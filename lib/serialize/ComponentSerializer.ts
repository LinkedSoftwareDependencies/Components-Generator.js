import { ResolutionContext } from '../resolution/ResolutionContext';
import { ComponentDefinitions } from './ComponentDefinitions';

/**
 * Serializes components to files.
 */
export class ComponentSerializer {
  private readonly resolutionContext: ResolutionContext;
  private readonly fileExtension: string;
  private readonly indentation: string;

  public constructor(args: ComponentSerializerArgs) {
    this.resolutionContext = args.resolutionContext;
    this.fileExtension = args.fileExtension;
    this.indentation = args.indentation;
  }

  /**
   * Serialize the given components to files.
   * @param components Component definitions.
   */
  public async serializeComponents(components: ComponentDefinitions): Promise<string[]> {
    const createdFiles: string[] = [];

    for (const [ fileNameBase, component ] of Object.entries(components)) {
      const filePath = `${fileNameBase}.${this.fileExtension}`;
      createdFiles.push(filePath);
      await this.resolutionContext.writeFileContent(
        filePath,
        JSON.stringify(component, null, this.indentation),
      );
    }

    return createdFiles;
  }
}

export interface ComponentSerializerArgs {
  resolutionContext: ResolutionContext;
  fileExtension: string;
  indentation: string;
}
