/* eslint-disable @typescript-eslint/no-require-imports */
import { ContextParser } from 'jsonld-context-parser';
import { logger } from '../Core';
import { ClassFinder } from '../parse/ClassFinder';
import { ClassIndexer } from '../parse/ClassIndexer';
import { ClassLoader } from '../parse/ClassLoader';
import { ConstructorLoader } from '../parse/ConstructorLoader';
import { PackageMetadataLoader } from '../parse/PackageMetadataLoader';
import { ParameterResolver } from '../parse/ParameterResolver';
import { ResolutionContext } from '../resolution/ResolutionContext';
import { ComponentConstructor } from '../serialize/ComponentConstructor';

/**
 * Generates a components file by parsing a typescript file.
 */
export class Generator {
  private readonly resolutionContext: ResolutionContext;
  private readonly packageRootDirectory: string;
  private readonly moduleRoot: string;
  private readonly level: string;

  public constructor(args: GeneratorArgs) {
    this.resolutionContext = args.resolutionContext;
    this.packageRootDirectory = args.packageRootDirectory;
    this.moduleRoot = args.moduleRoot;
    this.level = args.level;
    logger.level = this.level;
  }

  public async generateComponents(): Promise<any> {
    // Load package metadata
    const packageMetadata = await new PackageMetadataLoader({ resolutionContext: this.resolutionContext })
      .load(this.packageRootDirectory);

    const classLoader = new ClassLoader({ resolutionContext: this.resolutionContext });
    const classFinder = new ClassFinder({ classLoader });
    const classIndexer = new ClassIndexer({ classLoader, classFinder });

    // Find all relevant classes
    const packageExports = await classFinder.getPackageExports(this.packageRootDirectory);
    const classIndex = await classIndexer.createIndex(packageExports);

    // Load constructor data
    const constructorsUnresolved = new ConstructorLoader().getConstructors(classIndex);
    const constructors = await new ParameterResolver({ classLoader })
      .resolveAllConstructorParameters(constructorsUnresolved, classIndex);

    // Create components
    const componentConstructor = new ComponentConstructor({
      packageMetadata,
      pathDestination: {
        packageRootDirectory: this.packageRootDirectory,
        originalPath: 'src',
        replacementPath: 'components',
      },
      classReferences: classIndex,
      classConstructors: constructors,
      contextParser: new ContextParser(),
    });
    const components = componentConstructor.constructComponents();

    // Serialize components
    // TODO

    return components;
  }
}

export interface GeneratorArgs {
  resolutionContext: ResolutionContext;
  packageRootDirectory: string;
  moduleRoot: string;
  level: string;
}
