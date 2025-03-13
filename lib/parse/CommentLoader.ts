import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { parse } from 'comment-parser';
import type { ClassReference, ClassReferenceLoaded } from './ClassIndex';
import type { ConstructorHolder } from './ConstructorLoader';
import type { DefaultNested, DefaultValue, ParameterRangeUnresolved } from './ParameterLoader';

/**
 * Loads comments from fields in a given class.
 */
export class CommentLoader {
  /**
   * Extract comment data from the given constructor inheritance chain.
   * @param constructorChain An array of constructors within the class inheritance chain.
   */
  public getCommentDataFromConstructor(constructorChain: ConstructorHolder[]): ConstructorCommentData {
    // Merge comment data about each field so that the closest classes in the inheritance chain have
    // the highest priority in setting comment data.
    return constructorChain
      .map(constructorHolder => this.getCommentDataFromConstructorSingle(
        constructorHolder.classLoaded.value,
        constructorHolder.constructor,
      ))
      .reduce<ConstructorCommentData>((acc, commentData) => {
        for (const [ key, value ] of Object.entries(commentData)) {
          if (key in acc) {
            acc[key] = {
              // eslint-disable-next-line ts/prefer-nullish-coalescing
              range: acc[key].range || value.range,
              // eslint-disable-next-line ts/prefer-nullish-coalescing
              defaults: [ ...acc[key].defaults || [], ...value.defaults || [] ],
              // eslint-disable-next-line ts/prefer-nullish-coalescing
              ignored: acc[key].ignored || value.ignored,
              // eslint-disable-next-line ts/prefer-nullish-coalescing
              description: acc[key].description || value.description,
              params: { ...acc[key].params, ...value.params },
              // eslint-disable-next-line ts/prefer-nullish-coalescing
              defaultNested: [ ...acc[key].defaultNested || [], ...value.defaultNested || [] ],
            };
          } else {
            acc[key] = value;
          }
        }
        return acc;
      }, {});
  }

  /**
   * Extract comment data from the given constructor.
   * @param classLoaded The loaded class in which the constructor is defined.
   * @param constructor A constructor.
   */
  public getCommentDataFromConstructorSingle(
    classLoaded: ClassReferenceLoaded,
    constructor: TSESTree.MethodDefinition,
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
        const subCommentData = CommentLoader.getCommentDataFromComment(`/**${value.replaceAll(' @', '\n * @')}*/`, clazz);

        // Since we're in the scope of a param (key), prepend the defaultNested paramPath array with the current param.
        if (subCommentData.defaultNested) {
          for (const defaultNested of subCommentData.defaultNested) {
            defaultNested.paramPath.unshift(key);
          }
        }

        data[key] = subCommentData;
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
    field: TSESTree.TSPropertySignature | TSESTree.TSIndexSignature,
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

    const commentParsed = parse(comment)[0];
    if (commentParsed) {
      // Extract description
      if (commentParsed.description.length > 0) {
        data.description = commentParsed.description.replaceAll('\n', ' ');
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
            if (!data.defaults) {
              data.defaults = [];
            }
            data.defaults.push(CommentLoader.getDefaultValue(tag.type, clazz));
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
          case 'defaultnested':
            if (tag.type.length === 0 || tag.name.length === 0) {
              throw new Error(`Invalid @defaultNested syntax on a field in class ${clazz.localName} at ${clazz.fileName}: expected @defaultNested {<id> a <Type>} path_to_param`);
            }
            if (!data.defaultNested) {
              data.defaultNested = [];
            }
            data.defaultNested.push({
              paramPath: tag.name.split('_'),
              value: CommentLoader.getDefaultValue(tag.type, clazz),
            });
            break;
        }
      }
    }

    return data;
  }

  /**
   * Parse the microsyntax of a default value.
   *
   * Can be one of:
   * * raw value: "abc"
   * * iri value: "<ex:abc>"
   * * type value: "a <ex:Type>"
   * * iri and type value: "<ex:abc> a <ex:Type>"
   *
   * @param value A default value string.
   * @param clazz The class reference this value is loaded in.
   */
  public static getDefaultValue(value: string, clazz: ClassReference): DefaultValue {
    if (!value.startsWith('<') && !value.startsWith('a ')) {
      return {
        type: 'raw',
        value,
      };
    }

    const [ idRaw, typeRaw ] = value.startsWith('a ') ?
        [ undefined, value.slice(2) ] :
      value.split(' a ');
    return {
      type: 'iri',
      value: idRaw ? CommentLoader.getIriValue(idRaw) : undefined,
      typeIri: typeRaw ? CommentLoader.getIriValue(typeRaw) : undefined,
      baseComponent: clazz,
    };
  }

  /**
   * Unbox an IRI wrapped in <>
   * @param iriBoxed An iri string within <>
   */
  public static getIriValue(iriBoxed: string): string | undefined {
    const match = /^<([^>]*)>$/u.exec(iriBoxed);
    return match ? match[1] : undefined;
  }

  /**
   * Get the comment string from the given node.
   * @param classLoaded The loaded class in which the field is defined.
   * @param node A node, such as a field or constructor.
   */
  public getCommentRaw(classLoaded: ClassReferenceLoaded, node: TSESTree.BaseNode): string | undefined {
    const line = node.loc.start.line;
    for (const comment of classLoaded.ast.comments ?? []) {
      if (comment.loc.end.line === line - 1) {
        return `/*${comment.value}*/`;
      }
    }
  }
}

/**
 * Maps field keys to comments.
 */
export type ConstructorCommentData = Record<string, CommentData>;

export interface CommentData {
  /**
   * The range of the parameter values.
   */
  range?: ParameterRangeUnresolved;
  /**
   * The default values.
   */
  defaults?: DefaultValue[];
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
  /**
   * The nested default values on parameters.
   */
  defaultNested?: DefaultNested[];
}
