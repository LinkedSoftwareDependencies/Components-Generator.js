import type {
  Identifier,
  MethodDefinition,
  TSPropertySignature,
  TSTypeLiteral,
  TypeElement,
  TypeNode,
  TSIndexSignature,
  TSTypeReference,
  Parameter,
} from '@typescript-eslint/types/dist/ts-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ClassReferenceLoaded, InterfaceLoaded } from './ClassIndex';
import type { CommentData, ConstructorCommentData } from './CommentLoader';
import { CommentLoader } from './CommentLoader';
import type { ConstructorData } from './ConstructorLoader';
import type { TypeReferenceOverride } from './typereferenceoverride/TypeReferenceOverride';
import { TypeReferenceOverrideAliasRecord } from './typereferenceoverride/TypeReferenceOverrideAliasRecord';

/**
 * Interprets class parameters of a given class.
 */
export class ParameterLoader {
  private static readonly typeReferenceOverrides: TypeReferenceOverride[] = [
    new TypeReferenceOverrideAliasRecord(),
  ];

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
    const parameters: ParameterDataField<ParameterRangeUnresolved>[] = [];
    for (const field of constructor.value.params) {
      this.loadConstructorField(parameters, constructorCommentData, field);
    }
    return { parameters };
  }

  /**
   * Load the parameter data from the given field in a constructor.
   * @param parameters The array of parameters that will be appended to.
   * @param constructorCommentData Comment data from the constructor.
   * @param field The field to load.
   */
  public loadConstructorField(
    parameters: ParameterDataField<ParameterRangeUnresolved>[],
    constructorCommentData: ConstructorCommentData,
    field: Parameter,
  ): void {
    if (field.type === AST_NODE_TYPES.Identifier) {
      const commentData = constructorCommentData[field.name] || {};
      if (!commentData.ignored) {
        parameters.push(this.loadField(field, commentData));
      }
    } else if (field.type === AST_NODE_TYPES.TSParameterProperty) {
      this.loadConstructorField(parameters, constructorCommentData, field.parameter);
    } else {
      throw new Error(`Could not understand constructor parameter type ${field.type} in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
    }
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
        return;
      case AST_NODE_TYPES.TSIndexSignature:
        commentData = this.commentLoader.getCommentDataFromField(typeElement);
        if (!commentData.ignored) {
          return this.loadIndex(typeElement, commentData);
        }
        return;
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
  ParameterDataField<ParameterRangeUnresolved> {
    // Required data
    const parameterData: ParameterDataField<ParameterRangeUnresolved> = {
      type: 'field',
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

  public isFieldIndexedHash(field: Identifier | TSPropertySignature): boolean {
    return Boolean(field.typeAnnotation &&
      field.typeAnnotation.typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral &&
      field.typeAnnotation.typeAnnotation.members.some(member => member.type === AST_NODE_TYPES.TSIndexSignature));
  }

  public isFieldUnique(field: Identifier | TSPropertySignature): boolean {
    return !(field.typeAnnotation && field.typeAnnotation.typeAnnotation.type === AST_NODE_TYPES.TSArrayType) &&
      !this.isFieldIndexedHash(field);
  }

  public isFieldRequired(field: Identifier | TSPropertySignature): boolean {
    return !field.optional && !this.isFieldIndexedHash(field);
  }

  public getErrorIdentifierField(field: Identifier | TSPropertySignature): string {
    return `field ${this.getFieldName(field)}`;
  }

  public getErrorIdentifierIndex(): string {
    return `an index signature`;
  }

  public getRangeFromTypeNode(
    typeNode: TypeNode,
    errorIdentifier: string,
    nestedArrays = 0,
  ): ParameterRangeUnresolved {
    // Don't allow arrays to be nested
    if (nestedArrays > 1) {
      throw new Error(`Detected illegal nested array type for ${errorIdentifier
      } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
    }

    let typeAliasOverride: ParameterRangeUnresolved | undefined;
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
                return this.getRangeFromTypeNode(typeNode.typeParameters.params[0], errorIdentifier, nestedArrays + 1);
              }
              throw new Error(`Found invalid Array field type at ${errorIdentifier
              } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
            default:
              // First check if the type is be a generic type
              if (typeNode.typeName.name in this.classLoaded.generics) {
                const genericProperties = this.classLoaded.generics[typeNode.typeName.name];
                if (!genericProperties.type) {
                  throw new Error(`Found untyped generic field type at ${errorIdentifier
                  } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
                }
                return this.getRangeFromTypeNode(genericProperties.type, errorIdentifier);
              }

              // Check if this node is a predefined type alias
              typeAliasOverride = this.handleTypeOverride(typeNode);
              if (typeAliasOverride) {
                return typeAliasOverride;
              }

              // Otherwise, assume we have an interface/class parameter
              return { type: 'interface', value: typeNode.typeName.name };
          }
        }
        break;
      case AST_NODE_TYPES.TSArrayType:
        return this.getRangeFromTypeNode(typeNode.elementType, errorIdentifier, nestedArrays + 1);
      case AST_NODE_TYPES.TSBooleanKeyword:
        return { type: 'raw', value: 'boolean' };
      case AST_NODE_TYPES.TSNumberKeyword:
        return { type: 'raw', value: 'number' };
      case AST_NODE_TYPES.TSStringKeyword:
        return { type: 'raw', value: 'string' };
      case AST_NODE_TYPES.TSTypeLiteral:
        return { type: 'hash', value: typeNode };
      case AST_NODE_TYPES.TSUnknownKeyword:
      case AST_NODE_TYPES.TSUndefinedKeyword:
      case AST_NODE_TYPES.TSVoidKeyword:
      case AST_NODE_TYPES.TSNullKeyword:
      case AST_NODE_TYPES.TSAnyKeyword:
      case AST_NODE_TYPES.TSUnionType:
      case AST_NODE_TYPES.TSTupleType:
        return { type: 'undefined' };
    }
    throw new Error(`Could not understand parameter type ${typeNode.type} of ${errorIdentifier
    } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
  }

  public getFieldRange(field: Identifier | TSPropertySignature, commentData: CommentData): ParameterRangeUnresolved {
    // Check comment data
    if (commentData.range) {
      return commentData.range;
    }

    // Check the typescript raw field type
    if (field.typeAnnotation) {
      return this.getRangeFromTypeNode(field.typeAnnotation.typeAnnotation, this.getErrorIdentifierField(field));
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

  /**
   * Load the parameter data from the given index signature.
   * @param indexSignature An index signature.
   * @param commentData Comment data about the given field.
   */
  public loadIndex(indexSignature: TSIndexSignature, commentData: CommentData):
  ParameterDataIndex<ParameterRangeUnresolved> {
    // Required data
    const parameterData: ParameterDataIndex<ParameterRangeUnresolved> = {
      type: 'index',
      domain: this.getIndexDomain(indexSignature),
      range: this.getIndexRange(indexSignature, commentData),
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

  public getIndexDomain(indexSignature: TSIndexSignature): 'string' | 'number' | 'boolean' {
    if (indexSignature.parameters.length !== 1) {
      throw new Error(`Expected exactly one key in index signature in ${
        this.classLoaded.localName} at ${this.classLoaded.fileName}`);
    }
    if (indexSignature.parameters[0].type !== 'Identifier') {
      throw new Error(`Only identifier-based index signatures are allowed in ${
        this.classLoaded.localName} at ${this.classLoaded.fileName}`);
    }
    if (!indexSignature.parameters[0].typeAnnotation) {
      throw new Error(`Missing key type annotation in index signature in ${
        this.classLoaded.localName} at ${this.classLoaded.fileName}`);
    }
    const type = this.getRangeFromTypeNode(indexSignature.parameters[0].typeAnnotation.typeAnnotation,
      this.getErrorIdentifierIndex());
    if (type.type !== 'raw') {
      throw new Error(`Only raw types are allowed in index signature keys in ${
        this.classLoaded.localName} at ${this.classLoaded.fileName}`);
    }
    return type.value;
  }

  public getIndexRange(indexSignature: TSIndexSignature, commentData: CommentData): ParameterRangeUnresolved {
    // Check comment data
    if (commentData.range) {
      return commentData.range;
    }

    // Check the typescript raw field type
    if (indexSignature.typeAnnotation) {
      return this.getRangeFromTypeNode(indexSignature.typeAnnotation.typeAnnotation, this.getErrorIdentifierIndex());
    }

    throw new Error(`Missing field type on ${this.getErrorIdentifierIndex()
    } in ${this.classLoaded.localName} at ${this.classLoaded.fileName}`);
  }

  /**
   * Iterate over all type reference override handler to see if one of them overrides the given type.
   * @param typeNode A type reference node.
   */
  public handleTypeOverride(typeNode: TSTypeReference): ParameterRangeUnresolved | undefined {
    for (const typeReferenceOverride of ParameterLoader.typeReferenceOverrides) {
      const handled = typeReferenceOverride.handle(typeNode);
      if (handled) {
        return handled;
      }
    }
  }
}

export interface ParameterLoaderArgs {
  classLoaded: ClassReferenceLoaded;
}

export type ParameterData<R> = ParameterDataField<R> | ParameterDataIndex<R>;

export interface ParameterDataField<R> {
  /**
   * The data type.
   */
  type: 'field';
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

export interface ParameterDataIndex<R> {
  /**
   * The data type.
   */
  type: 'index';
  /**
   * The domain of the parameter keys.
   */
  domain: 'string' | 'number' | 'boolean';
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
} | {
  type: 'undefined';
};

export type ParameterRangeResolved = {
  type: 'raw';
  value: 'boolean' | 'number' | 'string';
} | {
  type: 'override';
  value: string;
} | {
  type: 'class';
  value: ClassReferenceLoaded;
} | {
  type: 'nested';
  value: ParameterData<ParameterRangeResolved>[];
} | {
  type: 'undefined';
};
