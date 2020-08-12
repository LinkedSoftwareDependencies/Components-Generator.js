import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import {
  Identifier,
  MethodDefinition,
  TSTypeLiteral,
  TypeNode,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ClassLoaded, ClassReference } from './ClassIndex';
import { CommentData, CommentLoader } from './CommentLoader';
import { ConstructorData } from './ConstructorLoader';

/**
 * Interprets class parameters of a given class.
 */
export class ParameterLoader {
  private readonly classLoaded: ClassLoaded;
  private readonly commentLoader: CommentLoader;

  public constructor(args: ParameterLoaderArgs) {
    this.classLoaded = args.classLoaded;
    this.commentLoader = new CommentLoader({ classLoaded: this.classLoaded });
  }

  /**
   * Load all parameter data from all fields in the given constructor.
   * @param constructor A constructor
   */
  public loadConstructorFields(constructor: MethodDefinition): ConstructorData {
    // Load the constructor comment
    const constructorCommentData = this.commentLoader.getCommentDataFromConstructor(constructor);

    // Load all constructor parameters
    const parameters: ParameterData[] = [];
    for (const field of constructor.value.params) {
      if (field.type === AST_NODE_TYPES.Identifier) {
        const commentData = constructorCommentData[field.name] || {};
        if (!commentData.ignored) {
          parameters.push(this.loadField(field, commentData));
        }
      } else {
        throw new Error(`Could not understand constructor parameter type ${field.type} in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
      }
    }
    return { parameters };
  }

  /**
   * Load the parameter data from the given field.
   * @param field A field.
   * @param commentData Comment data about the given field.
   */
  public loadField(field: Identifier, commentData: CommentData): ParameterData {
    // Required data
    const parameterData: ParameterData = {
      name: this.getFieldName(field),
      unique: this.isFieldUnique(field),
      required: this.isFieldRequired(field),
      range: this.getFieldRange(field, commentData),
    };

    // Optional data
    const defaultValue = this.getFieldDefault(commentData);
    if (defaultValue) {
      parameterData.default = defaultValue;
    }

    const comment = this.getFieldComment(commentData);
    if (comment) {
      parameterData.comment = comment;
    }

    return parameterData;
  }

  public getFieldName(field: Identifier): string {
    return field.name;
  }

  public isFieldUnique(field: Identifier): boolean {
    return !(field.typeAnnotation && field.typeAnnotation.typeAnnotation.type === AST_NODE_TYPES.TSArrayType);
  }

  public isFieldRequired(field: Identifier): boolean {
    return !field.optional;
  }

  public getRangeFromTypeNode(typeNode: TypeNode, field: Identifier, clazz: ClassReference, nestedArrays = 0):
  ParameterRange {
    // Don't allow arrays to be nested
    if (nestedArrays > 1) {
      throw new Error(`Detected illegal nested array type for field ${this.getFieldName(field)
      } in ${clazz.localName} at ${clazz.fileName}`);
    }

    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (typeNode.type) {
      case AST_NODE_TYPES.TSTypeReference:
        if (typeNode.typeName.type === AST_NODE_TYPES.Identifier) {
          // TS raw types can also start with an uppercase
          switch (typeNode.typeName.name) {
            case 'Boolean':
              return { type: 'raw', value: 'boolean' };
            case 'Number':
              return { type: 'raw', value: 'number' };
            case 'String':
              return { type: 'raw', value: 'string' };
            case 'Array':
              if (typeNode.typeParameters && typeNode.typeParameters.params.length === 1) {
                return this.getRangeFromTypeNode(typeNode.typeParameters.params[0], field, clazz, nestedArrays + 1);
              }
              throw new Error(`Found invalid Array field type at ${this.getFieldName(field)
              } in ${clazz.localName} at ${clazz.fileName}`);
            default:
              return { type: 'interface', value: typeNode.typeName.name };
          }
        }
        break;
      case AST_NODE_TYPES.TSArrayType:
        return this.getRangeFromTypeNode(typeNode.elementType, field, clazz, nestedArrays + 1);
      case AST_NODE_TYPES.TSBooleanKeyword:
        return { type: 'raw', value: 'boolean' };
      case AST_NODE_TYPES.TSNumberKeyword:
        return { type: 'raw', value: 'number' };
      case AST_NODE_TYPES.TSStringKeyword:
        return { type: 'raw', value: 'string' };
      case AST_NODE_TYPES.TSTypeLiteral:
        return { type: 'hash', value: typeNode };
    }
    throw new Error(`Could not understand parameter type of field ${this.getFieldName(field)
    } in ${clazz.localName} at ${clazz.fileName}`);
  }

  public getFieldRange(field: Identifier, commentData: CommentData): ParameterRange {
    // Check comment data
    if (commentData.range) {
      return commentData.range;
    }

    // Check the typescript raw field type
    if (field.typeAnnotation) {
      return this.getRangeFromTypeNode(field.typeAnnotation.typeAnnotation, field, this.classLoaded);
    }

    // Check the typescript class/interface field type
    // TODO: handle class references

    return <any> {};
  }

  public getFieldDefault(commentData: CommentData): string | undefined {
    return commentData.default;
  }

  public getFieldComment(commentData: CommentData): string | undefined {
    return commentData.description;
  }
}

export interface ParameterLoaderArgs {
  classLoaded: ClassLoaded;
}

export interface ParameterData {
  /**
   * The parameter name.
   */
  name: string;
  /**
   * If only one value for the given parameter can exist.
   * This is always false for an array.
   */
  unique: boolean;
  /**
   * If the parameter MUST have a value.
   */
  required: boolean;
  /**
   * The range of the parameter values.
   */
  range: ParameterRange;
  /**
   * The default value.
   */
  default?: string;
  /**
   * The human-readable description of this parameter.
   */
  comment?: string;
}

export type ParameterRange = {
  type: 'raw';
  value: 'boolean' | 'number' | 'string';
} | {
  type: 'override';
  value: string;
} | {
  type: 'interface';
  value: string;
} | {
  type: 'hash';
  value: TSTypeLiteral;
};
