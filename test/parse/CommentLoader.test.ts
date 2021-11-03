import type { MethodDefinition } from '@typescript-eslint/types/dist/ts-estree';
import type { ClassReference } from '../../lib/parse/ClassIndex';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { ConstructorLoader } from '../../lib/parse/ConstructorLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('CommentLoader', () => {
  const clazz: ClassReference = {
    packageName: 'p',
    localName: 'A',
    fileName: 'file',
    fileNameReferenced: 'fileReferenced',
  };
  const resolutionContext = new ResolutionContextMocked({});
  let logger: any;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
    };
  });

  describe('getCommentDataFromField', () => {
    async function createLoader() {
      const loader = new CommentLoader();
      const classLoader = new ClassLoader({ resolutionContext, logger, commentLoader: loader });
      const iface = await classLoader.loadClassDeclaration(clazz, true);
      const field: any = iface.declaration.body.body[0];
      return { loader, field, iface };
    }

    it('should be empty for no comment', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export interface A{
  fieldA: boolean;
}`,
      };
      const { loader, field, iface } = await createLoader();
      expect(loader.getCommentDataFromField(iface, field)).toEqual({});
    });

    it('should be defined for a simple comment', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export interface A{
  /**
   * This is a field!
   */
  fieldA: boolean;
}`,
      };
      const { loader, field, iface } = await createLoader();
      expect(loader.getCommentDataFromField(iface, field)).toEqual({
        description: 'This is a field!',
      });
    });

    it('should be defined for a simple comment with newlines', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export interface A{
  /**
   * This is a field!
   * And this is a new line.
   * And another one.
   */
  fieldA: boolean;
}`,
      };
      const { loader, field, iface } = await createLoader();
      expect(loader.getCommentDataFromField(iface, field)).toEqual({
        description: 'This is a field! And this is a new line. And another one.',
      });
    });

    it('should be defined for a complex comment', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export interface A{
  /**
   * This is a field!
   * @range {boolean}
   * @default {true}
   * @ignored
   */
  fieldA: boolean;
}`,
      };
      const { loader, field, iface } = await createLoader();
      expect(loader.getCommentDataFromField(iface, field)).toEqual({
        default: 'true',
        description: 'This is a field!',
        ignored: true,
        range: {
          type: 'override',
          value: 'boolean',
        },
      });
    });
  });

  describe('getCommentDataFromConstructorComment', () => {
    it('should be empty for an empty comment', () => {
      expect(CommentLoader.getCommentDataFromConstructorComment(
        `/**/`,
        clazz,
      )).toEqual({});
    });

    it('should return data for a single simple param', () => {
      expect(CommentLoader.getCommentDataFromConstructorComment(
        `
/**
 * @param fieldA This is a field
*/`,
        clazz,
      )).toEqual({
        fieldA: {
          description: 'This is a field',
        },
      });
    });

    it('should return data for a single complex param', () => {
      expect(CommentLoader.getCommentDataFromConstructorComment(
        `
/**
 * @param fieldA This is a field @ignored @range {number}
*/`,
        clazz,
      )).toEqual({
        fieldA: {
          description: 'This is a field',
          ignored: true,
          range: {
            type: 'override',
            value: 'number',
          },
        },
      });
    });
  });

  describe('getCommentDataFromComment', () => {
    it('should be empty for an empty comment', async() => {
      expect(CommentLoader.getCommentDataFromComment(
        '/**/',
        clazz,
      )).toEqual({});
    });

    it('should retrieve a description', async() => {
      expect(CommentLoader.getCommentDataFromComment(
        '/**\n   * This is a comment!\n   */',
        clazz,
      )).toEqual({
        description: 'This is a comment!',
      });
    });

    it('should retrieve a range tag', async() => {
      expect(CommentLoader.getCommentDataFromComment(
        '/**\n   * @range {number}\n   */',
        clazz,
      )).toEqual({
        range: {
          type: 'override',
          value: 'number',
        },
      });
    });

    it('should error on a range tag without value', async() => {
      expect(() => CommentLoader.getCommentDataFromComment(
        '/**\n   * @range true\n   */',
        clazz,
      )).toThrow(new Error('Missing @range value {something} on a field in class A at file'));
    });

    it('should retrieve a default tag', async() => {
      expect(CommentLoader.getCommentDataFromComment(
        '/**\n   * @default {true}\n   */',
        clazz,
      )).toEqual({
        default: 'true',
      });
    });

    it('should error on a default tag without value', async() => {
      expect(() => CommentLoader.getCommentDataFromComment(
        '/**\n   * @default true\n   */',
        clazz,
      )).toThrow(new Error('Missing @default value {something} on a field in class A at file'));
    });

    it('should retrieve an ignored tag', async() => {
      expect(CommentLoader.getCommentDataFromComment(
        '/**\n   * @ignored\n   */',
        clazz,
      )).toEqual({
        ignored: true,
      });
    });

    it('should retrieve a param tag', async() => {
      expect(CommentLoader.getCommentDataFromComment(
        '/**\n   * @param fieldA This is my field @someTag\n   */',
        clazz,
      )).toEqual({
        params: {
          fieldA: 'This is my field @someTag',
        },
      });
    });

    it('should retrieve a param tag and ignore the dash', async() => {
      expect(CommentLoader.getCommentDataFromComment(
        '/**\n   * @param fieldA - This is my field @someTag\n   */',
        clazz,
      )).toEqual({
        params: {
          fieldA: 'This is my field @someTag',
        },
      });
    });

    it('should retrieve multiple param tags', async() => {
      expect(CommentLoader.getCommentDataFromComment(
        '/**\n   * @param fieldA This is my field @someTag\n@param fieldB - This is another field\n   */',
        clazz,
      )).toEqual({
        params: {
          fieldA: 'This is my field @someTag',
          fieldB: 'This is another field',
        },
      });
    });
  });

  describe('getCommentRaw', () => {
    async function createLoader() {
      const loader = new CommentLoader();
      const classLoader = new ClassLoader({ resolutionContext, logger, commentLoader: loader });
      const classLoaded = await classLoader.loadClassDeclaration(clazz, false);
      const constructorLoader = new ConstructorLoader({ commentLoader: loader });
      const field = <any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded)).value.params[0];
      return { loader, field, classLoaded };
    }

    it('should be undefined for no comment', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(fieldA: boolean) {}
}`,
      };
      const { loader, field, classLoaded } = await createLoader();
      expect(loader.getCommentRaw(classLoaded, field)).toBeUndefined();
    });

    it('should be undefined for an unrelated comment', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
/**
 * Unrelated
 */

  constructor(fieldA: boolean) {}
}`,
      };
      const { loader, field, classLoaded } = await createLoader();
      expect(loader.getCommentRaw(classLoaded, field)).toBeUndefined();
    });

    it('should be undefined for no comments in ast', async() => {
      expect(new CommentLoader().getCommentRaw(
        <any> { ast: {}},
        <any> { loc: { start: { line: 0 }}},
      )).toBeUndefined();
    });

    it('should be defined for a constructor comment', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  /**
   * This is a comment!
   */
  constructor(fieldA: boolean) {}
}`,
      };
      const { loader, field, classLoaded } = await createLoader();
      expect(loader.getCommentRaw(classLoaded, field)).toEqual('/**\n   * This is a comment!\n   */');
    });
  });
});
