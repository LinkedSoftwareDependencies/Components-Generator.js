import type { RdfObjectLoader, Resource } from 'rdf-object';

import type { ClassIndex, ClassLoaded } from '../../lib/parse/ClassIndex';
import type { ConstructorData } from '../../lib/parse/ConstructorLoader';
import type { ParameterRangeResolved } from '../../lib/parse/ParameterLoader';
import { ExternalModulesLoader } from '../../lib/resolution/ExternalModulesLoader';

let loadComponentResources: (componentResources: Record<string, Resource>, objectLoader: RdfObjectLoader) => void;
jest.mock('componentsjs', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  ...<any>jest.requireActual('componentsjs'),
  ModuleStateBuilder: jest.fn().mockImplementation(() => ({
    buildNodeModuleImportPaths: () => [ '/path/1/', '/path/2/' ],
    buildPackageJsons: () => ({
      package1: {
        name: 'package1',
        'lsd:contexts': {
          'http://example.org/context1': true,
        },
      },
      package2: {
        name: 'package2',
        'lsd:contexts': {
          'http://example.org/context2': true,
        },
      },
    }),
    preprocessPackageJsons: jest.fn(),
    buildComponentModules: () => ({
      type: 'componentModules',
    }),
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
  let loader: ExternalModulesLoader;
  let req: any;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };
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
      logger,
    });
    req = {
      resolve(id: string, { paths }: any) {
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
            type: 'class',
            localName: 'Class2',
            packageName: 'package2',
          },
        },
        Class3: {
          type: 'class',
          localName: 'Class1',
          packageName: 'package2',
          superClass: {
            type: 'class',
            localName: 'Class4',
            packageName: 'my-package',
          },
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
  });

  describe('buildModuleStateSelective', () => {
    it('should create a module state', async() => {
      expect(await loader.buildModuleStateSelective(req, [ 'package1', 'package2' ]))
        .toEqual({
          componentModules: {
            type: 'componentModules',
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
          packageJsons: {
            package1: {
              name: 'package1',
              'lsd:contexts': {
                'http://example.org/context1': true,
              },
            },
            package2: {
              name: 'package2',
              'lsd:contexts': {
                'http://example.org/context2': true,
              },
            },
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
        });
      expect(logger.warn).not.toHaveBeenCalled();
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
        });
      expect(logger.warn).toHaveBeenCalledWith('Could not find a package.json for \'package3\'');
    });
  });
});
