import { ComponentsManagerBuilder } from 'componentsjs/lib/loading/ComponentsManagerBuilder';
import { PrefetchedDocumentLoader } from 'componentsjs/lib/rdf/PrefetchedDocumentLoader';
import type { LogLevel } from 'componentsjs/lib/util/LogLevel';
import { ContextParser } from 'jsonld-context-parser';
import { BulkPackageMetadataLoader } from '../parse/BulkPackageMetadataLoader';
import { ClassFinder } from '../parse/ClassFinder';
import { ClassIndexer } from '../parse/ClassIndexer';
import { ClassLoader } from '../parse/ClassLoader';
import { CommentLoader } from '../parse/CommentLoader';
import { ConstructorLoader } from '../parse/ConstructorLoader';
import type { PackageMetadata } from '../parse/PackageMetadataLoader';
import { PackageMetadataLoader } from '../parse/PackageMetadataLoader';
import { ParameterResolver } from '../parse/ParameterResolver';
import { ExternalModulesLoader } from '../resolution/ExternalModulesLoader';
import type { ResolutionContext } from '../resolution/ResolutionContext';
import type { PathDestinationDefinition } from '../serialize/ComponentConstructor';
import { ComponentConstructor } from '../serialize/ComponentConstructor';
import { ComponentSerializer } from '../serialize/ComponentSerializer';
import { ContextConstructor } from '../serialize/ContextConstructor';

/**
 * Generates a components file by parsing a typescript file.
 */
export class Generator {
  private readonly resolutionContext: ResolutionContext;
  private readonly pathDestinations: PathDestinationDefinition[];
  private readonly fileExtension: string;
  private readonly ignoreClasses: Record<string, boolean>;
  private readonly typeScopedContexts: boolean;
  private readonly logLevel: LogLevel;
  private readonly debugState: boolean;
  private readonly prefixes?: string | Record<string, string>;

  public constructor(args: GeneratorArgs) {
    this.resolutionContext = args.resolutionContext;
    this.pathDestinations = args.pathDestinations;
    this.fileExtension = args.fileExtension;
    this.ignoreClasses = args.ignoreClasses;
    this.typeScopedContexts = args.typeScopedContexts;
    this.logLevel = args.logLevel;
    this.debugState = args.debugState;
    this.prefixes = args.prefixes;
  }

  public async generateComponents(): Promise<void> {
    const logger = ComponentsManagerBuilder.createLogger(this.logLevel);

    const commentLoader = new CommentLoader();
    const classLoader = new ClassLoader({ resolutionContext: this.resolutionContext, logger, commentLoader });
    const classFinder = new ClassFinder({ classLoader });
    const classIndexer = new ClassIndexer({ classLoader, classFinder, ignoreClasses: this.ignoreClasses, logger });

    // Preload package metadata for all provided paths
    const { packageMetadatas, pathMetadatas } = await new BulkPackageMetadataLoader({
      packageMetadataLoader: new PackageMetadataLoader({
        resolutionContext: this.resolutionContext,
        prefixes: this.prefixes,
      }),
      logger,
      typeScopedContexts: this.typeScopedContexts,
    }).load(this.pathDestinations);

    // Generate components for all provided paths
    for (const pathDestination of this.pathDestinations) {
      // Load package metadata
      const packageMetadata: PackageMetadata = pathMetadatas[pathDestination.packageRootDirectory];
      if (!packageMetadata) {
        continue;
      }

      // Find all relevant classes
      const packageExports = await classFinder.getPackageExports(packageMetadata.name, packageMetadata.typesPath);
      const classAndInterfaceIndex = await classIndexer.createIndex(packageExports);

      // Load constructor data
      const constructorsUnresolved = new ConstructorLoader({ commentLoader }).getConstructors(classAndInterfaceIndex);
      const constructors = await new ParameterResolver({
        classLoader,
        commentLoader,
        ignoreClasses: this.ignoreClasses,
      }).resolveAllConstructorParameters(constructorsUnresolved);

      // Load external components
      const externalModulesLoader = new ExternalModulesLoader({
        pathDestination,
        packageMetadata,
        packagesBeingGenerated: packageMetadatas,
        resolutionContext: this.resolutionContext,
        debugState: this.debugState,
        logger,
      });
      const externalPackages = externalModulesLoader.findExternalPackages(classAndInterfaceIndex, constructors);
      const externalComponents = await externalModulesLoader.loadExternalComponents(require, externalPackages);

      // Create components
      const contextConstructor = new ContextConstructor({
        packageMetadata,
        typeScopedContexts: this.typeScopedContexts,
      });
      const componentConstructor = new ComponentConstructor({
        packageMetadata,
        contextConstructor,
        pathDestination,
        classAndInterfaceIndex,
        classConstructors: constructors,
        externalComponents,
        contextParser: new ContextParser({
          documentLoader: new PrefetchedDocumentLoader({
            contexts: externalComponents.moduleState.contexts,
            logger,
          }),
          skipValidation: true,
        }),
      });
      const components = await componentConstructor.constructComponents();
      const componentsIndex = await componentConstructor.constructComponentsIndex(components, this.fileExtension);

      // Serialize components
      const componentSerializer = new ComponentSerializer({
        resolutionContext: this.resolutionContext,
        pathDestination,
        fileExtension: this.fileExtension,
        indentation: '  ',
      });
      await componentSerializer.serializeComponents(components);
      await componentSerializer.serializeComponentsIndex(componentsIndex);

      // Serialize context
      const context = contextConstructor.constructContext(components);
      await componentSerializer.serializeContext(context);
    }
  }
}

export interface GeneratorArgs {
  resolutionContext: ResolutionContext;
  pathDestinations: PathDestinationDefinition[];
  fileExtension: string;
  ignoreClasses: Record<string, boolean>;
  typeScopedContexts: boolean;
  logLevel: LogLevel;
  debugState: boolean;
  prefixes?: string | Record<string, string>;
}
