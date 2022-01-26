import type { TSTypeLiteral, Identifier, TSIndexSignature,
  TSTypeReference } from '@typescript-eslint/types/dist/ts-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';

import { ClassFinder } from '../../lib/parse/ClassFinder';
import type { ClassLoaded, ClassReference, ClassReferenceLoaded, InterfaceLoaded } from '../../lib/parse/ClassIndex';

import { ClassIndexer } from '../../lib/parse/ClassIndexer';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import type { CommentData } from '../../lib/parse/CommentLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { ConstructorLoader } from '../../lib/parse/ConstructorLoader';
import type { ParameterRangeUnresolved } from '../../lib/parse/ParameterLoader';
import { ParameterLoader } from '../../lib/parse/ParameterLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ParameterLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let logger: any;
  let commentLoader: CommentLoader;
  let classLoader: ClassLoader;
  let loader: ParameterLoader;
  let classLoadedDummy: ClassLoaded;
  let constructorLoader: ConstructorLoader;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
    };
    commentLoader = new CommentLoader();
    classLoader = new ClassLoader({ resolutionContext, logger, commentLoader });
    classLoadedDummy = <any> { localName: 'A', fileName: 'file' };
    loader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });
    constructorLoader = new ConstructorLoader({ parameterLoader: loader });
  });

  describe('loadAllExtensionData', () => {
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getClass(definition: string) {
      resolutionContext.contentsOverrides = {
        'file.d.ts': definition,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, true, true);
      return classLoaded.type === 'type' ?
        classLoaded :
        await new ClassIndexer({
          classLoader,
          classFinder: new ClassFinder({ classLoader }),
          ignoreClasses: {},
          logger,
        }).loadClassChain(classLoaded);
    }

    it('should be empty for empty index', async() => {
      expect(loader.loadAllExtensionData({})).toEqual({});
    });

    it('should handle a non-emty index', async() => {
      expect(loader.loadAllExtensionData({
        A: await getClass(`export class A extends SuperA {}
export class SuperA {}`),
        B: await getClass(`export type A = number`),
        C: await getClass(`export interface A {}`),
      })).toEqual({
        A: expect.anything(),
        C: expect.anything(),
      });
    });
  });

  describe('loadExtensionData', () => {
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getClass(definition: string) {
      resolutionContext.contentsOverrides = {
        'file.d.ts': definition,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, true, false);
      return await new ClassIndexer({
        classLoader,
        classFinder: new ClassFinder({ classLoader }),
        ignoreClasses: {},
        logger,
      }).loadClassChain(classLoaded);
    }

    it('should be empty for no extensions', async() => {
      const classLoaded = await getClass(`
export class A{}`);
      expect(loader.loadExtensionData(classLoaded)).toEqual([]);
    });

    it('should be empty for no extensions and interfaces', async() => {
      const classLoaded = await getClass(`
export class A{}`);
      delete (<any> classLoaded).implementsInterfaces;
      expect(loader.loadExtensionData(classLoaded)).toEqual([]);
    });

    it('should handle a class extension', async() => {
      const classLoaded = await getClass(`
export class A extends SuperA {}
export class SuperA {}`);
      expect(loader.loadExtensionData(classLoaded)).toMatchObject([
        {
          classLoaded: <any> {
            localName: 'SuperA',
          },
          genericTypeInstantiations: [],
        },
      ]);
    });

    it('should handle interface extensions', async() => {
      const classLoaded = await getClass(`
export class A implements IFace1, IFace2{};
export interface IFace1 {};
export interface IFace2 {};`);
      expect(loader.loadExtensionData(classLoaded)).toMatchObject([
        {
          classLoaded: <any> {
            localName: 'IFace1',
          },
          genericTypeInstantiations: [],
        },
        {
          classLoaded: <any> {
            localName: 'IFace2',
          },
          genericTypeInstantiations: [],
        },
      ]);
    });

    it('should handle interface supers', async() => {
      const classLoaded = await getClass(`
export interface A extends IFace1, IFace2{};
export interface IFace1 {};
export interface IFace2 {};`);
      expect(loader.loadExtensionData(classLoaded)).toMatchObject([
        {
          classLoaded: <any> {
            localName: 'IFace1',
          },
          genericTypeInstantiations: [],
        },
        {
          classLoaded: <any> {
            localName: 'IFace2',
          },
          genericTypeInstantiations: [],
        },
      ]);
    });

    it('should handle interface without supers', async() => {
      const classLoaded = await getClass(`
export interface A{};`);
      delete (<any> classLoaded).superInterfaces;
      expect(loader.loadExtensionData(classLoaded)).toMatchObject([]);
    });

    it('should handle a class extension with generics', async() => {
      const classLoaded = await getClass(`
export class A extends SuperA<string> {};
export class SuperA<x>{};`);
      expect(loader.loadExtensionData(classLoaded)).toMatchObject([
        {
          classLoaded: <any> {
            localName: 'SuperA',
          },
          genericTypeInstantiations: [
            {
              type: 'raw',
              value: 'string',
            },
          ],
        },
      ]);
    });

    it('should handle interface extensions with generics', async() => {
      const classLoaded = await getClass(`
export class A implements IFace1<string>, IFace2<number> {}
export interface IFace1<x>{};
export interface IFace2<x>{};`);
      expect(loader.loadExtensionData(classLoaded)).toMatchObject([
        {
          classLoaded: <any> {
            localName: 'IFace1',
          },
          genericTypeInstantiations: [
            {
              type: 'raw',
              value: 'string',
            },
          ],
        },
        {
          classLoaded: <any> {
            localName: 'IFace2',
          },
          genericTypeInstantiations: [
            {
              type: 'raw',
              value: 'number',
            },
          ],
        },
      ]);
    });

    it('should handle interface supers with generics', async() => {
      const classLoaded = await getClass(`
export interface A extends IFace1<string>, IFace2<number> {}
export interface IFace1<x>{};
export interface IFace2<x>{};`);
      expect(loader.loadExtensionData(classLoaded)).toMatchObject([
        {
          classLoaded: <any> {
            localName: 'IFace1',
          },
          genericTypeInstantiations: [
            {
              type: 'raw',
              value: 'string',
            },
          ],
        },
        {
          classLoaded: <any> {
            localName: 'IFace2',
          },
          genericTypeInstantiations: [
            {
              type: 'raw',
              value: 'number',
            },
          ],
        },
      ]);
    });
  });

  describe('loadConstructorFields', () => {
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getConstructor(definition: string) {
      resolutionContext.contentsOverrides = {
        'file.d.ts': definition,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const constructorChain = constructorLoader.getConstructorChain({ value: classLoaded });
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });

      return { constructorChain, parameterLoader, classLoaded };
    }

    it('should be empty for an empty constructor', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor() {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [],
      });
    });

    it('should handle a single field without comment', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'string',
            },
          },
        ],
      });
    });

    it('should handle a single field with comment', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  /**
   * @param fieldA - This is a great field! @range {float}
   */
  constructor(fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            comment: 'This is a great field!',
            name: 'fieldA',
            range: {
              type: 'override',
              value: 'float',
            },
          },
        ],
      });
    });

    it('should handle a single ignored field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  /**
   * @param fieldA - This is a great field! @ignored
   */
  constructor(fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [],
      });
    });

    it('should handle a multiple fields', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  /**
   * @param fieldA - This is a great field! @range {float}
   * @param fieldB This is B @range {float}
   * @param fieldC This is C @ignored
   */
  constructor(fieldA: string, fieldB?: number[], fieldC?: string[]) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            comment: 'This is a great field!',
            name: 'fieldA',
            range: {
              type: 'override',
              value: 'float',
            },
          },
          {
            type: 'field',
            comment: 'This is B',
            name: 'fieldB',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'array',
                  value: {
                    type: 'override',
                    value: 'float',
                  },
                },
                {
                  type: 'undefined',
                },
              ],
            },
          },
        ],
      });
    });

    it('should error on an unknown field type', async() => {
      const { constructorChain, parameterLoader } = await getConstructor(`
export class A{
  constructor(fieldA = 'true') {}
}`);
      expect(() => parameterLoader.loadConstructorFields(constructorChain))
        .toThrow(new Error('Could not understand constructor parameter type AssignmentPattern in A at file'));
    });

    it('should handle a hash field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(fieldA: { a: string }) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toMatchObject({
        classLoaded,
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
            type: 'field',
          },
        ],
      });
    });

    it('should handle a hash field with indexed element', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(fieldA: { [key: string]: string }) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toMatchObject({
        classLoaded,
        parameters: [
          {
            name: 'fieldA',
            range: {
              type: 'hash',
              value: {
                type: 'TSTypeLiteral',
              },
            },
            type: 'field',
          },
        ],
      });
    });

    it('should handle a public field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'string',
            },
          },
        ],
      });
    });

    it('should handle a protected field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(protected fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'string',
            },
          },
        ],
      });
    });

    it('should handle a private field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(private fieldA: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'string',
            },
          },
        ],
      });
    });

    it('should handle a public array field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA: string[]) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'array',
              value: {
                type: 'raw',
                value: 'string',
              },
            },
          },
        ],
      });
    });

    it('should handle a public optional field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA?: string) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'raw',
                  value: 'string',
                },
                {
                  type: 'undefined',
                },
              ],
            },
          },
        ],
      });
    });

    it('should handle a public optional union field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA?: string | number) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'raw',
                  value: 'string',
                },
                {
                  type: 'raw',
                  value: 'number',
                },
                {
                  type: 'undefined',
                },
              ],
            },
          },
        ],
      });
    });

    it('should handle a public optional field as union type', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA?: string | undefined) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'raw',
                  value: 'string',
                },
                {
                  type: 'undefined',
                },
              ],
            },
          },
        ],
      });
    });

    it('should handle a public required field as union type', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA: string | undefined) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'raw',
                  value: 'string',
                },
                {
                  type: 'undefined',
                },
              ],
            },
          },
        ],
      });
    });

    it('should handle a public optional array field', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA?: string[]) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'array',
                  value: {
                    type: 'raw',
                    value: 'string',
                  },
                },
                {
                  type: 'undefined',
                },
              ],
            },
          },
        ],
      });
    });

    it('should handle a public optional array field as union type', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA?: string[] | undefined) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'array',
                  value: {
                    type: 'raw',
                    value: 'string',
                  },
                },
                {
                  type: 'undefined',
                },
              ],
            },
          },
        ],
      });
    });

    it('should handle a public required array field as union type', async() => {
      const { constructorChain, parameterLoader, classLoaded } = await getConstructor(`
export class A{
  constructor(public fieldA: string[] | undefined) {}
}`);
      expect(parameterLoader.loadConstructorFields(constructorChain)).toEqual({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'array',
                  value: {
                    type: 'raw',
                    value: 'string',
                  },
                },
                {
                  type: 'undefined',
                },
              ],
            },
          },
        ],
      });
    });
  });

  describe('loadClassGenerics', () => {
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getGenerics(definition: string) {
      resolutionContext.contentsOverrides = {
        'file.d.ts': definition,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });

      return { parameterLoader, classLoaded };
    }

    it('should be empty for a class without generics', async() => {
      const { parameterLoader, classLoaded } = await getGenerics(`
export class A{}`);
      expect(parameterLoader.loadClassGenerics(classLoaded)).toEqual({
        classLoaded,
        genericTypeParameters: [],
      });
    });

    it('should handle a single untyped generic', async() => {
      const { parameterLoader, classLoaded } = await getGenerics(`
export class A<T>{
  constructor() {}
}`);
      expect(parameterLoader.loadClassGenerics(classLoaded)).toEqual({
        classLoaded,
        genericTypeParameters: [
          {
            name: 'T',
          },
        ],
      });
    });

    it('should handle a single typed generic', async() => {
      const { parameterLoader, classLoaded } = await getGenerics(`
export class A<T extends string>{
  constructor() {}
}`);
      expect(parameterLoader.loadClassGenerics(classLoaded)).toEqual({
        classLoaded,
        genericTypeParameters: [
          {
            name: 'T',
            range: { type: 'raw', value: 'string' },
          },
        ],
      });
    });

    it('should handle a single union typed generic', async() => {
      const { parameterLoader, classLoaded } = await getGenerics(`
export class A<T extends string | number>{
  constructor() {}
}`);
      expect(parameterLoader.loadClassGenerics(classLoaded)).toEqual({
        classLoaded,
        genericTypeParameters: [
          {
            name: 'T',
            range: {
              type: 'union',
              elements: [
                { type: 'raw', value: 'string' },
                { type: 'raw', value: 'number' },
              ],
            },
          },
        ],
      });
    });

    it('should handle a multiple typed generic', async() => {
      const { parameterLoader, classLoaded } = await getGenerics(`
export class A<T extends string, U extends number>{
  constructor() {}
}`);
      expect(parameterLoader.loadClassGenerics(classLoaded)).toEqual({
        classLoaded,
        genericTypeParameters: [
          {
            name: 'T',
            range: { type: 'raw', value: 'string' },
          },
          {
            name: 'U',
            range: { type: 'raw', value: 'number' },
          },
        ],
      });
    });

    it('should handle a single typed generic with sub-generic', async() => {
      const { parameterLoader, classLoaded } = await getGenerics(`
export class A<T extends Class<U>>{
  constructor() {}
}`);
      expect(parameterLoader.loadClassGenerics(classLoaded)).toEqual({
        classLoaded,
        genericTypeParameters: [
          {
            name: 'T',
            range: {
              type: 'interface',
              value: 'Class',
              genericTypeParameterInstantiations: [
                {
                  type: 'interface',
                  value: 'U',
                  origin: classLoaded,
                },
              ],
              origin: classLoaded,
            },
          },
        ],
      });
    });

    it('should handle a multiple typed generic with linked sub-generics', async() => {
      const { parameterLoader, classLoaded } = await getGenerics(`
export class A<T extends Class<U>, U extends number>{
  constructor() {}
}`);
      expect(parameterLoader.loadClassGenerics(classLoaded)).toEqual({
        classLoaded,
        genericTypeParameters: [
          {
            name: 'T',
            range: {
              type: 'interface',
              value: 'Class',
              genericTypeParameterInstantiations: [
                {
                  type: 'genericTypeReference',
                  value: 'U',
                },
              ],
              origin: classLoaded,
            },
          },
          {
            name: 'U',
            range: { type: 'raw', value: 'number' },
          },
        ],
      });
    });
  });

  describe('loadInterfaceFields', () => {
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getInterface(definition: string):
    Promise<{ iface: InterfaceLoaded; parameterLoader: ParameterLoader }> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': definition,
      };
      const classLoaded = <InterfaceLoaded> await classLoader.loadClassDeclaration(clazz, true, false);
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });

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
   * @default {3}
   */
  fieldA?: boolean[];
}`);
      expect(parameterLoader.loadInterfaceFields(iface)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          comment: 'Hi',
          range: {
            type: 'union',
            elements: [
              {
                type: 'array',
                value: {
                  type: 'override',
                  value: 'number',
                },
              },
              { type: 'undefined' },
            ],
          },
          defaults: [{ type: 'raw', value: '3' }],
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
          range: { type: 'interface', value: 'MyClass', origin: iface },
        },
      ]);
    });

    it('should handle an interface that extends another interface', async() => {
      const { iface, parameterLoader } = await getInterface(`
