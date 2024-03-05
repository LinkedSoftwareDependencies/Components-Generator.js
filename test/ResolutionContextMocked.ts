/* istanbul ignore file */
import type { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { ResolutionContext } from '../lib/resolution/ResolutionContext';
import { normalizeFilePath } from '../lib/util/PathUtil';

export class ResolutionContextMocked extends ResolutionContext {
  public contentsOverrides: Record<string, string | AST<TSESTreeOptions>>;
  public packageNameIndexOverrides: Record<string, string>;

  public constructor(
    contentsOverrides: Record<string, string | AST<TSESTreeOptions>>,
    packageNameIndexOverrides: Record<string, string> = {},
  ) {
    super();
    this.contentsOverrides = contentsOverrides;
    this.packageNameIndexOverrides = packageNameIndexOverrides;
  }

  public resolveTypesPath(filePath: string): Promise<string> {
    return new Promise((resolve) => {
      if (!(`${filePath}.d.ts` in this.contentsOverrides)) {
        return resolve(normalizeFilePath(`${filePath}/index`));
      }
      resolve(filePath);
    });
  }

  public async getFileContent(filePath: string): Promise<string> {
    if (!(filePath in this.contentsOverrides)) {
      throw new Error(`Could not find mocked path for ${filePath}`);
    }
    return <any> this.contentsOverrides[filePath];
  }

  public async writeFileContent(filePath: string, content: string): Promise<void> {
    this.contentsOverrides[filePath] = content;
  }

  public parseTypescriptContents(contents: string): AST<TSESTreeOptions> {
    if (typeof contents !== 'string') {
      return contents;
    }
    return super.parseTypescriptContents(contents);
  }

  public async parseTypescriptFile(filePath: string): Promise<AST<TSESTreeOptions>> {
    const indexContent = await this.getTypeScriptFileContent(filePath);
    try {
      return this.parseTypescriptContents(indexContent);
    } catch (error: unknown) {
      throw new Error(`Could not parse file ${filePath}, invalid syntax at line ${(<any> error).lineNumber}, column ${(<any> error).column}. Message: ${(<Error> error).message}`);
    }
  }

  public resolvePackageIndex(packageName: string, currentFilePath: string): string {
    const filePath = this.packageNameIndexOverrides[packageName];
    if (!filePath) {
      throw new Error(`Could not resolve '${packageName}' from path '${currentFilePath}'`);
    }
    return filePath;
  }
}
