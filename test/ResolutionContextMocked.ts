/* istanbul ignore file */
import type { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { ResolutionContext } from '../lib/resolution/ResolutionContext';

export class ResolutionContextMocked extends ResolutionContext {
  public contentsOverrides: Record<string, string | AST<TSESTreeOptions>>;

  public constructor(contentsOverrides: Record<string, string | AST<TSESTreeOptions>>) {
    super();
    this.contentsOverrides = contentsOverrides;
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
}
