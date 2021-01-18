import * as Path from 'path';
import type { ResolutionContext } from '../resolution/ResolutionContext';
import type { PathDestinationDefinition } from './ComponentConstructor';
import type { ComponentDefinitions, ComponentDefinitionsIndex } from './ComponentDefinitions';
import type { ContextRaw } from './ContextConstructor';

/**
 * Serializes components to files.
 */
export class ComponentSerializer {
  private readonly resolutionContext: ResolutionContext;
  private readonly pathDestination: PathDestinationDefinition;
  private readonly fileExtension: string;
  private readonly indentation: string;

  public constructor(args: ComponentSerializerArgs) {
    this.resolutionContext = args.resolutionContext;
    this.pathDestination = args.pathDestination;
    this.fileExtension = args.fileExtension;
    this.indentation = args.indentation;
  }

  protected async writeJsonToFile(fileNameBase: string, data: any): Promise<string> {
    const filePath = `${fileNameBase}.${this.fileExtension}`;
    await this.resolutionContext.writeFileContent(
      filePath,
      JSON.stringify(data, null, this.indentation),
    );
    return filePath;
  }

  /**
   * Serialize the given components to files.
   * @param components Component definitions.
   * @return An array of absolute file paths that were created.
   */
  public async serializeComponents(components: ComponentDefinitions): Promise<string[]> {
    const createdFiles: string[] = [];

    for (const [ fileNameBase, component ] of Object.entries(components)) {
      createdFiles.push(await this.writeJsonToFile(fileNameBase, component));
    }

    return createdFiles;
  }

  /**
   * Serialize the given components index to a file.
   * @param componentsIndex Component definitions index.
   * @return The absolute file path that was created.
   */
  public async serializeComponentsIndex(componentsIndex: ComponentDefinitionsIndex): Promise<string> {
    const filePathBase = Path.join(
      this.pathDestination.replacementPath,
      'components',
    );
    return await this.writeJsonToFile(filePathBase, componentsIndex);
  }

  /**
   * Serialize the given context to a file.
   * @param contextRaw JSON-LD context contents.
   * @return The absolute file path that was created.
   */
  public async serializeContext(contextRaw: ContextRaw): Promise<string> {
    const filePathBase = Path.join(
      this.pathDestination.replacementPath,
      'context',
    );
    return await this.writeJsonToFile(filePathBase, contextRaw);
  }
}

export interface ComponentSerializerArgs {
  resolutionContext: ResolutionContext;
  pathDestination: PathDestinationDefinition;
  fileExtension: string;
  indentation: string;
}