export interface A{
  fieldA: MyClass1;
}`);
      const ifaceSuper = (await getInterface(`
export interface A{
  fieldB: MyClass2;
}`)).iface;
      iface.superInterfaces = [
        { value: ifaceSuper },
      ];
      expect(parameterLoader.loadInterfaceFields(iface)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: { type: 'interface', value: 'MyClass1', origin: iface },
        },
        {
          type: 'field',
          name: 'fieldB',
          range: { type: 'interface', value: 'MyClass2', origin: ifaceSuper },
        },
      ]);
    });

    it('should handle an interface that extends two other interfaces', async() => {
      const { iface, parameterLoader } = await getInterface(`
export interface A{
  fieldA: MyClass1;
}`);
      const ifaceSuper1 = (await getInterface(`
export interface A{
  fieldB: MyClass2;
}`)).iface;
      const ifaceSuper2 = (await getInterface(`
export interface A{
  fieldC: MyClass3;
  fieldD: MyClass4;
}`)).iface;
      iface.superInterfaces = [
        { value: ifaceSuper1 },
        { value: ifaceSuper2 },
      ];
      expect(parameterLoader.loadInterfaceFields(iface)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: { type: 'interface', value: 'MyClass1', origin: iface },
        },
        {
          type: 'field',
          name: 'fieldB',
          range: { type: 'interface', value: 'MyClass2', origin: ifaceSuper1 },
        },
        {
          type: 'field',
          name: 'fieldC',
          range: { type: 'interface', value: 'MyClass3', origin: ifaceSuper2 },
        },
        {
          type: 'field',
          name: 'fieldD',
          range: { type: 'interface', value: 'MyClass4', origin: ifaceSuper2 },
        },
      ]);
    });
  });

  describe('loadHashFields', () => {
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getHash(definition: string):
    Promise<{ hash: TSTypeLiteral; parameterLoader: ParameterLoader; classLoaded: ClassReferenceLoaded }> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(fieldA: ${definition}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const hash: TSTypeLiteral = (<any> constructorLoader.getConstructor({ value: classLoaded })!.constructor
        .value.params[0]).typeAnnotation.typeAnnotation;
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });

      return { hash, parameterLoader, classLoaded };
    }

    it('should be empty for an empty hash', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`{}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([]);
    });

    it('should error for an hash with methods', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  a(): void;
  b(): void;
}`);
      expect(() => parameterLoader.loadHashFields(classLoaded, hash))
        .toThrow(new Error('Unsupported field type TSMethodSignature in A in file'));
    });

    it('should handle a simple field without comment', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  fieldA: boolean;
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: { type: 'raw', value: 'boolean' },
        },
      ]);
    });

    it('should handle a field that should be ignored', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  /**
   * @ignored
   */
  fieldA: boolean;
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([]);
    });

    it('should handle an index signature that should be ignored', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  /**
   * @ignored
   */
  [key: string]: boolean;
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([]);
    });

    it('should handle a simple field with comment', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  /**
   * Hi
   * @range {number}
   * @default {3}
   */
  fieldA?: boolean[];
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          comment: 'Hi',
          defaults: [{ type: 'raw', value: '3' }],
          range: {
            type: 'union',
            elements: [
              {
                type: 'array',
                value: {
                  type: 'override',
                  value: 'number',
                },
              },
              { type: 'undefined' },
            ],
          },
        },
      ]);
    });

    it('should handle an interface field', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  fieldA: MyClass;
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: { type: 'interface', value: 'MyClass', origin: classLoaded },
        },
      ]);
    });

    it('should handle a string index signature with raw value', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  [key: string]: string;
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([
        {
          type: 'index',
          domain: 'string',
          range: { type: 'raw', value: 'string' },
        },
      ]);
    });

    it('should handle a number index signature with raw value', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  [key: number]: string;
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([
        {
          type: 'index',
          domain: 'number',
          range: { type: 'raw', value: 'string' },
        },
      ]);
    });

    it('should handle a number index signature with interface value', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  [key: number]: MyClass;
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([
        {
          type: 'index',
          domain: 'number',
          range: { type: 'interface', value: 'MyClass', origin: classLoaded },
        },
      ]);
    });

    it('should handle a string index signature, and raw field', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  [key: string]: string;
  something: string;
}`);
      expect(parameterLoader.loadHashFields(classLoaded, hash)).toEqual([
        {
          type: 'index',
          domain: 'string',
          range: { type: 'raw', value: 'string' },
        },
        {
          type: 'field',
          name: 'something',
          range: { type: 'raw', value: 'string' },
        },
      ]);
    });

    it('should error on no index signature', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  []: string;
}`);
      expect(() => parameterLoader.loadHashFields(classLoaded, hash))
        .toThrow(new Error('Expected exactly one key in index signature in A at file'));
    });

    it('should error on multiple index signatures', async() => {
      const { hash, parameterLoader, classLoaded } = await getHash(`
{
  [key1: string, key2: string]: string;
}`);
      expect(() => parameterLoader.loadHashFields(classLoaded, hash))
        .toThrow(new Error('Expected exactly one key in index signature in A at file'));
    });
  });

  describe('loadField', () => {
    it('should get required data', () => {
      expect(loader.loadField(classLoadedDummy, <any> {
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
        range: {
          type: 'union',
          elements: [
            {
              type: 'array',
              value: { type: 'raw', value: 'boolean' },
            },
            {
              type: 'undefined',
            },
          ],
        },
      });
    });

    it('should get optional data', () => {
      expect(loader.loadField(classLoadedDummy, <any> {
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
      }, {})).toEqual({
        type: 'field',
        name: 'fieldA',
        range: {
          type: 'array',
          value: { type: 'raw', value: 'boolean' },
        },
      });
    });

    it('should get optional data with override', () => {
      expect(loader.loadField(classLoadedDummy, <any> {
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
        defaults: [{ type: 'raw', value: '1.0' }],
        defaultNested: [
          {
            paramPath: [ 'a', 'b' ],
            value: { type: 'raw', value: 'A' },
          },
          {
            paramPath: [ 'c' ],
            value: { type: 'raw', value: 'B' },
          },
        ],
        description: 'Hi',
      })).toEqual({
        type: 'field',
        name: 'fieldA',
        range: {
          type: 'union',
          elements: [
            {
              type: 'array',
              value: {
                type: 'override',
                value: 'float',
              },
            },
            {
              type: 'undefined',
            },
          ],
        },
        defaults: [{ type: 'raw', value: '1.0' }],
        defaultNested: [
          {
            paramPath: [ 'a', 'b' ],
            value: { type: 'raw', value: 'A' },
          },
          {
            paramPath: [ 'c' ],
            value: { type: 'raw', value: 'B' },
          },
        ],
        comment: 'Hi',
      });
    });
  });

  describe('loadIndex', () => {
    it('should get required data', () => {
      expect(loader.loadIndex(classLoadedDummy, <any> {
        type: AST_NODE_TYPES.TSIndexSignature,
        parameters: [{
          type: AST_NODE_TYPES.Identifier,
          name: 'key',
          typeAnnotation: {
            typeAnnotation: {
              type: AST_NODE_TYPES.TSTypeReference,
              typeName: {
                type: AST_NODE_TYPES.Identifier,
                name: 'String',
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
          type: 'array',
          value: {
            type: 'raw',
            value: 'boolean',
          },
        },
      });
    });

    it('should also get optional data', () => {
      expect(loader.loadIndex(classLoadedDummy, <any> {
        type: AST_NODE_TYPES.TSIndexSignature,
        parameters: [{
          type: AST_NODE_TYPES.Identifier,
          name: 'key',
          typeAnnotation: {
            typeAnnotation: {
              type: AST_NODE_TYPES.TSTypeReference,
              typeName: {
                type: AST_NODE_TYPES.Identifier,
                name: 'String',
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
        defaults: [{ type: 'raw', value: '1.0' }],
        description: 'Hi',
      })).toEqual({
        type: 'index',
        domain: 'string',
        range: {
          type: 'override',
          value: 'string',
        },
        defaults: [{ type: 'raw', value: '1.0' }],
        comment: 'Hi',
      });
    });
  });

  describe('getFieldName', () => {
    it('should get the field name of an Identifier', () => {
      expect(loader.getFieldName(classLoadedDummy, <any> {
        name: 'fieldA',
      })).toEqual('fieldA');
    });

    it('should get the field name of a TSPropertySignature', () => {
      expect(loader.getFieldName(classLoadedDummy, <any> {
        key: {
          type: AST_NODE_TYPES.Identifier,
          name: 'fieldA',
        },
      })).toEqual('fieldA');
    });

    it('should error on getting the field name of an unknown type', () => {
      expect(() => loader.getFieldName(classLoadedDummy, <any> {
        key: {
          type: 'unknown',
          name: 'fieldA',
        },
      })).toThrow(new Error('Unsupported field key type unknown in interface A in file'));
    });
  });

  describe('getFieldRange', () => {
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getFieldRange(fieldDeclaration: string, commentData: CommentData, hardErrorUnsupported = true):
    Promise<ParameterRangeUnresolved> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(${fieldDeclaration}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const field: Identifier = <any> (constructorLoader.getConstructor({ value: classLoaded })!.constructor)
        .value.params[0];
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported, logger });
      return parameterLoader.getFieldRange(classLoaded, field, commentData);
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
        .toEqual({ type: 'array', value: { type: 'raw', value: 'string' }});
    });

    it('should get the range of a String array field type', async() => {
      expect(await getFieldRange('fieldA: String[]', {}))
        .toEqual({ type: 'array', value: { type: 'raw', value: 'string' }});
    });

    it('should get the range of a string Array field type', async() => {
      expect(await getFieldRange('fieldA: Array<string>', {}))
        .toEqual({ type: 'array', value: { type: 'raw', value: 'string' }});
    });

    it('should error on an Array field type with no params', async() => {
      await expect(async() => await getFieldRange('fieldA: Array<>', {}))
        .rejects.toThrow(new Error('Found invalid Array field type at field fieldA in A at file'));
    });

    it('should log on an Array field type with no params', async() => {
      expect(await getFieldRange('fieldA: Array<>', {}, false))
        .toEqual({ type: 'wildcard' });
      expect(logger.error).toHaveBeenCalledWith('Found invalid Array field type at field fieldA in A at file');
    });

    it('should error on an Array field type with too many params', async() => {
      await expect(async() => await getFieldRange('fieldA: Array<string, string>', {}))
        .rejects.toThrow(new Error('Found invalid Array field type at field fieldA in A at file'));
    });

    it('should log on an Array field type with too many params', async() => {
      expect(await getFieldRange('fieldA: Array<string, string>', {}, false))
        .toEqual({ type: 'wildcard' });
      expect(logger.error).toHaveBeenCalledWith('Found invalid Array field type at field fieldA in A at file');
    });

    it('should handle a nested array', async() => {
      expect(await getFieldRange('fieldA: string[][]', {}))
        .toEqual({ type: 'array', value: { type: 'array', value: { type: 'raw', value: 'string' }}});
    });

    it('should handle a nested Array', async() => {
      expect(await getFieldRange('fieldA: Array<Array<string>>', {}))
        .toEqual({ type: 'array', value: { type: 'array', value: { type: 'raw', value: 'string' }}});
    });

    it('should get the range of a class', async() => {
      expect(await getFieldRange('fieldA: MyClass', {}))
        .toEqual({ type: 'interface', value: 'MyClass', origin: expect.anything() });
    });

    it('should get the range of a generic class', async() => {
      expect(await getFieldRange('fieldA: MyClass<T>', {}))
        .toEqual({
          type: 'interface',
          value: 'MyClass',
          genericTypeParameterInstantiations: [
            {
              type: 'interface',
              value: 'T',
              origin: expect.anything(),
            },
          ],
          origin: expect.anything(),
        });
    });

    it('should get the range of a qualified name with generic', async() => {
      expect(await getFieldRange('fieldA: a.B<T>', {}))
        .toEqual({
          type: 'interface',
          value: 'B',
          genericTypeParameterInstantiations: [
            {
              type: 'interface',
              value: 'T',
              origin: expect.anything(),
            },
          ],
          qualifiedPath: [ 'a' ],
          origin: expect.anything(),
        });
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

    it('should get the range of a qualified name', async() => {
      expect(await getFieldRange('fieldA: a.B', {}))
        .toEqual({ type: 'interface', value: 'B', qualifiedPath: [ 'a' ], origin: expect.anything() });
    });

    it('should get the range of a long qualified name', async() => {
      expect(await getFieldRange('fieldA: a.b.c.D', {}))
        .toEqual({ type: 'interface', value: 'D', qualifiedPath: [ 'a', 'b', 'c' ], origin: expect.anything() });
    });

    it('should error on a field without type', async() => {
      await expect(async() => await getFieldRange('fieldA', {}))
        .rejects.toThrow(new Error('Missing field type on fieldA in A at file'));
    });

    it('should log on a field without type', async() => {
      expect(await getFieldRange('fieldA', {}, false))
        .toEqual({ type: 'wildcard' });
      expect(logger.error).toHaveBeenCalledWith('Missing field type on fieldA in A at file');
    });

    it('should get the range of a generic type', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A<T extends MyClass>{
  constructor(fieldA: T) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const field: Identifier = <any> (constructorLoader.getConstructor({ value: classLoaded })!.constructor)
        .value.params[0];
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });

      expect(parameterLoader.getFieldRange(classLoaded, field, {}))
        .toEqual({ type: 'genericTypeReference', value: 'T' });
    });

    it('should get the range of a generic raw type', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A<T extends string>{
  constructor(fieldA: T) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const field: Identifier = <any> (constructorLoader.getConstructor({ value: classLoaded })!.constructor)
        .value.params[0];
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });

      expect(parameterLoader.getFieldRange(classLoaded, field, {}))
        .toEqual({ type: 'genericTypeReference', value: 'T' });
    });

    it('should get the range of an untyped generic type', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A<T>{
  constructor(fieldA: T) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const field: Identifier = <any> (constructorLoader.getConstructor({ value: classLoaded })!.constructor)
        .value.params[0];
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });

      expect(parameterLoader.getFieldRange(classLoaded, field, {}))
        .toEqual({ type: 'genericTypeReference', value: 'T' });
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

    it('should get the range of an unknown type as wildcard', async() => {
      expect(await getFieldRange('fieldA: unknown', {}))
        .toEqual({ type: 'wildcard' });
    });

    it('should get the range of an undefined type as undefined', async() => {
      expect(await getFieldRange('fieldA: undefined', {}))
        .toEqual({ type: 'undefined' });
    });

    it('should get the range of an any type as wildcard', async() => {
      expect(await getFieldRange('fieldA: any', {}))
        .toEqual({ type: 'wildcard' });
    });

    it('should get the range of an void type as wildcard', async() => {
      expect(await getFieldRange('fieldA: void', {}))
        .toEqual({ type: 'wildcard' });
    });

    it('should get the range of a null type as wildcard', async() => {
      expect(await getFieldRange('fieldA: null', {}))
        .toEqual({ type: 'wildcard' });
    });

    it('should get the range of a union type of two raw types', async() => {
      expect(await getFieldRange('fieldA: number | string', {}))
        .toEqual({
          type: 'union',
          elements: [
            { type: 'raw', value: 'number' },
            { type: 'raw', value: 'string' },
          ],
        });
    });

    it('should get the range of a union type of a raw type and undefined', async() => {
      expect(await getFieldRange('fieldA: number | undefined', {}))
        .toEqual({
          type: 'union',
          elements: [
            { type: 'raw', value: 'number' },
            { type: 'undefined' },
          ],
        });
    });

    it('should get the range of a union type of two raw types and undefined', async() => {
      expect(await getFieldRange('fieldA: number | string | undefined', {}))
        .toEqual({
          type: 'union',
          elements: [
            { type: 'raw', value: 'number' },
            { type: 'raw', value: 'string' },
            { type: 'undefined' },
          ],
        });
    });

    it('should get the range of a union type of three classes', async() => {
      expect(await getFieldRange('fieldA: MyClass1 | MyClass2 | MyClass3', {}))
        .toEqual({
          type: 'union',
          elements: [
            { type: 'interface', value: 'MyClass1', origin: expect.anything() },
            { type: 'interface', value: 'MyClass2', origin: expect.anything() },
            { type: 'interface', value: 'MyClass3', origin: expect.anything() },
          ],
        });
    });

    it('should get the range of an intersection type of two raw types', async() => {
      expect(await getFieldRange('fieldA: number & string', {}))
        .toEqual({
          type: 'intersection',
          elements: [
            { type: 'raw', value: 'number' },
            { type: 'raw', value: 'string' },
          ],
        });
    });

    it('should get the range of a intersection type of three classes', async() => {
      expect(await getFieldRange('fieldA: MyClass1 & MyClass2 & MyClass3', {}))
        .toEqual({
          type: 'intersection',
          elements: [
            { type: 'interface', value: 'MyClass1', origin: expect.anything() },
            { type: 'interface', value: 'MyClass2', origin: expect.anything() },
            { type: 'interface', value: 'MyClass3', origin: expect.anything() },
          ],
        });
    });

    it('should get the range of nested union and types', async() => {
      expect(await getFieldRange('fieldA: (MyClass1 | MyClass2) & MyClass3', {}))
        .toEqual({
          type: 'intersection',
          elements: [
            {
              type: 'union',
              elements: [
                { type: 'interface', value: 'MyClass1', origin: expect.anything() },
                { type: 'interface', value: 'MyClass2', origin: expect.anything() },
              ],
            },
            { type: 'interface', value: 'MyClass3', origin: expect.anything() },
          ],
        });
    });

    it('should get the range of a tuple type of fixed length', async() => {
      expect(await getFieldRange('fieldA: [ number, string ]', {}))
        .toEqual({
          type: 'tuple',
          elements: [
            { type: 'raw', value: 'number' },
            { type: 'raw', value: 'string' },
          ],
        });
    });

    it('should get the range of a tuple type with rest types', async() => {
      expect(await getFieldRange('fieldA: [ number, ...string, ...number, ...(boolean | string) ]', {}))
        .toEqual({
          type: 'tuple',
          elements: [
            { type: 'raw', value: 'number' },
            { type: 'rest', value: { type: 'raw', value: 'string' }},
            { type: 'rest', value: { type: 'raw', value: 'number' }},
            {
              type: 'rest',
              value: {
                type: 'union',
                elements: [
                  { type: 'raw', value: 'boolean' },
                  { type: 'raw', value: 'string' },
                ],
              },
            },
          ],
        });
    });

    it('should get the range of a literal number field type', async() => {
      expect(await getFieldRange('fieldA: 123', {}))
        .toEqual({ type: 'literal', value: 123 });
    });

    it('should get the range of a literal string field type', async() => {
      expect(await getFieldRange('fieldA: "abc"', {}))
        .toEqual({ type: 'literal', value: 'abc' });
    });

    it('should get the range of a literal boolean field type', async() => {
      expect(await getFieldRange('fieldA: true', {}))
        .toEqual({ type: 'literal', value: true });
    });

    it('should error on a literal of unsupported type', async() => {
      await expect(async() => await getFieldRange('fieldA: 100n', {}))
        .rejects.toThrow(new Error(`Could not understand parameter type TSLiteralType of field fieldA in A at file`));
    });

    it('should log on a literal of unsupported type', async() => {
      expect(await getFieldRange('fieldA: 100n', {}, false))
        .toEqual({ type: 'wildcard' });
      expect(logger.error).toHaveBeenCalledWith(`Could not understand parameter type TSLiteralType of field fieldA in A at file`);
    });

    it('should get the range of a keyof field type', async() => {
      expect(await getFieldRange('fieldA: keyof MyClass', {}))
        .toEqual({
          type: 'keyof',
          value: { type: 'interface', value: 'MyClass', origin: expect.anything() },
        });
    });

    it('should error on a readonly type', async() => {
      await expect(async() => await getFieldRange('fieldA: readonly ABC', {}))
        .rejects.toThrow(new Error(`Could not understand parameter type TSTypeOperator of field fieldA in A at file`));
    });

    it('should get the range of a typeof field type', async() => {
      expect(await getFieldRange('fieldA: typeof MyClass', {}))
        .toEqual({
          type: 'typeof',
          value: 'MyClass',
          origin: expect.anything(),
        });
    });

    it('should get the range of a typeof field type with qualified path', async() => {
      expect(await getFieldRange('fieldA: typeof A.B.MyClass', {}))
        .toEqual({
          type: 'typeof',
          value: 'MyClass',
          qualifiedPath: [ 'A', 'B' ],
          origin: expect.anything(),
        });
    });
  });

  describe('overrideRawRange', () => {
    it('should override a raw range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'raw',
          value: 'string',
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'raw',
        value: 'boolean',
      });
    });

    it('should not override an undefined range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'undefined',
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'undefined',
      });
    });

    it('should not override an override range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'override',
          value: 'bla',
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'override',
        value: 'bla',
      });
    });

    it('should not override an interface range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'interface',
          value: 'bla',
          genericTypeParameterInstantiations: [],
          origin: classLoadedDummy,
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'raw',
        value: 'boolean',
      });
    });

    it('should override a genericTypeReference range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'genericTypeReference',
          value: 'T',
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'raw',
        value: 'boolean',
      });
    });

    it('should override a typeof range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'typeof',
          value: 'T',
          origin: classLoadedDummy,
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'raw',
        value: 'boolean',
      });
    });

    it('should override a hash range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'hash',
          value: <any> 'bla',
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'raw',
        value: 'boolean',
      });
    });

    it('should recursively override a union range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'union',
          elements: [
            {
              type: 'raw',
              value: 'string',
            },
            {
              type: 'undefined',
            },
          ],
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'union',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'undefined',
          },
        ],
      });
    });

    it('should recursively override an intersection range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'intersection',
          elements: [
            {
              type: 'raw',
              value: 'string',
            },
            {
              type: 'undefined',
            },
          ],
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'intersection',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'undefined',
          },
        ],
      });
    });

    it('should recursively override a tuple range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'tuple',
          elements: [
            {
              type: 'raw',
              value: 'string',
            },
            {
              type: 'undefined',
            },
          ],
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'tuple',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'undefined',
          },
        ],
      });
    });

    it('should recursively override a rest range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'rest',
          value: {
            type: 'raw',
            value: 'string',
          },
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'rest',
        value: {
          type: 'raw',
          value: 'boolean',
        },
      });
    });

    it('should recursively override an array range', () => {
      expect(loader.overrideRawRange(
        {
          type: 'array',
          value: {
            type: 'raw',
            value: 'string',
          },
        },
        {
          type: 'raw',
          value: 'boolean',
        },
      )).toEqual({
        type: 'array',
        value: {
          type: 'raw',
          value: 'boolean',
        },
      });
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
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };
    let parameterLoader: ParameterLoader;

    async function getIndexDomain(fieldDeclaration: string):
    Promise<'string' | 'number' | 'boolean'> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(field: ${fieldDeclaration}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const field: any = <any>(constructorLoader.getConstructor({ value: classLoaded })!.constructor)
        .value.params[0];
      const indexSignature: TSIndexSignature = field.typeAnnotation.typeAnnotation.members[0];
      parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });
      return parameterLoader.getIndexDomain(classLoaded, indexSignature);
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
      await expect(async() => parameterLoader.getIndexDomain(classLoadedDummy, <any> {
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
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getIndexRange(fieldDeclaration: string, commentData: CommentData, hardErrorUnsupported = true):
    Promise<ParameterRangeUnresolved> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(field: ${fieldDeclaration}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const field: any = <any>(constructorLoader.getConstructor({ value: classLoaded })!.constructor)
        .value.params[0];
      const indexSignature: TSIndexSignature = field.typeAnnotation.typeAnnotation.members[0];
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported, logger });
      return parameterLoader.getIndexRange(classLoaded, indexSignature, commentData);
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

    it('should log on a missing range', async() => {
      expect(await getIndexRange('{[k: string]}', {}, false))
        .toEqual({ type: 'wildcard' });
      expect(logger.error).toHaveBeenCalledWith('Missing field type on an index signature in A at file');
    });
  });

  describe('handleTypeOverride', () => {
    const clazz: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function handleTypeOverride(type: string): Promise<ParameterRangeUnresolved | undefined> {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(a: ${type}) {}
}`,
      };
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false, false);
      const field: Identifier = <any> (constructorLoader.getConstructor({ value: classLoaded })!.constructor)
        .value.params[0];
      const parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });
      const typeNode: TSTypeReference = <TSTypeReference> field.typeAnnotation!.typeAnnotation;
      return parameterLoader.handleTypeOverride(typeNode);
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
