import type { TSTypeLiteral } from '@typescript-eslint/types/dist/ts-estree';
import type { ClassLoaded, ClassReference, ClassReferenceLoaded, InterfaceLoaded } from '../../lib/parse/ClassIndex';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { ConstructorLoader } from '../../lib/parse/ConstructorLoader';
import { ParameterResolver } from '../../lib/parse/ParameterResolver';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ParameterResolver', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let logger: any;
  let commentLoader: CommentLoader;
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
    loader = new ParameterResolver({ classLoader, ignoreClasses, commentLoader });
  });

  describe('resolveAllConstructorParameters', () => {
    it('should handle an empty index', async() => {
      expect(await loader.resolveAllConstructorParameters({}))
        .toEqual({});
    });

    it('should handle a non-empty simple index', async() => {
      expect(await loader.resolveAllConstructorParameters({
        A: {
          classLoaded: <any> { type: 'class', localName: 'A', fileName: 'A' },
          genericTypeParameters: [],
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
      })).toEqual({
        A: {
          classLoaded: <any> { type: 'class', localName: 'A', fileName: 'A' },
          genericTypeParameters: [],
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
      expect(await loader.resolveAllConstructorParameters({
        A: {
          classLoaded: <any> { type: 'interface', localName: 'A', fileName: 'A' },
          genericTypeParameters: [],
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
      })).toEqual({});
    });
  });

  describe('resolveConstructorParameters', () => {
    const classLoaded: ClassLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      expect(await loader.resolveConstructorParameters({ classLoaded, genericTypeParameters: [], parameters: []}))
        .toEqual({ classLoaded, genericTypeParameters: [], parameters: []});
    });

    it('should handle a raw parameter', async() => {
      expect(await loader.resolveConstructorParameters({
        classLoaded,
        genericTypeParameters: [],
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
      }))
        .toEqual({
          classLoaded,
          genericTypeParameters: [],
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

  describe('resolveGenericTypeParameterData', () => {
    const classReference: ClassReferenceLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      expect(await loader.resolveGenericTypeParameterData([], classReference, {})).toEqual([]);
    });

    it('should handle raw generic type parameters', async() => {
      expect(await loader.resolveGenericTypeParameterData([
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
      ], classReference, {})).toEqual([
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

    it('should handle a generic type parameter with class value', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      expect(await loader.resolveGenericTypeParameterData([
        {
          name: 'A',
          range: {
            type: 'interface',
            value: 'MyClass',
            genericTypeParameterInstantiations: [],
            origin: classReference,
          },
        },
      ], classReference, {})).toMatchObject([
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
      expect(await loader.resolveGenericTypeParameterData([
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
      ], classReference, {})).toMatchObject([
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

  describe('resolveParameterData', () => {
    const classReference: ClassReferenceLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      expect(await loader.resolveParameterData([], classReference, {})).toEqual([]);
    });

    it('should handle raw field parameters', async() => {
      expect(await loader.resolveParameterData([
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
      ], classReference, {})).toEqual([
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
      expect(await loader.resolveParameterData([
        {
          type: 'index',
          domain: 'string',
          range: {
            type: 'raw',
            value: 'boolean',
          },
        },
      ], classReference, {})).toEqual([
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
      expect(await loader.resolveParameterData([
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
      ], classReference, {})).toMatchObject([
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
      expect(await loader.resolveParameterData([
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
      ], classReference, {})).toMatchObject([
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

  describe('resolveRange', () => {
    const classReference: ClassReferenceLoaded = <any> { localName: 'A', fileName: 'A' };

    it('should not modify a raw range', async() => {
      expect(await loader.resolveRange({
        type: 'raw',
        value: 'boolean',
      }, classReference, {})).toEqual({
        type: 'raw',
        value: 'boolean',
      });
    });

    it('should not modify an override range', async() => {
      expect(await loader.resolveRange({
        type: 'override',
        value: 'boolean',
      }, classReference, {})).toEqual({
        type: 'override',
        value: 'boolean',
      });
    });

    it('should not modify a literal range', async() => {
      expect(await loader.resolveRange({
        type: 'literal',
        value: 'abc',
      }, classReference, {})).toEqual({
        type: 'literal',
        value: 'abc',
      });
    });

    it('should handle an interface range pointing to a class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'MyClass',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {})).toMatchObject({
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
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'OtherClass',
        genericTypeParameterInstantiations: [],
        origin: <any> { localName: 'OtherClass', fileName: 'OtherClass' },
      }, classReference, {})).toMatchObject({
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
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'MyClass',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {})).toMatchObject({
        type: 'undefined',
      });
    });

    it('should handle an ignored interface range pointing to a class with qualified path', async() => {
      ignoreClasses['a.MyClass'] = true;
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'MyClass',
        qualifiedPath: [ 'a' ],
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {})).toMatchObject({
        type: 'undefined',
      });
    });

    it('should handle an interface range pointing to an implicit class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export interface MyClass{
  constructor();
}`,
      };
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'MyClass',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {})).toMatchObject({
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
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'MyInterface',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {})).toMatchObject({
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
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'MyInterface',
        genericTypeParameterInstantiations: [],
        origin: classReference,
      }, classReference, {})).toMatchObject({
        type: 'nested',
        value: [],
      });
    });

    it('should handle an undefined range', async() => {
      expect(await loader.resolveRange({
        type: 'undefined',
      }, classReference, {})).toMatchObject({
        type: 'undefined',
      });
    });

    it('should handle a union range', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `export * from './MyClass'`,
        'MyClass.d.ts': `export class MyClass{}`,
      };

      expect(await loader.resolveRange({
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
      }, classReference, {})).toMatchObject({
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

      expect(await loader.resolveRange({
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
      }, classReference, {})).toMatchObject({
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

      expect(await loader.resolveRange({
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
      }, classReference, {})).toMatchObject({
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

      expect(await loader.resolveRange({
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
      }, classReference, {})).toMatchObject({
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

      expect(await loader.resolveRange({
        type: 'array',
        value: {
          type: 'interface',
          value: 'MyClass',
          genericTypeParameterInstantiations: [],
          origin: classReference,
        },
      }, classReference, {})).toMatchObject({
        type: 'array',
        value: {
          type: 'class',
          value: { localName: 'MyClass', fileName: 'MyClass' },
        },
      });
    });

    it('should handle a genericTypeReference range', async() => {
      expect(await loader.resolveRange({
        type: 'genericTypeReference',
        value: 'T',
      }, classReference, {})).toEqual({
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
      expect(await loader.resolveRange({
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
      }, classReference, {})).toMatchObject({
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
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'IFace1',
        genericTypeParameterInstantiations: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
          },
        ],
        origin: classReference,
      }, classReference, {})).toMatchObject({
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
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'Type',
        genericTypeParameterInstantiations: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
          },
        ],
        origin: classReference,
      }, classReference, {})).toMatchObject({
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
      expect(await loader.resolveRange({
        type: 'interface',
        value: 'Type',
        genericTypeParameterInstantiations: [
          {
            type: 'genericTypeReference',
            value: 'AOuter',
          },
        ],
        origin: classReference,
      }, classReference, {})).toMatchObject({
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
      expect(await loader.resolveRange({
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
      }, classReference, {})).toMatchObject({
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
      await expect(loader.resolveRangeInterface('IFaceA', undefined, undefined, classReference, classReference, {}))
        .rejects.toThrow(new Error('Could not load class or interface or other type IFaceA from A'));
    });

    it('should resolve an empty interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface IFaceA {}
`,
      };
      expect(await loader.resolveRangeInterface('IFaceA', undefined, undefined, classReference, classReference, {}))
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
      expect(await loader.resolveRangeInterface('ClassA', undefined, undefined, classReference, classReference, {}))
        .toMatchObject({
          type: 'class',
          value: { localName: 'ClassA', fileName: 'A' },
        });
    });

    it('should resolve an implicit class', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface ClassA {
  constructor();
}
`,
      };
      expect(await loader.resolveRangeInterface('ClassA', undefined, undefined, classReference, classReference, {}))
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
      expect(await loader.resolveRangeInterface('IFaceA', undefined, undefined, classReference, classReference, {}))
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
      expect(await loader.resolveRangeInterface('IFaceA', undefined, undefined, classReference, classReference, {}))
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
      expect(await loader.resolveRangeInterface('Type', undefined, undefined, classReference, classReference, {}))
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
      expect(await loader.resolveRangeInterface('Enum', undefined, undefined, classReference, classReference, {}))
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
      expect(await loader.resolveRangeInterface('a', [ 'Enum' ], undefined, classReference, classReference, {}))
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
      await expect(loader.resolveRangeInterface('Enum', undefined, undefined, classReference, classReference, {}))
        .rejects.toThrowError(`Detected enum Enum having an unsupported member (member 1) in A`);
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
      expect(await loader.loadClassOrInterfacesChain(classReference))
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
      expect(await loader.loadClassOrInterfacesChain(classReference))
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
      expect(await loader.loadClassOrInterfacesChain(classReference))
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              fileName: 'A',
              localName: 'B',
              type: 'interface',
            },
            {
              fileName: 'A',
              localName: 'C',
              type: 'interface',
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
      expect(await loader.loadClassOrInterfacesChain(classReference))
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              fileName: 'A',
              localName: 'B',
              type: 'interface',
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
      expect(await loader.loadClassOrInterfacesChain(classReference))
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              fileName: 'B',
              localName: 'B',
              type: 'interface',
            },
            {
              fileName: 'C',
              localName: 'C',
              type: 'interface',
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
      expect(await loader.loadClassOrInterfacesChain(classReference))
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              fileName: 'B',
              localName: 'B',
              type: 'interface',
              superInterfaces: [
                {
                  fileName: 'C',
                  localName: 'C',
                  type: 'interface',
                },
              ],
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
      expect(await loader.loadClassOrInterfacesChain(classReference))
        .toMatchObject({
          fileName: 'A',
          localName: 'A',
          type: 'interface',
          superInterfaces: [
            {
              fileName: 'A',
              localName: 'B',
              type: 'interface',
            },
            {
              fileName: 'A',
              localName: 'C',
              type: 'interface',
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      await expect(loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
      expect(await loader.getNestedFieldsFromInterface(iface, classReference, {}))
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
    Promise<{ hash: TSTypeLiteral; owningClass: ClassReferenceLoaded }> {
      resolutionContext.contentsOverrides['file.d.ts'] = `
${prefix}
export class A{
  constructor(fieldA: ${definition}) {}
}`;
      const classLoaded = await classLoader.loadClassDeclaration(classReference, false, false);
      const hash: TSTypeLiteral = (<any> (new ConstructorLoader({ commentLoader })
        .getConstructor(classLoaded)!.constructor)
        .value.params[0]).typeAnnotation.typeAnnotation;

      return { hash, owningClass: classLoaded };
    }

    it('should handle an empty hash', async() => {
      const { hash, owningClass } = await getHash(`{}`);
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
        .toEqual([]);
    });

    it('should handle a hash with a raw field', async() => {
      const { hash, owningClass } = await getHash(`{
  fieldA: string;
}`);
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
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
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}))
        .rejects.toThrow(new Error('Could not load class or interface or other type B from file'));
    });

    it('should error on a hash with a non-existing class field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `export class X{}`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass, {}))
        .rejects.toThrow(new Error('Could not load class or interface or other type B from B'));
    });

    it('should handle a hash with an empty interface field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `export interface B{}`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass, {}))
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
