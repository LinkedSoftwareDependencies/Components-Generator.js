import * as Path from 'path';
import type { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ClassLoader', () => {
  let resolutionContext: ResolutionContextMocked;
  let logger: any;
  let commentLoader: CommentLoader;
  let loader: ClassLoader;

  beforeEach(() => {
    resolutionContext = new ResolutionContextMocked({});
    logger = {
      debug: jest.fn(),
    };
    commentLoader = new CommentLoader();
    loader = new ClassLoader({ resolutionContext, logger, commentLoader });
  });

  describe('getSuperClass', () => {
    it('should return undefined on a class that is not extended', async() => {
      expect(loader.getSuperClassName(<any>(resolutionContext
        .parseTypescriptContents('class A{}')).body[0], 'file'))
        .toBeUndefined();
    });

    it('should return on a class that is extended', async() => {
      expect(loader.getSuperClassName(<any>(resolutionContext
        .parseTypescriptContents(`class A extends B{}`)).body[0], 'file'))
        .toEqual('B');
    });

    it('should error on a class that is extended via a namespace', async() => {
      expect(() => loader.getSuperClassName(<any>(resolutionContext
        .parseTypescriptContents(`class A extends x.B {}`)).body[0], 'file'))
        .toThrow(new Error('Namespaced superclasses are currently not supported: file on line 1 column 16'));
    });

    it('should error on a class that is extended anonymously', async() => {
      await expect(async() => loader.getSuperClassName(<any>(resolutionContext
        .parseTypescriptContents(`class A extends class {} {}`)).body[0], 'file'))
        .rejects.toThrow(new Error('Could not interpret type of superclass in file on line 1 column 16'));
    });
  });

  describe('getSuperInterfaceNames', () => {
    it('should return undefined on an interface that is not extended', async() => {
      expect(loader.getSuperInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents('interface A{}')).body[0], 'file'))
        .toEqual([]);
    });

    it('should return on an interface with one extension', async() => {
      expect(loader.getSuperInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents('interface A extends B{}')).body[0], 'file'))
        .toEqual([
          'B',
        ]);
    });

    it('should return on an interface with multiple extensions', async() => {
      expect(loader.getSuperInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents('interface A extends B, C, D{}')).body[0], 'file'))
        .toEqual([
          'B',
          'C',
          'D',
        ]);
    });

    it('should ignore on an interface that is extended anonymously', async() => {
      expect(loader.getSuperInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents('interface A extends {} {}')).body[0], 'file'))
        .toEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(`Ignored an interface expression of unknown type ObjectExpression on A`);
    });

    it('should ignore on an interface that is extended anonymously, but still handle other interfaces', async() => {
      expect(loader.getSuperInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents('interface A extends B, {}, D {}')).body[0], 'file'))
        .toEqual([
          'B',
          'D',
        ]);
      expect(logger.debug).toHaveBeenCalledWith(`Ignored an interface expression of unknown type ObjectExpression on A`);
    });
  });

  describe('getClassInterfaceNames', () => {
    it('should return undefined on a class that does not implement an interface', async() => {
      expect(loader.getClassInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents('class A{}')).body[0], 'file'))
        .toEqual([]);
    });

    it('should return on a class that implements one interface', async() => {
      expect(loader.getClassInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents('class A implements X {}')).body[0], 'file'))
        .toEqual([
          'X',
        ]);
    });

    it('should return on a class that multiple interfaces', async() => {
      expect(loader.getClassInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents('class A implements X, Y, Z {}')).body[0], 'file'))
        .toEqual([
          'X',
          'Y',
          'Z',
        ]);
    });

    it('should error on a class that is implemented anonymously', async() => {
      await expect(async() => loader.getClassInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents(`interface A implements {} {}`)).body[0], 'file'))
        .rejects.toThrow(new Error('Could not interpret the implements type on a class in file on line 1 column 23'));
    });
  });

  describe('loadClassDeclaration', () => {
    describe('when not considering interfaces', () => {
      it('for an empty file should throw', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': ``,
          }),
          logger,
          commentLoader,
        });
        await expect(loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .rejects.toThrow(new Error('Could not load class A from file'));
      });

      it('for a file without the file class should throw', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
const A = "a";
declare class B{};
export class C{};
export { B as X };
export * from './lib/D';
`,
          }),
          logger,
          commentLoader,
        });
        await expect(loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .rejects.toThrow(new Error('Could not load class A from file'));
      });

      it('for a file without the file class should throw, even if it exists as an interface', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
declare interface A{};
`,
          }),
          logger,
          commentLoader,
        });
        await expect(loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .rejects.toThrow(new Error('Could not load class A from file'));
      });

      it('for an exported class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export class A{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a declared class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `declare class A{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for an imported class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `import { B as A } from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via export import', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export { B as A } from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            fileNameReferenced: 'fileReferenced',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked on of the multiple export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
export * from './file1'
export * from './file2'
export * from './file3'
`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via nested export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export * from './file3'`,
            'file3.d.ts': `export * from './file4'`,
            'file4.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file4',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for an export assignment to namespace declaration with class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `namespace NS {
  class A{}
}
export = NS`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for an export assignment to empty namespace declaration', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `namespace NS{};
export = NS;`,
          }),
          logger,
          commentLoader,
        });
        await expect(loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false)).rejects
          .toThrow(`Could not load class A from file`);
      });
    });

    describe('when considering interfaces', () => {
      it('for an empty file should throw', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': ``,
          }),
          logger,
          commentLoader,
        });
        await expect(loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .rejects.toThrow(new Error('Could not load class or interface A from file'));
      });

      it('for a file without the file interface should throw', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
const A = "a";
declare interface B{};
export interface C{};
export { B as X };
export * from './lib/D';
`,
          }),
          logger,
          commentLoader,
        });
        await expect(loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .rejects.toThrow(new Error('Could not load class or interface A from file'));
      });

      it('for an exported class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export class A{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a declared class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `declare class A{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for an imported class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `import { B as A } from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via export import', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export { B as A } from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked on of the multiple export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
export * from './file1'
export * from './file2'
export * from './file3'
`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via nested export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export * from './file3'`,
            'file3.d.ts': `export * from './file4'`,
            'file4.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file4',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for an exported interface', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export interface A{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSInterfaceDeclaration',
            },
          });
      });

      it('for a declared interface', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `declare interface A{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSInterfaceDeclaration',
            },
          });
      });

      it('for an imported interface', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `import { B as A } from './file2'`,
            'file2.d.ts': `export interface B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'TSInterfaceDeclaration',
            },
          });
      });

      it('for an interface linked via export import', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export { B as A } from './file2'`,
            'file2.d.ts': `export interface B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'TSInterfaceDeclaration',
            },
          });
      });

      it('for an interface linked via export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export interface B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'TSInterfaceDeclaration',
            },
          });
      });

      it('for an interface linked on of the multiple export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
export * from './file1'
export * from './file2'
export * from './file3'
`,
            'file2.d.ts': `export interface B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'TSInterfaceDeclaration',
            },
          });
      });

      it('for a interface linked via nested export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export * from './file3'`,
            'file3.d.ts': `export * from './file4'`,
            'file4.d.ts': `export interface B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file4',
            declaration: {
              id: { name: 'B' },
              type: 'TSInterfaceDeclaration',
            },
          });
      });

      it('for an exported class with comment', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
/**
 * Hello world!
 */
export class A{}
`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
            comment: 'Hello world!',
          });
      });

      it('for a declared class with comment', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
/**
 * Hello world!
 */
declare class A{}
`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
            comment: 'Hello world!',
          });
      });

      it('for an exported interface with comment', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
/**
 * Hello world!
 */
export interface A{}
`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSInterfaceDeclaration',
            },
            comment: 'Hello world!',
          });
      });

      it('for a declared interface with comment', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
/**
 * Hello world!
 */
declare interface A{}
`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSInterfaceDeclaration',
            },
            comment: 'Hello world!',
          });
      });

      it('for an export assignment to namespace declaration with interface', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `namespace NS {
  interface A{}
}
export = NS`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, false))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSInterfaceDeclaration',
            },
          });
      });
    });

    describe('when considering types', () => {
      it('for an empty file should throw', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': ``,
          }),
          logger,
          commentLoader,
        });
        await expect(loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .rejects.toThrow(new Error('Could not load class or type A from file'));
      });

      it('for a file without the file type should throw', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
const A = "a";
declare type B = number;
export type C = number;
export { B as X };
export * from './lib/D';
`,
          }),
          logger,
          commentLoader,
        });
        await expect(loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .rejects.toThrow(new Error('Could not load class or type A from file'));
      });

      it('for an exported class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export class A{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a declared class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `declare class A{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for an imported class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `import { B as A } from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via export import', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export { B as A } from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked on of the multiple export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
export * from './file1'
export * from './file2'
export * from './file3'
`,
            'file2.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for a class linked via nested export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export * from './file3'`,
            'file3.d.ts': `export * from './file4'`,
            'file4.d.ts': `export class B{}`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file4',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });

      it('for an exported type', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export type A = number;`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSTypeAliasDeclaration',
            },
          });
      });

      it('for a declared type', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `declare type A = number;`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSTypeAliasDeclaration',
            },
          });
      });

      it('for an imported type', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `import { B as A } from './file2'`,
            'file2.d.ts': `export type B = number;`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'TSTypeAliasDeclaration',
            },
          });
      });

      it('for a type linked via export import', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export { B as A } from './file2'`,
            'file2.d.ts': `export type B = number;`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'TSTypeAliasDeclaration',
            },
          });
      });

      it('for a type linked via export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export type B = number;`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'TSTypeAliasDeclaration',
            },
          });
      });

      it('for a type linked on of the multiple export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
export * from './file1'
export * from './file2'
export * from './file3'
`,
            'file2.d.ts': `export type B = number;`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file2',
            declaration: {
              id: { name: 'B' },
              type: 'TSTypeAliasDeclaration',
            },
          });
      });

      it('for a type linked via nested export *', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export * from './file2'`,
            'file2.d.ts': `export * from './file3'`,
            'file3.d.ts': `export * from './file4'`,
            'file4.d.ts': `export type B = number;`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'B',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'B',
            fileName: 'file4',
            declaration: {
              id: { name: 'B' },
              type: 'TSTypeAliasDeclaration',
            },
          });
      });

      it('for an exported class with comment', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
/**
 * Hello world!
 */
export class A{}
`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
            comment: 'Hello world!',
          });
      });

      it('for a declared class with comment', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
/**
 * Hello world!
 */
declare class A{}
`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'ClassDeclaration',
            },
            comment: 'Hello world!',
          });
      });

      it('for an exported type with comment', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
/**
 * Hello world!
 */
export type A = number;
`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSTypeAliasDeclaration',
            },
            comment: 'Hello world!',
          });
      });

      it('for a declared type with comment', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
/**
 * Hello world!
 */
declare type A = number;
`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSTypeAliasDeclaration',
            },
            comment: 'Hello world!',
          });
      });

      it('for an export assignment to namespace declaration with type', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `namespace NS {
  type A = number
}
export = NS`,
          }),
          logger,
          commentLoader,
        });
        expect(await loader.loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, false, true))
          .toMatchObject({
            localName: 'A',
            fileName: 'file',
            declaration: {
              id: { name: 'A' },
              type: 'TSTypeAliasDeclaration',
            },
          });
      });
    });

    it('for an exported abstract class', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `export abstract class A{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          abstract: true,
        });
    });

    it('for a declared abstract class', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `declare abstract class A{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          abstract: true,
        });
    });

    it('for a declared class with one generic type', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `declare class A<T extends string>{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          generics: {
            T: { type: { type: 'TSStringKeyword' }},
          },
        });
    });

    it('for a declared class with one untyped generic type', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `declare class A<T>{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          generics: {
            T: {},
          },
        });
    });

    it('for a declared class with one generic type with default', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `declare class A<T extends string = number>{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          generics: {
            T: { type: { type: 'TSStringKeyword' }},
          },
        });
    });

    it('for an exported class with one generic type', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `export class A<T extends string>{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          generics: {
            T: { type: { type: 'TSStringKeyword' }},
          },
        });
    });

    it('for a declared interface with one generic type', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `declare interface A<T extends string>{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          generics: {
            T: { type: { type: 'TSStringKeyword' }},
          },
        });
    });

    it('for an exported interface with one generic type', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `export interface A<T extends string>{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          generics: {
            T: { type: { type: 'TSStringKeyword' }},
          },
        });
    });

    it('for a declared class with multiple generic types', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `declare class A<T extends string, U extends MyClass, V extends number>{}`,
        }),
        logger,
        commentLoader,
      });
      expect(await loader.loadClassDeclaration({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }, true, false))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          generics: {
            T: { type: { type: 'TSStringKeyword' }},
            U: { type: { type: 'TSTypeReference', typeName: { name: 'MyClass' }}},
            V: { type: { type: 'TSNumberKeyword' }},
          },
        });
    });
  });

  describe('loadClassElements', () => {
    it('for file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `declare class A{}`,
      };
      expect(await loader.loadClassElements('package', 'file'))
        .toMatchObject({
          declaredClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });
  });

  describe('importTargetToAbsolutePath', () => {
    it('for a local file', () => {
      expect(loader.importTargetToAbsolutePath('package', 'dir/lib/fileA', './subdir/fileB'))
        .toEqual({
          packageName: 'package',
          fileName: Path.normalize('dir/lib/subdir/fileB'),
          fileNameReferenced: 'dir/lib/fileA',
        });
    });

    it('for a package', () => {
      resolutionContext.packageNameIndexOverrides['other-package'] = '/some-dir/index.js';
      expect(loader.importTargetToAbsolutePath('package', 'dir/lib/fileA', 'other-package'))
        .toEqual({ packageName: 'other-package', fileName: '/some-dir/index', fileNameReferenced: 'dir/lib/fileA' });
    });

    it('for a package with a .d.ts index', () => {
      resolutionContext.packageNameIndexOverrides['other-package'] = '/some-dir/index.d.ts';
      expect(loader.importTargetToAbsolutePath('package', 'dir/lib/fileA', 'other-package'))
        .toEqual({ packageName: 'other-package', fileName: '/some-dir/index', fileNameReferenced: 'dir/lib/fileA' });
    });

    it('for a package that does not exist', () => {
      expect(() => loader.importTargetToAbsolutePath('package', 'dir/lib/fileA', 'other-package'))
        .toThrow(`Could not resolve 'other-package' from path 'dir/lib/fileA'`);
    });

    it('for a file in a package', () => {
      resolutionContext.packageNameIndexOverrides['other-package'] = Path.normalize('/some-dir/index.js');
      expect(loader.importTargetToAbsolutePath('package', 'dir/lib/fileA', 'other-package/lib/bla'))
        .toEqual({
          packageName: 'other-package',
          fileName: Path.normalize('/some-dir/lib/bla'),
          fileNameReferenced: 'dir/lib/fileA',
        });
    });

    it('for a scoped package', () => {
      resolutionContext.packageNameIndexOverrides['@rubensworks/other-package'] = Path.normalize('/some-dir/index.js');
      expect(loader.importTargetToAbsolutePath('package', 'dir/lib/fileA', '@rubensworks/other-package'))
        .toEqual({
          packageName: '@rubensworks/other-package',
          fileName: Path.normalize('/some-dir/index'),
          fileNameReferenced: 'dir/lib/fileA',
        });
    });

    it('for an invalid scoped package', () => {
      expect(() => loader.importTargetToAbsolutePath('package', 'dir/lib/fileA', '@rubensworks-invalid'))
        .toThrow(`Invalid scoped package name for import path '@rubensworks-invalid' in 'dir/lib/fileA'`);
    });

    it('for a file in a scoped package', () => {
      resolutionContext.packageNameIndexOverrides['@rubensworks/other-package'] = Path.normalize('/some-dir/index.js');
      expect(loader.importTargetToAbsolutePath('package', 'dir/lib/fileA', '@rubensworks/other-package/lib/bla'))
        .toEqual({
          packageName: '@rubensworks/other-package',
          fileName: Path.normalize('/some-dir/lib/bla'),
          fileNameReferenced: 'dir/lib/fileA',
        });
    });
  });

  describe('getClassElements', () => {
    const fileName = Path.normalize('dir/file');

    it('for an empty file', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(``)))
        .toMatchObject({});
    });

    it('for a file with a const', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`const a = "a"`)))
        .toMatchObject({});
    });

    it('for a file with a const export', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export const foo = "a";`)))
        .toMatchObject({});
    });

    it('for a file with a namespace import', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`import polygons = Shapes.Polygons`)))
        .toMatchObject({});
    });

    it('for a file with a default import', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`import A from './lib/A'`)))
        .toMatchObject({});
    });

    it('for a single declare', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`declare class A{}`)))
        .toMatchObject({
          declaredClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single declare abstract', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`declare abstract class A{}`)))
        .toMatchObject({
          declaredClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single declare interface', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`declare interface A{}`)))
        .toMatchObject({
          declaredInterfaces: {
            A: {
              type: 'TSInterfaceDeclaration',
            },
          },
        });
    });

    it('for a single import', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`import {A as B} from './lib/A'`)))
        .toMatchObject({
          importedElements: {
            B: {
              localName: 'A',
              fileName: Path.normalize('dir/lib/A'),
            },
          },
        });
    });

    it('for a single named export', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export class A{}`)))
        .toMatchObject({
          exportedClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single named export abstract', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export abstract class A{}`)))
        .toMatchObject({
          exportedClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single named generic export', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export class A<T extends string>{}`)))
        .toMatchObject({
          exportedClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single named generic export with default', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export class A<T extends string = string>{}`)))
        .toMatchObject({
          exportedClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single named interface export', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export interface A{}`)))
        .toMatchObject({
          exportedInterfaces: {
            A: {
              type: 'TSInterfaceDeclaration',
            },
          },
        });
    });

    it('for a single import from an unknown package', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`import {A as B} from 'unknown-package'`)).importedElements)
        .toEqual({});
    });

    it('for export all', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export * from './lib/A'`)))
        .toMatchObject({
          exportedImportedAll: [
            { packageName: 'package', fileName: Path.normalize('dir/lib/A') },
          ],
        });
    });

    it('for export all from another package', () => {
      resolutionContext.packageNameIndexOverrides['other-package'] = '/some-dir/index.js';
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export * from 'other-package'`)))
        .toMatchObject({
          exportedImportedAll: [
            { packageName: 'other-package', fileName: '/some-dir/index' },
          ],
        });
    });

    it('for export all without source', () => {
      expect(loader.getClassElements('package', fileName, <AST<TSESTreeOptions>> {
        body: [
          {
            type: AST_NODE_TYPES.ExportAllDeclaration,
            source: {},
          },
        ],
      }))
        .toMatchObject({});
    });

    it('for export all without type', () => {
      expect(loader.getClassElements('package', fileName, <AST<TSESTreeOptions>> {
        body: [
          {
            type: AST_NODE_TYPES.ExportAllDeclaration,
            source: {},
          },
        ],
      }))
        .toMatchObject({});
    });

    it('for export all without value', () => {
      expect(loader.getClassElements('package', fileName, <AST<TSESTreeOptions>> {
        body: [
          {
            type: AST_NODE_TYPES.ExportAllDeclaration,
            source: {
              type: AST_NODE_TYPES.Literal,
            },
          },
        ],
      }))
        .toMatchObject({});
    });

    it('for a single named export without name should error', () => {
      expect(() => loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export class{}`)))
        .toThrow(new Error(`Export parsing failure: missing exported class name in ${fileName} on line 1 column 7`));
    });

    it('for a single export without target', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export { A as B }`)))
        .toMatchObject({
          exportedUnknowns: {
            B: 'A',
          },
        });
    });

    it('for a single export from file', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export { A as B } from './lib/A'`)))
        .toMatchObject({
          exportedImportedElements: {
            B: {
              localName: 'A',
              fileName: Path.normalize('dir/lib/A'),
            },
          },
        });
    });

    it('for a single export object as reference', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export = A`)))
        .toMatchObject({
          exportAssignment: 'A',
        });
    });

    it('for a single export object as class', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export = class A{}`)))
        .toMatchObject({
          exportAssignment: { type: 'ClassDeclaration' },
        });
    });

    it('for a single export object as function', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export = a => true`)))
        .toMatchObject({
          exportAssignment: undefined,
        });
    });

    it('for multiple exports from file', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export { A as B, C as D, X } from './lib/A'`)))
        .toMatchObject({
          exportedImportedElements: {
            B: {
              localName: 'A',
              fileName: Path.normalize('dir/lib/A'),
            },
            D: {
              localName: 'C',
              fileName: Path.normalize('dir/lib/A'),
            },
            X: {
              localName: 'X',
              fileName: Path.normalize('dir/lib/A'),
            },
          },
        });
    });

    it('for an exported type', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export type A = string`)))
        .toMatchObject({
          exportedTypes: {
            A: {
              type: 'TSTypeAliasDeclaration',
            },
          },
        });
    });

    it('for a declared type', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`declare type A = string`)))
        .toMatchObject({
          declaredTypes: {
            A: {
              type: 'TSTypeAliasDeclaration',
            },
          },
        });
    });

    it('for an exported namespace', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`export namespace A {}`)))
        .toMatchObject({
          exportedNamespaces: {
            A: {
              type: 'TSModuleDeclaration',
            },
          },
        });
    });

    it('for a declared namespace', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`declare namespace A {}`)))
        .toMatchObject({
          declaredNamespaces: {
            A: {
              type: 'TSModuleDeclaration',
            },
          },
        });
    });

    it('for a mixed file', () => {
      expect(loader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`
declare class A{}
declare class B{}
import {C} from './lib/C'
import {D as X} from './lib/D'
`)))
        .toMatchObject({
          declaredClasses: {
            A: {
              type: 'ClassDeclaration',
            },
            B: {
              type: 'ClassDeclaration',
            },
          },
          importedElements: {
            C: {
              localName: 'C',
              fileName: Path.normalize('dir/lib/C'),
            },
            X: {
              localName: 'D',
              fileName: Path.normalize('dir/lib/D'),
            },
          },
        });
    });
  });
});
