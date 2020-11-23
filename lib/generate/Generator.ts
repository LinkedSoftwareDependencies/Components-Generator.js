import { ContextParser } from 'jsonld-context-parser';
import { ClassFinder } from '../parse/ClassFinder';
import { ClassIndexer } from '../parse/ClassIndexer';
import { ClassLoader } from '../parse/ClassLoader';
import { ConstructorLoader } from '../parse/ConstructorLoader';
import { PackageMetadataLoader } from '../parse/PackageMetadataLoader';
import { ParameterResolver } from '../parse/ParameterResolver';
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
  private readonly pathDestination: PathDestinationDefinition;
  private readonly fileExtension: string;
  private readonly ignoreClasses: Record<string, boolean>;

  public constructor(args: GeneratorArgs) {
    this.resolutionContext = args.resolutionContext;
    this.pathDestination = args.pathDestination;
    this.fileExtension = args.fileExtension;
    this.ignoreClasses = args.ignoreClasses;
  }

  public async generateComponents(): Promise<void> {
    // Load package metadata
    const packageMetadata = await new PackageMetadataLoader({ resolutionContext: this.resolutionContext })
      .load(this.pathDestination.packageRootDirectory);

    const classLoader = new ClassLoader({ resolutionContext: this.resolutionContext });
    const classFinder = new ClassFinder({ classLoader });
    const classIndexer = new ClassIndexer({ classLoader, classFinder, ignoreClasses: this.ignoreClasses });

    // Find all relevant classes
    const packageExports = await classFinder.getPackageExports(packageMetadata.typesPath);
    const classIndex = await classIndexer.createIndex(packageExports);

    // Load constructor data
    const constructorsUnresolved = new ConstructorLoader().getConstructors(classIndex);
    const constructors = await new ParameterResolver({ classLoader })
      .resolveAllConstructorParameters(constructorsUnresolved, classIndex);

    // Create components
    const contextConstructor = new ContextConstructor({ packageMetadata });
    const componentConstructor = new ComponentConstructor({
      packageMetadata,
      contextConstructor,
      pathDestination: this.pathDestination,
      classReferences: classIndex,
      classConstructors: constructors,
      contextParser: new ContextParser(),
    });
    const components = await componentConstructor.constructComponents();
    const componentsIndex = await componentConstructor.constructComponentsIndex(components, this.fileExtension);

    // Serialize components
    const componentSerializer = new ComponentSerializer({
      resolutionContext: this.resolutionContext,
      pathDestination: this.pathDestination,
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

export interface GeneratorArgs {
  resolutionContext: ResolutionContext;
  pathDestination: PathDestinationDefinition;
  fileExtension: string;
  level: string;
  ignoreClasses: Record<string, boolean>;
}
