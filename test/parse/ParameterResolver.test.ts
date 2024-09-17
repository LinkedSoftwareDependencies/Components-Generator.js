import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ClassLoaded, ClassReference, ClassReferenceLoaded, InterfaceLoaded } from '../../lib/parse/ClassIndex';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { ConstructorLoader } from '../../lib/parse/ConstructorLoader';
import { ParameterLoader } from '../../lib/parse/ParameterLoader';
import { ParameterResolver } from '../../lib/parse/ParameterResolver';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ParameterResolver', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let logger: any;
  let commentLoader: CommentLoader;
  let parameterLoader: ParameterLoader;
  let classLoader: ClassLoader;
  let ignoreClasses: Record<string, boolean>;
  let loader: ParameterResolver;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
    };
    commentLoader = new CommentLoader();
    classLoader = new ClassLoader({ resolutionContext, logger, commentLoader });
    ignoreClasses = {};
    parameterLoader = new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger });
    loader = new ParameterResolver({ classLoader, ignoreClasses, parameterLoader });
  });

  describe('resolveAllConstructorParameters', () => {
    it('should handle an empty index', async() => {
      await expect(loader.resolveAllConstructorParameters({})).resolves
        .toEqual({});
    });

    it('should handle a non-empty simple index', async() => {
      await expect(loader.resolveAllConstructorParameters({
        A: {
          classLoaded: <any> { type: 'class', localName: 'A', fileName: 'A' },
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      })).resolves.toEqual({
        A: {
          classLoaded: <any> { type: 'class', localName: 'A', fileName: 'A' },
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      });
    });

    it('should ignore interfaces', async() => {
      await expect(loader.resolveAllConstructorParameters({
        A: {
          classLoaded: <any> { type: 'interface', localName: 'A', fileName: 'A' },
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      })).resolves.toEqual({});
    });
  });

  describe('resolveConstructorParameters', () => {
    const classLoaded: ClassLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      await expect(loader.resolveConstructorParameters({
        classLoaded,
        parameters: [],
      })).resolves.toEqual({
        classLoaded,
        parameters: [],
      });
    });

    it('should handle a raw parameter', async() => {
      await expect(loader.resolveConstructorParameters({
        classLoaded,
        parameters: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'boolean',
            },
          },
        ],
      })).resolves
        .toEqual({
          classLoaded,
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        });
    });
  });

  describe('resolveAllGenericTypeParameterData', () => {
    it('should handle an empty index', async() => {
      await expect(loader.resolveAllGenericTypeParameterData({})).resolves
        .toEqual({});
    });

    it('should handle a non-empty simple index', async() => {
      await expect(loader.resolveAllGenericTypeParameterData({
        A: {
          classLoaded: <any> { type: 'class', localName: 'A', fileName: 'A' },
          genericTypeParameters: [
            {
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      })).resolves.toEqual({
        A: {
          classLoaded: <any> { type: 'class', localName: 'A', fileName: 'A' },
          genericTypeParameters: [
            {
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      });
    });
  });

  describe('resolveGenericTypeParameterData', () => {
    const classReference: ClassReferenceLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      await expect(loader.resolveGenericTypeParameterData([], classReference, {})).resolves.toEqual([]);
    });

    it('should handle raw generic type parameters', async() => {
      await expect(loader.resolveGenericTypeParameterData([
        {
          name: 'A',
        },
        {
          name: 'B',
          range: {
            type: 'raw',
            value: 'number',
          },
        },
        {
          name: 'C',
          default: {
            type: 'literal',
            value: 3,
          },
        },
      ], classReference, {})).resolves.toEqual([
        {
          name: 'A',
        },
        {
          name: 'B',
          range: {
            type: 'raw',
            value: 'number',
          },
        },
        {
          name: 'C',
          default: {
            type: 'literal',
            value: 3,
          },
        },
      ]);
    });

    it('should handle a generic type parameter with class value', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      await expect(loader.resolveGenericTypeParameterData([
        {
          name: 'A',
          range: {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [],
            origin: classReference,
          },
        },
      ], classReference, {})).resolves.toMatchObject([
        {
          name: 'A',
          range: {
            type: 'class',
            value: { localName: 'MyClass', fileName: 'MyClass' },
          },
        },
      ]);
    });

    it('should handle a generic type parameter with class value with sub-generics', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass<T, U>{}`,
      };
      await expect(loader.resolveGenericTypeParameterData([
        {
          name: 'A',
          range: {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [
              {
                type: 'genericTypeReference',
                value: 'B',
              },
              {
                type: 'raw',
                value: 'number',
              },
            ],
            origin: classReference,
          },
        },
        {
          name: 'B',
        },
      ], classReference, {})).resolves.toMatchObject([
        {
          name: 'A',
          range: {
            type: 'class',
            value: {
              type: 'class',
              localName: 'MyClass',
            },
            genericTypeParameterInstances: [
              {
                type: 'genericTypeReference',
                value: 'B',
              },
              {
                type: 'raw',
                value: 'number',
              },
            ],
          },
        },
        {
          name: 'B',
        },
      ]);
    });

    // TODO: also test with generic type instantiation of raw number
  });

  describe('resolveAllMemberParameterData', () => {
    it('should handle an empty index', async() => {
      await expect(loader.resolveAllMemberParameterData({})).resolves
        .toEqual({});
    });

    it('should handle a non-empty simple index', async() => {
      await expect(loader.resolveAllMemberParameterData({
        A: {
          classLoaded: <any> { type: 'class', localName: 'A', fileName: 'A' },
          members: [
            {
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      })).resolves.toEqual({
        A: {
          classLoaded: <any> { type: 'class', localName: 'A', fileName: 'A' },
          members: [
            {
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      });
    });
  });

  describe('resolveMemberParameterData', () => {
    const classReference: ClassReferenceLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      await expect(loader.resolveMemberParameterData([], classReference, {})).resolves.toEqual([]);
    });

    it('should handle raw members', async() => {
      await expect(loader.resolveMemberParameterData([
        {
          name: 'A',
        },
        {
          name: 'B',
          range: {
            type: 'raw',
            value: 'number',
          },
        },
      ], classReference, {})).resolves.toEqual([
        {
          name: 'A',
        },
        {
          name: 'B',
          range: {
            type: 'raw',
            value: 'number',
          },
        },
      ]);
    });

    it('should handle a member with class value', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      await expect(loader.resolveMemberParameterData([
        {
          name: 'A',
          range: {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [],
            origin: classReference,
          },
        },
      ], classReference, {})).resolves.toMatchObject([
        {
          name: 'A',
          range: {
            type: 'class',
            value: { localName: 'MyClass', fileName: 'MyClass' },
          },
        },
      ]);
    });

    it('should handle a member with class value with sub-generics', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass<T, U>{}`,
      };
      await expect(loader.resolveMemberParameterData([
        {
          name: 'A',
          range: {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [
              {
                type: 'genericTypeReference',
                value: 'B',
              },
              {
                type: 'raw',
                value: 'number',
              },
            ],
            origin: classReference,
          },
        },
        {
          name: 'B',
        },
      ], classReference, {})).resolves.toMatchObject([
        {
          name: 'A',
          range: {
            type: 'class',
            value: {
              type: 'class',
              localName: 'MyClass',
            },
            genericTypeParameterInstances: [
              {
                type: 'genericTypeReference',
                value: 'B',
              },
              {
                type: 'raw',
                value: 'number',
              },
            ],
          },
        },
        {
          name: 'B',
        },
      ]);
    });
  });

  describe('resolveParameterData', () => {
    const classReference: ClassReferenceLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      await expect(loader.resolveParameterData([], classReference, {}, new Set())).resolves.toEqual([]);
    });

    it('should handle raw field parameters', async() => {
      await expect(loader.resolveParameterData([
        {
          type: 'field',
          name: 'fieldA',
          range: {
            type: 'raw',
            value: 'boolean',
          },
        },
        {
          type: 'field',
          name: 'fieldB',
          range: {
            type: 'raw',
            value: 'number',
          },
        },
      ], classReference, {}, new Set())).resolves.toEqual([
        {
          type: 'field',
          name: 'fieldA',
          range: {
            type: 'raw',
            value: 'boolean',
          },
        },
        {
          type: 'field',
          name: 'fieldB',
          range: {
            type: 'raw',
            value: 'number',
          },
        },
      ]);
    });

    it('should handle a raw index parameters', async() => {
      await expect(loader.resolveParameterData([
        {
          type: 'index',
          domain: 'string',
          range: {
            type: 'raw',
            value: 'boolean',
          },
        },
      ], classReference, {}, new Set())).resolves.toEqual([
        {
          type: 'index',
          domain: 'string',
          range: {
            type: 'raw',
            value: 'boolean',
          },
        },
      ]);
    });

    it('should handle a complex field parameter', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      await expect(loader.resolveParameterData([
        {
          type: 'field',
          name: 'fieldA',
          range: {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [],
            origin: classReference,
          },
        },
      ], classReference, {}, new Set())).resolves.toMatchObject([
        {
          type: 'field',
          name: 'fieldA',
          range: {
            type: 'class',
            value: { localName: 'MyClass', fileName: 'MyClass' },
          },
        },
      ]);
    });

    it('should handle a complex index parameter', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      await expect(loader.resolveParameterData([
        {
          type: 'index',
          domain: 'string',
          range: {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [],
            origin: classReference,
          },
        },
      ], classReference, {}, new Set())).resolves.toMatchObject([
        {
          type: 'index',
          domain: 'string',
          range: {
            type: 'class',
            value: { localName: 'MyClass', fileName: 'MyClass' },
          },
        },
      ]);
    });
  });

  describe('resolveAllExtensionData', () => {
    it('should handle an empty index', async() => {
      await expect(loader.resolveAllExtensionData({}, {})).resolves
        .toEqual({});
    });

    it('should handle a non-empty simple index', async() => {
      const iface1 = <any> {};
      const iface2 = <any> {};
      await expect(loader.resolveAllExtensionData({
        A: [
          {
            classLoaded: iface1,
            genericTypeInstantiations: [
              {
                type: 'raw',
                value: 'string',
              },
            ],
          },
          {
            classLoaded: iface2,
            genericTypeInstantiations: [
              {
                type: 'raw',
                value: 'number',
              },
            ],
          },
        ],
      }, {
        A: <any> { type: 'class', localName: 'A', fileName: 'A' },
      })).resolves.toEqual({
        A: [
          {
            classLoaded: iface1,
            genericTypeInstantiations: [
              {
                type: 'raw',
                value: 'string',
              },
            ],
          },
          {
            classLoaded: iface2,
            genericTypeInstantiations: [
              {
                type: 'raw',
                value: 'number',
              },
            ],
          },
        ],
      });
    });
  });

  describe('resolveExtensionData', () => {
    const classReference: ClassReferenceLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      await expect(loader.resolveExtensionData([], classReference, {})).resolves.toEqual([]);
    });

    it('should handle empty generic type instantiations', async() => {
      const iface1 = <any> {};
      const iface2 = <any> {};
      await expect(loader.resolveExtensionData([
        {
          classLoaded: iface1,
          genericTypeInstantiations: [],
        },
        {
          classLoaded: iface2,
          genericTypeInstantiations: [],
        },
      ], classReference, {})).resolves.toEqual([
        {
          classLoaded: iface1,
          genericTypeInstantiations: [],
        },
        {
          classLoaded: iface2,
          genericTypeInstantiations: [],
        },
      ]);
    });

    it('should handle raw generic type instantiations', async() => {
      const iface1 = <any> {};
      const iface2 = <any> {};
      await expect(loader.resolveExtensionData([
        {
          classLoaded: iface1,
          genericTypeInstantiations: [
            {
              type: 'raw',
              value: 'string',
            },
          ],
        },
        {
          classLoaded: iface2,
          genericTypeInstantiations: [
            {
              type: 'raw',
              value: 'number',
            },
          ],
        },
      ], classReference, {})).resolves.toEqual([
        {
          classLoaded: iface1,
          genericTypeInstantiations: [
            {
              type: 'raw',
              value: 'string',
            },
          ],
        },
        {
          classLoaded: iface2,
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

  describe('hashParameterRangeUnresolved', () => {
    it('should hash undefined', () => {
      expect(loader.hashParameterRangeUnresolved({ type: 'undefined' }))
        .toBe('undefined');
    });

    it('should hash wildcard', () => {
      expect(loader.hashParameterRangeUnresolved({ type: 'wildcard' }))
        .toBe('wildcard');
    });

    it('should hash interface', () => {
      expect(loader.hashParameterRangeUnresolved(<any> { type: 'interface', value: 'IFACE' }))
        .toBe('interface:IFACE');
    });

    it('should hash genericTypeReference', () => {
      expect(loader.hashParameterRangeUnresolved({ type: 'genericTypeReference', value: 'val' }))
        .toBe('genericTypeReference:val');
    });

    it('should hash raw', () => {
      expect(loader.hashParameterRangeUnresolved({ type: 'raw', value: 'boolean' }))
        .toBe('raw:boolean');
    });

    it('should hash literal', () => {
      expect(loader.hashParameterRangeUnresolved({ type: 'literal', value: 'val' }))
        .toBe('literal:val');
    });

    it('should hash override', () => {
      expect(loader.hashParameterRangeUnresolved({ type: 'override', value: 'val' }))
        .toBe('override:val');
    });

    it('should hash union', () => {
      expect(loader.hashParameterRangeUnresolved({
        type: 'union',
        elements: [
          { type: 'raw', value: 'boolean' },
          { type: 'raw', value: 'number' },
        ],
      }))
        .toBe('union:[raw:boolean,raw:number]');
    });

    it('should hash intersection', () => {
      expect(loader.hashParameterRangeUnresolved({
        type: 'intersection',
        elements: [
          { type: 'raw', value: 'boolean' },
          { type: 'raw', value: 'number' },
        ],
      }))
        .toBe('intersection:[raw:boolean,raw:number]');
    });

    it('should hash tuple', () => {
      expect(loader.hashParameterRangeUnresolved({
        type: 'tuple',
        elements: [
          { type: 'raw', value: 'boolean' },
          { type: 'raw', value: 'number' },
        ],
      }))
        .toBe('tuple:[raw:boolean,raw:number]');
    });

    it('should hash rest', () => {
      expect(loader.hashParameterRangeUnresolved({
        type: 'rest',
        value: { type: 'raw', value: 'boolean' },
      }))
        .toBe('rest:[raw:boolean]');
    });

    it('should hash array', () => {
      expect(loader.hashParameterRangeUnresolved({
        type: 'array',
        value: { type: 'raw', value: 'boolean' },
      }))
        .toBe('array:[raw:boolean]');
    });

    it('should hash keyof', () => {
      expect(loader.hashParameterRangeUnresolved({
        type: 'keyof',
        value: { type: 'raw', value: 'boolean' },
      }))
        .toBe('keyof:[raw:boolean]');
    });

    it('should hash typeof', () => {
      expect(loader.hashParameterRangeUnresolved(<any> {
        type: 'typeof',
        value: 'CLASS',
      }))
        .toBe('typeof:CLASS');
    });

    it('should hash hash', () => {
      expect(loader.hashParameterRangeUnresolved({
        type: 'hash',
        value: <any> { a: 'b' },
      }))
        .toBe('hash:{"a":"b"}');
    });

    it('should hash index', () => {
      expect(loader.hashParameterRangeUnresolved({
        type: 'indexed',
        object: { type: 'raw', value: 'boolean' },
        index: { type: 'raw', value: 'string' },
      }))
        .toBe('indexed:[raw:boolean;raw:string]');
    });
  });

  describe('resolveRange', () => {
    const classReference: ClassReferenceLoaded = <any> { localName: 'A', fileName: 'A' };

    it('should not modify a raw range', async() => {
      await expect(loader.resolveRange({
        type: 'raw',
        value: 'boolean',
      }, classReference, {}, true, new Set())).resolves.toEqual({
        type: 'raw',
        value: 'boolean',
      });
    });

    it('should not modify an override range', async() => {
      await expect(loader.resolveRange({
        type: 'override',
        value: 'boolean',
      }, classReference, {}, true, new Set())).resolves.toEqual({
        type: 'override',
        value: 'boolean',
      });
    });

    it('should not modify a literal range', async() => {
      await expect(loader.resolveRange({
        type: 'literal',
        value: 'abc',
      }, classReference, {}, true, new Set())).resolves.toEqual({
        type: 'literal',
        value: 'abc',
      });
    });

    it('should handle a hash range', async() => {
      await expect(loader.resolveRange({
        type: 'hash',
        value: <any> {
          type: AST_NODE_TYPES.TSTypeLiteral,
          members: [],
        },
      }, classReference, {}, true, new Set())).resolves.toEqual({
        type: 'nested',
        value: [],
      });
    });

    it('should handle an interface range pointing to a class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyClass',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'class',
        value: { localName: 'MyClass', fileName: 'MyClass' },
      });
    });

    it('should handle an interface range pointing to a class with another origin', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
        'OtherClass.d.ts': `export class OtherClass{}`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'OtherClass',
        genericTypeParameterInstantiations: [],
        origin: <any> { localName: 'OtherClass', fileName: 'OtherClass' },
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'class',
        value: { localName: 'OtherClass', fileName: 'OtherClass' },
      });
    });

    it('should handle an ignored interface range pointing to a class', async() => {
      ignoreClasses.MyClass = true;
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyClass',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'wildcard',
      });
    });

    it('should handle an ignored interface range pointing to a class with qualified path', async() => {
      ignoreClasses['a.MyClass'] = true;
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyClass',
        qualifiedPath: [ 'a' ],
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'wildcard',
      });
    });

    it('should handle an interface range pointing to an implicit class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export interface MyClass{
  constructor();
}`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyClass',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'class',
        value: { localName: 'MyClass', fileName: 'MyClass' },
      });
    });

    it('should handle an interface range pointing to an interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyInterface'`,
        'MyInterface.d.ts': `export interface MyInterface{
  fieldA: string;
}`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyInterface',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'nested',
        value: [
          {
            name: 'fieldA',
            range: { type: 'raw', value: 'string' },
          },
        ],
      });
    });

    it('should handle an interface range pointing to a extended interface that is ignored', async() => {
      ignoreClasses.IgnoredInterface = true;
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyInterface'`,
        'MyInterface.d.ts': `
export interface MyInterface extends IgnoredInterface{};
`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyInterface',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'nested',
        value: [],
      });
    });

    it('should handle a wildcard range', async() => {
      await expect(loader.resolveRange({
        type: 'wildcard',
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'wildcard',
      });
    });

    it('should handle an undefined range', async() => {
      await expect(loader.resolveRange({
        type: 'undefined',
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'undefined',
      });
    });

    it('should handle a union range', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      await expect(loader.resolveRange({
        type: 'union',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'raw',
            value: 'number',
          },
          {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [],
            origin: classReference,
          },
        ],
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'union',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'raw',
            value: 'number',
          },
          {
            type: 'class',
            value: { localName: 'MyClass', fileName: 'MyClass' },
          },
        ],
      });
    });

    it('should handle an intersection range', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      await expect(loader.resolveRange({
        type: 'intersection',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'raw',
            value: 'number',
          },
          {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [],
            origin: classReference,
          },
        ],
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'intersection',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'raw',
            value: 'number',
          },
          {
            type: 'class',
            value: { localName: 'MyClass', fileName: 'MyClass' },
          },
        ],
      });
    });

    it('should handle a tuple range', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      await expect(loader.resolveRange({
        type: 'tuple',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'raw',
            value: 'number',
          },
          {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [],
            origin: classReference,
          },
        ],
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'tuple',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'raw',
            value: 'number',
          },
          {
            type: 'class',
            value: { localName: 'MyClass', fileName: 'MyClass' },
          },
        ],
      });
    });

    it('should handle a tuple range with rest type', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      await expect(loader.resolveRange({
        type: 'tuple',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'rest',
            value: {
              type: 'interface',
              value: 'MyClass',
              genericTypeParameterInstantiations: [],
              origin: classReference,
            },
          },
        ],
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'tuple',
        elements: [
          {
            type: 'raw',
            value: 'boolean',
          },
          {
            type: 'rest',
            value: {
              type: 'class',
              value: { localName: 'MyClass', fileName: 'MyClass' },
            },
          },
        ],
      });
    });

    it('should handle an array range', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      await expect(loader.resolveRange({
        type: 'array',
        value: {
          type: 'interface',
          value: 'MyClass',
          genericTypeParameterInstantiations: [],
          origin: classReference,
        },
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'array',
        value: {
          type: 'class',
          value: { localName: 'MyClass', fileName: 'MyClass' },
        },
      });
    });

    it('should handle a genericTypeReference range', async() => {
      await expect(loader.resolveRange({
        type: 'genericTypeReference',
        value: 'T',
      }, classReference, {}, true, new Set())).resolves.toEqual({
        type: 'genericTypeReference',
        value: 'T',
        origin: classReference,
      });
    });

    it('should handle a generic range within an interface and remap generic types', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface IFace<AInner, BInner> {
  fieldA: AInner;
  fieldB: BInner;
}
`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'IFace',
        genericTypeParameterInstantiations: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
          },
          {
            type: 'genericTypeReference',
            value: 'BOuter',
          },
        ],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'nested',
        value: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'genericTypeReference',
              value: 'AOuter',
              origin: classReference,
            },
          },
          {
            type: 'field',
            name: 'fieldB',
            range: {
              type: 'genericTypeReference',
              value: 'BOuter',
              origin: classReference,
            },
          },
        ],
      });
    });

    it('should handle a generic range within a nested interface and remap generic types', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface IFace1<AInner1> {
  fieldA: IFace2<AInner1>;
}
interface IFace2<AInner2> {
  fieldB: AInner2;
}
`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'IFace1',
        genericTypeParameterInstantiations: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
          },
        ],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
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
                  name: 'fieldB',
                  range: {
                    type: 'genericTypeReference',
                    value: 'AOuter',
                    origin: classReference,
                  },
                },
              ],
            },
          },
        ],
      });
    });

    it('should handle a generic range within a simple type alias', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
type Type<AOuter> = IFaceA<AOuter>;
interface IFaceA<AInner> {
  fieldA: AInner;
}
`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'Type',
        genericTypeParameterInstantiations: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
          },
        ],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'nested',
        value: [
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'genericTypeReference',
              value: 'AOuter',
              origin: classReference,
            },
          },
        ],
      });
    });

    it('should handle a generic range within a type alias to union type', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
type Type<AOuter> = IFaceA<AOuter> | IFaceB<AOuter>;
interface IFaceA<AInner> {
  fieldA: AInner;
}
interface IFaceB<AInner> {
  fieldB: AInner;
}
`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'Type',
        genericTypeParameterInstantiations: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
          },
        ],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'union',
        elements: [
          {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'fieldA',
                range: {
                  type: 'genericTypeReference',
                  value: 'AOuter',
                  origin: {
                    localName: 'Type',
                  },
                },
              },
            ],
          },
          {
            type: 'nested',
            value: [
              {
                type: 'field',
                name: 'fieldB',
                range: {
                  type: 'genericTypeReference',
                  value: 'AOuter',
                  origin: {
                    localName: 'Type',
                  },
                },
              },
            ],
          },
        ],
      });
    });

    it('should handle a generic range within a class and remap generic types', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
class MyInnerClass<AInner, BInner> {
  constructor(fieldA: AInner, fieldB: BInner){}
}
`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyInnerClass',
        genericTypeParameterInstantiations: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
          },
          {
            type: 'genericTypeReference',
            value: 'BOuter',
          },
        ],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'class',
        value: { localName: 'MyInnerClass', fileName: 'A' },
        genericTypeParameterInstances: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
            origin: classReference,
          },
          {
            type: 'genericTypeReference',
            value: 'BOuter',
            origin: classReference,
          },
        ],
      });
    });

    it('should handle a genericTypeReference range with recursive remapping to itself', async() => {
      await expect(loader.resolveRange({
        type: 'genericTypeReference',
        value: 'T',
      }, classReference, {
        T: {
          type: 'genericTypeReference',
          value: 'T',
        },
      }, true, new Set())).resolves.toEqual({
        type: 'genericTypeReference',
        value: 'T',
        origin: classReference,
      });
    });

    it('should handle a keyof range', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      await expect(loader.resolveRange({
        type: 'keyof',
        value: {
          type: 'interface',
          value: 'MyClass',
          genericTypeParameterInstantiations: [],
          origin: classReference,
        },
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'keyof',
        value: {
          type: 'class',
          value: { localName: 'MyClass', fileName: 'MyClass' },
        },
      });
    });

    it('should handle a keyof range over a typeof over an enum', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyEnum'`,
        'MyEnum.d.ts': `export enum MyEnum {
  keya = 'valuea',
  'keyb' = 'valueb',
}`,
      };

      await expect(loader.resolveRange({
        type: 'keyof',
        value: {
          type: 'typeof',
          value: 'MyEnum',
          origin: classReference,
        },
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'union',
        elements: [
          { type: 'literal', value: 'keya' },
          { type: 'literal', value: 'keyb' },
        ],
      });
    });

    it('should throw on a keyof range over a typeof over a non-enum', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass {}`,
      };

      await expect(loader.resolveRange({
        type: 'keyof',
        value: {
          type: 'typeof',
          value: 'MyClass',
          origin: classReference,
        },
      }, classReference, {}, true, new Set())).rejects
        .toThrow(`Detected typeof of unsupported value MyClass in A`);
    });

    it('should throw on a typeof range', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      await expect(loader.resolveRange({
        type: 'typeof',
        value: 'MyClass',
        origin: classReference,
      }, classReference, {}, true, new Set())).rejects
        .toThrow(`Detected typeof of unsupported value MyClass in A`);
    });

    it('should handle an interface recursively pointing to itself', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export interface MyInterface { field: MyInterface; }`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyInterface',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'nested',
        value: [
          {
            type: 'field',
            name: 'field',
            range: {
              type: 'class',
              value: { localName: 'MyInterface', fileName: 'A' },
            },
          },
        ],
      });
    });

    it('should handle an interface recursively pointing to itself indirectly', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export interface MyInterface { field: string | MyInterface[]; }`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyInterface',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'nested',
        value: [
          {
            type: 'field',
            name: 'field',
            range: {
              type: 'union',
              elements: [
                {
                  type: 'raw',
                  value: 'string',
                },
                {
                  type: 'array',
                  value: {
                    type: 'class',
                    value: { localName: 'MyInterface', fileName: 'A' },
                  },
                },
              ],
            },
          },
        ],
      });
    });

    it('should error on an interface containing a recursive type', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export interface MyInterface { field: MyType[]; };
export type MyType = string | MyType[];`,
      };
      await expect(loader.resolveRange({
        type: 'interface',
        value: 'MyInterface',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {}, true, new Set())).rejects
        .toThrow(`Detected unsupported recursive type definition on MyType`);
    });

    it('should handle an indexed range over a generic', async() => {
      await expect(loader.resolveRange({
        type: 'indexed',
        object: {
          type: 'genericTypeReference',
          value: 'AOuter',
        },
        index: { type: 'literal', value: 'keya' },
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'indexed',
        object: {
          type: 'genericTypeReference',
          value: 'AOuter',
        },
        index: { type: 'literal', value: 'keya' },
      });
    });

    it('should handle an indexed range over a class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      await expect(loader.resolveRange({
        type: 'indexed',
        object: {
          type: 'interface',
          value: 'MyClass',
          genericTypeParameterInstantiations: [],
          origin: classReference,
        },
        index: { type: 'literal', value: 'keya' },
      }, classReference, {}, true, new Set())).resolves.toMatchObject({
        type: 'indexed',
        object: {
          type: 'class',
          value: { localName: 'MyClass', fileName: 'MyClass' },
        },
        index: { type: 'literal', value: 'keya' },
      });
    });
  });

  describe('resolveRangeInterface', () => {
    const classReference: ClassReferenceLoaded = <any> {
      packageName: 'p',
      localName: 'A',
      fileName: 'A',
      fileNameReferenced: 'fileReferenced',
    };

    it('should error on a non-existing interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': ``,
      };
      await expect(loader
        .resolveRangeInterface('IFaceA', undefined, undefined, classReference, classReference, {}, true, new Set()))
        .rejects.toThrow(new Error('Could not load class or interface or other type IFaceA from A'));
    });

    it('should resolve an empty interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface IFaceA {}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'IFaceA',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        )).resolves
        .toEqual({
          type: 'nested',
          value: [],
        });
    });

    it('should resolve a class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
class ClassA {}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'ClassA',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        )).resolves
        .toMatchObject({
          type: 'class',
          value: { localName: 'ClassA', fileName: 'A' },
        });
    });

    it('should resolve a class multiple times via cache', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
class ClassA {}
`,
      };
      const first = await loader
        .resolveRangeInterface(
          'ClassA',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        );
      const second = await loader
        .resolveRangeInterface(
          'ClassA',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        );
      expect(first).toBe(second);
      expect((<any> loader).cacheInterfaceRange.keys()).toEqual([ 'ClassA::::::A::true' ]);
    });

    it('should resolve a class multiple times with different generics without cache', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
class ClassA {}
`,
      };
      const first = await loader
        .resolveRangeInterface('ClassA', undefined, [
          { type: 'raw', value: 'boolean' },
        ], classReference, classReference, {}, true, new Set());
      const second = await loader
        .resolveRangeInterface('ClassA', undefined, [
          { type: 'raw', value: 'number' },
        ], classReference, classReference, {}, true, new Set());
      expect(first).not.toBe(second);
      expect((<any> loader).cacheInterfaceRange.keys())
        .toEqual([ 'ClassA::::raw:number::A::true', 'ClassA::::raw:boolean::A::true' ]);
    });

    it('should resolve an implicit class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface ClassA {
  constructor();
}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'ClassA',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        )).resolves
        .toMatchObject({
          type: 'class',
          value: { localName: 'ClassA', fileName: 'A' },
        });
    });

    it('should resolve an interface with raw fields', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface IFaceA {
  fieldA: string;
  fieldB: number;
}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'IFaceA',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        )).resolves
        .toEqual({
          type: 'nested',
          value: [
            {
              type: 'field',
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'string',
              },
            },
            {
              type: 'field',
              name: 'fieldB',
              range: {
                type: 'raw',
                value: 'number',
              },
            },
          ],
        });
    });

    it('should resolve an interface with raw fields with getNestedFields false', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface IFaceA {
  fieldA: string;
  fieldB: number;
}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'IFaceA',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          false,
          new Set(),
        )).resolves
        .toMatchObject({
          type: 'class',
          value: { localName: 'IFaceA', fileName: 'A' },
        });
    });

    it('should resolve a nested interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface IFaceA {
  fieldA: IFaceB;
}
interface IFaceB {
  fieldB: number;
}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'IFaceA',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        )).resolves
        .toEqual({
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
                    name: 'fieldB',
                    range: {
                      type: 'raw',
                      value: 'number',
                    },
                  },
                ],
              },
            },
          ],
        });
    });

    it('should resolve a type alias', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
type Type = string | boolean;
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'Type',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        )).resolves
        .toEqual({
          type: 'union',
          elements: [
            {
              type: 'raw',
              value: 'string',
            },
            {
              type: 'raw',
              value: 'boolean',
            },
          ],
        });
    });

    it('should resolve an enum', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
enum Enum {
  a = 'A',
  b = 'B',
}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'Enum',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        )).resolves
        .toEqual({
          type: 'union',
          elements: [
            {
              type: 'literal',
              value: 'A',
            },
            {
              type: 'literal',
              value: 'B',
            },
          ],
        });
    });

    it('should resolve an enum value', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
enum Enum {
  a = 'A',
  b = 'B',
}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'a',
          [ 'Enum' ],
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        )).resolves
        .toEqual({
          type: 'literal',
          value: 'A',
        });
    });

    it('should throw on an enum without expression', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
enum Enum {
  a = 'A',
  b,
}
`,
      };
      await expect(loader
        .resolveRangeInterface(
          'Enum',
          undefined,
          undefined,
          classReference,
          classReference,
          {},
          true,
          new Set(),
        ))
        .rejects.toThrow(`Detected enum Enum having an unsupported member (member 1) in A`);
    });
  });

  describe('isInterfaceImplicitClass', () => {
    const classReference: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'A',
      fileNameReferenced: 'fileReferenced',
    };

    it('should be false on an empty interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      expect(loader.isInterfaceImplicitClass(iface)).toBeFalsy();
    });

    it('should be false on an interface with fields', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{
  fieldA: string;
  fieldB: MyClass;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      expect(loader.isInterfaceImplicitClass(iface)).toBeFalsy();
    });

    it('should be true on an interface with a method', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{
  methodA(param: boolean): void;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      expect(loader.isInterfaceImplicitClass(iface)).toBeTruthy();
    });

    it('should be true on an interface with a field-based method', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{
  methodA: (param: boolean) => void;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      expect(loader.isInterfaceImplicitClass(iface)).toBeTruthy();
    });

    it('should be true on an interface with a constructor', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{
  constructor(param: boolean);
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      expect(loader.isInterfaceImplicitClass(iface)).toBeTruthy();
    });
  });

  describe('loadClassOrInterfacesChain', () => {
    const classReference: ClassReference = {
      packageName: 'p',
      localName: 'A',
      fileName: 'A',
      fileNameReferenced: 'fileReferenced',
    };

    it('should error on a non-existing interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': ``,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference))
        .rejects.toThrow(new Error('Could not load class or interface or other type A from A'));
    });

    it('should load a class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export class A{}`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference)).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'class',
        });
    });

    it('should load an interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export interface A{}`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference)).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [],
        });
    });

    it('should load an interface with supers', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A extends B, C{}
export interface B{}
declare interface C{}
`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference)).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              value: {
                fileName: 'A',
                localName: 'B',
                type: 'interface',
              },
            },
            {
              value: {
                fileName: 'A',
                localName: 'C',
                type: 'interface',
              },
            },
          ],
        });
    });

    it('should load an interface with supers with generics', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A extends B<string>, C<number>{}
export interface B<X>{}
declare interface C<X>{}
`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference)).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              value: {
                fileName: 'A',
                localName: 'B',
                type: 'interface',
              },
              genericTypeInstantiations: {
                params: [
                  {
                    type: 'TSStringKeyword',
                  },
                ],
              },
            },
            {
              value: {
                fileName: 'A',
                localName: 'C',
                type: 'interface',
              },
              genericTypeInstantiations: {
                params: [
                  {
                    type: 'TSNumberKeyword',
                  },
                ],
              },
            },
          ],
        });
    });

    it('should load an interface with supers and consider ignored classes', async() => {
      ignoreClasses.C = true;
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A extends B, C{}
export interface B{}
declare interface C{}
`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference)).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              value: {
                fileName: 'A',
                localName: 'B',
                type: 'interface',
              },
            },
          ],
        });
    });

    it('should load an interface with supers over different files', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
import { B } from './B';
import { C } from './C';
export interface A extends B, C{}
`,
        'B.d.ts': `export interface B{}`,
        'C.d.ts': `export interface C{}`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference)).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              value: {
                fileName: 'B',
                localName: 'B',
                type: 'interface',
              },
            },
            {
              value: {
                fileName: 'C',
                localName: 'C',
                type: 'interface',
              },
            },
          ],
        });
    });

    it('should load an interface with supers over recursively different files', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
import { B } from './B';
export interface A extends B{}
`,
        'B.d.ts': `
import { C } from './C';
export interface B extends C{}
`,
        'C.d.ts': `export interface C{}`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference)).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              value: {
                fileName: 'B',
                localName: 'B',
                type: 'interface',
                superInterfaces: [
                  {
                    value: {
                      fileName: 'C',
                      localName: 'C',
                      type: 'interface',
                    },
                  },
                ],
              },
            },
          ],
        });
    });

    it('should load an interface with super over different files via a qualified path', async() => {
      resolutionContext.contentsOverrides = {
        'index.d.ts': `
import * as a from './A';
`,
        'A.d.ts': `
import { B } from './B';
export interface A extends B {}
`,
        'B.d.ts': `
import { C } from './C';
export interface B extends C {}
`,
        'C.d.ts': `export interface C{}`,
      };
      await expect(loader.loadClassOrInterfacesChain(
        { ...classReference, fileName: 'index', qualifiedPath: [ 'a' ]},
      )).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              value: {
                fileName: 'B',
                localName: 'B',
                type: 'interface',
                superInterfaces: [
                  {
                    value: {
                      fileName: 'C',
                      localName: 'C',
                      type: 'interface',
                    },
                  },
                ],
              },
            },
          ],
        });
    });

    it('should error on an interface extending from a class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A extends B{}
export class B{}
`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference))
        .rejects.toThrow(new Error('Detected interface A extending from a non-interface B in A'));
    });

    it('should load an interface with supers via a type alias', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A extends B_A, C_A{}
export type B_A = B;
export type C_A = C;
export interface B{}
declare interface C{}
`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference)).resolves
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              value: {
                fileName: 'A',
                localName: 'B',
                type: 'interface',
              },
            },
            {
              value: {
                fileName: 'A',
                localName: 'C',
                type: 'interface',
              },
            },
          ],
        });
    });

    it('should error on an interface extending from a type alias that does not refer to an interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A extends B{}
export type B = number;
`,
      };
      await expect(loader.loadClassOrInterfacesChain(classReference))
        .rejects.toThrow(new Error('Detected interface A extending from a non-interface B in A'));
    });
  });

  describe('getNestedFieldsFromInterface', () => {
    const classReference: ClassReferenceLoaded = <any> {
      packageName: 'p',
      localName: 'A',
      fileName: 'A',
      fileNameReferenced: 'fileReferenced',
    };

    it('should handle an empty interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toEqual([]);
    });

    it('should handle an interface with a raw field', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{
  fieldA: string;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toEqual([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'string',
            },
          },
        ]);
    });

    it('should handle an interface with an overridden field', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{
  /**
   * @range {boolean}
   */
  fieldA: string;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toEqual([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'override',
              value: 'boolean',
            },
          },
        ]);
    });

    it('should handle an interface with a class field', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
import {B} from './B';
export interface A{
  fieldA: B;
}
`,
        'B.d.ts': `export class B{}`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'class',
              value: { localName: 'B', fileName: 'B' },
            },
          },
        ]);
    });

    it('should error on an interface with a non-imported class field', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{
  fieldA: B;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set()))
        .rejects.toThrow(new Error('Could not load class or interface or other type B from A'));
    });

    it('should error on an interface with a non-existing class field', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
import {B} from './B';
export interface A{
  fieldA: B;
}
`,
        'B.d.ts': `export class X{}`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set()))
        .rejects.toThrow(new Error('Could not load class or interface or other type B from B'));
    });

    it('should handle an interface with an empty interface field', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
import {B} from './B';
export interface A{
  fieldA: B;
}
`,
        'B.d.ts': `export interface B{}`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [],
            },
          },
        ]);
    });

    it('should handle an interface with an filled interface field', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
import {B} from './B';
export interface A{
  fieldA: B;
}
`,
        'B.d.ts': `
export interface B{
  fieldB: boolean;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [
                {
                  name: 'fieldB',
                  range: {
                    type: 'raw',
                    value: 'boolean',
                  },
                },
              ],
            },
          },
        ]);
    });

    it('should handle an interface with an filled interface field referring to the same file', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A{
  fieldA: B;
}
export interface B{
  fieldB: boolean;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [
                {
                  name: 'fieldB',
                  range: {
                    type: 'raw',
                    value: 'boolean',
                  },
                },
              ],
            },
          },
        ]);
    });

    it('should handle an interface with a recursive interface field', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
import {B} from './B';
export interface A{
  fieldA: B;
}
`,
        'B.d.ts': `
import {C} from './C';
export interface B{
  fieldB: C;
}
`,
        'C.d.ts': `
export interface C{
  fieldC1: boolean;
  fieldC2: number;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [
                {
                  type: 'field',
                  name: 'fieldB',
                  range: {
                    type: 'nested',
                    value: [
                      {
                        type: 'field',
                        name: 'fieldC1',
                        range: {
                          type: 'raw',
                          value: 'boolean',
                        },
                      },
                      {
                        type: 'field',
                        name: 'fieldC2',
                        range: {
                          type: 'raw',
                          value: 'number',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ]);
    });

    it('should handle an interface with a generic type reference', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export interface A<T>{
  fieldA: T;
}
`,
      };
      const iface = <InterfaceLoaded> await loader.loadClassOrInterfacesChain(classReference);
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}, new Set())).resolves
        .toEqual([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'genericTypeReference',
              value: 'T',
              origin: classReference,
            },
          },
        ]);
    });
  });

  describe('getNestedFieldsFromHash', () => {
    const classReference: ClassReference = {
      packageName: 'P',
      localName: 'A',
      fileName: 'file',
      fileNameReferenced: 'fileReferenced',
    };

    async function getHash(definition: string, prefix = ''):
    Promise<{ hash: TSESTree.TSTypeLiteral; owningClass: ClassReferenceLoaded }> {
      resolutionContext.contentsOverrides['file.d.ts'] = `
${prefix}
export class A{
  constructor(fieldA: ${definition}) {}
}`;
      const classLoaded = await classLoader.loadClassDeclaration(classReference, false, false);
      const hash: TSESTree.TSTypeLiteral = (<any> (new ConstructorLoader({ parameterLoader })
        .getConstructor({ value: classLoaded })!.constructor)
        .value.params[0]).typeAnnotation.typeAnnotation;

      return { hash, owningClass: classLoaded };
    }

    it('should handle an empty hash', async() => {
      const { hash, owningClass } = await getHash(`{}`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toEqual([]);
    });

    it('should handle a hash with a raw field', async() => {
      const { hash, owningClass } = await getHash(`{
  fieldA: string;
}`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toEqual([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'string',
            },
          },
        ]);
    });

    it('should handle a hash with an overridden field', async() => {
      const { hash, owningClass } = await getHash(`{
  /**
   * @range {boolean}
   */
  fieldA: string;
}`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toEqual([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'override',
              value: 'boolean',
            },
          },
        ]);
    });

    it('should handle a hash with a class field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `export class B{}`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'class',
              value: { localName: 'B', fileName: 'B' },
            },
          },
        ]);
    });

    it('should error on a hash with a non-imported class field', async() => {
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set()))
        .rejects.toThrow(new Error('Could not load class or interface or other type B from file'));
    });

    it('should error on a hash with a non-existing class field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `export class X{}`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set()))
        .rejects.toThrow(new Error('Could not load class or interface or other type B from B'));
    });

    it('should handle a hash with an empty interface field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `export interface B{}`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [],
            },
          },
        ]);
    });

    it('should handle a hash with an filled interface field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `
export interface B{
  fieldB: boolean;
}
`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [
                {
                  name: 'fieldB',
                  range: {
                    type: 'raw',
                    value: 'boolean',
                  },
                },
              ],
            },
          },
        ]);
    });

    it('should handle a hash with an filled interface field referring to the same file', async() => {
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `export interface B{
  fieldB: boolean;
}`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [
                {
                  name: 'fieldB',
                  range: {
                    type: 'raw',
                    value: 'boolean',
                  },
                },
              ],
            },
          },
        ]);
    });

    it('should handle a hash with a recursive interface field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `
import {C} from './C';
export interface B{
  fieldB: C;
}
`,
        'C.d.ts': `
export interface C{
  fieldC1: boolean;
  fieldC2: number;
}
`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [
                {
                  type: 'field',
                  name: 'fieldB',
                  range: {
                    type: 'nested',
                    value: [
                      {
                        type: 'field',
                        name: 'fieldC1',
                        range: {
                          type: 'raw',
                          value: 'boolean',
                        },
                      },
                      {
                        type: 'field',
                        name: 'fieldC2',
                        range: {
                          type: 'raw',
                          value: 'number',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ]);
    });

    it('should handle a hash with a recursive hash field', async() => {
      const { hash, owningClass } = await getHash(`{
  fieldA: {
    fieldB: {
      fieldC1: boolean;
      fieldC2: number;
    },
  },
}`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}, new Set())).resolves
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [
                {
                  type: 'field',
                  name: 'fieldB',
                  range: {
                    type: 'nested',
                    value: [
                      {
                        type: 'field',
                        name: 'fieldC1',
                        range: {
                          type: 'raw',
                          value: 'boolean',
                        },
                      },
                      {
                        type: 'field',
                        name: 'fieldC2',
                        range: {
                          type: 'raw',
                          value: 'number',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ]);
    });
  });
});
