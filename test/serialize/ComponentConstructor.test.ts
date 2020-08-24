import { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser';
import { ClassIndex, ClassLoaded, ClassReference } from '../../lib/parse/ClassIndex';
import { ConstructorData } from '../../lib/parse/ConstructorLoader';
import { ParameterRangeResolved } from '../../lib/parse/ParameterLoader';
import { ComponentConstructor } from '../../lib/serialize/ComponentConstructor';
import { ParameterDefinition } from '../../lib/serialize/ComponentDefinitions';
import { ContextConstructor } from '../../lib/serialize/ContextConstructor';

describe('ComponentConstructor', () => {
  let ctor: ComponentConstructor;
  let classReference: ClassLoaded;
  let context: JsonLdContextNormalized;

  beforeEach(async() => {
    classReference = <any> { localName: 'MyClass', fileName: '/docs/package/src/a/b/file-param' };

    const contextParser = new ContextParser();
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
    };
    const contextConstructor = new ContextConstructor({ packageMetadata });
    ctor = new ComponentConstructor({
      packageMetadata,
      contextConstructor,
      pathDestination: {
        packageRootDirectory: '/docs/package',
        originalPath: 'src',
        replacementPath: 'components',
      },
      classReferences: {},
      classConstructors: {},
      contextParser,
    });
    context = await contextParser.parse(contextConstructor.constructContext());
  });

  describe('constructComponents', () => {
    it('should handle an empty index', async() => {
      expect(await ctor.constructComponents()).toEqual({});
    });

    it('should handle a non-empty index for classes in the same file', async() => {
      (<any> ctor).classReferences = {
        MyClass1: { localName: 'MyClass1', fileName: '/docs/package/src/b/file' },
        MyClass2: { localName: 'MyClass2', fileName: '/docs/package/src/b/file' },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          parameters: [],
        },
        MyClass2: {
          parameters: [
            {
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              required: true,
              unique: true,
              comment: 'Hi1',
            },
            {
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
        '/docs/package/components/b/file': {
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
                'mp:b/file#MyClass2_fieldA',
                'mp:b/file#MyClass2_fieldB',
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
      (<any> ctor).classReferences = {
        MyClass1: { localName: 'MyClass1', fileName: '/docs/package/src/file1' },
        MyClass2: { localName: 'MyClass2', fileName: '/docs/package/src/b/file2' },
      };
      (<any> ctor).classConstructors = <ClassIndex<ConstructorData<ParameterRangeResolved>>> {
        MyClass1: {
          parameters: [],
        },
        MyClass2: {
          parameters: [
            {
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              required: true,
              unique: true,
              comment: 'Hi1',
            },
            {
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
        '/docs/package/components/file1': {
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
        '/docs/package/components/b/file2': {
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
                'mp:b/file2#MyClass2_fieldA',
                'mp:b/file2#MyClass2_fieldB',
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
        '/docs/package/components/file1': true,
        '/docs/package/components/file2': true,
        '/docs/package/components/file/a/b/c': true,
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
      expect(ctor.getPathRelative('/docs/package/src/a/b/myFile'))
        .toEqual('a/b/myFile');
    });
  });

  describe('getPathDestination', () => {
    it('should error when source is outside package', () => {
      expect(() => ctor.getPathDestination('not-in-package'))
        .toThrow(new Error('Tried to reference a file outside the current package: not-in-package'));
    });

    it('should handle a valid path', () => {
      expect(ctor.getPathDestination('/docs/package/src/myFile'))
        .toEqual('/docs/package/components/myFile');
    });
  });

  describe('constructComponent', () => {
    it('should handle a component with empty constructor', () => {
      expect(ctor.constructComponent(context, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with non-empty constructor', () => {
      expect(ctor.constructComponent(context, classReference, {
        parameters: [
          {
            name: 'fieldA',
            range: { type: 'raw', value: 'boolean' },
            required: true,
            unique: true,
            comment: 'Hi1',
          },
          {
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
          'mp:a/b/file-param#MyClass_fieldA',
          'mp:a/b/file-param#MyClass_fieldB',
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

    it('should handle a component with abstract class', () => {
      classReference.abstract = true;
      expect(ctor.constructComponent(context, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'AbstractClass',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with super class', () => {
      classReference.superClass = <any> { localName: 'SuperClass', fileName: '/docs/package/src/a/b/SuperFile' };
      expect(ctor.constructComponent(context, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'mp:a/b/file-param#MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        extends: 'mp:a/b/SuperFile#SuperClass',
      });
    });

    it('should handle a component with comment', () => {
      classReference.comment = 'Hi';
      expect(ctor.constructComponent(context, classReference, {
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
  });

  describe('moduleIriToId', () => {
    it('should return a compacted module IRI', () => {
      expect(ctor.moduleIriToId(context))
        .toEqual('npmd:my-package');
    });
  });

  describe('classNameToId', () => {
    it('should return a compacted class IRI', () => {
      expect(ctor.classNameToId(context, {
        localName: 'MyClass',
        fileName: '/docs/package/src/a/b/MyOwnClass',
      })).toEqual('mp:a/b/MyOwnClass#MyClass');
    });
  });

  describe('fieldNameToId', () => {
    it('should return a compacted field IRI', () => {
      expect(ctor.fieldNameToId(context, {
        localName: 'MyClass',
        fileName: '/docs/package/src/a/b/MyOwnClass',
      }, 'field')).toEqual('mp:a/b/MyOwnClass#MyClass_field');
    });
  });

  describe('constructParameters', () => {
    it('should handle a constructor with no params', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.constructParameters(context, classReference, {
        parameters: [],
      }, parameters)).toEqual([]);
      expect(parameters).toEqual([]);
    });

    it('should handle a constructor with two params', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.constructParameters(context, classReference, {
        parameters: [
          {
            name: 'fieldA',
            range: { type: 'raw', value: 'boolean' },
            required: true,
            unique: true,
            comment: 'Hi1',
          },
          {
            name: 'fieldB',
            range: { type: 'raw', value: 'string' },
            required: true,
            unique: true,
            comment: 'Hi2',
          },
        ],
      }, parameters)).toEqual([
        'mp:a/b/file-param#MyClass_fieldA',
        'mp:a/b/file-param#MyClass_fieldB',
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

    it('should handle a constructor with a nested param with two sub-params', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.constructParameters(context, classReference, {
        parameters: [
          {
            name: 'field',
            range: {
              type: 'nested',
              value: [
                {
                  name: 'fieldA',
                  range: { type: 'raw', value: 'boolean' },
                  required: true,
                  unique: true,
                  comment: 'Hi1',
                },
                {
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
          fields: [
            { keyRaw: 'fieldA', value: 'mp:a/b/file-param#MyClass_fieldA' },
            { keyRaw: 'fieldB', value: 'mp:a/b/file-param#MyClass_fieldB' },
          ],
        },
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
  });

  describe('parameterDataToConstructorArgument', () => {
    it('should handle a raw parameter definition', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.parameterDataToConstructorArgument(context, classReference, {
        name: 'field',
        range: { type: 'raw', value: 'boolean' },
        required: true,
        unique: true,
        comment: 'Hi',
      }, parameters)).toEqual('mp:a/b/file-param#MyClass_field');
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

    it('should handle an override parameter definition', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.parameterDataToConstructorArgument(context, classReference, {
        name: 'field',
        range: { type: 'override', value: 'boolean' },
        required: true,
        unique: true,
        comment: 'Hi',
      }, parameters)).toEqual('mp:a/b/file-param#MyClass_field');
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

    it('should handle a class parameter definition', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.parameterDataToConstructorArgument(context, classReference, {
        name: 'field',
        range: { type: 'class', value: { localName: 'ClassParam', fileName: '/docs/package/src/a/b/file-param' }},
        required: true,
        unique: true,
        comment: 'Hi',
      }, parameters)).toEqual('mp:a/b/file-param#MyClass_field');
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

    it('should handle an empty nested parameter definition', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.parameterDataToConstructorArgument(context, classReference, {
        name: 'field',
        range: { type: 'nested', value: []},
        required: true,
        unique: true,
        comment: 'Hi',
      }, parameters)).toEqual({
        fields: [],
      });
      expect(parameters).toEqual([]);
    });

    it('should handle a nested parameter definition with raw field', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.parameterDataToConstructorArgument(context, classReference, {
        name: 'field',
        range: {
          type: 'nested',
          value: [
            {
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
      }, parameters)).toEqual({
        fields: [
          { keyRaw: 'field', value: 'mp:a/b/file-param#MyClass_field' },
        ],
      });
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

    it('should handle a nested parameter definition with multiple raw fields', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.parameterDataToConstructorArgument(context, classReference, {
        name: 'field',
        range: {
          type: 'nested',
          value: [
            {
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              required: true,
              unique: true,
              comment: 'Hi1',
            },
            {
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
      }, parameters)).toEqual({
        fields: [
          { keyRaw: 'fieldA', value: 'mp:a/b/file-param#MyClass_fieldA' },
          { keyRaw: 'fieldB', value: 'mp:a/b/file-param#MyClass_fieldB' },
        ],
      });
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

    it('should handle a recursive nested parameter definition', () => {
      const parameters: ParameterDefinition[] = [];
      expect(ctor.parameterDataToConstructorArgument(context, classReference, {
        name: 'field',
        range: {
          type: 'nested',
          value: [
            {
              name: 'fieldA',
              range: { type: 'raw', value: 'boolean' },
              required: true,
              unique: true,
              comment: 'Hi1',
            },
            {
              name: 'fieldSub',
              range: {
                type: 'nested',
                value: [
                  {
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
      }, parameters)).toEqual({
        fields: [
          { keyRaw: 'fieldA', value: 'mp:a/b/file-param#MyClass_fieldA' },
          {
            keyRaw: 'fieldSub',
            value: {
              fields: [
                { keyRaw: 'fieldB', value: 'mp:a/b/file-param#MyClass_fieldB' },
              ],
            },
          },
        ],
      });
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
  });

  describe('constructParameterRaw', () => {
    it('should construct a raw parameter definition', () => {
      const rangeValue = 'boolean';
      expect(ctor.constructParameterRaw(context, classReference, {
        name: 'field',
        range: { type: 'raw', value: rangeValue },
        required: true,
        unique: true,
        comment: 'Hi',
      }, rangeValue)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_field',
        comment: 'Hi',
        range: 'xsd:boolean',
        required: true,
        unique: true,
      });
    });
  });

  describe('constructParameterClass', () => {
    it('should construct a class parameter definition', () => {
      const rangeValue: ClassReference = { localName: 'ClassParam', fileName: '/docs/package/src/a/b/file-param' };
      expect(ctor.constructParameterClass(context, classReference, {
        name: 'field',
        range: { type: 'class', value: rangeValue },
        required: true,
        unique: true,
        comment: 'Hi',
      }, rangeValue)).toEqual({
        '@id': 'mp:a/b/file-param#MyClass_field',
        comment: 'Hi',
        range: 'mp:a/b/file-param#ClassParam',
        required: true,
        unique: true,
      });
    });
  });

  describe('populateOptionalParameterFields', () => {
    it('should fill in nothing when not needed', () => {
      const field = { '@id': 'ex:field' };
      ctor.populateOptionalParameterFields(field, {
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
