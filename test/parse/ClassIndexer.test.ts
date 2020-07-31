import { ClassFinder } from '../../lib/parse/ClassFinder';
import { ClassIndexer } from '../../lib/parse/ClassIndexer';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ClassIndexer', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let classLoader: ClassLoader;
  let classFinder: ClassFinder;
  let indexer: ClassIndexer;

  beforeEach(() => {
    classLoader = new ClassLoader({ resolutionContext });
    classFinder = new ClassFinder({ classLoader });
    indexer = new ClassIndexer({ classLoader, classFinder });
  });

  describe('createIndex', () => {
    it('for an empty index should return empty', async() => {
      expect(await indexer.createIndex({}))
        .toEqual({});
    });

    it('should load a direct class reference', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `export class X{}`,
      };
      expect(await indexer.createIndex({
        A: {
          localName: 'X',
          fileName: 'x',
        },
      })).toMatchObject({
        A: {
          localName: 'X',
          fileName: 'x',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
      });
    });

    it('should load an indirect class reference', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `export * from './y'`,
        'y.d.ts': `export class X{}`,
      };
      expect(await indexer.createIndex({
        A: {
          localName: 'X',
          fileName: 'x',
        },
      })).toMatchObject({
        A: {
          localName: 'X',
          fileName: 'y',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
      });
    });

    it('should error on a non-existing class reference', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `export class Y{}`,
      };
      await expect(indexer.createIndex({
        A: {
          localName: 'X',
          fileName: 'x',
        },
      })).rejects.toThrow(new Error('Could not load class X from x'));
    });

    it('should load multiple direct class references', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `
export class X{}
export class Y{}
`,
      };
      expect(await indexer.createIndex({
        A: {
          localName: 'X',
          fileName: 'x',
        },
        B: {
          localName: 'Y',
          fileName: 'x',
        },
      })).toMatchObject({
        A: {
          localName: 'X',
          fileName: 'x',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
        B: {
          localName: 'Y',
          fileName: 'x',
          declaration: {
            id: { name: 'Y' },
            type: 'ClassDeclaration',
          },
        },
      });
    });

    it('should load multiple indirect class references', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `
export * from './y'
`,
        'y.d.ts': `
export class X{}
export class Y{}
`,
      };
      expect(await indexer.createIndex({
        A: {
          localName: 'X',
          fileName: 'x',
        },
        B: {
          localName: 'Y',
          fileName: 'x',
        },
      })).toMatchObject({
        A: {
          localName: 'X',
          fileName: 'y',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
        B: {
          localName: 'Y',
          fileName: 'y',
          declaration: {
            id: { name: 'Y' },
            type: 'ClassDeclaration',
          },
        },
      });
    });
  });

  describe('loadClassChain', () => {
    it('for an empty file should throw', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': ``,
      };
      await expect(indexer.loadClassChain({ localName: 'A', fileName: 'file' }))
        .rejects.toThrow(new Error('Could not load class A from file'));
    });

    it('for an exported class', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{}`,
      };
      expect(await indexer.loadClassChain({ localName: 'A', fileName: 'file' }))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
        });
    });

    it('for an exported class with super in current file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends B{}
export class B{}
`,
      };
      expect(await indexer.loadClassChain({ localName: 'A', fileName: 'file' }))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            localName: 'B',
            fileName: 'file',
            declaration: {
              id: { name: 'B' },
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for an exported class with super in other file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends B{}
export { X as B } from './X'
`,
        'X.d.ts': `export class X{}`,
      };
      expect(await indexer.loadClassChain({ localName: 'A', fileName: 'file' }))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            localName: 'X',
            fileName: 'X',
            declaration: {
              id: { name: 'X' },
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for an exported class with super in other file via export all', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends X{}
export * from './X'
`,
        'X.d.ts': `export class X{}`,
      };
      expect(await indexer.loadClassChain({ localName: 'A', fileName: 'file' }))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            localName: 'X',
            fileName: 'X',
            declaration: {
              id: { name: 'X' },
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for an exported class with super in other file via nested export all', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends X{}
export * from './Z'
`,
        'Z.d.ts': `export * from './Y'`,
        'Y.d.ts': `export * from './X'`,
        'X.d.ts': `export class X{}`,
      };
      expect(await indexer.loadClassChain({ localName: 'A', fileName: 'file' }))
        .toMatchObject({
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            localName: 'X',
            fileName: 'X',
            declaration: {
              id: { name: 'X' },
              type: 'ClassDeclaration',
            },
          },
        });
    });
  });
});
