import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { Program } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ClassLoader', () => {
  const resolutionContext = new ResolutionContextMocked({
    'file.d.ts': `declare class A{}`,
  });
  let loader: ClassLoader;

  beforeEach(() => {
    loader = new ClassLoader({ resolutionContext });
  });

  describe('loadClassElements', () => {
    it('for file', async() => {
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
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(``)))
        .toMatchObject({});
    });

    it('for a file with a const', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`const a = "a"`)))
        .toMatchObject({});
    });

    it('for a file with a const export', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`export const foo = "a";`)))
        .toMatchObject({});
    });

    it('for a file with a namespace import', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`import polygons = Shapes.Polygons`)))
        .toMatchObject({});
    });

    it('for a file with a default import', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`import A from './lib/A'`)))
        .toMatchObject({});
    });

    it('for a single declare', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`declare class A{}`)))
        .toMatchObject({
          declaredClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for a single import', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`import {A as B} from './lib/A'`)))
        .toMatchObject({
          importedClasses: {
            B: {
              localName: 'A',
              fileName: 'dir/lib/A',
            },
          },
        });
    });

    it('for a single named export', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`export class A{}`)))
        .toMatchObject({
          exportedClasses: {
            A: {
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for export all', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`export * from './lib/A'`)))
        .toMatchObject({
          exportedImportedAll: [ 'dir/lib/A' ],
        });
    });

    it('for export all without source', () => {
      expect(loader.getClassElements('dir/file', <Program> {
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
      expect(loader.getClassElements('dir/file', <Program> {
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
      expect(loader.getClassElements('dir/file', <Program> {
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
      expect(() => loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`export class{}`)))
        .toThrow(new Error('Export parsing failure: missing exported class name in dir/file on line 1 column 7'));
    });

    it('for a single export without target', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`export { A as B }`)))
        .toMatchObject({
          exportedUnknowns: {
            B: 'A',
          },
        });
    });

    it('for a single export from file', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`export { A as B } from './lib/A'`)))
        .toMatchObject({
          exportedImportedClasses: {
            B: {
              localName: 'A',
              fileName: 'dir/lib/A',
            },
          },
        });
    });

    it('for multiple exports from file', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`export { A as B, C as D, X } from './lib/A'`)))
        .toMatchObject({
          exportedImportedClasses: {
            B: {
              localName: 'A',
              fileName: 'dir/lib/A',
            },
            D: {
              localName: 'C',
              fileName: 'dir/lib/A',
            },
            X: {
              localName: 'X',
              fileName: 'dir/lib/A',
            },
          },
        });
    });

    it('for a mixed file', () => {
      expect(loader.getClassElements('dir/file', resolutionContext.parseTypescriptContents(`
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
          importedClasses: {
            C: {
              localName: 'C',
              fileName: 'dir/lib/C',
            },
            X: {
              localName: 'D',
              fileName: 'dir/lib/D',
            },
          },
        });
    });
  });
});
