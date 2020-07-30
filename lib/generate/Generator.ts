/* eslint-disable @typescript-eslint/no-require-imports */
import { logger } from '../Core';
import { ClassFinder } from '../parse/ClassFinder';
import { ClassLoader } from '../parse/ClassLoader';
import { ResolutionContext } from '../resolution/ResolutionContext';

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
    const classLoader = new ClassLoader({ resolutionContext: this.resolutionContext });
    const classFinder = new ClassFinder({ classLoader });

    const packageExports = await classFinder.getPackageExports(this.packageRootDirectory);
    // Const classIndex = await classLoader.loadClasses(packageExports);
    // Const constructors = await new ConstructorLoader({ resolutionContext: this.resolutionContext })
    //  .getConstructors(packageExports);
    return packageExports;
  }
}

export interface GeneratorArgs {
  resolutionContext: ResolutionContext;
  packageRootDirectory: string;
  moduleRoot: string;
  level: string;
}
