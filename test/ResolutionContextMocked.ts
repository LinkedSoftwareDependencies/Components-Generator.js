/* istanbul ignore file */
import { Program } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ResolutionContext } from '../lib/resolution/ResolutionContext';

export class ResolutionContextMocked extends ResolutionContext {
  private readonly contentsOverrides: {[name: string]: string | Program};

  public constructor(contentsOverrides: {[name: string]: string | Program}) {
    super();
    this.contentsOverrides = contentsOverrides;
  }

  public async getFileContent(filePath: string): Promise<string> {
    if (!(filePath in this.contentsOverrides)) {
      throw new Error(`Could not find mocked path for ${filePath}`);
    }
    return <any> this.contentsOverrides[filePath];
  }

  public parseTypescriptContents(contents: string): Program {
    if (typeof contents !== 'string') {
      return contents;
    }
    return super.parseTypescriptContents(contents);
  }
}
