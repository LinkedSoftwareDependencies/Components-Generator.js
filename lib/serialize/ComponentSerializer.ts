import * as Path from 'path';
import { ResolutionContext } from '../resolution/ResolutionContext';
import { PathDestinationDefinition } from './ComponentConstructor';
import { ComponentDefinitions, ComponentDefinitionsIndex } from './ComponentDefinitions';

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

  /**
   * Serialize the given components to files.
   * @param components Component definitions.
   * @return An array of absolute file paths that were created.
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

  /**
   * Serialize the given components index to a file.
   * @param componentsIndex Component definitions index.
   * @return The absolute file path that was created.
   */
  public async serializeComponentsIndex(componentsIndex: ComponentDefinitionsIndex): Promise<string> {
    const filePath = Path.join(
      this.pathDestination.packageRootDirectory,
      this.pathDestination.replacementPath,
      `components.${this.fileExtension}`,
    );
    await this.resolutionContext.writeFileContent(
      filePath,
      JSON.stringify(componentsIndex, null, this.indentation),
    );
    return filePath;
  }
}

export interface ComponentSerializerArgs {
  resolutionContext: ResolutionContext;
  pathDestination: PathDestinationDefinition;
  fileExtension: string;
  indentation: string;
}
