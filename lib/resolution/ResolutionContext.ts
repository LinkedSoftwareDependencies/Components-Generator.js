import * as fs from 'fs';
import * as parser from '@typescript-eslint/typescript-estree';
import { Program } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';

/**
 * Context for loading files.
 */
export class ResolutionContext {
  /**
   * Reads the content of a file
   * @param filePath The file path
   * @return The content of the file
   */
  public getFileContent(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Gets the content of a TypeScript file based on its filepath without extension
   * @param filePath A typescript file path, without extension.
   * @return The content of the file
   */
  public async getTypeScriptFileContent(filePath: string): Promise<string> {
    return this.getFileContent(`${filePath}.d.ts`);
  }

  /**
   * Parse the given typescript contents into an abstract syntax tree.
   * @param contents Typescript file contents.
   * @return An abstract syntax tree.
   */
  public parseTypescriptContents(contents: string): Program {
    return parser.parse(contents, { loc: true, comment: true });
  }

  /**
   * Parse a given typescript file into an abstract syntax tree.
   * @param filePath A typescript file path, without extension.
   * @return An abstract syntax tree.
   */
  public async parseTypescriptFile(filePath: string): Promise<Program> {
    const indexContent = await this.getTypeScriptFileContent(filePath);
    try {
      return this.parseTypescriptContents(indexContent);
    } catch (error) {
      throw new Error(`Could not parse file ${filePath}, invalid syntax at line ${error.lineNumber}, column ${error.column}. Message: ${error.message}`);
    }
  }
}
