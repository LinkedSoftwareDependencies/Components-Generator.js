import { MethodDefinition } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ClassReference } from '../../lib/parse/ClassIndex';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { ConstructorLoader } from '../../lib/parse/ConstructorLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('CommentLoader', () => {
  const clazz: ClassReference = { localName: 'A', fileName: 'file' };
  const resolutionContext = new ResolutionContextMocked({});

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
      const classLoader = new ClassLoader({ resolutionContext });
      const classLoaded = await classLoader.loadClassDeclaration(clazz);
      const constructorLoader = new ConstructorLoader();
      const field = <any> (<MethodDefinition> constructorLoader.getConstructor(classLoaded)).value.params[0];

      const loader = new CommentLoader({ classLoaded });

      return { loader, field };
    }

    it('should be undefined for no comment', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  constructor(fieldA: boolean) {}
}`,
      };
      const { loader, field } = await createLoader();
      expect(loader.getCommentRaw(field)).toBeUndefined();
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
      const { loader, field } = await createLoader();
      expect(loader.getCommentRaw(field)).toEqual('/**\n   * This is a comment!\n   */');
    });
  });
});
