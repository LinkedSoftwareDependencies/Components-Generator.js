import type { RdfObjectLoader, Resource } from 'rdf-object';
import type { ClassIndex, ClassLoaded } from '../../lib/parse/ClassIndex';
import type { ConstructorData } from '../../lib/parse/ConstructorLoader';
import type { ParameterRangeResolved } from '../../lib/parse/ParameterLoader';
import type { PackageMetadataScope } from '../../lib/resolution/ExternalModulesLoader';
import { ExternalModulesLoader } from '../../lib/resolution/ExternalModulesLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

let packageJsons: Record<string, any> = {};
let loadComponentResources: (componentResources: Record<string, Resource>, objectLoader: RdfObjectLoader) => void;
jest.mock('componentsjs', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  ...<any>jest.requireActual('componentsjs'),
  ModuleStateBuilder: jest.fn().mockImplementation(() => ({
    buildNodeModuleImportPaths: () => [ '/path/1/', '/path/2/' ],
    buildPackageJsons(nodeModulePaths: string[]) {
      return Object.fromEntries(Object.entries(packageJsons)
        .filter(([ key, value ]) => nodeModulePaths.some(nodeModulePath => nodeModulePath === value.path)));
    },
    preprocessPackageJsons: jest.fn(),
    buildComponentModules(packageJsonsArg: Record<string, any>) {
      return Object.fromEntries(Object.entries(packageJsonsArg)
        .filter(([ key, value ]) => value['lsd:module'])
        .map(([ key, value ]) => [ value['lsd:module'], value ]));
    },
    buildComponentContexts: () => ({
      type: 'contexts',
    }),
    buildComponentImportPaths: () => ({
      type: 'importPaths',
    }),
  })),
  ComponentRegistry: jest.fn().mockImplementation(({ componentResources, objectLoader }) => ({
    async registerAvailableModules() {
      await (<RdfObjectLoader> objectLoader).context;
      loadComponentResources(componentResources, objectLoader);
    },
  })),
}));

