import { ClassFinder } from '../../lib/parse/ClassFinder';
import { ClassIndexer } from '../../lib/parse/ClassIndexer';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ClassIndexer', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let ignoreClasses: Record<string, boolean>;
  let logger: any;
  let classLoader: ClassLoader;
  let classFinder: ClassFinder;
  let indexer: ClassIndexer;

  beforeEach(() => {
    ignoreClasses = {};
    logger = {
      debug: jest.fn(),
    };
    const commentLoader = new CommentLoader();
    classLoader = new ClassLoader({ resolutionContext, logger, commentLoader });
    classFinder = new ClassFinder({ classLoader });
    indexer = new ClassIndexer({ classLoader, classFinder, ignoreClasses, logger });
  });

  describe('createIndex', () => {
    it('for an empty index should return empty', async() => {
      await expect(indexer.createIndex({})).resolves
        .toEqual({});
    });

    it('should load a direct class reference', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `export class X{}`,
      };
      await expect(indexer.createIndex({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
          fileNameReferenced: 'xR',
        },
      })).resolves.toMatchObject({
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
          fileNameReferenced: 'unknownR',
        },
      })).rejects.toThrow(new Error(`Could not load class or interface Unknown from unknown:
Could not find mocked path for unknown.d.ts`));
    });

    it('should not throw on a direct class reference to an unknown file when it is ignored', async() => {
      ignoreClasses.Unknown = true;
      await expect(indexer.createIndex({
        Unknown: {
          packageName: 'package',
          localName: 'Unknown',
          fileName: 'unknown',
          fileNameReferenced: 'unknownR',
        },
      })).resolves.toMatchObject({});
    });

    it('should load an indirect class reference', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `export * from './y'`,
        'y.d.ts': `export class X{}`,
      };
      await expect(indexer.createIndex({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
          fileNameReferenced: 'xR',
        },
      })).resolves.toMatchObject({
        A: {
          localName: 'X',
          fileName: 'y',
          fileNameReferenced: 'xR',
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
          fileNameReferenced: 'xR',
        },
      })).rejects.toThrow(new Error('Could not load class or interface X from x'));
    });

    it('should load multiple direct class references', async() => {
      resolutionContext.contentsOverrides = {
        'x.d.ts': `
export class X{}
export class Y{}
`,
      };
      await expect(indexer.createIndex({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
          fileNameReferenced: 'xR',
        },
        B: {
          packageName: 'package',
          localName: 'Y',
          fileName: 'x',
          fileNameReferenced: 'xR',
        },
      })).resolves.toMatchObject({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
          fileNameReferenced: 'xR',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
        B: {
          packageName: 'package',
          localName: 'Y',
          fileName: 'x',
          fileNameReferenced: 'xR',
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
      await expect(indexer.createIndex({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'x',
          fileNameReferenced: 'xR',
        },
        B: {
          packageName: 'package',
          localName: 'Y',
          fileName: 'x',
          fileNameReferenced: 'xR',
        },
      })).resolves.toMatchObject({
        A: {
          packageName: 'package',
          localName: 'X',
          fileName: 'y',
          fileNameReferenced: 'xR',
          declaration: {
            id: { name: 'X' },
            type: 'ClassDeclaration',
          },
        },
        B: {
          packageName: 'package',
          localName: 'Y',
          fileName: 'y',
          fileNameReferenced: 'xR',
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
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }))
        .rejects.toThrow(new Error('Could not load class or interface A from file'));
    });

    it('for an exported class', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{}`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
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
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            value: {
              packageName: 'package',
              localName: 'B',
              fileName: 'file',
              declaration: {
                id: { name: 'B' },
                type: 'ClassDeclaration',
              },
            },
          },
        });
    });

    it('for an exported class with super in current file with generics', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends B<string>{}
export class B<A>{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            value: {
              packageName: 'package',
              localName: 'B',
              fileName: 'file',
              declaration: {
                id: { name: 'B' },
                type: 'ClassDeclaration',
              },
            },
            genericTypeInstantiations: {
              params: [
                {
                  type: 'TSStringKeyword',
                },
              ],
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
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            value: {
              packageName: 'package',
              localName: 'X',
              fileName: 'X',
              declaration: {
                id: { name: 'X' },
                type: 'ClassDeclaration',
              },
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
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            value: {
              packageName: 'other-package',
              localName: 'X',
              fileName: '/some-dir/index',
              declaration: {
                id: { name: 'X' },
                type: 'ClassDeclaration',
              },
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
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            value: {
              packageName: 'package',
              localName: 'X',
              fileName: 'X',
              declaration: {
                id: { name: 'X' },
                type: 'ClassDeclaration',
              },
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
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          superClass: {
            value: {
              packageName: 'package',
              localName: 'X',
              fileName: 'X',
              declaration: {
                id: { name: 'X' },
                type: 'ClassDeclaration',
              },
            },
          },
        });
    });

    it('for an exported class extending a non-class should error', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends Interface{};
export interface Interface{};
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }))
        .rejects.toThrow(new Error(`Detected non-class Interface extending from a class A in file`));
    });

    it('for an exported class extending an unknown class should error', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends Unknown{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }))
        .rejects.toThrow(new Error(`Failed to load super class Unknown of A in file:
Could not load class or interface Unknown from file`));
    });

    it('for an exported class extending an unknown class should not error if it is ignored', async() => {
      ignoreClasses.Unknown = true;
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A extends Unknown{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
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

    it('for an exported class with implements interface in current file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A implements B{}
export interface B{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          implementsInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'B',
                fileName: 'file',
                declaration: {
                  id: { name: 'B' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported class with implements interface in current file with generics', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A implements B<string>{}
export interface B<X>{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          implementsInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'B',
                fileName: 'file',
                declaration: {
                  id: { name: 'B' },
                  type: 'TSInterfaceDeclaration',
                },
              },
              genericTypeInstantiations: {
                params: [
                  {
                    type: 'TSStringKeyword',
                  },
                ],
              },
            },
          ],
        });
    });

    it('for an exported class with implements interface in other file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A implements B{}
export { X as B } from './X'
`,
        'X.d.ts': `export interface X{}`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          implementsInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'X',
                fileName: 'X',
                declaration: {
                  id: { name: 'X' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported class implementing an unknown interface should ignore the interface', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A implements Unknown{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          implementsInterfaces: [],
        });
      expect(logger.debug).toHaveBeenCalledWith(`Ignored interface Unknown implemented by A in file:
Could not load class or interface Unknown from file`);
    });

    it('for an exported class implementing an unknown interface should not error if it is ignored', async() => {
      ignoreClasses.Unknown = true;
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A implements Unknown{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
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

    it('for an exported class implementing a class', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A implements B{}
export class B{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'ClassDeclaration',
          },
          implementsInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'B',
                fileName: 'file',
                declaration: {
                  id: { name: 'B' },
                  type: 'ClassDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported interface', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export interface A{}`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
        });
    });

    it('for an exported interface with super in current file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends B{}
export interface B{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          superInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'B',
                fileName: 'file',
                declaration: {
                  id: { name: 'B' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported interface with super in current file with generics', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends B<string>{}
export interface B<A>{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          superInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'B',
                fileName: 'file',
                declaration: {
                  id: { name: 'B' },
                  type: 'TSInterfaceDeclaration',
                },
              },
              genericTypeInstantiations: {
                params: [
                  {
                    type: 'TSStringKeyword',
                  },
                ],
              },
            },
          ],
        });
    });

    it('for an exported interface with multiple supers in current file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends B, C{}
export interface B{}
export interface C{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          superInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'B',
                fileName: 'file',
                declaration: {
                  id: { name: 'B' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
            {
              value: {
                packageName: 'package',
                localName: 'C',
                fileName: 'file',
                declaration: {
                  id: { name: 'C' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported interface with super in other file', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends B{}
export { X as B } from './X'
`,
        'X.d.ts': `export interface X{}`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          superInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'X',
                fileName: 'X',
                declaration: {
                  id: { name: 'X' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported interface with super in other package', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends B{}
export { X as B } from 'other-package'
`,
        '/some-dir/index.d.ts': `export interface X{}`,
      };
      resolutionContext.packageNameIndexOverrides['other-package'] = '/some-dir/index.js';
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          superInterfaces: [
            {
              value: {
                packageName: 'other-package',
                localName: 'X',
                fileName: '/some-dir/index',
                declaration: {
                  id: { name: 'X' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported interface with super in other file via export all', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends X{}
export * from './X'
`,
        'X.d.ts': `export interface X{}`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          superInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'X',
                fileName: 'X',
                declaration: {
                  id: { name: 'X' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported interface with super in other file via nested export all', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends X{}
export * from './Z'
`,
        'Z.d.ts': `export * from './Y'`,
        'Y.d.ts': `export * from './X'`,
        'X.d.ts': `export interface X{}`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
          superInterfaces: [
            {
              value: {
                packageName: 'package',
                localName: 'X',
                fileName: 'X',
                declaration: {
                  id: { name: 'X' },
                  type: 'TSInterfaceDeclaration',
                },
              },
            },
          ],
        });
    });

    it('for an exported interface extending a non-interface should error', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends AClass{};
export class AClass{};
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      }))
        .rejects.toThrow(new Error(`Detected non-interface A extending from a class AClass in file`));
    });

    it('for an exported interface extending an unknown interface should ignore the interface', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends Unknown{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
        });
      expect(logger.debug).toHaveBeenCalledWith(`Ignored interface Unknown extended by A in file:
Could not load class or interface Unknown from file`);
    });

    it('for an exported interface extending an unknown interface should not error if it is ignored', async() => {
      ignoreClasses.Unknown = true;
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export interface A extends Unknown{}
`,
      };
      await expect(indexer.loadClassChain({
        packageName: 'package',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      })).resolves
        .toMatchObject({
          packageName: 'package',
          localName: 'A',
          fileName: 'file',
          declaration: {
            id: { name: 'A' },
            type: 'TSInterfaceDeclaration',
          },
        });
    });
  });
});
