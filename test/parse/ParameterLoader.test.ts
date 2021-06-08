import type { MethodDefinition, TSTypeLiteral, Identifier, TSIndexSignature,
  TSTypeAnnotation, TypeNode, TSTypeReference } from '@typescript-eslint/types/dist/ts-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ClassReference, InterfaceLoaded } from '../../lib/parse/ClassIndex';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import type { CommentData } from '../../lib/parse/CommentLoader';
import { ConstructorLoader } from '../../lib/parse/ConstructorLoader';
import type { ParameterRangeUnresolved } from '../../lib/parse/ParameterLoader';
import { ParameterLoader } from '../../lib/parse/ParameterLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ParameterLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let logger: any;
  let classLoader: ClassLoader;
  let loader: ParameterLoader;
  let constructorLoader: ConstructorLoader;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
    };
    classLoader = new ClassLoader({ resolutionContext, logger });
    loader = new ParameterLoader({ classLoaded: <any> { localName: 'A', fileName: 'file' }});
    constructorLoader = new ConstructorLoader();
  });

  describe('loadConstructorFields', () => {
    const clazz: ClassReference = { packageName: 'p', localName: 'A', fileName: 'file' };

    async function getConstructor(definition: string):
    Promise<{ constructor: MethodDefinition; parameterLoader: ParameterLoader }> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': definition,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
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
            type: 'field',
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
            type: 'field',
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
            type: 'field',
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
            type: 'field',
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

    it('should handle a hash field', async() => {
      const { constructor, parameterLoader } = await getConstructor(`
export class A{
  constructor(fieldA: { a: string }) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructor)).toMatchObject({
        parameters: [
          {
            name: 'fieldA',
            range: {
              type: 'hash',
              value: {
                members: [
                  {
                    key: {
                      name: 'a',
                      type: 'Identifier',
                    },
                  },
                ],
                type: 'TSTypeLiteral',
              },
            },
            required: true,
            type: 'field',
            unique: true,
          },
        ],
      });
    });

    it('should handle a hash field with indexed element', async() => {
      const { constructor, parameterLoader } = await getConstructor(`
export class A{
  constructor(fieldA: { [key: string]: string }) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructor)).toMatchObject({
        parameters: [
          {
            name: 'fieldA',
            range: {
              type: 'hash',
              value: {
                type: 'TSTypeLiteral',
              },
            },
            required: false,
            type: 'field',
            unique: false,
          },
        ],
      });
    });
  });

  describe('loadInterfaceFields', () => {
    const clazz: ClassReference = { packageName: 'p', localName: 'A', fileName: 'file' };

    async function getInterface(definition: string):
    Promise<{ iface: InterfaceLoaded; parameterLoader: ParameterLoader }> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': definition,
      };
      const classLoaded = <InterfaceLoaded> await classLoader.loadClassDeclaration(clazz, true);
      const parameterLoader = new ParameterLoader({ classLoaded });

      return { iface: classLoaded, parameterLoader };
    }

    it('should be empty for an empty interface', async() => {
      const { iface, parameterLoader } = await getInterface(`
export interface A{
}`);
      expect(parameterLoader.loadInterfaceFields(iface)).toEqual([]);
    });

    it('should error for an interface with methods', async() => {
      const { iface, parameterLoader } = await getInterface(`
export interface A{
  a(): void;
  b(): void;
}`);
      expect(() => parameterLoader.loadInterfaceFields(iface))
        .toThrow(new Error('Unsupported field type TSMethodSignature in A in file'));
    });

    it('should handle a simple field without comment', async() => {
      const { iface, parameterLoader } = await getInterface(`
export interface A{
  fieldA: boolean;
}`);
      expect(parameterLoader.loadInterfaceFields(iface)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: { type: 'raw', value: 'boolean' },
          required: true,
          unique: true,
        },
      ]);
    });

    it('should handle a field that should be ignored', async() => {
      const { iface, parameterLoader } = await getInterface(`
export interface A{
  /**
   * @ignored
   */
  fieldA: boolean;
}`);
      expect(parameterLoader.loadInterfaceFields(iface)).toEqual([]);
    });

    it('should handle a simple field with comment', async() => {
      const { iface, parameterLoader } = await getInterface(`
export interface A{
  /**
   * Hi
   * @range {number}
   * @default: {3}
   */
  fieldA?: boolean[];
}`);
      expect(parameterLoader.loadInterfaceFields(iface)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          comment: 'Hi',
          range: { type: 'override', value: 'number' },
          required: false,
          unique: false,
        },
      ]);
    });

    it('should handle an interface field', async() => {
      const { iface, parameterLoader } = await getInterface(`
export interface A{
  fieldA: MyClass;
}`);
      expect(parameterLoader.loadInterfaceFields(iface)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: { type: 'interface', value: 'MyClass' },
          required: true,
          unique: true,
        },
      ]);
    });
  });

  describe('loadHashFields', () => {
    const clazz: ClassReference = { packageName: 'p', localName: 'A', fileName: 'file' };

    async function getHash(definition: string):
    Promise<{ hash: TSTypeLiteral; parameterLoader: ParameterLoader }> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(fieldA: ${definition}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
      const hash: TSTypeLiteral = (<any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded))
        .value.params[0]).typeAnnotation.typeAnnotation;
      const parameterLoader = new ParameterLoader({ classLoaded });

      return { hash, parameterLoader };
    }

    it('should be empty for an empty hash', async() => {
      const { hash, parameterLoader } = await getHash(`{}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([]);
    });

    it('should error for an hash with methods', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  a(): void;
  b(): void;
}`);
      expect(() => parameterLoader.loadHashFields(hash))
        .toThrow(new Error('Unsupported field type TSMethodSignature in A in file'));
    });

    it('should handle a simple field without comment', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  fieldA: boolean;
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: { type: 'raw', value: 'boolean' },
          required: true,
          unique: true,
        },
      ]);
    });

    it('should handle a field that should be ignored', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  /**
   * @ignored
   */
  fieldA: boolean;
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([]);
    });

    it('should handle an index signature that should be ignored', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  /**
   * @ignored
   */
  [key: string]: boolean;
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([]);
    });

    it('should handle a simple field with comment', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  /**
   * Hi
   * @range {number}
   * @default: {3}
   */
  fieldA?: boolean[];
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          comment: 'Hi',
          range: { type: 'override', value: 'number' },
          required: false,
          unique: false,
        },
      ]);
    });

    it('should handle an interface field', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  fieldA: MyClass;
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: { type: 'interface', value: 'MyClass' },
          required: true,
          unique: true,
        },
      ]);
    });

    it('should handle a string index signature with raw value', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  [key: string]: string;
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([
        {
          type: 'index',
          domain: 'string',
          range: { type: 'raw', value: 'string' },
        },
      ]);
    });

    it('should handle a number index signature with raw value', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  [key: number]: string;
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([
        {
          type: 'index',
          domain: 'number',
          range: { type: 'raw', value: 'string' },
        },
      ]);
    });

    it('should handle a number index signature with interface value', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  [key: number]: MyClass;
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([
        {
          type: 'index',
          domain: 'number',
          range: { type: 'interface', value: 'MyClass' },
        },
      ]);
    });

    it('should handle a string index signature, and raw field', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  [key: string]: string;
  something: string;
}`);
      expect(parameterLoader.loadHashFields(hash)).toEqual([
        {
          type: 'index',
          domain: 'string',
          range: { type: 'raw', value: 'string' },
        },
        {
          type: 'field',
          name: 'something',
          range: { type: 'raw', value: 'string' },
          required: true,
          unique: true,
        },
      ]);
    });

    it('should error on no index signature', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  []: string;
}`);
      expect(() => parameterLoader.loadHashFields(hash))
        .toThrow(new Error('Expected exactly one key in index signature in A at file'));
    });

    it('should error on multiple index signatures', async() => {
      const { hash, parameterLoader } = await getHash(`
{
  [key1: string, key2: string]: string;
}`);
      expect(() => parameterLoader.loadHashFields(hash))
        .toThrow(new Error('Expected exactly one key in index signature in A at file'));
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
        type: 'field',
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
        type: 'field',
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

  describe('loadIndex', () => {
    it('should get required data', () => {
      expect(loader.loadIndex(<any> {
        type: AST_NODE_TYPES.TSIndexSignature,
        parameters: [{
          type: AST_NODE_TYPES.Identifier,
          name: 'key',
          typeAnnotation: {
            typeAnnotation: {
              type: AST_NODE_TYPES.TSArrayType,
              elementType: {
                type: AST_NODE_TYPES.TSTypeReference,
                typeName: {
                  type: AST_NODE_TYPES.Identifier,
                  name: 'String',
                },
              },
            },
          },
        }],
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
      }, {})).toEqual({
        type: 'index',
        domain: 'string',
        range: {
          type: 'raw',
          value: 'boolean',
        },
      });
    });

    it('should also get optional data', () => {
      expect(loader.loadIndex(<any> {
        type: AST_NODE_TYPES.TSIndexSignature,
        parameters: [{
          type: AST_NODE_TYPES.Identifier,
          name: 'key',
          typeAnnotation: {
            typeAnnotation: {
              type: AST_NODE_TYPES.TSArrayType,
              elementType: {
                type: AST_NODE_TYPES.TSTypeReference,
                typeName: {
                  type: AST_NODE_TYPES.Identifier,
                  name: 'String',
                },
              },
            },
          },
        }],
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
      }, {
        range: {
          type: 'override',
          value: 'string',
        },
        default: '1.0',
        description: 'Hi',
      })).toEqual({
        type: 'index',
        domain: 'string',
        range: {
          type: 'override',
          value: 'string',
        },
        default: '1.0',
        comment: 'Hi',
      });
    });
  });

  describe('getFieldName', () => {
    it('should get the field name of an Identifier', () => {
      expect(loader.getFieldName(<any> {
        name: 'fieldA',
      })).toEqual('fieldA');
    });

    it('should get the field name of a TSPropertySignature', () => {
      expect(loader.getFieldName(<any> {
        key: {
          type: AST_NODE_TYPES.Identifier,
          name: 'fieldA',
        },
      })).toEqual('fieldA');
    });

    it('should error on getting the field name of an unknown type', () => {
      expect(() => loader.getFieldName(<any> {
        key: {
          type: 'unknown',
          name: 'fieldA',
        },
      })).toThrow(new Error('Unsupported field key type unknown in interface A in file'));
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

    it('should return false when the type annotation is an indexed hash', () => {
      expect(loader.isFieldUnique(<any> {
        name: 'fieldA',
        typeAnnotation: {
          typeAnnotation: {
            type: AST_NODE_TYPES.TSTypeLiteral,
            members: [
              { type: AST_NODE_TYPES.TSIndexSignature },
            ],
          },
        },
      })).toEqual(false);
    });

    it('should return true when the type annotation is a hash without index', () => {
      expect(loader.isFieldUnique(<any> {
        name: 'fieldA',
        typeAnnotation: {
          typeAnnotation: {
            type: AST_NODE_TYPES.TSTypeLiteral,
            members: [
              { type: 'bla' },
            ],
          },
        },
      })).toEqual(true);
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

    it('should return false when the type annotation is an indexed hash', () => {
      expect(loader.isFieldRequired(<any> {
        name: 'fieldA',
        typeAnnotation: {
          typeAnnotation: {
            type: AST_NODE_TYPES.TSTypeLiteral,
            members: [
              { type: AST_NODE_TYPES.TSIndexSignature },
            ],
          },
        },
      })).toEqual(false);
    });

    it('should return true when the type annotation is a hash without index', () => {
      expect(loader.isFieldRequired(<any> {
        name: 'fieldA',
        typeAnnotation: {
          typeAnnotation: {
            type: AST_NODE_TYPES.TSTypeLiteral,
            members: [
              { type: 'bla' },
            ],
          },
        },
      })).toEqual(true);
    });
  });

  describe('getFieldRange', () => {
    const clazz: ClassReference = { packageName: 'p', localName: 'A', fileName: 'file' };

    async function getFieldRange(fieldDeclaration: string, commentData: CommentData):
    Promise<ParameterRangeUnresolved> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(${fieldDeclaration}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
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
        .rejects.toThrow(new Error('Found invalid Array field type at field fieldA in A at file'));
    });

    it('should error on an Array field type with too many params', async() => {
      await expect(async() => await getFieldRange('fieldA: Array<string, string>', {}))
        .rejects.toThrow(new Error('Found invalid Array field type at field fieldA in A at file'));
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

    it('should error on a field with qualified name', async() => {
      await expect(async() => await getFieldRange('fieldA: a.B', {}))
        .rejects.toThrow(new Error('Could not understand parameter type TSTypeReference of field fieldA in A at file'));
    });

    it('should error on a field without type', async() => {
      await expect(async() => await getFieldRange('fieldA', {}))
        .rejects.toThrow(new Error('Missing field type on fieldA in A at file'));
    });

    it('should get the range of a generic type', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A<T extends MyClass>{
  constructor(fieldA: T) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
      const field: Identifier = <any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded))
        .value.params[0];
      const parameterLoader = new ParameterLoader({ classLoaded });

      expect(parameterLoader.getFieldRange(field, {}))
        .toEqual({ type: 'interface', value: 'MyClass' });
    });

    it('should get the range of a generic raw type', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A<T extends string>{
  constructor(fieldA: T) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
      const field: Identifier = <any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded))
        .value.params[0];
      const parameterLoader = new ParameterLoader({ classLoaded });

      expect(parameterLoader.getFieldRange(field, {}))
        .toEqual({ type: 'raw', value: 'string' });
    });

    it('should fail to get the range of an untyped generic type', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A<T>{
  constructor(fieldA: T) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
      const field: Identifier = <any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded))
        .value.params[0];
      const parameterLoader = new ParameterLoader({ classLoaded });

      expect(() => parameterLoader.getFieldRange(field, {}))
        .toThrow(new Error('Found untyped generic field type at field fieldA in A at file'));
    });

    it('should get the range of a Record', async() => {
      expect(await getFieldRange('fieldA: Record<string, number>', {}))
        .toMatchObject({
          type: 'hash',
          value: {
            members: [
              {
                parameters: [
                  {
                    name: 'key',
                    type: 'Identifier',
                    typeAnnotation: {
                      type: 'TSTypeAnnotation',
                      typeAnnotation: {
                        type: 'TSStringKeyword',
                      },
                    },
                  },
                ],
                type: 'TSIndexSignature',
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

  describe('getIndexDomain', () => {
    const clazz: ClassReference = { packageName: 'p', localName: 'A', fileName: 'file' };
    let parameterLoader: ParameterLoader;

    async function getIndexDomain(fieldDeclaration: string):
    Promise<'string' | 'number' | 'boolean'> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(field: ${fieldDeclaration}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
      const field: any = <any>(<MethodDefinition>constructorLoader.getConstructor(classLoaded))
        .value.params[0];
      const indexSignature: TSIndexSignature = field.typeAnnotation.typeAnnotation.members[0];
      parameterLoader = new ParameterLoader({ classLoaded });
      return parameterLoader.getIndexDomain(indexSignature);
    }

    it('should get the domain of a raw Boolean', async() => {
      expect(await getIndexDomain('{[k: Boolean]: string}'))
        .toEqual('boolean');
    });

    it('should error on missing parameters', async() => {
      await expect(async() => await getIndexDomain('{[]: string}'))
        .rejects.toThrow(new Error('Expected exactly one key in index signature in A at file'));
    });

    it('should error on multiple parameters', async() => {
      await expect(async() => await getIndexDomain('{[a: string, b: string]: string}'))
        .rejects.toThrow(new Error('Expected exactly one key in index signature in A at file'));
    });

    it('should error on non-identifier keys', async() => {
      await expect(async() => await getIndexDomain('{[...x]: string}'))
        .rejects.toThrow(new Error('Only identifier-based index signatures are allowed in A at file'));
    });

    it('should error on missing key type', async() => {
      await expect(async() => parameterLoader.getIndexDomain(<any> {
        type: AST_NODE_TYPES.TSIndexSignature,
        parameters: [{
          type: AST_NODE_TYPES.Identifier,
          name: 'key',
        }],
      }))
        .rejects.toThrow(new Error('Missing key type annotation in index signature in A at file'));
    });

    it('should error on non-raw key types', async() => {
      await expect(async() => await getIndexDomain('{[key: MyClass]: string}'))
        .rejects.toThrow(new Error('Only raw types are allowed in index signature keys in A at file'));
    });
  });

  describe('getIndexRange', () => {
    const clazz: ClassReference = { packageName: 'p', localName: 'A', fileName: 'file' };

    async function getIndexRange(fieldDeclaration: string, commentData: CommentData):
    Promise<ParameterRangeUnresolved> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(field: ${fieldDeclaration}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
      const field: any = <any>(<MethodDefinition>constructorLoader.getConstructor(classLoaded))
        .value.params[0];
      const indexSignature: TSIndexSignature = field.typeAnnotation.typeAnnotation.members[0];
      const parameterLoader = new ParameterLoader({ classLoaded });
      return parameterLoader.getIndexRange(indexSignature, commentData);
    }

    it('should get the range of a raw Boolean field type and ignore empty comment data', async() => {
      expect(await getIndexRange('{[k: string]: Boolean}', {}))
        .toEqual({ type: 'raw', value: 'boolean' });
    });

    it('should get the range of the comment data', async() => {
      expect(await getIndexRange('{[k: string]: Boolean}', {
        range: {
          type: 'override',
          value: 'number',
        },
      })).toEqual({ type: 'override', value: 'number' });
    });

    it('should error on a missing range', async() => {
      await expect(async() => await getIndexRange('{[k: string]}', {}))
        .rejects.toThrow(new Error('Missing field type on an index signature in A at file'));
    });
  });

  describe('handleTypeOverride', () => {
    const clazz: ClassReference = { packageName: 'p', localName: 'A', fileName: 'file' };

    async function handleTypeOverride(type: string): Promise<ParameterRangeUnresolved | undefined> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(a: ${type}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
      const field: Identifier = <any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded))
        .value.params[0];
      const parameterLoader = new ParameterLoader({ classLoaded });
      const typeNode: TypeNode = (<TSTypeAnnotation> field.typeAnnotation).typeAnnotation;
      return parameterLoader.handleTypeOverride(<TSTypeReference> typeNode);
    }

    it('should do nothing on an unsupported type', async() => {
      expect(await handleTypeOverride('String')).toBeUndefined();
    });

    it('handle a Record type alias', async() => {
      expect(await handleTypeOverride('Record<string, number>')).toMatchObject({
        type: 'hash',
        value: {
          members: [
            {
              parameters: [
                {
                  name: 'key',
                  type: 'Identifier',
                  typeAnnotation: {
                    type: 'TSTypeAnnotation',
                    typeAnnotation: {
                      type: 'TSStringKeyword',
                    },
                  },
                },
              ],
              type: 'TSIndexSignature',
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
});