describe('ExternalModulesLoader', () => {
  let logger: any;
  let resolutionContext: ResolutionContextMocked;
  let packagesBeingGenerated: Record<string, PackageMetadataScope>;
  let loader: ExternalModulesLoader;
  let req: any;

  beforeEach(() => {
    packageJsons = {
      package1: {
        name: 'package1',
        path: '/path/1/package1',
        'lsd:module': 'urn:package1',
        'lsd:contexts': {
          'http://example.org/context1': true,
        },
      },
      package2: {
        name: 'package2',
        path: '/path/1/package2',
        'lsd:module': 'urn:package2',
        'lsd:contexts': {
          'http://example.org/context2': true,
        },
      },
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };
    resolutionContext = new ResolutionContextMocked({});
    packagesBeingGenerated = {};
    loader = new ExternalModulesLoader({
      pathDestination: {
        packageRootDirectory: '/',
        originalPath: '/src',
        replacementPath: '/components',
      },
      packageMetadata: {
        name: 'my-package',
        version: '2.3.4',
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/my-package/',
        componentsPath: 'components',
        contexts: {},
        importPaths: {},
        typesPath: '',
      },
      packagesBeingGenerated,
      resolutionContext,
      debugState: false,
      logger,
    });
    req = {
      resolve(id: string, { paths }: any) {
        if (id.includes('invalid')) {
          throw new Error('invalid package');
        }
        return paths[0] + id;
      },
    };
    loadComponentResources = (componentResources, objectLoader) => {
      componentResources.Component1 = objectLoader.createCompactedResource({
        '@id': 'urn:Component1',
        module: {
          requireName: '"package1"',
        },
        requireElement: '"Component1"',
      });
      componentResources.Component2 = objectLoader.createCompactedResource({
        '@id': 'urn:Component2',
        module: {
          requireName: '"package2"',
        },
        requireElement: '"Component2"',
      });
      componentResources.Component3 = objectLoader.createCompactedResource({
        '@id': 'urn:Component3',
        module: {
          requireName: '"package2"',
        },
        requireElement: '"Component3"',
      });
    };
  });

  describe('findExternalPackages', () => {
    it('should handle empty indexes and no constructors', () => {
      expect(loader.findExternalPackages({}, {}))
        .toEqual([]);
    });

    it('should handle classes', () => {
      const classIndex: ClassIndex<ClassLoaded> = <any> {
        Class1: {
          type: 'class',
          localName: 'Class1',
          packageName: 'package1',
        },
        Class2: {
          type: 'class',
          localName: 'Class2',
          packageName: 'package1',
        },
        Class3: {
          type: 'class',
          localName: 'Class1',
          packageName: 'package2',
        },
        Class4: {
          type: 'class',
          localName: 'Class4',
          packageName: 'my-package',
        },
      };
      expect(loader.findExternalPackages(classIndex, {}))
        .toEqual([
          'package1',
          'package2',
        ]);
    });

    it('should handle super classes', () => {
      const classIndex: ClassIndex<ClassLoaded> = <any> {
        Class1: {
          type: 'class',
          localName: 'Class1',
          packageName: 'package1',
          superClass: {
            value: {
              type: 'class',
              localName: 'Class2',
              packageName: 'package2',
            },
          },
        },
        Class3: {
          type: 'class',
          localName: 'Class1',
          packageName: 'package2',
          superClass: {
            value: {
              type: 'class',
              localName: 'Class4',
              packageName: 'my-package',
            },
          },
        },
      };
      expect(loader.findExternalPackages(classIndex, {}))
        .toEqual([
          'package1',
          'package2',
        ]);
    });

    it('should handle implements interfaces', () => {
      const classIndex: ClassIndex<ClassLoaded> = <any> {
        Class1: {
          type: 'class',
          localName: 'Class1',
          packageName: 'package1',
          implementsInterfaces: [
            {
              value: {
                type: 'interface',
                localName: 'Interface2',
                packageName: 'package2',
              },
            },
          ],
        },
        Class3: {
          type: 'class',
          localName: 'Class1',
          packageName: 'package2',
          implementsInterfaces: [
            {
              value: {
                type: 'interface',
                localName: 'Interface4',
                packageName: 'my-package',
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages(classIndex, {}))
        .toEqual([
          'package1',
          'package2',
        ]);
    });

    it('should ignore raw constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'raw',
                value: 'ignored',
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([]);
    });

    it('should ignore override constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'override',
                value: 'ignored',
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([]);
    });

    it('should ignore undefined constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'undefined',
                value: 'ignored',
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([]);
    });

    it('should ignore wildcard constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'wildcard',
                value: 'ignored',
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([]);
    });

    it('should ignore genericTypeReference constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'genericTypeReference',
                value: 'T',
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([]);
    });

    it('should handle class constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'class',
                value: {
                  type: 'class',
                  localName: 'Class1',
                  packageName: 'package1',
                },
              },
            },
            {
              range: {
                type: 'class',
                value: {
                  type: 'class',
                  localName: 'Class2',
                  packageName: 'package2',
                },
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([ 'package1', 'package2' ]);
    });

    it('should handle nested constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'nested',
                value: [
                  {
                    range: {
                      type: 'class',
                      value: {
                        type: 'class',
                        localName: 'Class1',
                        packageName: 'package1',
                      },
                    },
                  },
                  {
                    range: {
                      type: 'class',
                      value: {
                        type: 'class',
                        localName: 'Class2',
                        packageName: 'package2',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([ 'package1', 'package2' ]);
    });

    it('should handle union constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'union',
                elements: [
                  {
                    type: 'class',
                    value: {
                      type: 'class',
                      localName: 'Class1',
                      packageName: 'package1',
                    },
                  },
                  {
                    type: 'class',
                    value: {
                      type: 'class',
                      localName: 'Class2',
                      packageName: 'package2',
                    },
                  },
                ],
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([ 'package1', 'package2' ]);
    });

    it('should handle intersection constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'intersection',
                elements: [
                  {
                    type: 'class',
                    value: {
                      type: 'class',
                      localName: 'Class1',
                      packageName: 'package1',
                    },
                  },
                  {
                    type: 'class',
                    value: {
                      type: 'class',
                      localName: 'Class2',
                      packageName: 'package2',
                    },
                  },
                ],
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([ 'package1', 'package2' ]);
    });

    it('should handle tuple constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'tuple',
                elements: [
                  {
                    type: 'class',
                    value: {
                      type: 'class',
                      localName: 'Class1',
                      packageName: 'package1',
                    },
                  },
                  {
                    type: 'class',
                    value: {
                      type: 'class',
                      localName: 'Class2',
                      packageName: 'package2',
                    },
                  },
                ],
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([ 'package1', 'package2' ]);
    });

    it('should handle tuple constructor parameters with rest type', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'tuple',
                elements: [
                  {
                    type: 'rest',
                    value: {
                      type: 'class',
                      value: {
                        type: 'class',
                        localName: 'Class1',
                        packageName: 'package1',
                      },
                    },
                  },
                  {
                    type: 'class',
                    value: {
                      type: 'class',
                      localName: 'Class2',
                      packageName: 'package2',
                    },
                  },
                ],
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([ 'package1', 'package2' ]);
    });

    it('should ignore components in packages that are being generated', () => {
      const classIndex: ClassIndex<ClassLoaded> = <any>{
        Class1: {
          type: 'class',
          localName: 'Class1',
          packageName: 'package1',
        },
        Class2: {
          type: 'class',
          localName: 'Class2',
          packageName: 'package2',
        },
        Class3: {
          type: 'class',
          localName: 'Class3',
          packageName: 'package3',
        },
        Class4: {
          type: 'class',
          localName: 'Class4',
          packageName: 'my-package',
        },
      };
      packagesBeingGenerated.package1 = <any>true;
      packagesBeingGenerated.package3 = <any>true;
      expect(loader.findExternalPackages(classIndex, {}))
        .toEqual([
          'package2',
        ]);
    });

    it('should handle array constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'array',
                value: {
                  type: 'class',
                  value: {
                    type: 'class',
                    localName: 'Class1',
                    packageName: 'package1',
                  },
                },
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([ 'package1' ]);
    });

    it('should handle indexed constructor parameters', () => {
      const constructors: ClassIndex<ConstructorData<ParameterRangeResolved>> = <any> {
        Class1: {
          parameters: [
            {
              range: {
                type: 'indexed',
                object: {
                  type: 'class',
                  value: {
                    type: 'class',
                    localName: 'Class1',
                    packageName: 'package1',
                  },
                },
                index: {
                  type: 'class',
                  value: {
                    type: 'class',
                    localName: 'Class2',
                    packageName: 'package2',
                  },
                },
              },
            },
          ],
        },
      };
      expect(loader.findExternalPackages({}, constructors))
        .toEqual([ 'package1', 'package2' ]);
    });
  });

  describe('buildModuleStateSelective', () => {
    it('should create a module state', async() => {
      expect(await loader.buildModuleStateSelective(req, [ 'package1', 'package2' ]))
        .toEqual({
          componentModules: {
            'urn:package1': {
              name: 'package1',
              path: '/path/1/package1',
              'lsd:module': 'urn:package1',
              'lsd:contexts': {
                'http://example.org/context1': true,
              },
            },
            'urn:package2': {
              name: 'package2',
              path: '/path/1/package2',
              'lsd:module': 'urn:package2',
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
            },
          },
          contexts: {
            type: 'contexts',
          },
          importPaths: {
            type: 'importPaths',
          },
          mainModulePath: '/',
          nodeModuleImportPaths: [
            '/path/1/',
            '/path/2/',
          ],
          nodeModulePaths: [
            '/path/1/package1',
            '/path/1/package2',
          ],
          packageJsons,
        });
    });

    it('should create a module state for nested dependencies', async() => {
      packageJsons = {
        package1: {
          name: 'package1',
          path: '/path/1/package1',
          'lsd:module': 'urn:package1',
          'lsd:contexts': {
            'http://example.org/context1': true,
          },
        },
        package2: {
          name: 'package2',
          path: '/path/1/package2',
          'lsd:module': 'urn:package2',
          'lsd:contexts': {
            'http://example.org/context2': true,
          },
        },
        package3: {
          name: 'package3',
          path: '/path/1/package3',
          'lsd:module': 'urn:package3',
          'lsd:contexts': {
            'http://example.org/context2': true,
          },
          dependencies: {
            'package3-1': 'ANY',
            'package3-2': 'ANY',
            'package3-3': 'ANY',
          },
        },
        'package3-1': {
          name: 'package3-1',
          path: '/path/1/package3-1',
          'lsd:module': 'urn:package3-1',
          'lsd:contexts': {
            'http://example.org/context2': true,
          },
        },
        'package3-2': {
          name: 'package3-2',
          path: '/path/1/package3-2',
          'lsd:module': 'urn:package3-2',
          'lsd:contexts': {
            'http://example.org/context2': true,
          },
          dependencies: {
            'package3-2-1': 'ANY',
            'package3-2-2': 'ANY',
            'package3-2-3': 'ANY',
          },
        },
        'package3-3': {
          name: 'package3-3',
          path: '/path/1/package3-3',
          'lsd:module': 'urn:package3-3',
          dependencies: {
            'package3-3-ignored': 'ANY',
          },
        },
        'package3-2-1': {
          name: 'package3-2-1',
          path: '/path/1/package3-2-1',
          'lsd:module': 'urn:package3-2-1',
          'lsd:contexts': {
            'http://example.org/context2': true,
          },
        },
        'package3-2-2': {
          name: 'package3-2-2',
          path: '/path/1/package3-2-2',
          'lsd:module': 'urn:package3-2-2',
          'lsd:contexts': {
            'http://example.org/context2': true,
          },
        },
        'package3-2-3': {
          name: 'package3-2-3',
          path: '/path/1/package3-2-3',
          'lsd:module': 'urn:package3-2-3',
          'lsd:contexts': {
            'http://example.org/context2': true,
          },
        },
        'package3-3-ignored': {
          name: 'package3-3-ignored',
          path: '/path/1/package3-3-ignored',
          dependencies: {
            'package3-3-ignored-1': 'ANY',
          },
        },
        'package3-3-ignored-1': {
          name: 'package3-3-ignored-1',
          path: '/path/1/package3-3-ignored-1',
        },
      };

      expect(await loader.buildModuleStateSelective(req, [ 'package1', 'package3' ]))
        .toEqual({
          componentModules: {
            'urn:package1': {
              'lsd:contexts': {
                'http://example.org/context1': true,
              },
              'lsd:module': 'urn:package1',
              name: 'package1',
              path: '/path/1/package1',
            },
            'urn:package3': {
              dependencies: {
                'package3-1': 'ANY',
                'package3-2': 'ANY',
                'package3-3': 'ANY',
              },
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
              'lsd:module': 'urn:package3',
              name: 'package3',
              path: '/path/1/package3',
            },
            'urn:package3-1': {
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
              'lsd:module': 'urn:package3-1',
              name: 'package3-1',
              path: '/path/1/package3-1',
            },
            'urn:package3-2': {
              dependencies: {
                'package3-2-1': 'ANY',
                'package3-2-2': 'ANY',
                'package3-2-3': 'ANY',
              },
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
              'lsd:module': 'urn:package3-2',
              name: 'package3-2',
              path: '/path/1/package3-2',
            },
            'urn:package3-2-1': {
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
              'lsd:module': 'urn:package3-2-1',
              name: 'package3-2-1',
              path: '/path/1/package3-2-1',
            },
            'urn:package3-2-2': {
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
              'lsd:module': 'urn:package3-2-2',
              name: 'package3-2-2',
              path: '/path/1/package3-2-2',
            },
            'urn:package3-2-3': {
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
              'lsd:module': 'urn:package3-2-3',
              name: 'package3-2-3',
              path: '/path/1/package3-2-3',
            },
            'urn:package3-3': {
              'lsd:module': 'urn:package3-3',
              name: 'package3-3',
              path: '/path/1/package3-3',
              dependencies: {
                'package3-3-ignored': 'ANY',
              },
            },
          },
          contexts: {
            type: 'contexts',
          },
          importPaths: {
            type: 'importPaths',
          },
          mainModulePath: '/',
          nodeModuleImportPaths: [
            '/path/1/',
            '/path/2/',
          ],
          nodeModulePaths: [
            '/path/1/package1',
            '/path/1/package3',
            '/path/1/package3-1',
            '/path/1/package3-2',
            '/path/1/package3-3',
            '/path/1/package3-2-1',
            '/path/1/package3-2-2',
            '/path/1/package3-2-3',
            '/path/1/package3-3-ignored',
          ],
          packageJsons: {
            package1: {
              name: 'package1',
              path: '/path/1/package1',
              'lsd:module': 'urn:package1',
              'lsd:contexts': {
                'http://example.org/context1': true,
              },
            },
            // No package2
            package3: {
              name: 'package3',
              path: '/path/1/package3',
              'lsd:module': 'urn:package3',
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
              dependencies: {
                'package3-1': 'ANY',
                'package3-2': 'ANY',
                'package3-3': 'ANY',
              },
            },
            'package3-1': {
              name: 'package3-1',
              path: '/path/1/package3-1',
              'lsd:module': 'urn:package3-1',
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
            },
            'package3-2': {
              name: 'package3-2',
              path: '/path/1/package3-2',
              'lsd:module': 'urn:package3-2',
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
              dependencies: {
                'package3-2-1': 'ANY',
                'package3-2-2': 'ANY',
                'package3-2-3': 'ANY',
              },
            },
            'package3-3': {
              name: 'package3-3',
              path: '/path/1/package3-3',
              'lsd:module': 'urn:package3-3',
              dependencies: {
                'package3-3-ignored': 'ANY',
              },
            },
            'package3-2-1': {
              name: 'package3-2-1',
              path: '/path/1/package3-2-1',
              'lsd:module': 'urn:package3-2-1',
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
            },
            'package3-2-2': {
              name: 'package3-2-2',
              path: '/path/1/package3-2-2',
              'lsd:module': 'urn:package3-2-2',
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
            },
            'package3-2-3': {
              name: 'package3-2-3',
              path: '/path/1/package3-2-3',
              'lsd:module': 'urn:package3-2-3',
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
            },
            'package3-3-ignored': {
              name: 'package3-3-ignored',
              path: '/path/1/package3-3-ignored',
              dependencies: {
                'package3-3-ignored-1': 'ANY',
              },
            },
            // No 'package3-3-ignored-1'
          },
        });
    });
  });

  describe('buildNodeModulePathsSelective', () => {
    it('should resolve package paths', () => {
      expect(loader.buildNodeModulePathsSelective(req, [ '/path/to/' ], [ 'package1', 'package2' ]))
        .toEqual([
          '/path/to/package1',
          '/path/to/package2',
        ]);
    });

    it('should ignore invalid packages', () => {
      expect(loader.buildNodeModulePathsSelective(req, [ '/path/to/' ], [ 'package1', 'invalid' ]))
        .toEqual([
          '/path/to/package1',
        ]);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenLastCalledWith(`Ignoring invalid package "invalid": invalid package`);
    });
  });

  describe('loadExternalComponents', () => {
    it('should load external components', async() => {
      expect(await loader.loadExternalComponents(req, [ 'package1', 'package2' ]))
        .toEqual({
          components: {
            package1: {
              contextIris: [
                'http://example.org/context1',
              ],
              componentNamesToIris: {
                Component1: 'urn:Component1',
              },
            },
            package2: {
              contextIris: [
                'http://example.org/context2',
              ],
              componentNamesToIris: {
                Component2: 'urn:Component2',
                Component3: 'urn:Component3',
              },
            },
          },
          moduleState: expect.anything(),
          packagesBeingGenerated,
        });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(resolutionContext.contentsOverrides).toEqual({});
    });

    it('should load handle components with multiple modules', async() => {
      loadComponentResources = (componentResources, objectLoader) => {
        componentResources.Component1 = objectLoader.createCompactedResource({
          '@id': 'urn:Component1',
          module: [
            { requireName: '"package1"' },
            { requireName: '"package2"' },
          ],
          requireElement: '"Component1"',
        });
      };

      expect(await loader.loadExternalComponents(req, [ 'package1', 'package2' ]))
        .toEqual({
          components: {
            package1: {
              contextIris: [
                'http://example.org/context1',
              ],
              componentNamesToIris: {
                Component1: 'urn:Component1',
              },
            },
            package2: {
              contextIris: [
                'http://example.org/context2',
              ],
              componentNamesToIris: {
                Component1: 'urn:Component1',
              },
            },
          },
          moduleState: expect.anything(),
          packagesBeingGenerated,
        });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(resolutionContext.contentsOverrides).toEqual({});
    });

    it('should warn on components without a package.json', async() => {
      loadComponentResources = (componentResources, objectLoader) => {
        componentResources.Component1 = objectLoader.createCompactedResource({
          '@id': 'urn:Component1',
          module: {
            requireName: '"package3"',
          },
          requireElement: '"Component1"',
        });
      };
      expect(await loader.loadExternalComponents(req, [ 'package3' ]))
        .toEqual({
          components: {},
          moduleState: expect.anything(),
          packagesBeingGenerated,
        });
      expect(logger.warn).toHaveBeenCalledWith('Could not find a package.json for \'package3\'');
      expect(resolutionContext.contentsOverrides).toEqual({});
    });

    it('should dump the state when debugState is true', async() => {
      loader = new ExternalModulesLoader({
        pathDestination: {
          packageRootDirectory: '/',
          originalPath: '/src',
          replacementPath: '/components',
        },
        packageMetadata: {
          name: 'my-package',
          version: '2.3.4',
          moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/my-package/',
          componentsPath: 'components',
          contexts: {},
          importPaths: {},
          typesPath: '',
        },
        packagesBeingGenerated,
        resolutionContext,
        debugState: true,
        logger,
      });

      expect(await loader.loadExternalComponents(req, [ 'package1', 'package2' ]))
        .toEqual({
          components: {
            package1: {
              contextIris: [
                'http://example.org/context1',
              ],
              componentNamesToIris: {
                Component1: 'urn:Component1',
              },
            },
            package2: {
              contextIris: [
                'http://example.org/context2',
              ],
              componentNamesToIris: {
                Component2: 'urn:Component2',
                Component3: 'urn:Component3',
              },
            },
          },
          moduleState: expect.anything(),
          packagesBeingGenerated,
        });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(resolutionContext.contentsOverrides).toEqual({
        'componentsjs-generator-debug-state.json': `{\n  "externalPackages": [\n    "package1",\n    "package2"\n  ],\n  "moduleState": {\n    "mainModulePath": "/",\n    "componentModules": {\n      "urn:package1": {\n        "name": "package1",\n        "path": "/path/1/package1",\n        "lsd:module": "urn:package1",\n        "lsd:contexts": {\n          "http://example.org/context1": true\n        }\n      },\n      "urn:package2": {\n        "name": "package2",\n        "path": "/path/1/package2",\n        "lsd:module": "urn:package2",\n        "lsd:contexts": {\n          "http://example.org/context2": true\n        }\n      }\n    },\n    "importPaths": {\n      "type": "importPaths"\n    },\n    "contexts": {\n      "type": "contexts"\n    },\n    "nodeModuleImportPaths": [\n      "/path/1/",\n      "/path/2/"\n    ],\n    "nodeModulePaths": [\n      "/path/1/package1",\n      "/path/1/package2"\n    ]\n  }\n}`,
      });
    });
  });
});
