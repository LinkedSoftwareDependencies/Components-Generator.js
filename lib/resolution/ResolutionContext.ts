import * as fs from 'fs';
import * as Path from 'path';
import type { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { parse } from '@typescript-eslint/typescript-estree';
import * as LRUCache from 'lru-cache';

/**
 * Context for loading files.
 */
export class ResolutionContext {
  private readonly parsedCache: LRUCache<string, AST<TSESTreeOptions>>;

  public constructor() {
    this.parsedCache = new LRUCache(2_048);
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
  public parseTypescriptContents(contents: string): AST<TSESTreeOptions> {
    return parse(contents, { loc: true, comment: true });
  }

  /**
   * Parse a given typescript file into an abstract syntax tree.
   * This method has a built-in cache, so repeated calls for the same file are safe.
   * @param filePath A typescript file path, without extension.
   * @return An abstract syntax tree.
   */
  public async parseTypescriptFile(filePath: string): Promise<AST<TSESTreeOptions>> {
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
    } catch (error: unknown) {
      throw new Error(`Could not parse file ${filePath}, invalid syntax at line ${(<any> error).lineNumber}, column ${(<any> error).column}. Message: ${(<Error> error).message}`);
    }
  }

  /**
   * Determine the path to the index file of the given package.
   * @param packageName A package name.
   * @param currentFilePath The file from which resolution should start.
   *                        The requested package has to be a dependency of this file's package.
   */
  public resolvePackageIndex(packageName: string, currentFilePath: string): string {
    try {
      // First check if we have an @types package
      const packageJsonPath = require.resolve(
        `@types/${packageName}/package.json`,
        { paths: [ currentFilePath ]},
      );
      return Path.join(Path.dirname(packageJsonPath), require(packageJsonPath).types);
    } catch {
      // Otherwise, fallback to the actual package
      return require.resolve(packageName, { paths: [ currentFilePath ]});
    }
  }
}
