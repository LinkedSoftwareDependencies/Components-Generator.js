import { MethodDefinition, TypeElement,
  Identifier, TSTypeLiteral, TSPropertySignature, TypeNode } from '@typescript-eslint/types/dist/ts-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { ClassReference, ClassReferenceLoaded, InterfaceLoaded } from './ClassIndex';
import { CommentData, CommentLoader } from './CommentLoader';
import { ConstructorData } from './ConstructorLoader';

/**
 * Interprets class parameters of a given class.
 */
export class ParameterLoader {
  private readonly classLoaded: ClassReferenceLoaded;
  private readonly commentLoader: CommentLoader;

  public constructor(args: ParameterLoaderArgs) {
    this.classLoaded = args.classLoaded;
    this.commentLoader = new CommentLoader({ classLoaded: this.classLoaded });
  }

  /**
   * Load all parameter data from all fields in the given constructor.
   * @param constructor A constructor
   */
  public loadConstructorFields(constructor: MethodDefinition): ConstructorData<ParameterRangeUnresolved> {
    // Load the constructor comment
    const constructorCommentData = this.commentLoader.getCommentDataFromConstructor(constructor);

    // Load all constructor parameters
    const parameters: ParameterData<ParameterRangeUnresolved>[] = [];
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
   * Load all parameter data from all fields in the given interface.
   * If methods are found in the interface, an error is thrown.
   * @param iface An interface
   */
  public loadInterfaceFields(iface: InterfaceLoaded): ParameterData<ParameterRangeUnresolved>[] {
    return <ParameterData<ParameterRangeUnresolved>[]> iface.declaration.body.body
      .map(field => this.loadTypeElementField(field))
      .filter(Boolean);
  }

  /**
   * Load all parameter data from all fields in the given hash.
   * @param hash An hash element.
   */
  public loadHashFields(hash: TSTypeLiteral): ParameterData<ParameterRangeUnresolved>[] {
    return <ParameterData<ParameterRangeUnresolved>[]> hash.members
      .map(field => this.loadTypeElementField(field))
      .filter(Boolean);
  }

  /**
   * Load the parameter data from the given type element.
   * @param typeElement A type element, such as an interface or hash field.
   */
  public loadTypeElementField(typeElement: TypeElement): ParameterData<ParameterRangeUnresolved> | undefined {
    let commentData;
    switch (typeElement.type) {
      case AST_NODE_TYPES.TSPropertySignature:
        commentData = this.commentLoader.getCommentDataFromField(typeElement);
        if (!commentData.ignored) {
          return this.loadField(typeElement, commentData);
        }
        return undefined;
      default:
        throw new Error(`Unsupported field type ${typeElement.type} in ${this.classLoaded.localName} in ${this.classLoaded.fileName}`);
    }
  }

  /**
   * Load the parameter data from the given field.
   * @param field A field.
   * @param commentData Comment data about the given field.
   */
  public loadField(field: Identifier | TSPropertySignature, commentData: CommentData):
  ParameterData<ParameterRangeUnresolved> {
    // Required data
    const parameterData: ParameterData<ParameterRangeUnresolved> = {
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

  public getFieldName(field: Identifier | TSPropertySignature): string {
    if ('name' in field) {
      // If Identifier
      return field.name;
    }
    // Else TSPropertySignature
    if (field.key.type === AST_NODE_TYPES.Identifier) {
      return field.key.name;
    }
    throw new Error(`Unsupported field key type ${field.key.type} in interface ${this.classLoaded.localName} in ${this.classLoaded.fileName}`);
  }

  public isFieldUnique(field: Identifier | TSPropertySignature): boolean {
    return !(field.typeAnnotation && field.typeAnnotation.typeAnnotation.type === AST_NODE_TYPES.TSArrayType);
  }

  public isFieldRequired(field: Identifier | TSPropertySignature): boolean {
    return !field.optional;
  }

  public getRangeFromTypeNode(typeNode: TypeNode, field: Identifier | TSPropertySignature, nestedArrays = 0):
  ParameterRangeUnresolved {
    // Don't allow arrays to be nested
    if (nestedArrays > 1) {
      throw new Error(`Detected illegal nested array type for field ${this.getFieldName(field)
      } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
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
                return this.getRangeFromTypeNode(typeNode.typeParameters.params[0], field, nestedArrays + 1);
              }
              throw new Error(`Found invalid Array field type at ${this.getFieldName(field)
              } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
            default:
              return { type: 'interface', value: typeNode.typeName.name };
          }
        }
        break;
      case AST_NODE_TYPES.TSArrayType:
        return this.getRangeFromTypeNode(typeNode.elementType, field, nestedArrays + 1);
      case AST_NODE_TYPES.TSBooleanKeyword:
        return { type: 'raw', value: 'boolean' };
      case AST_NODE_TYPES.TSNumberKeyword:
        return { type: 'raw', value: 'number' };
      case AST_NODE_TYPES.TSStringKeyword:
        return { type: 'raw', value: 'string' };
      case AST_NODE_TYPES.TSTypeLiteral:
        return { type: 'hash', value: typeNode };
    }
    throw new Error(`Could not understand parameter type ${typeNode.type} of field ${this.getFieldName(field)
    } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
  }

  public getFieldRange(field: Identifier | TSPropertySignature, commentData: CommentData): ParameterRangeUnresolved {
    // Check comment data
    if (commentData.range) {
      return commentData.range;
    }

    // Check the typescript raw field type
    if (field.typeAnnotation) {
      return this.getRangeFromTypeNode(field.typeAnnotation.typeAnnotation, field);
    }

    throw new Error(`Missing field type on ${this.getFieldName(field)
    } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
  }

  public getFieldDefault(commentData: CommentData): string | undefined {
    return commentData.default;
  }

  public getFieldComment(commentData: CommentData): string | undefined {
    return commentData.description;
  }
}

export interface ParameterLoaderArgs {
  classLoaded: ClassReferenceLoaded;
}

export interface ParameterData<R> {
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
  range: R;
  /**
   * The default value.
   */
  default?: string;
  /**
   * The human-readable description of this parameter.
   */
  comment?: string;
}

export type ParameterRangeUnresolved = {
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

export type ParameterRangeResolved = {
  type: 'raw';
  value: 'boolean' | 'number' | 'string';
} | {
  type: 'override';
  value: string;
} | {
  type: 'class';
  value: ClassReference;
} | {
  type: 'nested';
  value: ParameterData<ParameterRangeResolved>[];
};
