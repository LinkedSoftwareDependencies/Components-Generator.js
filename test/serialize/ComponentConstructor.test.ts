import { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser';
import { ClassIndex, ClassLoaded, ClassReference } from '../../lib/parse/ClassIndex';
import { ConstructorData } from '../../lib/parse/ConstructorLoader';
import { ParameterRangeResolved } from '../../lib/parse/ParameterLoader';
import { ComponentConstructor } from '../../lib/serialize/ComponentConstructor';
import { ParameterDefinition } from '../../lib/serialize/ComponentDefinitions';

describe('ComponentConstructor', () => {
  let ctor: ComponentConstructor;
  let classReference: ClassLoaded;
  let context: JsonLdContextNormalized;

  beforeEach(async() => {
    classReference = <any> { localName: 'MyClass', fileName: 'file' };
    const contextRaw = {
      ex: 'http://example.org/',
    };

    const contextParser = new ContextParser();
    ctor = new ComponentConstructor({
      packageMetadata: {
        name: 'my-package',
        moduleIri: 'http://example.org/my-package',
        componentsPath: 'components',
        contexts: {
          'http://example.org/my-package/context.jsonld': contextRaw,
        },
      },
      pathDestination: {
        packageRootDirectory: '/',
        originalPath: 'src',
        replacementPath: 'components',
      },
      classReferences: {},
      classConstructors: {},
      contextParser,
    });

    context = await contextParser.parse(contextRaw);
  });

  describe('constructComponents', () => {
    it('should handle an empty index', async() => {
      expect(await ctor.constructComponents()).toEqual({});
    });

    it('should handle a non-empty index for classes in the same file', async() => {
      (<any> ctor).classReferences = {
        MyClass1: { localName: 'MyClass1', fileName: '/file' },
        MyClass2: { localName: 'MyClass2', fileName: '/file' },
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
        '/file': {
          '@context': [
            'http://example.org/my-package/context.jsonld',
          ],
          '@id': 'ex:my-package',
          components: [
            {
              '@id': 'ex:my-package/MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass1',
            },
            {
              '@id': 'ex:my-package/MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [
                'ex:my-package/MyClass2#fieldA',
                'ex:my-package/MyClass2#fieldB',
              ],
              parameters: [
                {
                  '@id': 'ex:my-package/MyClass2#fieldA',
                  comment: 'Hi1',
                  range: 'xsd:boolean',
                  required: true,
                  unique: true,
                },
                {
                  '@id': 'ex:my-package/MyClass2#fieldB',
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
        MyClass1: { localName: 'MyClass1', fileName: '/file1' },
        MyClass2: { localName: 'MyClass2', fileName: '/file2' },
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
        '/file1': {
          '@context': [
            'http://example.org/my-package/context.jsonld',
          ],
          '@id': 'ex:my-package',
          components: [
            {
              '@id': 'ex:my-package/MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass1',
            },
          ],
        },
        '/file2': {
          '@context': [
            'http://example.org/my-package/context.jsonld',
          ],
          '@id': 'ex:my-package',
          components: [
            {
              '@id': 'ex:my-package/MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [
                'ex:my-package/MyClass2#fieldA',
                'ex:my-package/MyClass2#fieldB',
              ],
              parameters: [
                {
                  '@id': 'ex:my-package/MyClass2#fieldA',
                  comment: 'Hi1',
                  range: 'xsd:boolean',
                  required: true,
                  unique: true,
                },
                {
                  '@id': 'ex:my-package/MyClass2#fieldB',
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

  describe('getPathDestination', () => {
    it('should error when source is outside package', () => {
      expect(() => ctor.getPathDestination('not-in-package'))
        .toThrow(new Error('Tried to reference a file outside the current package: not-in-package'));
    });

    it('should handle a valid path', () => {
      expect(ctor.getPathDestination('/src/myFile'))
        .toEqual('/components/myFile');
    });
  });

  describe('constructComponent', () => {
    it('should handle a component with empty constructor', () => {
      expect(ctor.constructComponent(context, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'ex:my-package/MyClass',
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
        '@id': 'ex:my-package/MyClass',
        '@type': 'Class',
        constructorArguments: [
          'ex:my-package/MyClass#fieldA',
          'ex:my-package/MyClass#fieldB',
        ],
        parameters: [
          {
            '@id': 'ex:my-package/MyClass#fieldA',
            comment: 'Hi1',
            range: 'xsd:boolean',
            required: true,
            unique: true,
          },
          {
            '@id': 'ex:my-package/MyClass#fieldB',
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
        '@id': 'ex:my-package/MyClass',
        '@type': 'AbstractClass',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
      });
    });

    it('should handle a component with super class', () => {
      classReference.superClass = <any> { localName: 'SuperClass' };
      expect(ctor.constructComponent(context, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'ex:my-package/MyClass',
        '@type': 'Class',
        constructorArguments: [],
        parameters: [],
        requireElement: 'MyClass',
        extends: 'ex:my-package/SuperClass',
      });
    });

    it('should handle a component with comment', () => {
      classReference.comment = 'Hi';
      expect(ctor.constructComponent(context, classReference, {
        parameters: [],
      })).toEqual({
        '@id': 'ex:my-package/MyClass',
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
        .toEqual('ex:my-package');
    });
  });

  describe('classNameToId', () => {
    it('should return a compacted class IRI', () => {
      expect(ctor.classNameToId(context, 'MyClass'))
        .toEqual('ex:my-package/MyClass');
    });
  });

  describe('fieldNameToId', () => {
    it('should return a compacted field IRI', () => {
      expect(ctor.fieldNameToId(context, 'MyClass', 'field'))
        .toEqual('ex:my-package/MyClass#field');
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
        'ex:my-package/MyClass#fieldA',
        'ex:my-package/MyClass#fieldB',
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'ex:my-package/MyClass#fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'ex:my-package/MyClass#fieldB',
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
            { keyRaw: 'fieldA', value: 'ex:my-package/MyClass#fieldA' },
            { keyRaw: 'fieldB', value: 'ex:my-package/MyClass#fieldB' },
          ],
        },
      ]);
      expect(parameters).toEqual([
        {
          '@id': 'ex:my-package/MyClass#fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'ex:my-package/MyClass#fieldB',
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
      }, parameters)).toEqual('ex:my-package/MyClass#field');
      expect(parameters).toEqual([
        {
          '@id': 'ex:my-package/MyClass#field',
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
      }, parameters)).toEqual('ex:my-package/MyClass#field');
      expect(parameters).toEqual([
        {
          '@id': 'ex:my-package/MyClass#field',
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
        range: { type: 'class', value: { localName: 'ClassParam', fileName: 'file-param' }},
        required: true,
        unique: true,
        comment: 'Hi',
      }, parameters)).toEqual('ex:my-package/MyClass#field');
      expect(parameters).toEqual([
        {
          '@id': 'ex:my-package/MyClass#field',
          comment: 'Hi',
          range: 'ex:my-package/ClassParam',
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
          { keyRaw: 'field', value: 'ex:my-package/MyClass#field' },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'ex:my-package/MyClass#field',
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
          { keyRaw: 'fieldA', value: 'ex:my-package/MyClass#fieldA' },
          { keyRaw: 'fieldB', value: 'ex:my-package/MyClass#fieldB' },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'ex:my-package/MyClass#fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'ex:my-package/MyClass#fieldB',
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
          { keyRaw: 'fieldA', value: 'ex:my-package/MyClass#fieldA' },
          {
            keyRaw: 'fieldSub',
            value: {
              fields: [
                { keyRaw: 'fieldB', value: 'ex:my-package/MyClass#fieldB' },
              ],
            },
          },
        ],
      });
      expect(parameters).toEqual([
        {
          '@id': 'ex:my-package/MyClass#fieldA',
          comment: 'Hi1',
          range: 'xsd:boolean',
          required: true,
          unique: true,
        },
        {
          '@id': 'ex:my-package/MyClass#fieldB',
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
        '@id': 'ex:my-package/MyClass#field',
        comment: 'Hi',
        range: 'xsd:boolean',
        required: true,
        unique: true,
      });
    });
  });

  describe('constructParameterClass', () => {
    it('should construct a class parameter definition', () => {
      const rangeValue: ClassReference = { localName: 'ClassParam', fileName: 'file-param' };
      expect(ctor.constructParameterClass(context, classReference, {
        name: 'field',
        range: { type: 'class', value: rangeValue },
        required: true,
        unique: true,
        comment: 'Hi',
      }, rangeValue)).toEqual({
        '@id': 'ex:my-package/MyClass#field',
        comment: 'Hi',
        range: 'ex:my-package/ClassParam',
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
