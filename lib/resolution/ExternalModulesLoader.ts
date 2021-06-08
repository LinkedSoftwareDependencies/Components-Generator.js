import type { IModuleState } from 'componentsjs';
import {
  ModuleStateBuilder,
  ComponentsManagerBuilder,
  ComponentRegistryFinalizer,
  ComponentRegistry,
} from 'componentsjs';
import type { Resource } from 'rdf-object';
import type { Logger } from 'winston';
import type { ClassIndex, ClassReferenceLoaded } from '../parse/ClassIndex';
import type { ConstructorData } from '../parse/ConstructorLoader';
import type { PackageMetadata } from '../parse/PackageMetadataLoader';
import type { ParameterData, ParameterRangeResolved } from '../parse/ParameterLoader';
import type { PathDestinationDefinition } from '../serialize/ComponentConstructor';

/**
 * Loads components from Node modules.
 */
export class ExternalModulesLoader {
  private readonly pathDestination: PathDestinationDefinition;
  private readonly packageMetadata: PackageMetadata;
  private readonly logger: Logger;

  public constructor(args: ExternalModulesLoaderArgs) {
    this.pathDestination = args.pathDestination;
    this.packageMetadata = args.packageMetadata;
    this.logger = args.logger;
  }

  /**
   * Determine packages referred to by components.
   * @param classIndex The available classes.
   * @param constructors The available constructors.
   */
  public findExternalPackages(
    classIndex: ClassIndex<ClassReferenceLoaded>,
    constructors: ClassIndex<ConstructorData<ParameterRangeResolved>>,
  ): string[] {
    const externalPackages: Record<string, boolean> = {};

    // Handle super classes
    for (const classReference of Object.values(classIndex)) {
      this.indexClassInExternalPackage(classReference, externalPackages);
    }

    // Handle constructor parameters
    for (const ctor of Object.values(constructors)) {
      for (const parameter of ctor.parameters) {
        this.indexParameterInExternalPackage(parameter, externalPackages);
      }
    }

    return Object.keys(externalPackages);
  }

  public indexClassInExternalPackage(
    classReference: ClassReferenceLoaded,
    externalPackages: Record<string, boolean>,
  ): void {
    if (classReference.packageName !== this.packageMetadata.name) {
      externalPackages[classReference.packageName] = true;
    }
    if (classReference.type === 'class') {
      if (classReference.superClass) {
        this.indexClassInExternalPackage(classReference.superClass, externalPackages);
      }
      if (classReference.implementsInterfaces) {
        for (const iface of classReference.implementsInterfaces) {
          this.indexClassInExternalPackage(iface, externalPackages);
        }
      }
    }
  }

  public indexParameterInExternalPackage(
    parameter: ParameterData<ParameterRangeResolved>,
    externalPackages: Record<string, boolean>,
  ): void {
    switch (parameter.range.type) {
      case 'raw':
      case 'override':
      case 'undefined':
        break;
      case 'class':
        this.indexClassInExternalPackage(parameter.range.value, externalPackages);
        break;
      case 'nested':
        for (const nestedParameter of parameter.range.value) {
          this.indexParameterInExternalPackage(nestedParameter, externalPackages);
        }
        break;
    }
  }

  /**
   * Build the module state.
   * Adapted from {@link ModuleStateBuilder#buildModuleState}.
   *
   * Instead of loading the modules for all available packages,
   * only the packages with their name included in the packageNames array are included.
   * This leads to better performance, as we usually need only a small subset of all packages.
   *
   * @param req The `require` instance.
   * @param packageNames Names of the packages to load.
   */
  public async buildModuleStateSelective(req: NodeJS.Require, packageNames: string[]): Promise<IModuleState> {
    const moduleStateBuilder = new ModuleStateBuilder(this.logger);
    const mainModulePath = this.pathDestination.packageRootDirectory;
    const nodeModuleImportPaths = moduleStateBuilder.buildNodeModuleImportPaths(mainModulePath);
    const nodeModulePaths = this.buildNodeModulePathsSelective(req, nodeModuleImportPaths, packageNames);
    const packageJsons = await moduleStateBuilder.buildPackageJsons(nodeModulePaths);
    await moduleStateBuilder.preprocessPackageJsons(packageJsons);
    const componentModules = await moduleStateBuilder.buildComponentModules(packageJsons);
    const contexts = await moduleStateBuilder.buildComponentContexts(packageJsons);
    const importPaths = await moduleStateBuilder.buildComponentImportPaths(packageJsons);
    return {
      mainModulePath,
      nodeModuleImportPaths,
      nodeModulePaths,
      packageJsons,
      componentModules,
      contexts,
      importPaths,
    };
  }

