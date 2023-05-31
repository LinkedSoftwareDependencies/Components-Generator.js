import type { ResolutionContext } from '../resolution/ResolutionContext';
import { joinFilePath } from '../util/PathUtil';
import type { GeneratorConfig } from './GeneratorConfig';

/**
 * Loads the `.componentsjs-generator-config.json` config file from the file system.
 */
export class FileConfigLoader {
  public static readonly DEFAULT_CONFIG_NAME = '.componentsjs-generator-config.json';

  private readonly resolutionContext: ResolutionContext;

  public constructor(args: FileConfigLoaderArgs) {
    this.resolutionContext = args.resolutionContext;
  }

  /**
   * Get the closest config file, starting from the current working directory and following parent directory links.
   * @param cwd The current working directory
   */
  public async getClosestConfigFile(cwd: string): Promise<Partial<GeneratorConfig> | undefined> {
    for (const directory of this.getConsideredDirectories(cwd)) {
      const configPath = joinFilePath(directory, FileConfigLoader.DEFAULT_CONFIG_NAME);
      try {
        const textContents = await this.resolutionContext.getFileContent(configPath);
        return JSON.parse(textContents);
      } catch {
        // Ignore error
      }
    }
  }

  /**
   * All directories that need to be considered when looking for the config file.
   * @param cwd The current working directory
   */
  public getConsideredDirectories(cwd: string): string[] {
    // Since Windows paths can have `/` or `\` depending on the operations done so far
    // it is safest to split on both possible separators.
    const sections: string[] = cwd.split(/[/\\]/u);
    const paths: string[] = [];
    for (let i = sections.length; i > 1; i--) {
      // Slash is valid on both platforms and keeps results consistent
      paths.push(sections.slice(0, i).join('/'));
    }
    return paths;
  }
}

export interface FileConfigLoaderArgs {
  resolutionContext: ResolutionContext;
}
