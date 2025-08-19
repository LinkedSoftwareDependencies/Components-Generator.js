import * as fs from 'node:fs';
import type { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { parse } from '@typescript-eslint/typescript-estree';
import { LRUCache } from 'lru-cache';
import { filePathDirName, joinFilePath, normalizeFilePath } from '../util/PathUtil';

/**
 * Context for loading files.
 */
export class ResolutionContext {
  private readonly parsedCache: LRUCache<string, AST<TSESTreeOptions>>;

  public constructor() {
    this.parsedCache = new LRUCache({ max: 2_048 });
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
   * Resolve the correct type declarations path for a specific path used
   * in the exports.
   *
   * @param {string} filePath File path without .d.ts
   * @returns {Promise<string>} Promise of the file path without .d.ts that is
   *  either equal to the parameter or the index of the directory.
   */
  public resolveTypesPath(filePath: string): Promise<string> {
    return new Promise((resolve) => {
      fs.access(`${filePath}.d.ts`, (error) => {
        if (error) {
          // No file found, treat as directory with an index
          filePath = normalizeFilePath(`${filePath}/index`);
        }
        resolve(filePath);
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
    await new Promise<void>((resolve, reject) => {
      fs.mkdir(filePathDirName(filePath), { recursive: true }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      fs.writeFile(filePath, content, 'utf8', (error) => {
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
   * @return - An abstract syntax tree.
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
      return this.resolvePackageIndexInner(require, `@types/${packageName}`, currentFilePath);
    } catch {
      try {
        // Fallback to the actual package
        return this.resolvePackageIndexInner(require, packageName, currentFilePath);
      } catch {
        // As final fallback, check if the package is a valid Node.js built-in like 'stream'.
        require.resolve(packageName, { paths: [ currentFilePath ]});

        // If so, require the Node.js types, and resolve the file for the built-in package
        const rootFile = this.resolvePackageIndexInner(require, `@types/node`, currentFilePath);
        const result = rootFile.replace(/index\.d\.ts$/u, `${packageName}.d.ts`);
        // eslint-disable-next-line no-sync
        if (!fs.existsSync(result)) {
          throw new Error(`Could not dereference path ${result}.
In case the listed package is not a Node.js type, you might have an issue with dual packaging:
Your export should list your package.json explicitly.`);
        }
        return result;
      }
    }
  }

  public resolvePackageIndexInner(req: NodeJS.Require, packageName: string, currentFilePath: string): string {
    const packageJsonPath = req.resolve(
      `${packageName}/package.json`,
      { paths: [ currentFilePath ]},
    );
    const packageJson = req(packageJsonPath);
    let typesPath = packageJson.types || packageJson.typings || packageJson.main.replace(/\.js$/u, '.d.ts');
    if (!typesPath.endsWith('.d.ts')) {
      typesPath += '.d.ts';
    }
    return joinFilePath(filePathDirName(packageJsonPath), <string> typesPath);
  }
}
