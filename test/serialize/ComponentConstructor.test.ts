import * as Path from 'path';
import { PrefetchedDocumentLoader } from 'componentsjs/lib/rdf/PrefetchedDocumentLoader';
import type { JsonLdContextNormalized } from 'jsonld-context-parser';
import { ContextParser } from 'jsonld-context-parser';
import type {
  ClassIndex,
  ClassLoaded,

  ClassReferenceLoaded,
  InterfaceLoaded,
} from '../../lib/parse/ClassIndex';
import type { ConstructorData } from '../../lib/parse/ConstructorLoader';
import type { ParameterData, ParameterRangeResolved } from '../../lib/parse/ParameterLoader';
import type { ExternalComponents } from '../../lib/resolution/ExternalModulesLoader';
import type { FieldScope, ExternalContextCallback } from '../../lib/serialize/ComponentConstructor';
import { ComponentConstructor } from '../../lib/serialize/ComponentConstructor';
import type { ParameterDefinition } from '../../lib/serialize/ComponentDefinitions';
import { ContextConstructorMocked } from '../ContextConstructorMocked';

describe('ComponentConstructor', () => {
  let ctor: ComponentConstructor;
  let classReference: ClassReferenceLoaded;
  let externalComponents: ExternalComponents;
  let context: JsonLdContextNormalized;
  let externalContextsCallback: ExternalContextCallback;
  let scope: FieldScope;

  beforeEach(async() => {
    classReference = <any> {
      type: 'class',
      packageName: 'my-package',
      localName: 'MyClass',
      fileName: Path.normalize('/docs/package/src/a/b/file-param'),
    };

    externalComponents = {
      moduleState: <any> {},
      components: {},
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
    const contextConstructor = new ContextConstructorMocked({ packageMetadata, typeScopedContexts: false });
    ctor = new ComponentConstructor({
      packageMetadata,
      contextConstructor,
      pathDestination: {
        packageRootDirectory: Path.normalize('/docs/package'),
        originalPath: 'src',
        replacementPath: 'components',
      },
      classAndInterfaceIndex: {},
      classConstructors: {},
      externalComponents,
      contextParser,
    });

    context = await contextParser.parse(contextConstructor.constructContext());

    externalContextsCallback = jest.fn();

    scope = {
      parentFieldNames: [],
      fieldIdsHash: {},
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
        },
        MyClass2: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass2',
          fileName: Path.normalize('/docs/package/src/b/file'),
        },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          type: 'class',
          parameters: [],
        },
        MyClass2: {
          type: 'class',
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              required: true,
              unique: true,
              comment: 'Hi1',
            },
            {
              type: 'field',
              name: 'fieldB',
              range: { type: 'raw', value: 'string' },
              required: true,
              unique: true,
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
              '@id': 'mp:b/file#MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass1',
            },
            {
              '@id': 'mp:b/file#MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [
                { '@id': 'mp:b/file#MyClass2_fieldA' },
                { '@id': 'mp:b/file#MyClass2_fieldB' },
              ],
              parameters: [
                {
                  '@id': 'mp:b/file#MyClass2_fieldA',
                  comment: 'Hi1',
                  range: 'xsd:boolean',
                  required: true,
                  unique: true,
                },
                {
                  '@id': 'mp:b/file#MyClass2_fieldB',
                  comment: 'Hi2',
                  range: 'xsd:string',
                  required: true,
                  unique: true,
                },
              ],
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
        },
        MyClass2: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass2',
          fileName: Path.normalize('/docs/package/src/b/file2'),
        },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          parameters: [],
        },
        MyClass2: {
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              required: true,
              unique: true,
              comment: 'Hi1',
            },
            {
              type: 'field',
              name: 'fieldB',
              range: { type: 'raw', value: 'string' },
              required: true,
              unique: true,
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
              '@id': 'mp:file1#MyClass1',
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
              '@id': 'mp:b/file2#MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [
                { '@id': 'mp:b/file2#MyClass2_fieldA' },
                { '@id': 'mp:b/file2#MyClass2_fieldB' },
              ],
              parameters: [
                {
                  '@id': 'mp:b/file2#MyClass2_fieldA',
                  comment: 'Hi1',
                  range: 'xsd:boolean',
                  required: true,
                  unique: true,
                },
                {
                  '@id': 'mp:b/file2#MyClass2_fieldB',
                  comment: 'Hi2',
                  range: 'xsd:string',
                  required: true,
                  unique: true,
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
          superClass: {
            packageName: 'other-package',
            localName: 'MyClass',
            fileName: Path.normalize('/docs/package/src/b/file'),
          },
        },
        MyClass2: {
          type: 'class',
          packageName: 'my-package',
          localName: 'MyClass2',
          fileName: Path.normalize('/docs/package/src/b/file'),
          superClass: {
            packageName: 'other-package',
            localName: 'MyClass',
            fileName: Path.normalize('/docs/package/src/b/file'),
          },
        },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          parameters: [],
        },
        MyClass2: {
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              required: true,
              unique: true,
              comment: 'Hi1',
            },
            {
              type: 'field',
              name: 'fieldB',
              range: { type: 'raw', value: 'string' },
              required: true,
              unique: true,
              comment: 'Hi2',
            },
          ],
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
              '@id': 'mp:b/file#MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              extends: [ 'op:MyClass' ],
              parameters: [],
              requireElement: 'MyClass1',
            },
            {
              '@id': 'mp:b/file#MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [
                { '@id': 'mp:b/file#MyClass2_fieldA' },
                { '@id': 'mp:b/file#MyClass2_fieldB' },
              ],
              extends: [ 'op:MyClass' ],
              parameters: [
                {
                  '@id': 'mp:b/file#MyClass2_fieldA',
                  comment: 'Hi1',
                  range: 'xsd:boolean',
                  required: true,
                  unique: true,
                },
                {
                  '@id': 'mp:b/file#MyClass2_fieldB',
                  comment: 'Hi2',
                  range: 'xsd:string',
                  required: true,
                  unique: true,
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
        },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          type: 'class',
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
  });

  describe('constructComponentsIndex', () => {
    it('should handle an empty index', async() => {
      expect(await ctor.constructComponentsIndex({}, 'jsonld')).toEqual({
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
      }, 'jsonld')).toEqual({
        '@context': [
          'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
        ],
        '@id': 'npmd:my-package',
        '@type': 'Module',
        requireName: 'my-package',
        import: [
          'files-mp:components/file1.jsonld',
          'files-mp:components/file2.jsonld',
          'files-mp:components/file/a/b/c.jsonld',
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
      expect(() => ctor.getPathRelative('not-in-package'))
        .toThrow(new Error('Tried to reference a file outside the current package: not-in-package'));
    });

    it('should handle a valid path', () => {
      expect(ctor.getPathRelative(Path.normalize('/docs/package/src/a/b/myFile')))
        .toEqual('a/b/myFile');
    });

    it('should generate the correct path for POSIX path implementations.', () => {
      const sep = Path.sep;
      (<any> Path).sep = Path.posix.sep;
      (<any> ctor).pathDestination.packageRootDirectory = Path.posix.normalize('/docs/package');
      expect(ctor.getPathRelative(Path.posix.normalize('/docs/package/src/a/b/myFile')))
        .toEqual('a/b/myFile');
      (<any> Path).sep = sep;
    });

    it('should generate the correct path for win32 path implementations.', () => {
      const sep = Path.sep;
      (<any> Path).sep = Path.win32.sep;
      (<any> ctor).pathDestination.packageRootDirectory = Path.win32.normalize('/docs/package');
      expect(ctor.getPathRelative(Path.win32.normalize('/docs/package/src/a/b/myFile')))
        .toEqual('a/b/myFile');
      (<any> Path).sep = sep;
    });
  });

  describe('getPathDestination', () => {
    it('should error when source is outside package', () => {
      expect(() => ctor.getPathDestination('not-in-package'))
        .toThrow(new Error('Tried to reference a file outside the current package: not-in-package'));
    });

    it('should handle a valid path', () => {
      expect(ctor.getPathDestination(Path.normalize('/docs/package/src/myFile')))
        .toEqual(Path.normalize('/docs/package/components/myFile'));
    });
  });

  describe('constructComponent', () => {
    it('should handle a component with empty constructor', async() => {
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with non-empty constructor', async() => {
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: { type: 'raw', value: 'boolean' },
            required: true,
            unique: true,
            comment: 'Hi1',
          },
          {
            type: 'field',
            name: 'fieldB',
            range: { type: 'raw', value: 'string' },
            required: true,
            unique: true,
            comment: 'Hi2',
          },
        ],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'Class',
        constructorArguments: [
          { '@id': 'mp:a/b/file-param#MyClass_fieldA' },
          { '@id': 'mp:a/b/file-param#MyClass_fieldB' },
        ],
        parameters: [
          {
            '@id': 'mp:a/b/file-param#MyClass_fieldA',
            comment: 'Hi1',
            range: 'xsd:boolean',
            required: true,
            unique: true,
          },
          {
            '@id': 'mp:a/b/file-param#MyClass_fieldB',
            comment: 'Hi2',
            range: 'xsd:string',
            required: true,
            unique: true,
          },
        ],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with abstract class', async() => {
      (<ClassLoaded> classReference).abstract = true;
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'AbstractClass',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with super class', async() => {
      (<ClassLoaded> classReference).superClass = <any> {
        packageName: 'my-package',
        localName: 'SuperClass',
        fileName: Path.normalize('/docs/package/src/a/b/SuperFile'),
      };
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        extends: [ 'mp:a/b/SuperFile#SuperClass' ],
      });
    });

    it('should handle a component with implementing interfaces', async() => {
      (<ClassLoaded> classReference).implementsInterfaces = <any> [
        {
          packageName: 'my-package',
          localName: 'SuperInterface1',
          fileName: Path.normalize('/docs/package/src/a/b/SuperFile1'),
        },
        {
          packageName: 'my-package',
          localName: 'SuperInterface2',
          fileName: Path.normalize('/docs/package/src/a/b/SuperFile2'),
        },
      ];
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        extends: [
          'mp:a/b/SuperFile1#SuperInterface1',
          'mp:a/b/SuperFile2#SuperInterface2',
        ],
      });
    });

    it('should handle a component with super class and implementing interfaces', async() => {
      (<ClassLoaded> classReference).superClass = <any> {
        packageName: 'my-package',
        localName: 'SuperClass',
        fileName: Path.normalize('/docs/package/src/a/b/SuperFile'),
      };
      (<ClassLoaded> classReference).implementsInterfaces = <any> [
        {
          packageName: 'my-package',
          localName: 'SuperInterface1',
          fileName: Path.normalize('/docs/package/src/a/b/SuperFile1'),
        },
        {
          packageName: 'my-package',
          localName: 'SuperInterface2',
          fileName: Path.normalize('/docs/package/src/a/b/SuperFile2'),
        },
      ];
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        extends: [
          'mp:a/b/SuperFile#SuperClass',
          'mp:a/b/SuperFile1#SuperInterface1',
          'mp:a/b/SuperFile2#SuperInterface2',
        ],
      });
    });

    it('should handle a component with comment', async() => {
      classReference.comment = 'Hi';
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
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
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'AbstractClass',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle an interface component with super interfaces', async() => {
      classReference.type = 'interface';
      (<InterfaceLoaded> classReference).superInterfaces = <any> [
        {
          packageName: 'my-package',
          localName: 'SuperInterface1',
          fileName: Path.normalize('/docs/package/src/a/b/SuperFile1'),
        },
        {
          packageName: 'my-package',
          localName: 'SuperInterface2',
          fileName: Path.normalize('/docs/package/src/a/b/SuperFile2'),
        },
      ];
      expect(await ctor.constructComponent(context, externalContextsCallback, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'AbstractClass',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        extends: [
          'mp:a/b/SuperFile1#SuperInterface1',
          'mp:a/b/SuperFile2#SuperInterface2',
        ],
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
      })).toEqual('mp:a/b/MyOwnClass#MyClass');
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
      }, 'field', scope)).toEqual('mp:a/b/MyOwnClass#MyClass_field');
    });

    it('should return a compacted field IRI for parent field names', () => {
      scope.parentFieldNames.push('a');
      scope.parentFieldNames.push('b');
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:a/b/MyOwnClass#MyClass_a_b_field');
    });

    it('should return unique compacted field IRIs', () => {
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:a/b/MyOwnClass#MyClass_field');
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:a/b/MyOwnClass#MyClass_field_1');
      expect(ctor.fieldNameToId(context, {
        packageName: 'my-package',
        localName: 'MyClass',
        fileName: Path.normalize('/docs/package/src/a/b/MyOwnClass'),
        fileNameReferenced: 'unused',
      }, 'field', scope)).toEqual('mp:a/b/MyOwnClass#MyClass_field_2');
    });
  });

  describe('constructParameters', () => {
    it('should handle a constructor with no params', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
        parameters: [],
      }, parameters)).toEqual([]);
      expect(parameters).toEqual([]);
    });

    it('should handle a constructor with two params', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: { type: 'raw', value: 'boolean' },
            required: true,
            unique: true,
            comment: 'Hi1',
          },
          {
            type: 'field',
            name: 'fieldB',
            range: { type: 'raw', value: 'string' },
            required: true,
            unique: true,
            comment: 'Hi2',
          },
        ],
      }, parameters)).toEqual([
        { '@id': 'mp:a/b/file-param#MyClass_fieldA' },
        { '@id': 'mp:a/b/file-param#MyClass_fieldB' },
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'mp:a/b/file-param#MyClass_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
          required: true,
          unique: true,
        },
      ]);
    });

    it('should handle a constructor with three params with identical names', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
        parameters: [
          {
            type: 'field',
            name: 'field',
            range: { type: 'raw', value: 'boolean' },
            required: true,
            unique: true,
            comment: 'Hi1',
          },
          {
            type: 'field',
            name: 'field',
            range: { type: 'raw', value: 'string' },
            required: true,
            unique: true,
            comment: 'Hi2',
          },
          {
            type: 'field',
            name: 'field',
            range: { type: 'raw', value: 'string' },
            required: true,
            unique: true,
            comment: 'Hi3',
          },
        ],
      }, parameters)).toEqual([
        { '@id': 'mp:a/b/file-param#MyClass_field' },
        { '@id': 'mp:a/b/file-param#MyClass_field_1' },
        { '@id': 'mp:a/b/file-param#MyClass_field_2' },
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'mp:a/b/file-param#MyClass_field_1',
          comment: 'Hi2',
          range: 'xsd:string',
          required: true,
          unique: true,
        },
        {
          '@id': 'mp:a/b/file-param#MyClass_field_2',
          comment: 'Hi3',
          range: 'xsd:string',
          required: true,
          unique: true,
        },
      ]);
    });

    it('should handle a constructor with a nested param with two sub-params', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
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
                  required: true,
                  unique: true,
                  comment: 'Hi1',
                },
                {
                  type: 'field',
                  name: 'fieldB',
                  range: { type: 'raw', value: 'string' },
                  required: true,
                  unique: true,
                  comment: 'Hi2',
                },
              ],
            },
            required: true,
            unique: true,
            comment: 'Hi',
          },
        ],
      }, parameters)).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field__constructorArgument',
          fields: [
            { keyRaw: 'fieldA', value: { '@id': 'mp:a/b/file-param#MyClass_field_fieldA' }},
            { keyRaw: 'fieldB', value: { '@id': 'mp:a/b/file-param#MyClass_field_fieldB' }},
          ],
        },
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field_fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'mp:a/b/file-param#MyClass_field_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
          required: true,
          unique: true,
        },
      ]);
    });

    it('should handle a constructor with a nested param with a hash', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor.constructParameters(context, externalContextsCallback, <ClassLoaded> classReference, {
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
                  required: true,
                  unique: true,
                  comment: 'Hi1',
                },
              ],
            },
            required: true,
            unique: true,
            comment: 'Hi',
          },
        ],
      }, parameters)).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field__constructorArgument',
          fields: [
            {
              keyRaw: 'fieldA',
              value: {
                '@id': 'mp:a/b/file-param#MyClass_field_fieldA__constructorArgument',
                fields: [
                  {
                    collectEntries: 'mp:a/b/file-param#MyClass_field_fieldA',
                    key: 'mp:a/b/file-param#MyClass_field_fieldA_key',
                    value: {
                      '@id': 'mp:a/b/file-param#MyClass_field_fieldA_value',
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
          '@id': 'mp:a/b/file-param#MyClass_field_fieldA',
          comment: 'Hi1',
          range: {
            '@id': 'mp:a/b/file-param#MyClass_field_fieldA_range',
            parameters: [
              {
                '@id': 'mp:a/b/file-param#MyClass_field_fieldA_key',
                required: true,
                unique: true,
              },
              {
                '@id': 'mp:a/b/file-param#MyClass_field_fieldA_value',
                comment: 'Hi1',
                range: 'xsd:boolean',
                required: true,
                unique: true,
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
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({ '@id': 'mp:a/b/file-param#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field',
          comment: 'Hi',
          range: 'xsd:boolean',
          required: true,
          unique: true,
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
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({ '@id': 'mp:a/b/file-param#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field',
          comment: 'Hi',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
      ]);
    });

    it('should handle a class parameter definition', async() => {
      const parameters: ParameterDefinition[] = [];
      expect(await ctor
        .parameterDataToConstructorArgument(context, externalContextsCallback, <ClassLoaded> classReference, {
          type: 'field',
          name: 'field',
          range: { type: 'class',
            value: <ClassReferenceLoaded> {
              packageName: 'my-package',
              localName: 'ClassParam',
              fileName: Path.normalize('/docs/package/src/a/b/file-param'),
            }},
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({ '@id': 'mp:a/b/file-param#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field',
          comment: 'Hi',
          range: 'mp:a/b/file-param#ClassParam',
          required: true,
          unique: true,
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
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({ '@id': 'mp:a/b/file-param#MyClass_field' });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field',
          comment: 'Hi',
          required: true,
          unique: true,
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
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_field__constructorArgument',
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
                required: true,
                unique: true,
                comment: 'Hi',
              },
            ],
          },
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'field', value: { '@id': 'mp:a/b/file-param#MyClass_field_field' }},
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field_field',
          comment: 'Hi',
          range: 'xsd:boolean',
          required: true,
          unique: true,
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
                required: true,
                unique: true,
                comment: 'Hi1',
              },
              {
                type: 'field',
                name: 'fieldB',
                range: { type: 'raw', value: 'string' },
                required: true,
                unique: true,
                comment: 'Hi2',
              },
            ],
          },
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'fieldA', value: { '@id': 'mp:a/b/file-param#MyClass_field_fieldA' }},
          { keyRaw: 'fieldB', value: { '@id': 'mp:a/b/file-param#MyClass_field_fieldB' }},
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field_fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'mp:a/b/file-param#MyClass_field_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
          required: true,
          unique: true,
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
                required: true,
                unique: true,
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
                      required: true,
                      unique: true,
                      comment: 'Hi2',
                    },
                  ],
                },
                required: true,
                unique: true,
                comment: 'Hi',
              },
            ],
          },
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'fieldA', value: { '@id': 'mp:a/b/file-param#MyClass_field_fieldA' }},
          {
            keyRaw: 'fieldSub',
            value: {
              '@id': 'mp:a/b/file-param#MyClass_field_fieldSub__constructorArgument',
              fields: [
                { keyRaw: 'fieldB', value: { '@id': 'mp:a/b/file-param#MyClass_field_fieldSub_fieldB' }},
              ],
            },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field_fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'mp:a/b/file-param#MyClass_field_fieldSub_fieldB',
          comment: 'Hi2',
          range: 'xsd:string',
          required: true,
          unique: true,
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
                required: true,
                unique: true,
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
                      required: true,
                      unique: true,
                      comment: 'Hi2',
                    },
                  ],
                },
                required: true,
                unique: true,
                comment: 'Hi',
              },
            ],
          },
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_field', scope)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_field__constructorArgument',
        fields: [
          { keyRaw: 'field', value: { '@id': 'mp:a/b/file-param#MyClass_field_field' }},
          {
            keyRaw: 'value',
            value: {
              '@id': 'mp:a/b/file-param#MyClass_field_value__constructorArgument',
              fields: [
                { keyRaw: 'field', value: { '@id': 'mp:a/b/file-param#MyClass_field_value_field' }},
              ],
            },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field_field',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'mp:a/b/file-param#MyClass_field_value_field',
          comment: 'Hi2',
          range: 'xsd:string',
          required: true,
          unique: true,
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
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_fieldA', scope)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_fieldA__constructorArgument',
        fields: [
          {
            collectEntries: 'mp:a/b/file-param#MyClass_fieldA',
            key: 'mp:a/b/file-param#MyClass_fieldA_key',
            value: { '@id': 'mp:a/b/file-param#MyClass_fieldA_value' },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_fieldA',
          comment: 'Hi',
          range: {
            '@id': 'mp:a/b/file-param#MyClass_fieldA_range',
            parameters: [
              {
                '@id': 'mp:a/b/file-param#MyClass_fieldA_key',
                required: true,
                unique: true,
              },
              {
                '@id': 'mp:a/b/file-param#MyClass_fieldA_value',
                comment: 'Hi1',
                range: 'xsd:boolean',
                required: true,
                unique: true,
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
                required: true,
                unique: true,
                comment: 'Hi1',
              },
            ],
          },
          required: true,
          unique: true,
          comment: 'Hi',
        }, parameters, 'mp:a/b/file-param#MyClass_fieldA', scope)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_fieldA__constructorArgument',
        fields: [
          {
            collectEntries: 'mp:a/b/file-param#MyClass_fieldA',
            key: 'mp:a/b/file-param#MyClass_fieldA_key',
            value: { '@id': 'mp:a/b/file-param#MyClass_fieldA_value' },
          },
          {
            keyRaw: 'fieldB',
            value: { '@id': 'mp:a/b/file-param#MyClass_fieldA_fieldB' },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_fieldA',
          comment: 'Hi',
          range: {
            '@id': 'mp:a/b/file-param#MyClass_fieldA_range',
            parameters: [
              {
                '@id': 'mp:a/b/file-param#MyClass_fieldA_key',
                required: true,
                unique: true,
              },
              {
                '@id': 'mp:a/b/file-param#MyClass_fieldA_value',
                comment: 'Hi1',
                range: 'xsd:boolean',
                required: true,
                unique: true,
              },
            ],
          },
        },
        {
          '@id': 'mp:a/b/file-param#MyClass_fieldA_fieldB',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
      ]);
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
              required: true,
              unique: true,
              comment: 'Hi',
            },
          ],
        },
        required: true,
        unique: true,
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
        .toEqual({ keyRaw: 'fieldA', value: { '@id': 'mp:a/b/file-param#MyClass_fieldA' }});
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_fieldA',
          comment: 'Hi',
          range: 'xsd:boolean',
          required: true,
          unique: true,
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
                    required: true,
                    unique: true,
                    comment: 'Hi',
                  },
                ],
              },
              required: true,
              unique: true,
              comment: 'Hi',
            },
          ],
        },
        required: true,
        unique: true,
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
            '@id': 'mp:a/b/file-param#MyClass_field__constructorArgument',
            fields: [
              {
                keyRaw: 'field',
                value: {
                  '@id': 'mp:a/b/file-param#MyClass_field_field',
                },
              },
            ],
          },
        });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_field_field',
          comment: 'Hi',
          range: 'xsd:boolean',
          required: true,
          unique: true,
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
        required: true,
        unique: false,
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
        'mp:a/b/file-param#MyClass_fieldA',
        scope,
      ))
        .toEqual({
          collectEntries: 'mp:a/b/file-param#MyClass_fieldA',
          key: 'mp:a/b/file-param#MyClass_fieldA_key',
          value: { '@id': 'mp:a/b/file-param#MyClass_fieldA_value' },
        });
      expect(parameters).toEqual([
        {
          '@id': 'mp:a/b/file-param#MyClass_fieldA',
          comment: 'Hi',
          range: {
            '@id': 'mp:a/b/file-param#MyClass_fieldA_range',
            parameters: [
              {
                '@id': 'mp:a/b/file-param#MyClass_fieldA_key',
                required: true,
                unique: true,
              },
              {
                '@id': 'mp:a/b/file-param#MyClass_fieldA_value',
                comment: 'Hi',
                range: 'xsd:boolean',
                required: true,
                unique: true,
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
        'mp:a/b/file-param#MyClass_field',
      )).toEqual('xsd:boolean');
    });

    it('should construct a JSON parameter range', async() => {
      const rangeValue = 'json';
      expect(await ctor.constructParameterRange(
        { type: 'override', value: rangeValue },
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).toEqual('rdf:JSON');
    });

    it('should construct a class parameter range', async() => {
      const rangeValue: ClassReferenceLoaded = <any> {
        packageName: 'my-package',
        localName: 'ClassParam',
        fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      };
      expect(await ctor.constructParameterRange(
        { type: 'class', value: rangeValue },
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).toEqual('mp:a/b/file-param#ClassParam');
    });

    it('should throw on a nested parameter range', async() => {
      const rangeValue: ParameterData<any>[] = [];
      await expect(ctor.constructParameterRange(
        { type: 'nested', value: rangeValue },
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).rejects.toThrow('Composition of nested fields is unsupported');
    });

    it('should construct an undefined parameter range', async() => {
      expect(await ctor.constructParameterRange(
        { type: 'undefined' },
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).toBeUndefined();
    });

    it('should construct a union parameter range', async() => {
      const rangeValueClass: ClassReferenceLoaded = <any> {
        packageName: 'my-package',
        localName: 'ClassParam',
        fileName: Path.normalize('/docs/package/src/a/b/file-param'),
      };
      const children: ParameterRangeResolved[] = [
        { type: 'raw', value: 'boolean' },
        { type: 'class', value: rangeValueClass },
      ];
      expect(await ctor.constructParameterRange(
        { type: 'union', children },
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeComposedUnion',
        parameterRangeComposedChildren: [
          'xsd:boolean',
          'mp:a/b/file-param#ClassParam',
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
        { type: 'class', value: rangeValueClass },
      ];
      expect(await ctor.constructParameterRange(
        { type: 'intersection', children },
        context,
        externalContextsCallback,
        'mp:a/b/file-param#MyClass_field',
      )).toEqual({
        '@type': 'ParameterRangeComposedIntersection',
        parameterRangeComposedChildren: [
          'xsd:boolean',
          'mp:a/b/file-param#ClassParam',
        ],
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
        required: false,
        unique: false,
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
        required: false,
        unique: false,
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
        required: false,
        unique: true,
        comment: undefined,
      });
      expect(field).toEqual({
        '@id': 'ex:field',
        unique: true,
      });
    });

    it('should fill in the required flag', () => {
      const field = { '@id': 'ex:field' };
      ctor.populateOptionalParameterFields(field, {
        type: 'field',
        name: 'field',
        range: { type: 'raw', value: 'boolean' },
        required: true,
        unique: false,
        comment: undefined,
      });
      expect(field).toEqual({
        '@id': 'ex:field',
        required: true,
      });
    });
  });
});