  /**
   * Get all currently available node module paths.
   * Adapted from {@link ModuleStateBuilder#buildNodeModulePaths}.
   * @param req The `require` instance.
   * @param nodeModuleImportPaths The import paths to resolve from.
   * @param packageNames The package names to resolve the path for.
   */
  public buildNodeModulePathsSelective(
    req: NodeJS.Require,
    nodeModuleImportPaths: string[],
    packageNames: string[],
  ): string[] {
    return packageNames
      .map(packageName => req
        .resolve(`${packageName}/package.json`, { paths: nodeModuleImportPaths })
        .slice(0, -13));
  }

  /**
   * Loads all components from the given Node package names.
   * @param req The `require` instance.
   * @param externalPackages
   */
  public async loadExternalComponents(req: NodeJS.Require, externalPackages: string[]): Promise<ExternalComponents> {
    // Load module state for the external packages
    const moduleState = await this.buildModuleStateSelective(req, externalPackages);

    // Load components for this module state (code inspired by ComponentsManagerBuilder from Components.js)
    const componentResources: Record<string, Resource> = {};
    const objectLoader = ComponentsManagerBuilder.createObjectLoader();
    const componentRegistry = new ComponentRegistry({
      moduleState,
      objectLoader,
      logger: this.logger,
      componentResources,
      skipContextValidation: true,
    });
    await componentRegistry.registerAvailableModules();
    const componentFinalizer = new ComponentRegistryFinalizer({
      objectLoader,
      logger: this.logger,
      componentResources,
      componentRegistry,
    });
    componentFinalizer.finalize();

    // Index available package.json by package name
    const packageJsons: Record<string, { contents: any; path: string }> = {};
    for (const [ path, packageJson ] of Object.entries(moduleState.packageJsons)) {
      packageJsons[packageJson.name] = { contents: packageJson, path };
    }

    // Index all loaded components
    const externalComponents: ExternalComponents = {
      moduleState,
      components: {},
    };
    for (const componentResource of Object.values(componentResources)) {
      const packageName = componentResource.property.module.property.requireName.value;

      // Initialize metadata for a package if it doesn't exist yet
      if (!externalComponents.components[packageName]) {
        const packageJson = packageJsons[packageName];
        if (!packageJson) {
          this.logger.warn(`Could not find a package.json for '${packageName}'`);
        } else {
          const contexts = packageJson.contents['lsd:contexts'];
          externalComponents.components[packageName] = {
            contextIris: Object.keys(contexts),
            componentNamesToIris: {},
          };
        }
      }

      // Add component to package
      if (externalComponents.components[packageName]) {
        externalComponents.components[packageName]
          .componentNamesToIris[componentResource.property.requireElement.value] = componentResource.value;
      }
    }

    return externalComponents;
  }
}

/**
 * Data object for external components.
 */
export interface ExternalComponents {
  /**
   * Module state.
   */
  moduleState: IModuleState;
  /**
   * Maps package name to exported class name to component IRI.
   */
  components: Record<string, {
    contextIris: string[];
    componentNamesToIris: Record<string, string>;
  }>;
}

export interface ExternalModulesLoaderArgs {
  pathDestination: PathDestinationDefinition;
  packageMetadata: PackageMetadata;
  logger: Logger;
}
