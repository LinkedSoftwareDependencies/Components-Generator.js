import * as fs from 'fs';
import * as Path from 'path';
import * as parser from '@typescript-eslint/typescript-estree';
import { Program } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import * as LRUCache from 'lru-cache';

/**
 * Context for loading files.
 */
export class ResolutionContext {
  private readonly parsedCache: LRUCache<string, Program>;

  public constructor() {
    this.parsedCache = new LRUCache(2048);
  }

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
   * Write the content of a file.
   * If any of the underlying directories do not exist, they will be created.
   *
   * @param filePath The file path.
   * @param content The content of the file.
   */
  public async writeFileContent(filePath: string, content: string): Promise<void> {
    await new Promise((resolve, reject) => {
      fs.mkdir(Path.dirname(filePath), { recursive: true }, error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    await new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, 'utf8', error => {
        if (error) {
          reject(error);
        } else {
          resolve();
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
   * This method has a built-in cache, so repeated calls for the same file are safe.
   * @param filePath A typescript file path, without extension.
   * @return An abstract syntax tree.
   */
  public async parseTypescriptFile(filePath: string): Promise<Program> {
    // First check cache
    const cached = this.parsedCache.get(filePath);
    if (cached) {
      return cached;
    }

    const indexContent = await this.getTypeScriptFileContent(filePath);
    try {
      const parsed = this.parseTypescriptContents(indexContent);
      this.parsedCache.set(filePath, parsed);
      return parsed;
    } catch (error) {
      throw new Error(`Could not parse file ${filePath}, invalid syntax at line ${error.lineNumber}, column ${error.column}. Message: ${error.message}`);
    }
  }
}
