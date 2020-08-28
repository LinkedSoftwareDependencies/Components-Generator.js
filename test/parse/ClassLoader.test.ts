import * as Path from 'path';
import { AST, TSESTreeOptions, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ClassLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let loader: ClassLoader;

  beforeEach(() => {
    loader = new ClassLoader({ resolutionContext });
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

    it('should error on an interface that is extended anonymously', async() => {
      await expect(async() => loader.getSuperInterfaceNames(<any>(resolutionContext
        .parseTypescriptContents(`interface A extends {} {}`)).body[0], 'file'))
        .rejects.toThrow(new Error('Could not interpret type of super interface in file on line 1 column 20'));
    });
  });

  describe('loadClassDeclaration', () => {
    describe('when not considering interfaces', () => {
      it('for an empty file should throw', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': ``,
          }),
        });
        await expect(loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
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
        });
        await expect(loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
          .rejects.toThrow(new Error('Could not load class A from file'));
      });

      it('for a file without the file class should throw, even if it exists as an interface', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `
declare interface A{};
`,
          }),
        });
        await expect(loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
          .rejects.toThrow(new Error('Could not load class A from file'));
      });

      it('for an exported class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export class A{}`,
          }),
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, false))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, false))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, false))
          .toMatchObject({
            localName: 'B',
            fileName: 'file4',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          });
      });
    });

    describe('when considering interfaces', () => {
      it('for an empty file should throw', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': ``,
          }),
        });
        await expect(loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        await expect(loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
          .rejects.toThrow(new Error('Could not load class or interface A from file'));
      });

      it('for an exported class', async() => {
        loader = new ClassLoader({
          resolutionContext: new ResolutionContextMocked({
            'file.d.ts': `export class A{}`,
          }),
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'B', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, false))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
        });
        expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
    });

    it('for an exported abstract class', async() => {
      loader = new ClassLoader({
        resolutionContext: new ResolutionContextMocked({
          'file.d.ts': `export abstract class A{}`,
        }),
      });
      expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
      });
      expect(await loader.loadClassDeclaration({ localName: 'A', fileName: 'file' }, true))
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
  });

  describe('loadClassElements', () => {
    it('for file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `declare class A{}`,
      };
      expect(await loader.loadClassElements('file'))
        .toMatchObject({
          declaredClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });
  });

  describe('getClassElements', () => {
    it('for an empty file', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(``)))
        .toMatchObject({});
    });

    it('for a file with a const', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`const a = "a"`)))
        .toMatchObject({});
    });

    it('for a file with a const export', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export const foo = "a";`)))
        .toMatchObject({});
    });

    it('for a file with a namespace import', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`import polygons = Shapes.Polygons`)))
        .toMatchObject({});
    });

    it('for a file with a default import', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`import A from './lib/A'`)))
        .toMatchObject({});
    });

    it('for a single declare', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`declare class A{}`)))
        .toMatchObject({
          declaredClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single declare abstract', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`declare abstract class A{}`)))
        .toMatchObject({
          declaredClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single declare interface', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`declare interface A{}`)))
        .toMatchObject({
          declaredInterfaces: {
            A: {
              type: 'TSInterfaceDeclaration',
            },
          },
        });
    });

    it('for a single import', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`import {A as B} from './lib/A'`)))
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
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export class A{}`)))
        .toMatchObject({
          exportedClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single named export abstract', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export abstract class A{}`)))
        .toMatchObject({
          exportedClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single named interface export', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export interface A{}`)))
        .toMatchObject({
          exportedInterfaces: {
            A: {
              type: 'TSInterfaceDeclaration',
            },
          },
        });
    });

    it('for export all', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export * from './lib/A'`)))
        .toMatchObject({
          exportedImportedAll: [ Path.normalize('dir/lib/A') ],
        });
    });

    it('for export all without source', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), <AST<TSESTreeOptions>> {
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
      expect(loader.getClassElements(Path.normalize('dir/file'), <AST<TSESTreeOptions>> {
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
      expect(loader.getClassElements(Path.normalize('dir/file'), <AST<TSESTreeOptions>> {
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
      expect(() => loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export class{}`)))
        .toThrow(new Error(`Export parsing failure: missing exported class name in ${Path.normalize('dir/file')} on line 1 column 7`));
    });

    it('for a single export without target', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export { A as B }`)))
        .toMatchObject({
          exportedUnknowns: {
            B: 'A',
          },
        });
    });

    it('for a single export from file', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export { A as B } from './lib/A'`)))
        .toMatchObject({
          exportedImportedElements: {
            B: {
              localName: 'A',
              fileName: Path.normalize('dir/lib/A'),
            },
          },
        });
    });

    it('for multiple exports from file', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`export { A as B, C as D, X } from './lib/A'`)))
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

    it('for a mixed file', () => {
      expect(loader.getClassElements(Path.normalize('dir/file'), resolutionContext.parseTypescriptContents(`
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
