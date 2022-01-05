import * as Path from 'path';
import { PrefetchedDocumentLoader } from 'componentsjs/lib/rdf/PrefetchedDocumentLoader';
import type { JsonLdContextNormalized } from 'jsonld-context-parser';
import { ContextParser } from 'jsonld-context-parser';
import type {
  ClassIndex,
  ClassLoaded,
  ClassReferenceLoaded, ClassReferenceLoadedClassOrInterface,
} from '../../lib/parse/ClassIndex';
import type { ConstructorData } from '../../lib/parse/ConstructorLoader';
import type { ParameterData, ParameterRangeResolved, ExtensionData } from '../../lib/parse/ParameterLoader';

import type { ExternalComponents } from '../../lib/resolution/ExternalModulesLoader';
import type {
  FieldScope,
  ExternalContextCallback,
  PathDestinationDefinition,
} from '../../lib/serialize/ComponentConstructor';
import { ComponentConstructor } from '../../lib/serialize/ComponentConstructor';
import type { ParameterDefinition } from '../../lib/serialize/ComponentDefinitions';
import { ContextConstructorMocked } from '../ContextConstructorMocked';

describe('ComponentConstructor', () => {
  let ctor: ComponentConstructor;
  let classReference: ClassReferenceLoadedClassOrInterface;
  let externalComponents: ExternalComponents;
  let context: JsonLdContextNormalized;
  let externalContextsCallback: ExternalContextCallback;
  let scope: FieldScope;
  let pathDestination: PathDestinationDefinition;

  beforeEach(async() => {
    classReference = <any> {
      type: 'class',
      packageName: 'my-package',
      localName: 'MyClass',
      fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      generics: {},
    };

    externalComponents = {
      moduleState: <any> {},
      components: {},
      packagesBeingGenerated: {},
    };

    const contextParser = new ContextParser({
      documentLoader: new PrefetchedDocumentLoader({
        contexts: {
          'http://example.org/context-other-package.jsonld': {
            '@context': {
              op: 'http://example.org/other-package.ttl#',
            },
          },
        },
      }),
      skipValidation: true,
    });
    const packageMetadata = {
      name: 'my-package',
      version: '1.2.3',
      moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/my-package',
      componentsPath: 'components',
      contexts: {
        'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld': 'components/context.jsonld',
      },
      importPaths: {
        'https://linkedsoftwaredependencies.org/bundles/npm/my-package/^1.0.0/components/': 'components/',
        'https://linkedsoftwaredependencies.org/bundles/npm/my-package/^1.0.0/config/': 'config/',
      },
      typesPath: '',
    };
    const contextConstructor = new ContextConstructorMocked({ packageMetadata });
    pathDestination = {
      packageRootDirectory: Path.normalize('/docs/package'),
      originalPath: 'src',
      replacementPath: 'components',
    };
    ctor = new ComponentConstructor({
      packageMetadata,
      fileExtension: 'jsonld',
      contextConstructor,
      pathDestination,
      classAndInterfaceIndex: {},
      classConstructors: {},
      classExtensions: {},
      externalComponents,
      contextParser,
    });

    context = await contextParser.parse(contextConstructor.constructContext());

    externalContextsCallback = jest.fn();

    scope = {
      parentFieldNames: [],
      fieldIdsHash: {},
      defaultNested: [],
    };
  });

  describe('constructComponents', () => {
    it('should handle an empty index', async() => {
      expect(await ctor.constructComponents()).toEqual({});
    });

    it('should handle a non-empty index for classes in the same file', async() => {
      (<any> ctor).classAndInterfaceIndex = {
        MyClass1: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass1',
          fileName: Path.normalize('/docs/package/src/b/file'),
          generics: {},
          memberKeys: [ 'field1_1', 'field1_2' ],
        },
        MyClass2: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass2',
          fileName: Path.normalize('/docs/package/src/b/file'),
          generics: {},
          memberKeys: [ 'field2_1' ],
        },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          type: 'class',
          classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
          genericTypeParameters: [],
          parameters: [],
        },
        MyClass2: {
          type: 'class',
          classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass2,
          genericTypeParameters: [],
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              comment: 'Hi1',
            },
            {
              type: 'field',
              name: 'fieldB',
              range: { type: 'raw', value: 'string' },
              comment: 'Hi2',
            },
          ],
        },
      };
      expect(await ctor.constructComponents()).toEqual({
        [Path.normalize('/docs/package/components/b/file')]: {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:components/b/file.jsonld#MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass1',
              memberKeys: [ 'field1_1', 'field1_2' ],
            },
            {
              '@id': 'mp:components/b/file.jsonld#MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [
                { '@id': 'mp:components/b/file.jsonld#MyClass2_fieldA' },
                { '@id': 'mp:components/b/file.jsonld#MyClass2_fieldB' },
              ],
              parameters: [
                {
                  '@id': 'mp:components/b/file.jsonld#MyClass2_fieldA',
                  comment: 'Hi1',
                  range: 'xsd:boolean',
                },
                {
                  '@id': 'mp:components/b/file.jsonld#MyClass2_fieldB',
                  comment: 'Hi2',
                  range: 'xsd:string',
                },
              ],
              memberKeys: [ 'field2_1' ],
            },
          ],
        },
      });
    });

    it('should handle a non-empty index for classes in different files', async() => {
      (<any> ctor).classAndInterfaceIndex = {
        MyClass1: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass1',
          fileName: Path.normalize('/docs/package/src/file1'),
          generics: {},
        },
        MyClass2: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass2',
          fileName: Path.normalize('/docs/package/src/b/file2'),
          generics: {},
        },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
          genericTypeParameters: [],
          parameters: [],
        },
        MyClass2: {
          classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass2,
          genericTypeParameters: [],
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              comment: 'Hi1',
            },
            {
              type: 'field',
              name: 'fieldB',
              range: { type: 'raw', value: 'string' },
              comment: 'Hi2',
            },
          ],
        },
      };
      expect(await ctor.constructComponents()).toEqual({
        [Path.normalize('/docs/package/components/file1')]: {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:components/file1.jsonld#MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass1',
            },
          ],
        },
        [Path.normalize('/docs/package/components/b/file2')]: {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:components/b/file2.jsonld#MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [
                { '@id': 'mp:components/b/file2.jsonld#MyClass2_fieldA' },
                { '@id': 'mp:components/b/file2.jsonld#MyClass2_fieldB' },
              ],
              parameters: [
                {
                  '@id': 'mp:components/b/file2.jsonld#MyClass2_fieldA',
                  comment: 'Hi1',
                  range: 'xsd:boolean',
                },
                {
                  '@id': 'mp:components/b/file2.jsonld#MyClass2_fieldB',
                  comment: 'Hi2',
                  range: 'xsd:string',
                },
              ],
            },
          ],
        },
      });
    });

    it('should handle references to other packages', async() => {
      (<any> ctor).classAndInterfaceIndex = {
        MyClass1: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass1',
          fileName: Path.normalize('/docs/package/src/b/file'),
          generics: {},
        },
        MyClass2: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass2',
          fileName: Path.normalize('/docs/package/src/b/file'),
          generics: {},
        },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
          genericTypeParameters: [],
          parameters: [],
        },
        MyClass2: {
          classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass2,
          genericTypeParameters: [],
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              comment: 'Hi1',
            },
            {
              type: 'field',
              name: 'fieldB',
              range: { type: 'raw', value: 'string' },
              comment: 'Hi2',
            },
          ],
        },
      };
      (<any> ctor).classExtensions = <ClassIndex<ExtensionData<ParameterRangeResolved>[]>> {
        MyClass1: [
          {
            classLoaded: <any> {
              packageName: 'other-package',
              localName: 'MyClass',
              fileName: Path.normalize('/docs/package/src/b/file'),
            },
            genericTypeInstantiations: [],
          },
        ],
        MyClass2: [
          {
            classLoaded: <any> {
              packageName: 'other-package',
              localName: 'MyClass',
              fileName: Path.normalize('/docs/package/src/b/file'),
            },
            genericTypeInstantiations: [],
          },
        ],
      };
      externalComponents.components['other-package'] = {
        contextIris: [ 'http://example.org/context-other-package.jsonld' ],
        componentNamesToIris: {
          MyClass: 'http://example.org/other-package.ttl#MyClass',
        },
      };
      expect(await ctor.constructComponents()).toEqual({
        [Path.normalize('/docs/package/components/b/file')]: {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
            'http://example.org/context-other-package.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:components/b/file.jsonld#MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              extends: [ 'op:MyClass' ],
              parameters: [],
              requireElement: 'MyClass1',
            },
            {
              '@id': 'mp:components/b/file.jsonld#MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [
                { '@id': 'mp:components/b/file.jsonld#MyClass2_fieldA' },
                { '@id': 'mp:components/b/file.jsonld#MyClass2_fieldB' },
              ],
              extends: [ 'op:MyClass' ],
              parameters: [
                {
                  '@id': 'mp:components/b/file.jsonld#MyClass2_fieldA',
                  comment: 'Hi1',
                  range: 'xsd:boolean',
                },
                {
                  '@id': 'mp:components/b/file.jsonld#MyClass2_fieldB',
                  comment: 'Hi2',
                  range: 'xsd:string',
                },
              ],
            },
          ],
        },
      });
    });

    it('should handle a non-empty index with a class from a different package', async() => {
      (<any> ctor).classAndInterfaceIndex = {
        MyClass1: {
          type: 'class',
          packageName: 'other-package',
          localName: 'MyClass',
          fileName: Path.normalize('/docs/other-package/src/b/file'),
          fileNameReferenced: Path.normalize('/docs/package/src/b/file'),
          generics: {},
        },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          type: 'class',
          classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
          genericTypeParameters: [],
          parameters: [],
        },
      };
      externalComponents.components['other-package'] = {
        contextIris: [ 'http://example.org/context-other-package.jsonld' ],
        componentNamesToIris: {
          MyClass: 'http://example.org/other-package.ttl#MyClass',
        },
      };
      expect(await ctor.constructComponents()).toEqual({
        [Path.normalize('/docs/package/components/b/file')]: {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
            'http://example.org/context-other-package.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'op:MyClass',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass',
            },
          ],
        },
      });
    });

    it('should handle components without constructors', async() => {
      (<any> ctor).classAndInterfaceIndex = {
        MyClass1: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass1',
          fileName: Path.normalize('/docs/package/src/b/file'),
          generics: {},
        },
        MyClass2: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass2',
          fileName: Path.normalize('/docs/package/src/b/file'),
          generics: {},
        },
      };
      expect(await ctor.constructComponents()).toEqual({
        [Path.normalize('/docs/package/components/b/file')]: {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:components/b/file.jsonld#MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass1',
            },
            {
              '@id': 'mp:components/b/file.jsonld#MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [],
              parameters: [],
            },
          ],
        },
      });
    });
  });

  describe('constructComponentsIndex', () => {
    it('should handle an empty index', async() => {
      expect(await ctor.constructComponentsIndex({})).toEqual({
        '@context': [
          'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
        ],
        '@id': 'npmd:my-package',
        '@type': 'Module',
        requireName: 'my-package',
        import: [],
      });
    });

    it('should handle a non-empty index', async() => {
      expect(await ctor.constructComponentsIndex(<any> {
        [Path.normalize('/docs/package/components/file1')]: true,
        [Path.normalize('/docs/package/components/file2')]: true,
        [Path.normalize('/docs/package/components/file/a/b/c')]: true,
      })).toEqual({
        '@context': [
          'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
        ],
        '@id': 'npmd:my-package',
        '@type': 'Module',
        requireName: 'my-package',
        import: [
          'mp:components/file1.jsonld',
          'mp:components/file2.jsonld',
          'mp:components/file/a/b/c.jsonld',
        ],
      });
    });
  });

  describe('getImportPathIri', () => {
    it('should error for a non-applicable file', () => {
      expect(() => ctor.getImportPathIri('/not-components/a/b'))
        .toThrow(new Error(`Could not find a valid import path for not-components/a/b. 'lsd:importPaths' in package.json may be invalid.`));
    });

    it('should handle an applicable file, starting with a slash', () => {
      expect(ctor.getImportPathIri('/components/a/b'))
        .toEqual('https://linkedsoftwaredependencies.org/bundles/npm/my-package/^1.0.0/components/a/b');
    });

    it('should handle an applicable file, not starting with a slash', () => {
      expect(ctor.getImportPathIri('components/a/b'))
        .toEqual('https://linkedsoftwaredependencies.org/bundles/npm/my-package/^1.0.0/components/a/b');
    });
  });

  describe('getPathRelative', () => {
    it('should error when source is outside package', () => {
      expect(() => ComponentConstructor.getPathRelative(pathDestination, 'not-in-package'))
        .toThrow(new Error('Tried to reference a file outside the current package: not-in-package'));
    });

    it('should handle a valid path', () => {
      expect(ComponentConstructor.getPathRelative(pathDestination, Path.normalize('/docs/package/src/a/b/myFile')))
        .toEqual('a/b/myFile');
    });

    it('should generate the correct path for POSIX path implementations.', () => {
      const sep = Path.sep;
      (<any> Path).sep = Path.posix.sep;
      (<any> ctor).pathDestination.packageRootDirectory = Path.posix.normalize('/docs/package');
      expect(ComponentConstructor.getPathRelative(
        pathDestination,
        Path.posix.normalize('/docs/package/src/a/b/myFile'),
      )).toEqual('a/b/myFile');
      (<any> Path).sep = sep;
    });

    it('should generate the correct path for win32 path implementations.', () => {
      const sep = Path.sep;
      (<any> Path).sep = Path.win32.sep;
      (<any> ctor).pathDestination.packageRootDirectory = Path.win32.normalize('/docs/package');
      expect(ComponentConstructor.getPathRelative(
        pathDestination,
        Path.win32.normalize('/docs/package/src/a/b/myFile'),
      )).toEqual('a/b/myFile');
      (<any> Path).sep = sep;
    });
  });

  describe('getPathDestination', () => {
    it('should error when source is outside package', () => {
      expect(() => ComponentConstructor.getPathDestination(pathDestination, 'not-in-package'))
        .toThrow(new Error('Tried to reference a file outside the current package: not-in-package'));
    });

    it('should handle a valid path', () => {
      expect(ComponentConstructor.getPathDestination(pathDestination, Path.normalize('/docs/package/src/myFile')))
        .toEqual(Path.normalize('/docs/package/components/myFile'));
    });
  });

  describe('constructComponent', () => {
    it('should handle a component with empty constructor', async() => {
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [],
      }, [])).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with non-empty constructor', async() => {
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: { type: 'raw', value: 'boolean' },
            comment: 'Hi1',
          },
          {
            type: 'field',
            name: 'fieldB',
            range: { type: 'raw', value: 'string' },
            comment: 'Hi2',
          },
        ],
      }, [])).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass',
        '@type': 'Class',
        constructorArguments: [
          { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA' },
          { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldB' },
        ],
        parameters: [
          {
            '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
            comment: 'Hi1',
            range: 'xsd:boolean',
          },
          {
            '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldB',
            comment: 'Hi2',
            range: 'xsd:string',
          },
        ],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with abstract class', async() => {
      (<ClassLoaded> classReference).abstract = true;
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [],
      }, [])).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass',
        '@type': 'AbstractClass',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with super class', async() => {
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [],
      }, [
        {
          classLoaded: <any> {
            packageName: 'my-package',
            localName: 'SuperClass',
            fileName: Path.normalize('/docs/package/src/a/b/SuperFile'),
          },
          genericTypeInstantiations: [],
        },
      ])).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        extends: [ 'mp:components/a/b/SuperFile.jsonld#SuperClass' ],
      });
    });

    it('should handle a component with implementing interfaces', async() => {
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [],
      }, [
        {
          classLoaded: <any> {
            packageName: 'my-package',
            localName: 'SuperInterface1',
            fileName: Path.normalize('/docs/package/src/a/b/SuperFile1'),
          },
          genericTypeInstantiations: [],
        },
        {
          classLoaded: <any> {
            packageName: 'my-package',
            localName: 'SuperInterface2',
            fileName: Path.normalize('/docs/package/src/a/b/SuperFile2'),
          },
          genericTypeInstantiations: [],
        },
      ])).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        extends: [
          'mp:components/a/b/SuperFile1.jsonld#SuperInterface1',
          'mp:components/a/b/SuperFile2.jsonld#SuperInterface2',
        ],
      });
    });

    it('should handle a component with comment', async() => {
      classReference.comment = 'Hi';
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [],
      }, [])).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        comment: 'Hi',
      });
    });

    it('should handle an interface component', async() => {
      classReference.type = 'interface';
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [],
      }, [])).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass',
        '@type': 'AbstractClass',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with generic types', async() => {
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [
          {
            name: 'T',
          },
          {
            name: 'U',
            range: {
              type: 'raw',
              value: 'number',
            },
          },
          {
            name: 'V',
            range: {
              type: 'class',
              value: classReference,
              genericTypeParameterInstances: [
                {
                  type: 'genericTypeReference',
                  value: 'U',
                  origin: classReference,
                },
                {
                  type: 'raw',
                  value: 'string',
                },
              ],
            },
          },
        ],
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'genericTypeReference',
              value: 'U',
              origin: classReference,
            },
            comment: 'Hi1',
          },
          {
            type: 'field',
            name: 'fieldB',
            range: {
              type: 'genericTypeReference',
              value: 'V',
              origin: classReference,
            },
            comment: 'Hi2',
          },
        ],
      }, [])).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass',
        '@type': 'Class',
        constructorArguments: [
          { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA' },
          { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldB' },
        ],
        genericTypeParameters: [
          {
            '@id': 'mp:components/a/b/file-param.jsonld#MyClass__generic_T',
          },
          {
            '@id': 'mp:components/a/b/file-param.jsonld#MyClass__generic_U',
            range: 'xsd:number',
          },
          {
            '@id': 'mp:components/a/b/file-param.jsonld#MyClass__generic_V',
            range: {
              '@type': 'ParameterRangeGenericComponent',
              component: 'mp:components/a/b/file-param.jsonld#MyClass',
              genericTypeInstances: [
                {
                  '@type': 'ParameterRangeGenericTypeReference',
                  parameterRangeGenericType: 'mp:components/a/b/file-param.jsonld#MyClass__generic_U',
                },
                'xsd:string',
              ],
            },
          },
        ],
        parameters: [
          {
            '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
            comment: 'Hi1',
            range: {
              '@type': 'ParameterRangeGenericTypeReference',
              parameterRangeGenericType: 'mp:components/a/b/file-param.jsonld#MyClass__generic_U',
            },
          },
          {
            '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldB',
            comment: 'Hi2',
            range: {
              '@type': 'ParameterRangeGenericTypeReference',
              parameterRangeGenericType: 'mp:components/a/b/file-param.jsonld#MyClass__generic_V',
            },
          },
        ],
        requireElement: 'MyClass',
      });
    });
  });

  describe('constructExtensionDefinition', () => {
    it('should handle an extension without generics', async() => {
      expect(await ctor.constructExtensionDefinition(context, externalContextsCallback, {
        classLoaded: classReference,
        genericTypeInstantiations: [],
      })).toEqual('mp:components/a/b/file-param.jsonld#MyClass');
    });

    it('should handle an extension with generics', async() => {
      expect(await ctor.constructExtensionDefinition(context, externalContextsCallback, {
        classLoaded: classReference,
        genericTypeInstantiations: [
          { type: 'raw', value: 'boolean' },
          { type: 'raw', value: 'string' },
        ],
      })).toEqual({
        '@type': 'ParameterRangeGenericComponent',
        component: 'mp:components/a/b/file-param.jsonld#MyClass',
        genericTypeInstances: [ 'xsd:boolean', 'xsd:string' ],
      });
    });
  });

  describe('moduleIriToId', () => {
    it('should return a compacted module IRI', () => {
      expect(ctor.moduleIriToId(context))
        .toEqual('npmd:my-package');
    });
  });

  describe('classNameToId', () => {
    it('should return a compacted class IRI within the current package', async() => {
      expect(await ctor.classNameToId(context, externalContextsCallback, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      })).toEqual('mp:components/a/b/MyOwnClass.jsonld#MyClass');
    });

    it('should return an existing IRI in another package that is being generated', async() => {
      const packageMetadata = <any> {
        name: 'other-package',
        version: '3.2.1',
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/other-package',
        contexts: {
          'http://example.org/context-other-package.jsonld': true,
        },
      };
      externalComponents.packagesBeingGenerated['other-package'] = {
        packageMetadata,
        pathDestination: {
          packageRootDirectory: Path.normalize('/docs/other-package'),
          originalPath: 'src',
          replacementPath: 'components',
        },
        minimalContext: await new ContextParser({
          documentLoader: new PrefetchedDocumentLoader({
            contexts: {},
          }),
          skipValidation: true,
        }).parse(new ContextConstructorMocked({ packageMetadata }).constructContext()),
      };
      expect(await ctor.classNameToId(context, externalContextsCallback, {
        packageName: 'other-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/other-package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      })).toEqual('op:components/a/b/MyOwnClass.jsonld#MyClass');
      expect(externalContextsCallback).toHaveBeenCalledWith('http://example.org/context-other-package.jsonld');
    });

    it('should return an existing IRI in an external package', async() => {
      externalComponents.components['other-package'] = {
        contextIris: [ 'http://example.org/context-other-package.jsonld' ],
        componentNamesToIris: {
          MyClass: 'http://example.org/other-package.ttl#MyClass',
        },
      };
      expect(await ctor.classNameToId(context, externalContextsCallback, {
        packageName: 'other-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/other-package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      })).toEqual('op:MyClass');
      expect(externalContextsCallback).toHaveBeenCalledWith('http://example.org/context-other-package.jsonld');
    });

    it('should throw when an external package does not expose the component', async() => {
      externalComponents.components['other-package'] = {
        contextIris: [ 'http://example.org/context-other-package.jsonld' ],
        componentNamesToIris: {
          MyClassOther: 'http://example.org/other-package.ttl#MyClass',
        },
      };
      await expect(ctor.classNameToId(context, externalContextsCallback, {
        packageName: 'other-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/other-package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      })).rejects.toThrow(`Tried to reference a class 'MyClass' from an external module 'other-package' that does not expose this component`);
    });

    it('should throw when an external package does not exist', async() => {
      externalComponents.components['other-package-other'] = {
        contextIris: [ 'http://example.org/context-other-package.jsonld' ],
        componentNamesToIris: {
          MyClass: 'http://example.org/other-package.ttl#MyClass',
        },
      };
      await expect(ctor.classNameToId(context, externalContextsCallback, {
        packageName: 'other-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/other-package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      })).rejects.toThrow(`Tried to reference a class 'MyClass' from an external module 'other-package' that is not a dependency`);
    });
  });

  describe('fieldNameToId', () => {
    it('should return a compacted field IRI', () => {
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:components/a/b/MyOwnClass.jsonld#MyClass_field');
    });

    it('should return a compacted field IRI for parent field names', () => {
      scope.parentFieldNames.push('a');
      scope.parentFieldNames.push('b');
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:components/a/b/MyOwnClass.jsonld#MyClass_a_b_field');
    });

    it('should return unique compacted field IRIs', () => {
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:components/a/b/MyOwnClass.jsonld#MyClass_field');
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:components/a/b/MyOwnClass.jsonld#MyClass_field_1');
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:components/a/b/MyOwnClass.jsonld#MyClass_field_2');
    });

    it('should return a compacted field IRI for a class in another package that is being generated', async() => {
      const packageMetadata = <any> {
        name: 'other-package',
        version: '3.2.1',
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/other-package',
        contexts: {
          'http://example.org/context-other-package.jsonld': true,
        },
      };
      externalComponents.packagesBeingGenerated['other-package'] = {
        packageMetadata,
        pathDestination: {
          packageRootDirectory: Path.normalize('/docs/other-package'),
          originalPath: 'src',
          replacementPath: 'components',
        },
        minimalContext: await new ContextParser({
          documentLoader: new PrefetchedDocumentLoader({
            contexts: {},
          }),
          skipValidation: true,
        }).parse(new ContextConstructorMocked({ packageMetadata }).constructContext()),
      };
      expect(ctor.fieldNameToId(context, {
        packageName: 'other-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/other-package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('npmd:other-package/^3.0.0/components/a/b/MyOwnClass.jsonld#MyClass_field');
    });

    it('should throw on a compacted field IRI for a class in another package that is not being generated', async() => {
      expect(() => ctor.fieldNameToId(context, {
        packageName: 'other-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/other-package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope))
        .toThrowError(/Tried to reference a field field in ".*" outside the current package: .*/u);
    });
  });

  describe('constructGenericTypeParameters', () => {
    it('should handle a constructor with no generics', async() => {
      expect(await ctor.constructGenericTypeParameters(context, externalContextsCallback, classReference, []))
        .toEqual([]);
    });

    it('should handle a constructor with a single untyped generic', async() => {
      expect(await ctor.constructGenericTypeParameters(context, externalContextsCallback, classReference, [
        {
          name: 'T',
        },
      ])).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass__generic_T',
        },
      ]);
    });

    it('should handle a constructor with a single typed generic', async() => {
      expect(await ctor.constructGenericTypeParameters(context, externalContextsCallback, classReference, [
        {
          name: 'T',
          range: {
            type: 'raw',
            value: 'number',
          },
        },
      ])).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass__generic_T',
          range: 'xsd:number',
        },
      ]);
    });

    it('should handle a constructor with a multiple generics', async() => {
      expect(await ctor.constructGenericTypeParameters(context, externalContextsCallback, classReference, [
        {
          name: 'T',
        },
        {
          name: 'U',
          range: {
            type: 'raw',
            value: 'number',
          },
        },
      ])).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass__generic_T',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass__generic_U',
          range: 'xsd:number',
        },
      ]);
    });
  });

  describe('constructParameters', () => {
    it('should handle a constructor with no params', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [],
      }, parameters)).toEqual([]);
      expect(parameters).toEqual([]);
    });

    it('should handle a constructor with two params', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: { type: 'raw', value: 'boolean' },
            comment: 'Hi1',
          },
          {
            type: 'field',
            name: 'fieldB',
            range: { type: 'raw', value: 'string' },
            comment: 'Hi2',
          },
        ],
      }, parameters)).toEqual([
        { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA' },
        { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldB' },
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a constructor with three params with identical names', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [
          {
            type: 'field',
            name: 'field',
            range: { type: 'raw', value: 'boolean' },
            comment: 'Hi1',
          },
          {
            type: 'field',
            name: 'field',
            range: { type: 'raw', value: 'string' },
            comment: 'Hi2',
          },
          {
            type: 'field',
            name: 'field',
            range: { type: 'raw', value: 'string' },
            comment: 'Hi3',
          },
        ],
      }, parameters)).toEqual([
        { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' },
        { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_1' },
        { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_2' },
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi1',
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_1',
          comment: 'Hi2',
          range: 'xsd:string',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_2',
          comment: 'Hi3',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a constructor with a nested param with two sub-params', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [
          {
            type: 'field',
            name: 'field',
            range: {
              type: 'nested',
              value: [
                {
                  type: 'field',
                  name: 'fieldA',
                  range: { type: 'raw', value: 'boolean' },
                  comment: 'Hi1',
                },
                {
                  type: 'field',
                  name: 'fieldB',
                  range: { type: 'raw', value: 'string' },
                  comment: 'Hi2',
                },
              ],
            },
            comment: 'Hi',
          },
        ],
      }, parameters)).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
          fields: [
            { keyRaw: 'fieldA', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA' }},
            { keyRaw: 'fieldB', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB' }},
          ],
        },
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a constructor with a nested param with a hash', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
        classLoaded: (<any> ctor).classAndInterfaceIndex.MyClass1,
        genericTypeParameters: [],
        parameters: [
          {
            type: 'field',
            name: 'field',
            range: {
              type: 'nested',
              value: [
                {
                  type: 'field',
                  name: 'fieldA',
                  range: {
                    type: 'nested',
                    value: [
                      {
                        type: 'index',
                        domain: 'string',
                        range: { type: 'raw', value: 'boolean' },
                        comment: 'Hi1',
                      },
                    ],
                  },
                  comment: 'Hi1',
                },
              ],
            },
            comment: 'Hi',
          },
        ],
      }, parameters)).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
          fields: [
            {
              keyRaw: 'fieldA',
              value: {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA__constructorArgument',
                fields: [
                  {
                    collectEntries: 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA',
                    key: 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA_key',
                    value: {
                      '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA_value',
                    },
                  },
                ],
              },
            },
          ],
        },
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA',
          comment: 'Hi1',
          range: {
            '@type': 'ParameterRangeCollectEntries',
            parameterRangeCollectEntriesParameters: [
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA_key',
              },
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA_value',
                comment: 'Hi1',
                range: 'xsd:boolean',
              },
            ],
          },
        },
      ]);
    });
  });

  describe('parameterDataToConstructorArgument', () => {
    it('should handle a raw parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'raw', value: 'boolean' },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: 'xsd:boolean',
        },
      ]);
    });

    it('should handle an override parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'override', value: 'boolean' },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: 'xsd:boolean',
        },
      ]);
    });

    it('should handle a class parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: {
            type: 'class',
            value: <ClassReferenceLoaded> {
              packageName: 'my-package',
              localName: 'ClassParam',
              fileName: Path.normalize('/docs/package/src/a/b/file-param'),
            },
            genericTypeParameterInstances: undefined,
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: 'mp:components/a/b/file-param.jsonld#ClassParam',
        },
      ]);
    });

    it('should handle an undefined parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'undefined' },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: {
            '@type': 'ParameterRangeUndefined',
          },
        },
      ]);
    });

    it('should handle an empty nested parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'nested', value: []},
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
        fields: [],
      });
      expect(parameters).toEqual([]);
    });

    it('should handle a nested parameter definition with raw field', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'field',
                range: { type: 'raw', value: 'boolean' },
                comment: 'Hi',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'field', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_field' }},
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_field',
          comment: 'Hi',
          range: 'xsd:boolean',
        },
      ]);
    });

    it('should handle a nested parameter definition with multiple raw fields', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'fieldA',
                range: { type: 'raw', value: 'boolean' },
                comment: 'Hi1',
              },
              {
                type: 'field',
                name: 'fieldB',
                range: { type: 'raw', value: 'string' },
                comment: 'Hi2',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'fieldA', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA' }},
          { keyRaw: 'fieldB', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB' }},
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a nested parameter definition with multiple raw fields and scoped default', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          defaultNested: [
            {
              paramPath: [ 'field', 'fieldA' ],
              value: { type: 'raw', value: 'VALUE' },
            },
          ],
          range: {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'fieldA',
                range: { type: 'raw', value: 'boolean' },
                comment: 'Hi1',
              },
              {
                type: 'field',
                name: 'fieldB',
                range: { type: 'raw', value: 'string' },
                comment: 'Hi2',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'fieldA', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA' }},
          { keyRaw: 'fieldB', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB' }},
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA',
          comment: 'Hi1',
          default: 'VALUE',
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a deep nested parameter definition with multiple raw fields and scoped default', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          defaultNested: [
            {
              paramPath: [ 'field', 'fieldA', 'field1' ],
              value: { type: 'raw', value: 'VALUE' },
            },
          ],
          range: {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'fieldA',
                range: {
                  type: 'nested',
                  value: [
                    {
                      type: 'field',
                      name: 'field1',
                      range: { type: 'raw', value: 'boolean' },
                      comment: 'Hi1',
                    },
                    {
                      type: 'field',
                      name: 'field2',
                      range: { type: 'raw', value: 'string' },
                      comment: 'Hi2',
                    },
                  ],
                },
                comment: 'Hi1',
              },
              {
                type: 'field',
                name: 'fieldB',
                range: { type: 'raw', value: 'string' },
                comment: 'Hi2',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
        fields: [
          {
            keyRaw: 'fieldA',
            value: {
              '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA__constructorArgument',
              fields: [
                {
                  keyRaw: 'field1',
                  value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA_field1' },
                },
                {
                  keyRaw: 'field2',
                  value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA_field2' },
                },
              ],
            },
          },
          { keyRaw: 'fieldB', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB' }},
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA_field1',
          comment: 'Hi1',
          default: 'VALUE',
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA_field2',
          comment: 'Hi2',
          range: 'xsd:string',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a default and nested default', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          defaultNested: [
            {
              paramPath: [ 'field', 'fieldA' ],
              value: { type: 'raw', value: 'VALUE' },
            },
          ],
          range: {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'fieldA',
                range: { type: 'raw', value: 'boolean' },
                defaults: [{ type: 'raw', value: 'VALUEOTHER' }],
                comment: 'Hi1',
              },
              {
                type: 'field',
                name: 'fieldB',
                range: { type: 'raw', value: 'string' },
                comment: 'Hi2',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
        fields: [
          {
            keyRaw: 'fieldA',
            value: {
              '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA',
            },
          },
          { keyRaw: 'fieldB', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB' }},
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA',
          comment: 'Hi1',
          default: {
            '@list': [ 'VALUEOTHER', 'VALUE' ],
          },
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a recursive nested parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'fieldA',
                range: { type: 'raw', value: 'boolean' },
                comment: 'Hi1',
              },
              {
                type: 'field',
                name: 'fieldSub',
                range: {
                  type: 'nested',
                  value: [
                    {
                      type: 'field',
                      name: 'fieldB',
                      range: { type: 'raw', value: 'string' },
                      comment: 'Hi2',
                    },
                  ],
                },
                comment: 'Hi',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'fieldA', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA' }},
          {
            keyRaw: 'fieldSub',
            value: {
              '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldSub__constructorArgument',
              fields: [
                {
                  keyRaw: 'fieldB',
                  value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldSub_fieldB' },
                },
              ],
            },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_fieldSub_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a recursive nested parameter definition with identical field names', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'field',
                range: { type: 'raw', value: 'boolean' },
                comment: 'Hi1',
              },
              {
                type: 'field',
                name: 'value',
                range: {
                  type: 'nested',
                  value: [
                    {
                      type: 'field',
                      name: 'field',
                      range: { type: 'raw', value: 'string' },
                      comment: 'Hi2',
                    },
                  ],
                },
                comment: 'Hi',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'field', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_field' }},
          {
            keyRaw: 'value',
            value: {
              '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_value__constructorArgument',
              fields: [
                { keyRaw: 'field', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_value_field' }},
              ],
            },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_field',
          comment: 'Hi1',
          range: 'xsd:boolean',
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_value_field',
          comment: 'Hi2',
          range: 'xsd:string',
        },
      ]);
    });

    it('should handle a nested field with indexed parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'fieldA',
          range: {
            type: 'nested',
            value: [
              {
                type: 'index',
                domain: 'string',
                range: { type: 'raw', value: 'boolean' },
                comment: 'Hi1',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_fieldA', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA__constructorArgument',
        fields: [
          {
            collectEntries: 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
            key: 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_key',
            value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_value' },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
          comment: 'Hi',
          range: {
            '@type': 'ParameterRangeCollectEntries',
            parameterRangeCollectEntriesParameters: [
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_key',
              },
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_value',
                comment: 'Hi1',
                range: 'xsd:boolean',
              },
            ],
          },
        },
      ]);
    });

    it('should handle a nested field with indexed parameter and field definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'fieldA',
          range: {
            type: 'nested',
            value: [
              {
                type: 'index',
                domain: 'string',
                range: { type: 'raw', value: 'boolean' },
                comment: 'Hi1',
              },
              {
                type: 'field',
                name: 'fieldB',
                range: { type: 'raw', value: 'boolean' },
                comment: 'Hi1',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_fieldA', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA__constructorArgument',
        fields: [
          {
            collectEntries: 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
            key: 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_key',
            value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_value' },
          },
          {
            keyRaw: 'fieldB',
            value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_fieldB' },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
          comment: 'Hi',
          range: {
            '@type': 'ParameterRangeCollectEntries',
            parameterRangeCollectEntriesParameters: [
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_key',
              },
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_value',
                comment: 'Hi1',
                range: 'xsd:boolean',
              },
            ],
          },
        },
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_fieldB',
          comment: 'Hi1',
          range: 'xsd:boolean',
        },
      ]);
    });

    it('should handle a nested field in a union with indexed parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'fieldA',
          range: {
            type: 'union',
            elements: [
              {
                type: 'nested',
                value: [
                  {
                    type: 'index',
                    domain: 'string',
                    range: { type: 'raw', value: 'boolean' },
                    comment: 'Hi1',
                  },
                ],
              },
              {
                type: 'undefined',
              },
            ],
          },
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_fieldA', scope)).toEqual({
        '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA__constructorArgument',
        fields: [
          {
            collectEntries: 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
            key: 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_key',
            value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_value' },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
          comment: 'Hi',
          range: {
            '@type': 'ParameterRangeCollectEntries',
            parameterRangeCollectEntriesParameters: [
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_key',
              },
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_value',
                comment: 'Hi1',
                range: 'xsd:boolean',
              },
            ],
          },
        },
      ]);
    });

    it('should handle a parameter with default raw value', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'raw', value: 'boolean' },
          defaults: [{ type: 'raw', value: 'abc' }],
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: 'xsd:boolean',
          default: 'abc',
        },
      ]);
    });

    it('should handle a parameter with default raw value with array range', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'array', value: { type: 'raw', value: 'boolean' }},
          defaults: [{ type: 'raw', value: 'abc' }],
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: {
            '@type': 'ParameterRangeArray',
            parameterRangeValue: 'xsd:boolean',
          },
          default: {
            '@list': [
              'abc',
            ],
          },
        },
      ]);
    });

    it('should handle a parameter with default iri value', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'raw', value: 'boolean' },
          defaults: [{ type: 'iri', value: 'ex:abc', baseComponent: classReference }],
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: 'xsd:boolean',
          default: { '@id': 'ex:abc' },
        },
      ]);
    });

    it('should handle a parameter with default iri value that is relative', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'raw', value: 'boolean' },
          defaults: [{ type: 'iri', value: 'abc', baseComponent: classReference }],
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: 'xsd:boolean',
          default: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_abc' },
        },
      ]);
    });

    it('should handle a parameter with default json value', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'override', value: 'json' },
          defaults: [{ type: 'raw', value: '{"a":true}' }],
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: 'rdf:JSON',
          default: {
            '@type': '@json',
            '@value': { a: true },
          },
        },
      ]);
    });

    it('should handle a parameter with default optional json value', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: {
            type: 'union',
            elements: [
              { type: 'override', value: 'json' },
              { type: 'undefined' },
            ],
          },
          defaults: [{ type: 'raw', value: '{"a":true}' }],
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .toEqual({ '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field',
          comment: 'Hi',
          range: {
            '@type': 'ParameterRangeUnion',
            parameterRangeElements: [
              'rdf:JSON',
              { '@type': 'ParameterRangeUndefined' },
            ],
          },
          default: {
            '@type': '@json',
            '@value': { a: true },
          },
        },
      ]);
    });

    it('should throw on a parameter with an invalid default json value', async() => {
      const parameters: ParameterDefinition[] = [];
      await expect(ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'override', value: 'json' },
          defaults: [{ type: 'raw', value: '{"a":invalid}' }],
          comment: 'Hi',
        }, parameters, 'mp:components/a/b/file-param.jsonld#MyClass_field', scope))
        .rejects.toThrow(`JSON parsing error in default value of mp:components/a/b/file-param.jsonld#MyClass_field: Unexpected token i in JSON at position 5`);
    });
  });

  describe('constructFieldDefinitionNested', () => {
    let parameters: ParameterDefinition[];
    beforeEach(() => {
      parameters = [];
    });

    it('should construct a field', async() => {
      const parameterData: ParameterData<ParameterRangeResolved> & { range: { type: 'nested' } } = {
        type: 'field',
        name: 'field',
        range: {
          type: 'nested',
          value: [
            {
              type: 'field',
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              comment: 'Hi',
            },
          ],
        },
        comment: 'Hi',
      };
      const subParamData: ParameterData<ParameterRangeResolved> = (<any> parameterData).range.value[0];
      expect(await ctor.constructFieldDefinitionNested(
        context,
        externalContextsCallback,
        <ClassLoaded> classReference,
        parameterData,
        parameters,
        subParamData,
        '',
        scope,
      ))
        .toEqual({ keyRaw: 'fieldA', value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA' }});
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
          comment: 'Hi',
          range: 'xsd:boolean',
        },
      ]);
    });

    it('should construct a double nested field', async() => {
      const parameterData: ParameterData<ParameterRangeResolved> & { range: { type: 'nested' } } = {
        type: 'field',
        name: 'field',
        range: {
          type: 'nested',
          value: [
            {
              type: 'field',
              name: 'field',
              range: {
                type: 'nested',
                value: [
                  {
                    type: 'field',
                    name: 'field',
                    range: { type: 'raw', value: 'boolean' },
                    comment: 'Hi',
                  },
                ],
              },
              comment: 'Hi',
            },
          ],
        },
        comment: 'Hi',
      };
      const subParamData: ParameterData<ParameterRangeResolved> = (<any> parameterData).range.value[0];
      expect(await ctor.constructFieldDefinitionNested(
        context,
        externalContextsCallback,
        <ClassLoaded> classReference,
        parameterData,
        parameters,
        subParamData,
        '',
        scope,
      ))
        .toEqual({
          keyRaw: 'field',
          value: {
            '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field__constructorArgument',
            fields: [
              {
                keyRaw: 'field',
                value: {
                  '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_field',
                },
              },
            ],
          },
        });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_field_field',
          comment: 'Hi',
          range: 'xsd:boolean',
        },
      ]);
    });

    it('should construct an indexed element with raw values', async() => {
      const parameterData: ParameterData<ParameterRangeResolved> & { range: { type: 'nested' } } = {
        type: 'field',
        name: 'fieldA',
        range: {
          type: 'nested',
          value: [
            {
              type: 'index',
              domain: 'string',
              range: { type: 'raw', value: 'boolean' },
              comment: 'Hi',
            },
          ],
        },
        comment: 'Hi',
      };
      const subParamData: ParameterData<ParameterRangeResolved> = (<any> parameterData).range.value[0];
      expect(await ctor.constructFieldDefinitionNested(
        context,
        externalContextsCallback,
        <ClassLoaded> classReference,
        parameterData,
        parameters,
        subParamData,
        'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
        scope,
      ))
        .toEqual({
          collectEntries: 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
          key: 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_key',
          value: { '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_value' },
        });
      expect(parameters).toEqual([
        {
          '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA',
          comment: 'Hi',
          range: {
            '@type': 'ParameterRangeCollectEntries',
            parameterRangeCollectEntriesParameters: [
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_key',
              },
              {
                '@id': 'mp:components/a/b/file-param.jsonld#MyClass_fieldA_value',
                comment: 'Hi',
                range: 'xsd:boolean',
              },
            ],
          },
        },
      ]);
    });

    it('should error on an indexed element inside another index', async() => {
      const parameterData: ParameterData<ParameterRangeResolved> & { range: { type: 'nested' } } = {
        type: 'index',
        domain: 'string',
        range: {
          type: 'nested',
          value: [
            {
              type: 'index',
              domain: 'string',
              range: { type: 'raw', value: 'boolean' },
              comment: 'Hi',
            },
          ],
        },
        comment: 'Hi',
      };
      const subParamData: ParameterData<ParameterRangeResolved> = (<any> parameterData).range.value[0];
      await expect(ctor
        .constructFieldDefinitionNested(
          context,
          externalContextsCallback,
          <ClassLoaded> classReference,
          parameterData,
          parameters,
          subParamData,
          '',
          scope,
        )).rejects
        .toThrow(new Error(`Detected illegal indexed element inside a non-field in MyClass at ${Path.normalize('/docs/package/src/a/b/file-param')}`));
    });
  });

  describe('constructParameterRange', () => {
    it('should construct a raw parameter range', async() => {
      const rangeValue = 'boolean';
      expect(await ctor.constructParameterRange(
        { type: 'raw', value: rangeValue },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual('xsd:boolean');
    });

    it('should construct a JSON parameter range', async() => {
      const rangeValue = 'json';
      expect(await ctor.constructParameterRange(
        { type: 'override', value: rangeValue },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual('rdf:JSON');
    });

    it('should construct a literal parameter range', async() => {
      expect(await ctor.constructParameterRange(
        { type: 'literal', value: 'abc' },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual({ '@type': 'ParameterRangeLiteral', parameterRangeValueLiteral: 'abc' });
    });

    it('should construct a class parameter range', async() => {
      const rangeValue: ClassReferenceLoaded = <any> {
        packageName: 'my-package',
        localName: 'ClassParam',
        fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      };
      expect(await ctor.constructParameterRange(
        { type: 'class', value: rangeValue, genericTypeParameterInstances: undefined },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual('mp:components/a/b/file-param.jsonld#ClassParam');
    });

    it('should construct a class parameter range with generics', async() => {
      const rangeValue: ClassReferenceLoaded = <any> {
        packageName: 'my-package',
        localName: 'ClassParam',
        fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      };
      expect(await ctor.constructParameterRange(
        {
          type: 'class',
          value: rangeValue,
          genericTypeParameterInstances: [
            {
              type: 'raw',
              value: 'number',
            },
            {
              type: 'genericTypeReference',
              value: 'T',
              origin: classReference,
            },
          ],
        },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeGenericComponent',
        component: 'mp:components/a/b/file-param.jsonld#ClassParam',
        genericTypeInstances: [
          'xsd:number',
          {
            '@type': 'ParameterRangeGenericTypeReference',
            parameterRangeGenericType: 'mp:components/a/b/file-param.jsonld#MyClass__generic_T',
          },
        ],
      });
    });

    it('should construct on a nested parameter range as undefined', async() => {
      const rangeValue: ParameterData<any>[] = [];
      expect(await ctor.constructParameterRange(
        { type: 'nested', value: rangeValue },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeUndefined',
      });
    });

    it('should construct an undefined parameter range', async() => {
      expect(await ctor.constructParameterRange(
        { type: 'undefined' },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeUndefined',
      });
    });

    it('should construct a union parameter range', async() => {
      const rangeValueClass: ClassReferenceLoaded = <any> {
        packageName: 'my-package',
        localName: 'ClassParam',
        fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      };
      const children: ParameterRangeResolved[] = [
        { type: 'raw', value: 'boolean' },
        { type: 'class', value: rangeValueClass, genericTypeParameterInstances: undefined },
      ];
      expect(await ctor.constructParameterRange(
        { type: 'union', elements: children },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeUnion',
        parameterRangeElements: [
          'xsd:boolean',
          'mp:components/a/b/file-param.jsonld#ClassParam',
        ],
      });
    });

    it('should construct an intersection parameter range', async() => {
      const rangeValueClass: ClassReferenceLoaded = <any> {
        packageName: 'my-package',
        localName: 'ClassParam',
        fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      };
      const children: ParameterRangeResolved[] = [
        { type: 'raw', value: 'boolean' },
        { type: 'class', value: rangeValueClass, genericTypeParameterInstances: undefined },
      ];
      expect(await ctor.constructParameterRange(
        { type: 'intersection', elements: children },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeIntersection',
        parameterRangeElements: [
          'xsd:boolean',
          'mp:components/a/b/file-param.jsonld#ClassParam',
        ],
      });
    });

    it('should construct a tuple parameter range', async() => {
      const rangeValueClass: ClassReferenceLoaded = <any> {
        packageName: 'my-package',
        localName: 'ClassParam',
        fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      };
      const elements: ParameterRangeResolved[] = [
        { type: 'raw', value: 'boolean' },
        { type: 'class', value: rangeValueClass, genericTypeParameterInstances: undefined },
      ];
      expect(await ctor.constructParameterRange(
        { type: 'tuple', elements },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeTuple',
        parameterRangeElements: [
          'xsd:boolean',
          'mp:components/a/b/file-param.jsonld#ClassParam',
        ],
      });
    });

    it('should construct a tuple parameter range with rest type', async() => {
      const rangeValueClass: ClassReferenceLoaded = <any> {
        packageName: 'my-package',
        localName: 'ClassParam',
        fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      };
      const elements: ParameterRangeResolved[] = [
        { type: 'rest', value: { type: 'raw', value: 'boolean' }},
        { type: 'class', value: rangeValueClass, genericTypeParameterInstances: undefined },
      ];
      expect(await ctor.constructParameterRange(
        { type: 'tuple', elements },
        context,
        externalContextsCallback,
        'mp:components/a/b/file-param.jsonld#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeTuple',
        parameterRangeElements: [
          {
            '@type': 'ParameterRangeRest',
            parameterRangeValue: 'xsd:boolean',
          },
          'mp:components/a/b/file-param.jsonld#ClassParam',
        ],
      });
    });

    it('should construct an array parameter range', async() => {
      expect(await ctor.constructParameterRange(
        { type: 'array', value: { type: 'raw', value: 'boolean' }},
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeArray',
        parameterRangeValue: 'xsd:boolean',
      });
    });

    it('should construct a generic type reference range', async() => {
      expect(await ctor.constructParameterRange(
        { type: 'genericTypeReference', value: 'T', origin: classReference },
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeGenericTypeReference',
        parameterRangeGenericType: 'mp:components/a/b/file-param.jsonld#MyClass__generic_T',
      });
    });

    it('should construct a keyof parameter range', async() => {
      expect(await ctor.constructParameterRange(
        { type: 'keyof', value: { type: 'raw', value: 'boolean' }},
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeKeyof',
        parameterRangeValue: 'xsd:boolean',
      });
    });
  });

  describe('populateOptionalParameterFields', () => {
    it('should fill in nothing when not needed', () => {
      const field = { '@id': 'ex:field' };
      ctor.populateOptionalParameterFields(field, {
        type: 'field',
        name: 'field',
        range: { type: 'raw', value: 'boolean' },
        comment: undefined,
      });
      expect(field).toEqual({
        '@id': 'ex:field',
      });
    });

    it('should fill in comment data', () => {
      const field = { '@id': 'ex:field' };
      ctor.populateOptionalParameterFields(field, {
        type: 'field',
        name: 'field',
        range: { type: 'raw', value: 'boolean' },
        comment: 'Hi',
      });
      expect(field).toEqual({
        '@id': 'ex:field',
        comment: 'Hi',
      });
    });

    it('should fill in the unique flag', () => {
      const field = { '@id': 'ex:field' };
      ctor.populateOptionalParameterFields(field, {
        type: 'field',
        name: 'field',
        range: { type: 'raw', value: 'boolean' },
        comment: undefined,
      });
      expect(field).toEqual({
        '@id': 'ex:field',
      });
    });
  });
});
