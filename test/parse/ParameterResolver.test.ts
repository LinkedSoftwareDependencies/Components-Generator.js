import type { TSTypeLiteral, MethodDefinition } from '@typescript-eslint/types/dist/ts-estree';
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
      expect(await loader.resolveAllConstructorParameters({}, {}))
        .toEqual({});
    });

    it('should handle a non-empty simple index', async() => {
      expect(await loader.resolveAllConstructorParameters({
        A: {
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              unique: true,
              required: true,
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      }, {
        A: <any>{ type: 'class', localName: 'A', fileName: 'A' },
      })).toEqual({
        A: {
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              unique: true,
              required: true,
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
          parameters: [
            {
              type: 'field',
              name: 'fieldA',
              unique: true,
              required: true,
              range: {
                type: 'raw',
                value: 'boolean',
              },
            },
          ],
        },
      }, {
        A: <any>{ type: 'interface', localName: 'A', fileName: 'A' },
      })).toEqual({});
    });
  });

  describe('resolveConstructorParameters', () => {
    const classReference: ClassLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      expect(await loader.resolveConstructorParameters({ parameters: []}, classReference))
        .toEqual({ parameters: []});
    });

    it('should handle a raw parameter', async() => {
      expect(await loader.resolveConstructorParameters({ parameters: [
        {
          type: 'field',
          name: 'fieldA',
          unique: true,
          required: true,
          range: {
            type: 'raw',
            value: 'boolean',
          },
        },
      ]}, classReference))
        .toEqual({ parameters: [
          {
            type: 'field',
            name: 'fieldA',
            unique: true,
            required: true,
            range: {
              type: 'raw',
              value: 'boolean',
            },
          },
        ]});
    });
  });

  describe('resolveParameterData', () => {
    const classReference: ClassReferenceLoaded = <any>{ localName: 'A', fileName: 'A' };

    it('should handle an empty array', async() => {
      expect(await loader.resolveParameterData([], classReference)).toEqual([]);
    });

    it('should handle raw field parameters', async() => {
      expect(await loader.resolveParameterData([
        {
          type: 'field',
          name: 'fieldA',
          unique: true,
          required: true,
          range: {
            type: 'raw',
            value: 'boolean',
          },
        },
        {
          type: 'field',
          name: 'fieldB',
          unique: true,
          required: true,
          range: {
            type: 'raw',
            value: 'number',
          },
        },
      ], classReference)).toEqual([
        {
          type: 'field',
          name: 'fieldA',
          unique: true,
          required: true,
          range: {
            type: 'raw',
            value: 'boolean',
          },
        },
        {
          type: 'field',
          name: 'fieldB',
          unique: true,
          required: true,
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
      ], classReference)).toEqual([
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
          unique: true,
          required: true,
          range: {
            type: 'interface',
            value: 'MyClass',
          },
        },
      ], classReference)).toMatchObject([
        {
          type: 'field',
          name: 'fieldA',
          unique: true,
          required: true,
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
          },
        },
      ], classReference)).toMatchObject([
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
      }, classReference)).toEqual({
        type: 'raw',
        value: 'boolean',
      });
    });

    it('should not modify an override range', async() => {
      expect(await loader.resolveRange({
        type: 'override',
        value: 'boolean',
      }, classReference)).toEqual({
        type: 'override',
        value: 'boolean',
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
      }, classReference)).toMatchObject({
        type: 'class',
        value: { localName: 'MyClass', fileName: 'MyClass' },
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
      }, classReference)).toMatchObject({
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
      }, classReference)).toMatchObject({
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
      }, classReference)).toMatchObject({
        type: 'nested',
        value: [
          {
            name: 'fieldA',
            range: { type: 'raw', value: 'string' },
            required: true,
            unique: true,
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
      }, classReference)).toMatchObject({
        type: 'nested',
        value: [],
      });
    });

    it('should handle an undefined range', async() => {
      expect(await loader.resolveRange({
        type: 'undefined',
      }, classReference)).toMatchObject({
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
          },
        ],
      }, classReference)).toMatchObject({
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
          },
        ],
      }, classReference)).toMatchObject({
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
          },
        ],
      }, classReference)).toMatchObject({
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
            },
          },
        ],
      }, classReference)).toMatchObject({
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
      await expect(loader.resolveRangeInterface('IFaceA', classReference))
        .rejects.toThrow(new Error('Could not load class or interface IFaceA from A'));
    });

    it('should resolve an empty interface', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
interface IFaceA {}
`,
      };
      expect(await loader.resolveRangeInterface('IFaceA', classReference))
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
      expect(await loader.resolveRangeInterface('ClassA', classReference))
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
      expect(await loader.resolveRangeInterface('ClassA', classReference))
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
      expect(await loader.resolveRangeInterface('IFaceA', classReference))
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
              required: true,
              unique: true,
            },
            {
              type: 'field',
              name: 'fieldB',
              range: {
                type: 'raw',
                value: 'number',
              },
              required: true,
              unique: true,
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
      expect(await loader.resolveRangeInterface('IFaceA', classReference))
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
                    required: true,
                    unique: true,
                  },
                ],
              },
              required: true,
              unique: true,
            },
          ],
        });
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
        .rejects.toThrow(new Error('Could not load class or interface A from A'));
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
        .rejects.toThrow(new Error('Detected interface A extending from a class B in A'));
    });
  });

  describe('getNestedFieldsFromInterface', () => {
    const classReference: ClassReference = {
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
      expect(await loader.getNestedFieldsFromInterface(iface))
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
      expect(await loader.getNestedFieldsFromInterface(iface))
        .toEqual([
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
      expect(await loader.getNestedFieldsFromInterface(iface))
        .toEqual([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'override',
              value: 'boolean',
            },
            required: true,
            unique: true,
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
      expect(await loader.getNestedFieldsFromInterface(iface))
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'class',
              value: { localName: 'B', fileName: 'B' },
            },
            required: true,
            unique: true,
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
      await expect(loader.getNestedFieldsFromInterface(iface))
        .rejects.toThrow(new Error('Could not load class or interface B from A'));
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
      await expect(loader.getNestedFieldsFromInterface(iface))
        .rejects.toThrow(new Error('Could not load class or interface B from B'));
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
      expect(await loader.getNestedFieldsFromInterface(iface))
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [],
            },
            required: true,
            unique: true,
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
      expect(await loader.getNestedFieldsFromInterface(iface))
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
                  required: true,
                  unique: true,
                },
              ],
            },
            required: true,
            unique: true,
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
      expect(await loader.getNestedFieldsFromInterface(iface))
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
                  required: true,
                  unique: true,
                },
              ],
            },
            required: true,
            unique: true,
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
      expect(await loader.getNestedFieldsFromInterface(iface))
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
                        required: true,
                        unique: true,
                      },
                      {
                        type: 'field',
                        name: 'fieldC2',
                        range: {
                          type: 'raw',
                          value: 'number',
                        },
                        required: true,
                        unique: true,
                      },
                    ],
                  },
                  required: true,
                  unique: true,
                },
              ],
            },
            required: true,
            unique: true,
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
      const classLoaded = await classLoader.loadClassDeclaration(classReference, false);
      const hash: TSTypeLiteral = (<any> (<MethodDefinition> new ConstructorLoader({ commentLoader })
        .getConstructor(classLoaded))
        .value.params[0]).typeAnnotation.typeAnnotation;

      return { hash, owningClass: classLoaded };
    }

    it('should handle an empty hash', async() => {
      const { hash, owningClass } = await getHash(`{}`);
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
        .toEqual([]);
    });

    it('should handle a hash with a raw field', async() => {
      const { hash, owningClass } = await getHash(`{
  fieldA: string;
}`);
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
        .toEqual([
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
        ]);
    });

    it('should handle a hash with an overridden field', async() => {
      const { hash, owningClass } = await getHash(`{
  /**
   * @range {boolean}
   */
  fieldA: string;
}`);
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
        .toEqual([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'override',
              value: 'boolean',
            },
            required: true,
            unique: true,
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'class',
              value: { localName: 'B', fileName: 'B' },
            },
            required: true,
            unique: true,
          },
        ]);
    });

    it('should error on a hash with a non-imported class field', async() => {
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass))
        .rejects.toThrow(new Error('Could not load class or interface B from file'));
    });

    it('should error on a hash with a non-existing class field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `export class X{}`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      await expect(loader.getNestedFieldsFromHash(hash, owningClass))
        .rejects.toThrow(new Error('Could not load class or interface B from B'));
    });

    it('should handle a hash with an empty interface field', async() => {
      resolutionContext.contentsOverrides = {
        'B.d.ts': `export interface B{}`,
      };
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `import {B} from './B';`);
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
        .toMatchObject([
          {
            type: 'field',
            name: 'fieldA',
            range: {
              type: 'nested',
              value: [],
            },
            required: true,
            unique: true,
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
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
                  required: true,
                  unique: true,
                },
              ],
            },
            required: true,
            unique: true,
          },
        ]);
    });

    it('should handle a hash with an filled interface field referring to the same file', async() => {
      const { hash, owningClass } = await getHash(`{
  fieldA: B;
}`, `export interface B{
  fieldB: boolean;
}`);
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
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
                  required: true,
                  unique: true,
                },
              ],
            },
            required: true,
            unique: true,
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
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
                        required: true,
                        unique: true,
                      },
                      {
                        type: 'field',
                        name: 'fieldC2',
                        range: {
                          type: 'raw',
                          value: 'number',
                        },
                        required: true,
                        unique: true,
                      },
                    ],
                  },
                  required: true,
                  unique: true,
                },
              ],
            },
            required: true,
            unique: true,
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
      expect(await loader.getNestedFieldsFromHash(hash, owningClass))
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
                        required: true,
                        unique: true,
                      },
                      {
                        type: 'field',
                        name: 'fieldC2',
                        range: {
                          type: 'raw',
                          value: 'number',
                        },
                        required: true,
                        unique: true,
                      },
                    ],
                  },
                  required: true,
                  unique: true,
                },
              ],
            },
            required: true,
            unique: true,
          },
        ]);
    });
  });
});
