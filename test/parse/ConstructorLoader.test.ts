import { ClassFinder } from '../../lib/parse/ClassFinder';
import type { ClassLoaded } from '../../lib/parse/ClassIndex';
import { ClassIndexer } from '../../lib/parse/ClassIndexer';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { ConstructorLoader } from '../../lib/parse/ConstructorLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ConstructorLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let logger: any;
  let commentLoader: CommentLoader;
  let parser: ConstructorLoader;
  let classIndexer: ClassIndexer;

  beforeEach(() => {
    commentLoader = new CommentLoader();
    parser = new ConstructorLoader({ commentLoader });
    logger = {
      debug: jest.fn(),
    };
    const classLoader = new ClassLoader({ resolutionContext, logger, commentLoader });
    classIndexer = new ClassIndexer({
      classLoader,
      classFinder: new ClassFinder({ classLoader }),
      ignoreClasses: {},
      logger,
    });
  });

  describe('getConstructors', () => {
    it('should return for a single class without constructor', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{}`,
      };
      const A = await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getConstructors({
        A,
      })).toEqual({
        A: {
          parameters: [],
          classLoaded: A,
        },
      });
    });

    it('should return for a single interface', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export interface A{}`,
      };
      const A = await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getConstructors({
        A,
      })).toEqual({
        A: {
          parameters: [],
          classLoaded: A,
        },
      });
    });

    it('should return for two classes with constructor', async() => {
      resolutionContext.contentsOverrides = {
        'A.d.ts': `
export class A{
  /**
   * @param fieldA - This is a great field! @range {float}
   * @param fieldB This is B @range {float}
   * @param fieldC This is C @ignored
   */
  constructor(fieldA: string, fieldB?: number[], fieldC?: string[]) {}
}
`,
        'B.d.ts': `
export class B{
  /**
   * @param fieldA - This is a great field!
   */
  constructor(fieldA: string) {}
}
`,
      };
      const A = await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'A',
        fileNameReferenced: 'fileReferenced',
      });
      const B = await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'B',
        fileName: 'B',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getConstructors({
        A,
        B,
      })).toEqual({
        A: {
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
          classLoaded: A,
        },
        B: {
          parameters: [
            {
              type: 'field',
              comment: 'This is a great field!',
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'string',
              },
              required: true,
              unique: true,
            },
          ],
          classLoaded: B,
        },
      });
    });
  });

  describe('getConstructor', () => {
    it('should return undefined on a class without a constructor or super', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{}`,
      };
      expect(parser.getConstructor(
        <ClassLoaded> await classIndexer.loadClassChain({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }),
      )).toBeUndefined();
    });

    it('should return undefined on a class chain without constructors', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
import { B } from './B';
export class A extends B{}
`,
        'B.d.ts': `
import { C } from './C';
export class B extends C{}
`,
        'C.d.ts': `export class C{}`,
      };
      expect(parser.getConstructor(
        <ClassLoaded> await classIndexer.loadClassChain({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }),
      )).toBeUndefined();
    });

    it('should return on a class with a direct constructor', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
class A{
  constructor() {}
}`,
      };
      const classLoaded = <ClassLoaded> await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getConstructor(
        classLoaded,
      )).toMatchObject({
        classLoaded,
        constructor: {
          computed: false,
          key: {
            name: 'constructor',
            type: 'Identifier',
          },
          kind: 'constructor',
          static: false,
          type: 'MethodDefinition',
          value: {
            async: false,
            body: {
              body: [],
              type: 'BlockStatement',
            },
            expression: false,
            generator: false,
            id: null,
            params: [],
            type: 'FunctionExpression',
          },
        },
      });
    });

    it('should return on a class chain with a super super constructor', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
import { B } from './B';
export class A extends B{}
`,
        'B.d.ts': `
import { C } from './C';
export class B extends C{}
`,
        'C.d.ts': `
export class C{
  constructor() {}
}
`,
      };
      const classLoaded = <ClassLoaded> await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getConstructor(
        classLoaded,
      )).toMatchObject({
        classLoaded: {
          localName: 'C',
        },
        constructor: {
          computed: false,
          key: {
            name: 'constructor',
            type: 'Identifier',
          },
          kind: 'constructor',
          static: false,
          type: 'MethodDefinition',
          value: {
            async: false,
            body: {
              body: [],
              type: 'BlockStatement',
            },
            expression: false,
            generator: false,
            id: null,
            params: [],
            type: 'FunctionExpression',
          },
        },
      });
    });
  });

  describe('getConstructorInClass', () => {
    it('should return undefined on a class without a constructor', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `class A{}`,
      };
      expect(parser.getConstructorInClass(<any> (await resolutionContext
        .parseTypescriptFile('file')).body[0]))
        .toBeUndefined();
    });

    it('should return undefined on a class without a constructor but other elements', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
class A{
  abc(): string {}
}`,
      };
      expect(parser.getConstructorInClass(<any> (await resolutionContext
        .parseTypescriptFile('file')).body[0]))
        .toBeUndefined();
    });

    it('should return on a class with a constructor', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
class A{
  constructor() {}
}`,
      };
      expect(parser.getConstructorInClass(<any> (await resolutionContext
        .parseTypescriptFile('file')).body[0]))
        .toMatchObject({
          computed: false,
          key: {
            name: 'constructor',
            type: 'Identifier',
          },
          kind: 'constructor',
          static: false,
          type: 'MethodDefinition',
          value: {
            async: false,
            body: {
              body: [],
              type: 'BlockStatement',
            },
            expression: false,
            generator: false,
            id: null,
            params: [],
            type: 'FunctionExpression',
          },
        });
    });
  });

  describe('getClass', () => {
    it('should error on no contents', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': ``,
      };
      await expect(async() => parser.getClass('A',
        await resolutionContext.parseTypescriptFile('file'),
        'file')).rejects
        .toThrow(new Error('Could not find class A in file'));
    });

    it('should error on just a const export', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export const foo = "a";`,
      };
      await expect(async() => parser.getClass('A',
        await resolutionContext.parseTypescriptFile('file'),
        'file')).rejects
        .toThrow(new Error('Could not find class A in file'));
    });

    it('should return a local class', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `class A{}`,
      };
      expect(parser.getClass('A',
        await resolutionContext.parseTypescriptFile('file'),
        'file')).toMatchObject({
        body: {
          body: [],
          type: 'ClassBody',
        },
        id: {
          name: 'A',
          type: 'Identifier',
        },
        superClass: null,
        type: 'ClassDeclaration',
      });
    });

    it('should return an exported class', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{}`,
      };
      expect(parser.getClass('A',
        await resolutionContext.parseTypescriptFile('file'),
        'file')).toMatchObject({
        body: {
          body: [],
          type: 'ClassBody',
        },
        id: {
          name: 'A',
          type: 'Identifier',
        },
        superClass: null,
        type: 'ClassDeclaration',
      });
    });
  });
});
