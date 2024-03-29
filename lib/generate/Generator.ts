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
import { GenericsLoader } from '../parse/GenericsLoader';
import { MemberLoader } from '../parse/MemberLoader';
import type { PackageMetadata } from '../parse/PackageMetadataLoader';
import { PackageMetadataLoader } from '../parse/PackageMetadataLoader';
import { ParameterLoader } from '../parse/ParameterLoader';
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
  private readonly logLevel: LogLevel;
  private readonly debugState: boolean;
  private readonly prefixes?: string | Record<string, string>;
  private readonly hardErrorUnsupported: boolean;

  public constructor(args: GeneratorArgs) {
    this.resolutionContext = args.resolutionContext;
    this.pathDestinations = args.pathDestinations;
    this.fileExtension = args.fileExtension;
    this.ignoreClasses = args.ignoreClasses;
    this.logLevel = args.logLevel;
    this.debugState = args.debugState;
    this.prefixes = args.prefixes;
    this.hardErrorUnsupported = args.hardErrorUnsupported;
  }

  public async generateComponents(): Promise<void> {
    const logger = ComponentsManagerBuilder.createLogger(this.logLevel);

    const commentLoader = new CommentLoader();
    const classLoader = new ClassLoader({ resolutionContext: this.resolutionContext, logger, commentLoader });
    const classFinder = new ClassFinder({ classLoader });
    const classIndexer = new ClassIndexer({ classLoader, classFinder, ignoreClasses: this.ignoreClasses, logger });
    const parameterLoader = new ParameterLoader({
      commentLoader,
      hardErrorUnsupported: this.hardErrorUnsupported,
      logger,
    });
    const parameterResolver = new ParameterResolver({
      classLoader,
      parameterLoader,
      ignoreClasses: this.ignoreClasses,
    });

    // Preload package metadata for all provided paths
    const { packageMetadatas, pathMetadatas } = await new BulkPackageMetadataLoader({
      packageMetadataLoader: new PackageMetadataLoader({
        resolutionContext: this.resolutionContext,
        prefixes: this.prefixes,
      }),
      logger,
    }).load(this.pathDestinations);

    logger.info(`Generating components for ${Object.keys(packageMetadatas).length} package${Object.keys(packageMetadatas).length > 1 ? 's' : ''}`);

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
      const constructorsUnresolved = new ConstructorLoader({ parameterLoader }).getConstructors(classAndInterfaceIndex);
      const constructors = await parameterResolver.resolveAllConstructorParameters(constructorsUnresolved);

      // Load generics data
      const genericsUnresolved = new GenericsLoader({ parameterLoader }).getGenerics(classAndInterfaceIndex);
      const generics = await parameterResolver.resolveAllGenericTypeParameterData(genericsUnresolved);

      // Load extensions data
      const extensionsUnresolved = parameterLoader.loadAllExtensionData(classAndInterfaceIndex);
      const extensions = await parameterResolver.resolveAllExtensionData(extensionsUnresolved, classAndInterfaceIndex);

      // Load members data
      const membersUnresolved = new MemberLoader({ parameterLoader }).getMembers(classAndInterfaceIndex);
      const members = await parameterResolver.resolveAllMemberParameterData(membersUnresolved);

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
      const contextConstructor = new ContextConstructor({ packageMetadata });
      const componentConstructor = new ComponentConstructor({
        packageMetadata,
        fileExtension: this.fileExtension,
        contextConstructor,
        pathDestination,
        classAndInterfaceIndex,
        classConstructors: constructors,
        classGenerics: generics,
        classExtensions: extensions,
        classMembers: members,
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
      const componentsIndex = await componentConstructor.constructComponentsIndex(components);

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
  logLevel: LogLevel;
  debugState: boolean;
  prefixes?: string | Record<string, string>;
  hardErrorUnsupported: boolean;
}
