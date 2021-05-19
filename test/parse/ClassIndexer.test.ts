import * as Path from 'path';
import { ClassFinder } from '../../lib/parse/ClassFinder';
import { ClassIndexer } from '../../lib/parse/ClassIndexer';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ClassIndexer', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let ignoreClasses: Record<string, boolean>;
  let classLoader: ClassLoader;
  let classFinder: ClassFinder;
  let indexer: ClassIndexer;

  beforeEach(() => {
    ignoreClasses = {};
    classLoader = new ClassLoader({ resolutionContext });
    classFinder = new ClassFinder({ classLoader });
    indexer = new ClassIndexer({ classLoader, classFinder, ignoreClasses });
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
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
        },
      })).toMatchObject({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
      });
    });

    it('should throw on a direct class reference to an unknown file', async() => {
      await expect(indexer.createIndex({
        Unknown: {
          packageName: 'package',
          localName: 'Unknown',
          fileName: 'unknown',
        },
      })).rejects.toThrow(new Error(`Could not load class Unknown from unknown:
Could not find mocked path for unknown.d.ts`));
    });

    it('should not throw on a direct class reference to an unknown file when it is ignored', async() => {
      ignoreClasses.Unknown = true;
      expect(await indexer.createIndex({
        Unknown: {
          packageName: 'package',
          localName: 'Unknown',
          fileName: 'unknown',
        },
      })).toMatchObject({});
    });

    it('should load an indirect class reference', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `export * from './y'`,
        'y.d.ts': `export class X{}`,
      };
      expect(await indexer.createIndex({
        A: {
          packageName: 'package',
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
          packageName: 'package',
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
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
        },
        B: {
          packageName: 'package',
          localName: 'Y',
          fileName: 'x',
        },
      })).toMatchObject({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
        B: {
          packageName: 'package',
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
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
        },
        B: {
          packageName: 'package',
          localName: 'Y',
          fileName: 'x',
        },
      })).toMatchObject({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'y',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
        B: {
          packageName: 'package',
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
      await expect(indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .rejects.toThrow(new Error('Could not load class A from file'));
    });

    it('for an exported class', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{}`,
      };
      expect(await indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .toMatchObject({
          packageName: 'package',
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
      expect(await indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            packageName: 'package',
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
      expect(await indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            packageName: 'package',
            localName: 'X',
            fileName: 'X',
            declaration: {
              id: { name: 'X' },
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for an exported class with super in other package', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends B{}
export { X as B } from 'other-package'
`,
        '/some-dir/index.d.ts': `export class X{}`,
      };
      resolutionContext.packageNameIndexOverrides['other-package'] = '/some-dir/index.js';
      expect(await indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            packageName: 'other-package',
            localName: 'X',
            fileName: Path.normalize('/some-dir/index'),
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
      expect(await indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            packageName: 'package',
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
      expect(await indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            packageName: 'package',
            localName: 'X',
            fileName: 'X',
            declaration: {
              id: { name: 'X' },
              type: 'ClassDeclaration',
            },
          },
        });
    });

    it('for an exported class extending an unknown class should error', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends Unknown{}
`,
      };
      await expect(indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .rejects.toThrow(new Error(`Failed to load super class Unknown of A in file:
Could not load class Unknown from file`));
    });

    it('for an exported class extending an unknown class should not error if it is ignored', async() => {
      ignoreClasses.Unknown = true;
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends Unknown{}
`,
      };
      expect(await indexer.loadClassChain({ packageName: 'package', localName: 'A', fileName: 'file' }))
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
        });
    });
  });
});
