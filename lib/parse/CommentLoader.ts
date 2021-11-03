import type { MethodDefinition, TSPropertySignature,
  TSIndexSignature, BaseNode } from '@typescript-eslint/types/dist/ts-estree';
import * as commentParse from 'comment-parser';
import type { ClassReference, ClassReferenceLoaded } from './ClassIndex';
import type { ParameterRangeUnresolved } from './ParameterLoader';

/**
 * Loads comments from fields in a given class.
 */
export class CommentLoader {
  /**
   * Extract comment data from the given constructor.
   * @param classLoaded The loaded class in which the constructor is defined.
   * @param constructor A constructor.
   */
  public getCommentDataFromConstructor(
    classLoaded: ClassReferenceLoaded,
    constructor: MethodDefinition,
  ): ConstructorCommentData {
    // Get the constructor comment
    const comment = this.getCommentRaw(classLoaded, constructor);
    if (comment) {
      return CommentLoader.getCommentDataFromConstructorComment(comment, classLoaded);
    }

    return {};
  }

  /**
   * Get comment data from the given constructor comment.
   * @param comment A constructor comment string.
   * @param clazz A class reference, for error reporting.
   */
  public static getCommentDataFromConstructorComment(comment: string, clazz: ClassReference): ConstructorCommentData {
    const data: ConstructorCommentData = {};

    // Iterate over all @param's
    const commentData = CommentLoader.getCommentDataFromComment(comment, clazz);
    if (commentData.params) {
      for (const [ key, value ] of Object.entries(commentData.params)) {
        data[key] = CommentLoader.getCommentDataFromComment(`/**${value.replace(/@/gu, '\n * @')}*/`, clazz);
      }
    }

    return data;
  }

  /**
   * Extract comment data from the given field.
   * @param classLoaded The loaded class in which the field is defined.
   * @param field A field.
   */
  public getCommentDataFromField(
    classLoaded: ClassReferenceLoaded,
    field: TSPropertySignature | TSIndexSignature,
  ): CommentData {
    const comment = this.getCommentRaw(classLoaded, field);
    if (comment) {
      return CommentLoader.getCommentDataFromComment(comment, classLoaded);
    }
    return {};
  }

  /**
   * Extract comment data from the given class.
   * @param classLoaded The loaded class or interface.
   */
  public getCommentDataFromClassOrInterface(classLoaded: ClassReferenceLoaded): CommentData {
    const comment = this.getCommentRaw(classLoaded, classLoaded.declaration);
    if (comment) {
      return CommentLoader.getCommentDataFromComment(comment, classLoaded);
    }
    return {};
  }

  /**
   * Get comment data from the given comment.
   * @param comment A comment string.
   * @param clazz A class reference, for error reporting.
   */
  public static getCommentDataFromComment(comment: string, clazz: ClassReference): CommentData {
    const data: CommentData = {};

    const commentParsed = commentParse(comment)[0];
    if (commentParsed) {
      // Extract description
      if (commentParsed.description.length > 0) {
        data.description = commentParsed.description.replace(/\n/gu, ' ');
      }

      // Extract tags
      for (const tag of commentParsed.tags) {
        switch (tag.tag.toLowerCase()) {
          case 'range':
            if (tag.type.length === 0) {
              throw new Error(`Missing @range value {something} on a field in class ${clazz.localName} at ${clazz.fileName}`);
            }
            data.range = {
              type: 'override',
              value: tag.type,
            };
            break;
          case 'default':
            if (tag.type.length === 0) {
              throw new Error(`Missing @default value {something} on a field in class ${clazz.localName} at ${clazz.fileName}`);
            }
            data.default = tag.type;
            break;
          case 'ignored':
            data.ignored = true;
            break;
          case 'param':
            if (!data.params) {
              data.params = {};
            }
            data.params[tag.name] = tag.description;
            if (data.params[tag.name].startsWith('- ')) {
              data.params[tag.name] = data.params[tag.name].slice(2);
            }
            break;
        }
      }
    }

    return data;
  }

  /**
   * Get the comment string from the given node.
   * @param classLoaded The loaded class in which the field is defined.
   * @param node A node, such as a field or constructor.
   */
  public getCommentRaw(classLoaded: ClassReferenceLoaded, node: BaseNode): string | undefined {
    const line = node.loc.start.line;
    for (const comment of classLoaded.ast.comments || []) {
      if (comment.loc.end.line === line - 1) {
        return `/*${comment.value}*/`;
      }
    }
  }
}

export type ConstructorCommentData = Record<string, CommentData>;

export interface CommentData {
  /**
   * The range of the parameter values.
   */
  range?: ParameterRangeUnresolved;
  /**
   * The default value.
   */
  default?: string;
  /**
   * If the field referenced by this comment should be ignored.
   */
  ignored?: boolean;
  /**
   * The human-readable description of this comment.
   */
  description?: string;
  /**
   * Parameters that were defined in this comment.
   */
  params?: Record<string, string>;
}
