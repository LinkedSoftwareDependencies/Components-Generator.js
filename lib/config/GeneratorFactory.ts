import * as Path from 'path';
import type { LogLevel } from '../../../components';
import { Generator } from '../generate/Generator';
import type { ResolutionContext } from '../resolution/ResolutionContext';
import { FileConfigLoader } from './FileConfigLoader';
import type { GeneratorConfig } from './GeneratorConfig';

/**
 * Constructs a {@link Generator} with the proper configs.
 *
 * It will consider the following configs in order of priority:
 * * CLI arguments
 * * .componentsjs-generator-config.json
 * * Default values
 */
export class GeneratorFactory {
  private readonly resolutionContext: ResolutionContext;

  public constructor(args: GeneratorFactoryArgs) {
    this.resolutionContext = args.resolutionContext;
  }

  public async createGenerator(
    cwd: string,
    cliArgs: Record<string, any>,
    packageRootDirectories: string[],
  ): Promise<Generator> {
    const config = await this.getConfig(cwd, cliArgs);
    return new Generator({
      resolutionContext: this.resolutionContext,
      pathDestinations: packageRootDirectories
        .filter(packageRootDirectory => !config.ignorePackagePaths
          .some(ignorePackagePath => packageRootDirectory.startsWith(Path.join(cwd, ignorePackagePath))))
        .map(packageRootDirectory => ({
          packageRootDirectory,
          originalPath: Path.posix.join(packageRootDirectory, config.source),
          replacementPath: Path.posix.join(packageRootDirectory, config.destination),
        })),
      fileExtension: config.extension,
      logLevel: <LogLevel> config.logLevel,
      debugState: config.debugState,
      prefixes: config.modulePrefix,
      ignoreClasses: config.ignoreComponents.reduce((acc: Record<string, boolean>, entry: string) => {
        acc[entry] = true;
        return acc;
      }, {}),
    });
  }

  public async getConfig(cwd: string, cliArgs: Record<string, any>): Promise<GeneratorConfig> {
    const defaultConfig = this.getDefaultConfig();
    const fileConfig = await new FileConfigLoader({ resolutionContext: this.resolutionContext })
      .getClosestConfigFile(cwd);
    const cliConfig = await this.getCliConfig(cliArgs);
    return {
      ...defaultConfig,
      ...fileConfig,
      ...cliConfig,
    };
  }

  public getDefaultConfig(): GeneratorConfig {
    return {
      source: 'lib',
      destination: 'components',
      extension: 'jsonld',
      ignorePackagePaths: [],
      ignoreComponents: [],
      logLevel: 'info',
      modulePrefix: undefined,
      debugState: false,
    };
  }

  public async getCliConfig(cliArgs: Record<string, any>): Promise<Partial<GeneratorConfig>> {
    const config: Partial<GeneratorConfig> = {};
    if (cliArgs.s) {
      config.source = cliArgs.s;
    }
    if (cliArgs.c) {
      config.destination = cliArgs.c;
    }
    if (cliArgs.e) {
      config.extension = cliArgs.e;
    }
    if (cliArgs.i) {
      config.ignoreComponents = JSON.parse(await this.resolutionContext.getFileContent(cliArgs.i));
    }
    if (cliArgs.l) {
      config.logLevel = cliArgs.l;
    }
    if (cliArgs.r) {
      config.modulePrefix = cliArgs.r;
    }
    if (cliArgs.debugState) {
      config.debugState = cliArgs.debugState;
    }
    return config;
  }
}

export interface GeneratorFactoryArgs {
  resolutionContext: ResolutionContext;
}
