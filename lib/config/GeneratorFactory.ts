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

  public async createGenerator(packageRootDirectory: string, cliArgs: Record<string, any>): Promise<Generator> {
    const config = await this.getConfig(packageRootDirectory, cliArgs);
    return new Generator({
      resolutionContext: this.resolutionContext,
      pathDestination: {
        packageRootDirectory,
        originalPath: Path.posix.join(packageRootDirectory, config.source),
        replacementPath: Path.posix.join(packageRootDirectory, config.destination),
      },
      fileExtension: config.extension,
      typeScopedContexts: config.typeScopedContexts,
      logLevel: <LogLevel> config.logLevel,
      debugState: config.debugState,
      prefix: config.modulePrefix,
      ignoreClasses: config.ignoreComponents.reduce((acc: Record<string, boolean>, entry: string) => {
        acc[entry] = true;
        return acc;
      }, {}),
    });
  }

  public async getConfig(packageRootDirectory: string, cliArgs: Record<string, any>): Promise<GeneratorConfig> {
    const defaultConfig = this.getDefaultConfig();
    const fileConfig = await new FileConfigLoader({ resolutionContext: this.resolutionContext })
      .getClosestConfigFile(packageRootDirectory);
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
      ignoreComponents: [],
      logLevel: 'info',
      modulePrefix: undefined,
      debugState: false,
      typeScopedContexts: false,
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
    if (cliArgs.typeScopedContexts) {
      config.typeScopedContexts = cliArgs.typeScopedContexts;
    }
    return config;
  }
}

export interface GeneratorFactoryArgs {
  resolutionContext: ResolutionContext;
}
