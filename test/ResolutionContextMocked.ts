/* istanbul ignore file */
import { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { ResolutionContext } from '../lib/resolution/ResolutionContext';

export class ResolutionContextMocked extends ResolutionContext {
  public contentsOverrides: {[name: string]: string | AST<TSESTreeOptions>};

  public constructor(contentsOverrides: {[name: string]: string | AST<TSESTreeOptions>}) {
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
    } catch (error) {
      throw new Error(`Could not parse file ${filePath}, invalid syntax at line ${error.lineNumber}, column ${error.column}. Message: ${error.message}`);
    }
  }
}
