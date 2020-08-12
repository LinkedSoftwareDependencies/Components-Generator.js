import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree/dist/ts-estree/ast-node-types';
import { Identifier, MethodDefinition } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ClassReference } from '../../lib/parse/ClassIndex';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentData } from '../../lib/parse/CommentLoader';
import { ConstructorLoader } from '../../lib/parse/ConstructorLoader';
import { ParameterLoader, ParameterRange } from '../../lib/parse/ParameterLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ParameterLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let classLoader: ClassLoader;
  let loader: ParameterLoader;
  let constructorLoader: ConstructorLoader;

  beforeEach(() => {
    classLoader = new ClassLoader({ resolutionContext });
    loader = new ParameterLoader({ classLoaded: <any> undefined });
    constructorLoader = new ConstructorLoader();
  });

  describe('loadConstructorFields', () => {
    const clazz: ClassReference = { localName: 'A', fileName: 'file' };

    async function getConstructor(definition: string):
    Promise<{ constructor: MethodDefinition; parameterLoader: ParameterLoader }> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': definition,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz);
      const constructor = <any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded));
      const parameterLoader = new ParameterLoader({ classLoaded });

      return { constructor, parameterLoader };
    }

    it('should be empty for an empty constructor', async() => {
      const { constructor, parameterLoader } = await getConstructor(`
export class A{
  constructor() {}
}`);
      expect(parameterLoader.loadConstructorFields(constructor)).toEqual({
        parameters: [],
      });
    });

    it('should handle a single field without comment', async() => {
      const { constructor, parameterLoader } = await getConstructor(`
export class A{
  constructor(fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructor)).toEqual({
        parameters: [
          {
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'string',
            },
            required: true,
            unique: true,
          },
        ],
      });
    });

    it('should handle a single field with comment', async() => {
      const { constructor, parameterLoader } = await getConstructor(`
export class A{
  /**
   * @param fieldA - This is a great field! @range {float}
   */
  constructor(fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructor)).toEqual({
        parameters: [
          {
            comment: 'This is a great field!',
            name: 'fieldA',
            range: {
              type: 'override',
              value: 'float',
            },
            required: true,
            unique: true,
          },
        ],
      });
    });

    it('should handle a single ignored field', async() => {
      const { constructor, parameterLoader } = await getConstructor(`
export class A{
  /**
   * @param fieldA - This is a great field! @ignored
   */
  constructor(fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructor)).toEqual({
        parameters: [],
      });
    });

    it('should handle a multiple fields', async() => {
      const { constructor, parameterLoader } = await getConstructor(`
export class A{
  /**
   * @param fieldA - This is a great field! @range {float}
   * @param fieldB This is B @range {float}
   * @param fieldC This is C @ignored
   */
  constructor(fieldA: string, fieldB?: number[], fieldC?: string[]) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructor)).toEqual({
        parameters: [
          {
            comment: 'This is a great field!',
            name: 'fieldA',
            range: {
              type: 'override',
              value: 'float',
            },
            required: true,
            unique: true,
          },
          {
            comment: 'This is B',
            name: 'fieldB',
            range: {
              type: 'override',
              value: 'float',
            },
            required: false,
            unique: false,
          },
        ],
      });
    });

    it('should error on an unknown field type', async() => {
      const { constructor, parameterLoader } = await getConstructor(`
export class A{
  constructor(fieldA = 'true') {}
}`);
      expect(() => parameterLoader.loadConstructorFields(constructor))
        .toThrow(new Error('Could not understand constructor parameter type AssignmentPattern in A at file'));
    });
  });

  describe('loadField', () => {
    it('should get required data', () => {
      expect(loader.loadField(<any> {
        name: 'fieldA',
        typeAnnotation: {
          typeAnnotation: {
            type: AST_NODE_TYPES.TSArrayType,
            elementType: {
              type: AST_NODE_TYPES.TSTypeReference,
              typeName: {
                type: AST_NODE_TYPES.Identifier,
                name: 'Boolean',
              },
            },
          },
        },
        optional: true,
      }, {})).toEqual({
        name: 'fieldA',
        unique: false,
        required: false,
        range: {
          type: 'raw',
          value: 'boolean',
        },
      });
    });

    it('should also get optional data', () => {
      expect(loader.loadField(<any> {
        name: 'fieldA',
        typeAnnotation: {
          typeAnnotation: {
            type: AST_NODE_TYPES.TSArrayType,
            elementType: {
              type: AST_NODE_TYPES.TSTypeReference,
              typeName: {
                type: AST_NODE_TYPES.Identifier,
                name: 'Boolean',
              },
            },
          },
        },
        optional: true,
      }, {
        range: {
          type: 'override',
          value: 'float',
        },
        default: '1.0',
        description: 'Hi',
      })).toEqual({
        name: 'fieldA',
        unique: false,
        required: false,
        range: {
          type: 'override',
          value: 'float',
        },
        default: '1.0',
        comment: 'Hi',
      });
    });
  });

  describe('getFieldName', () => {
    it('should get the field name', () => {
      expect(loader.getFieldName(<any> {
        name: 'fieldA',
      })).toEqual('fieldA');
    });
  });

  describe('isFieldUnique', () => {
    it('should return true when there is no type annotation', () => {
      expect(loader.isFieldUnique(<any> {})).toEqual(true);
    });

    it('should return true when the type annotation is not array', () => {
      expect(loader.isFieldUnique(<any> {
        typeAnnotation: {
          typeAnnotation: {
            type: AST_NODE_TYPES.TSAnyKeyword,
          },
        },
      })).toEqual(true);
    });

    it('should return false when the type annotation is array', () => {
      expect(loader.isFieldUnique(<any> {
        name: 'fieldA',
        typeAnnotation: {
          typeAnnotation: {
            type: AST_NODE_TYPES.TSArrayType,
          },
        },
      })).toEqual(false);
    });
  });

  describe('isFieldRequired', () => {
    it('should be true without optional field', () => {
      expect(loader.isFieldRequired(<any> {})).toEqual(true);
    });

    it('should be true with a falsy optional field', () => {
      expect(loader.isFieldRequired(<any> {
        optional: false,
      })).toEqual(true);
    });

    it('should be false with a truthy optional field', () => {
      expect(loader.isFieldRequired(<any> {
        optional: true,
      })).toEqual(false);
    });
  });

  describe('getFieldRange', () => {
    const clazz: ClassReference = { localName: 'A', fileName: 'file' };

    async function getFieldRange(fieldDeclaration: string, commentData: CommentData): Promise<ParameterRange> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(${fieldDeclaration}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz);
      const field: Identifier = <any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded))
        .value.params[0];
      const parameterLoader = new ParameterLoader({ classLoaded });
      return parameterLoader.getFieldRange(field, commentData);
    }

    it('should get the range of a raw Boolean field type and ignore empty comment data', async() => {
      expect(await getFieldRange('fieldA: Boolean', {}))
        .toEqual({ type: 'raw', value: 'boolean' });
    });

    it('should get the range of the comment data', async() => {
      expect(await getFieldRange('fieldA: Boolean', {
        range: {
          type: 'override',
          value: 'number',
        },
      })).toEqual({ type: 'override', value: 'number' });
    });

    it('should get the range of a raw Boolean field type', async() => {
      expect(await getFieldRange('fieldA: Boolean', {}))
        .toEqual({ type: 'raw', value: 'boolean' });
    });

    it('should get the range of a raw boolean field type', async() => {
      expect(await getFieldRange('fieldA: boolean', {}))
        .toEqual({ type: 'raw', value: 'boolean' });
    });

    it('should get the range of a raw Number field type', async() => {
      expect(await getFieldRange('fieldA: Number', {}))
        .toEqual({ type: 'raw', value: 'number' });
    });

    it('should get the range of a raw number field type', async() => {
      expect(await getFieldRange('fieldA: number', {}))
        .toEqual({ type: 'raw', value: 'number' });
    });

    it('should get the range of a raw String field type', async() => {
      expect(await getFieldRange('fieldA: String', {}))
        .toEqual({ type: 'raw', value: 'string' });
    });

    it('should get the range of a raw string field type', async() => {
      expect(await getFieldRange('fieldA: string', {}))
        .toEqual({ type: 'raw', value: 'string' });
    });

    it('should get the range of a string array field type', async() => {
      expect(await getFieldRange('fieldA: string[]', {}))
        .toEqual({ type: 'raw', value: 'string' });
    });

    it('should get the range of a String array field type', async() => {
      expect(await getFieldRange('fieldA: String[]', {}))
        .toEqual({ type: 'raw', value: 'string' });
    });

    it('should get the range of a string Array field type', async() => {
      expect(await getFieldRange('fieldA: Array<string>', {}))
        .toEqual({ type: 'raw', value: 'string' });
    });

    it('should error on an Array field type with no params', async() => {
      await expect(async() => await getFieldRange('fieldA: Array<>', {}))
        .rejects.toThrow(new Error('Found invalid Array field type at fieldA in A at file'));
    });

    it('should error on an Array field type with too many params', async() => {
      await expect(async() => await getFieldRange('fieldA: Array<string, string>', {}))
        .rejects.toThrow(new Error('Found invalid Array field type at fieldA in A at file'));
    });

    it('should error on a nested array', async() => {
      await expect(async() => await getFieldRange('fieldA: string[][]', {}))
        .rejects.toThrow(new Error('Detected illegal nested array type for field fieldA in A at file'));
    });

    it('should error on a nested Array', async() => {
      await expect(async() => await getFieldRange('fieldA: Array<Array<string>>', {}))
        .rejects.toThrow(new Error('Detected illegal nested array type for field fieldA in A at file'));
    });

    it('should get the range of a class', async() => {
      expect(await getFieldRange('fieldA: MyClass', {}))
        .toEqual({ type: 'interface', value: 'MyClass' });
    });

    it('should get the range of a hash', async() => {
      expect(await getFieldRange('fieldA: { a: number }', {}))
        .toMatchObject({
          type: 'hash',
          value: {
            members: [
              {
                computed: false,
                key: {
                  name: 'a',
                  type: 'Identifier',
                },
                type: 'TSPropertySignature',
                typeAnnotation: {
                  type: 'TSTypeAnnotation',
                  typeAnnotation: {
                    type: 'TSNumberKeyword',
                  },
                },
              },
            ],
            type: 'TSTypeLiteral',
          },
        });
    });
  });

  describe('getFieldDefault', () => {
    it('should be undefined without default', () => {
      expect(loader.getFieldDefault({})).toBeUndefined();
    });

    it('should be defined with default', () => {
      expect(loader.getFieldDefault({ default: 'abc' })).toEqual('abc');
    });
  });

  describe('getFieldComment', () => {
    it('should be undefined without description', () => {
      expect(loader.getFieldComment({})).toBeUndefined();
    });

    it('should be defined with description', () => {
      expect(loader.getFieldComment({ description: 'abc' })).toEqual('abc');
    });
  });
});
