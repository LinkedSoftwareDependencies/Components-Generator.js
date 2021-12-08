import type { Identifier,
  TSPropertySignature,
  TSTypeLiteral,
  TypeElement,
  TypeNode,
  TSIndexSignature,
  TSTypeReference,
  Parameter,
  EntityName, TSTypeParameterInstantiation } from '@typescript-eslint/types/dist/ts-estree';

import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ClassReferenceLoaded, InterfaceLoaded, ClassReference } from './ClassIndex';
import type { CommentData, ConstructorCommentData, CommentLoader } from './CommentLoader';
import type { ConstructorData, ConstructorHolder } from './ConstructorLoader';
import type { TypeReferenceOverride } from './typereferenceoverride/TypeReferenceOverride';
import { TypeReferenceOverrideAliasRecord } from './typereferenceoverride/TypeReferenceOverrideAliasRecord';

/**
 * Interprets class parameters of a given class.
 */
export class ParameterLoader {
  private static readonly typeReferenceOverrides: TypeReferenceOverride[] = [
    new TypeReferenceOverrideAliasRecord(),
  ];

  private readonly commentLoader: CommentLoader;

  public constructor(args: ParameterLoaderArgs) {
    this.commentLoader = args.commentLoader;
  }

  /**
   * Load all parameter data from all fields in the given constructor inheritance chain.
   * @param constructorChain An array of constructors within the class inheritance chain.
   */
  public loadConstructorFields(
    constructorChain: ConstructorHolder[],
  ): ConstructorData<ParameterRangeUnresolved> {
    // Load the constructor comment
    const constructorCommentData = this.commentLoader.getCommentDataFromConstructor(constructorChain);

    // Load all generic type parameters
    const genericTypeParameters: GenericTypeParameterData<ParameterRangeUnresolved>[] = [];
    for (const [ genericName, genericType ] of Object.entries(constructorChain[0].classLoaded.generics)) {
      this.loadConstructorGeneric(
        constructorChain[0].classLoaded,
        genericTypeParameters,
        constructorCommentData,
        genericName,
        genericType.type,
      );
    }

    // Load all constructor parameters
    const parameters: ParameterDataField<ParameterRangeUnresolved>[] = [];
    for (const field of constructorChain[0].constructor.value.params) {
      this.loadConstructorField(constructorChain[0].classLoaded, parameters, constructorCommentData, field);
    }

    return { genericTypeParameters, parameters, classLoaded: constructorChain[0].classLoaded };
  }

  /**
   * Load the generic type parameter data from the given generic in a constructor.
   * @param classLoaded The loaded class in which the field is defined.
   * @param genericTypeParameters The array of generic type parameters that will be appended to.
   * @param constructorCommentData Comment data from the constructor.
   * @param genericName The generic type name.
   * @param genericType The optional generic type range.
   */
  public loadConstructorGeneric(
    classLoaded: ClassReferenceLoaded,
    genericTypeParameters: GenericTypeParameterData<ParameterRangeUnresolved>[],
    constructorCommentData: ConstructorCommentData,
    genericName: string,
    genericType: TypeNode | undefined,
  ): void {
    genericTypeParameters.push({
      name: genericName,
      ...genericType ?
        { range: this.getRangeFromTypeNode(
          classLoaded,
          genericType,
          this.getErrorIdentifierGeneric(classLoaded, genericName),
        ) } :
        {},
    });
  }

  /**
   * Load the parameter data from the given field in a constructor.
   * @param classLoaded The loaded class in which the field is defined.
   * @param parameters The array of parameters that will be appended to.
   * @param constructorCommentData Comment data from the constructor.
   * @param field The field to load.
   */
  public loadConstructorField(
    classLoaded: ClassReferenceLoaded,
    parameters: ParameterDataField<ParameterRangeUnresolved>[],
    constructorCommentData: ConstructorCommentData,
    field: Parameter,
  ): void {
    if (field.type === AST_NODE_TYPES.Identifier) {
      const commentData = constructorCommentData[field.name] || {};
      if (!commentData.ignored) {
        parameters.push(this.loadField(classLoaded, field, commentData));
      }
    } else if (field.type === AST_NODE_TYPES.TSParameterProperty) {
      this.loadConstructorField(classLoaded, parameters, constructorCommentData, field.parameter);
    } else {
      throw new Error(`Could not understand constructor parameter type ${field.type} in ${classLoaded.localName} at ${classLoaded.fileName}`);
    }
  }

  /**
   * Load all parameter data from all fields in the given interface.
   * If methods are found in the interface, an error is thrown.
   * @param iface An interface
   */
  public loadInterfaceFields(iface: InterfaceLoaded): ParameterData<ParameterRangeUnresolved>[] {
    let fields: ParameterData<ParameterRangeUnresolved>[] = <ParameterData<ParameterRangeUnresolved>[]> iface
      .declaration.body.body
      .map(field => this.loadTypeElementField(iface, field))
      .filter(Boolean);
    if (iface.superInterfaces && iface.superInterfaces.length > 0) {
      fields = fields.concat(...iface.superInterfaces.map(superIface => this.loadInterfaceFields(superIface)));
    }
    return fields;
  }

  /**
   * Load all parameter data from all fields in the given hash.
   * @param classLoaded The loaded class in which the field is defined.
   * @param hash An hash element.
   */
  public loadHashFields(
    classLoaded: ClassReferenceLoaded,
    hash: TSTypeLiteral,
  ): ParameterData<ParameterRangeUnresolved>[] {
    return <ParameterData<ParameterRangeUnresolved>[]> hash.members
      .map(field => this.loadTypeElementField(classLoaded, field))
      .filter(Boolean);
  }

  /**
   * Load the parameter data from the given type element.
   * @param classLoaded The loaded class in which the field is defined.
   * @param typeElement A type element, such as an interface or hash field.
   */
  public loadTypeElementField(
    classLoaded: ClassReferenceLoaded,
    typeElement: TypeElement,
  ): ParameterData<ParameterRangeUnresolved> | undefined {
    let commentData;
    switch (typeElement.type) {
      case AST_NODE_TYPES.TSPropertySignature:
        commentData = this.commentLoader.getCommentDataFromField(classLoaded, typeElement);
        if (!commentData.ignored) {
          return this.loadField(classLoaded, typeElement, commentData);
        }
        return;
      case AST_NODE_TYPES.TSIndexSignature:
        commentData = this.commentLoader.getCommentDataFromField(classLoaded, typeElement);
        if (!commentData.ignored) {
          return this.loadIndex(classLoaded, typeElement, commentData);
        }
        return;
      default:
        throw new Error(`Unsupported field type ${typeElement.type} in ${classLoaded.localName} in ${classLoaded.fileName}`);
    }
  }

  /**
   * Load the parameter data from the given field.
   * @param classLoaded The loaded class in which the field is defined.
   * @param field A field.
   * @param commentData Comment data about the given field.
   */
  public loadField(
    classLoaded: ClassReferenceLoaded,
    field: Identifier | TSPropertySignature,
    commentData: CommentData,
  ): ParameterDataField<ParameterRangeUnresolved> {
    // Required data
    const parameterData: ParameterDataField<ParameterRangeUnresolved> = {
      type: 'field',
      name: this.getFieldName(classLoaded, field),
      range: this.getFieldRange(classLoaded, field, commentData),
      defaults: commentData.defaults,
      defaultNested: commentData.defaultNested,
    };

    const comment = this.getFieldComment(commentData);
    if (comment) {
      parameterData.comment = comment;
    }

    return parameterData;
  }

  public getFieldName(classLoaded: ClassReferenceLoaded, field: Identifier | TSPropertySignature): string {
    if ('name' in field) {
      // If Identifier
      return field.name;
    }
    // Else TSPropertySignature
    if (field.key.type === AST_NODE_TYPES.Identifier) {
      return field.key.name;
    }
    throw new Error(`Unsupported field key type ${field.key.type} in interface ${classLoaded.localName} in ${classLoaded.fileName}`);
  }

  public getErrorIdentifierGeneric(classLoaded: ClassReferenceLoaded, genericName: string): string {
    return `generic type ${genericName}`;
  }

  public getErrorIdentifierField(classLoaded: ClassReferenceLoaded, field: Identifier | TSPropertySignature): string {
    return `field ${this.getFieldName(classLoaded, field)}`;
  }

  public getErrorIdentifierIndex(): string {
    return `an index signature`;
  }

  public getRangeFromTypeNode(
    classLoaded: ClassReferenceLoaded,
    typeNode: TypeNode,
    errorIdentifier: string,
  ): ParameterRangeUnresolved {
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
                return {
                  type: 'array',
                  value: this.getRangeFromTypeNode(classLoaded, typeNode.typeParameters.params[0], errorIdentifier),
                };
              }
              throw new Error(`Found invalid Array field type at ${errorIdentifier
              } in ${classLoaded.localName} at ${classLoaded.fileName}`);
            default:
              // First check if the type is a direct generic type
              if (classLoaded.type !== 'type' &&
                classLoaded.type !== 'enum' &&
                typeNode.typeName.name in classLoaded.generics) {
                return {
                  type: 'genericTypeReference',
                  value: typeNode.typeName.name,
                };
              }

              // Check if this node is a predefined type alias
              typeAliasOverride = this.handleTypeOverride(typeNode);
              if (typeAliasOverride) {
                return typeAliasOverride;
              }

              // Otherwise, assume we have an interface/class parameter
              return {
                type: 'interface',
                value: typeNode.typeName.name,
                genericTypeParameterInstantiations: typeNode.typeParameters ?
                  this.getGenericTypeParameterInstantiations(typeNode.typeParameters, classLoaded) :
                  undefined,
                origin: classLoaded,
              };
          }
        } else {
          // Otherwise we have a qualified name: AST_NODE_TYPES.TSQualifiedName
          return {
            type: 'interface',
            value: typeNode.typeName.right.name,
            qualifiedPath: this.getQualifiedPath(typeNode.typeName.left),
            genericTypeParameterInstantiations: typeNode.typeParameters ?
              this.getGenericTypeParameterInstantiations(typeNode.typeParameters, classLoaded) :
              undefined,
            origin: classLoaded,
          };
        }
      case AST_NODE_TYPES.TSBooleanKeyword:
        return { type: 'raw', value: 'boolean' };
      case AST_NODE_TYPES.TSNumberKeyword:
        return { type: 'raw', value: 'number' };
      case AST_NODE_TYPES.TSStringKeyword:
        return { type: 'raw', value: 'string' };
      case AST_NODE_TYPES.TSLiteralType:
        if (typeNode.literal.type !== AST_NODE_TYPES.UnaryExpression &&
          typeNode.literal.type !== AST_NODE_TYPES.UpdateExpression &&
          'value' in typeNode.literal &&
          (typeof typeNode.literal.value === 'number' ||
            typeof typeNode.literal.value === 'string' ||
            typeof typeNode.literal.value === 'boolean')) {
          return { type: 'literal', value: typeNode.literal.value };
        }
        break;
      case AST_NODE_TYPES.TSTypeLiteral:
        return { type: 'hash', value: typeNode };
      case AST_NODE_TYPES.TSUnionType:
      case AST_NODE_TYPES.TSIntersectionType:
        return {
          type: typeNode.type === AST_NODE_TYPES.TSUnionType ? 'union' : 'intersection',
          elements: typeNode.types
            .map(type => this.getRangeFromTypeNode(classLoaded, type, errorIdentifier)),
        };
      case AST_NODE_TYPES.TSParenthesizedType:
        return this.getRangeFromTypeNode(classLoaded, typeNode.typeAnnotation, errorIdentifier);
      case AST_NODE_TYPES.TSUnknownKeyword:
      case AST_NODE_TYPES.TSUndefinedKeyword:
      case AST_NODE_TYPES.TSVoidKeyword:
      case AST_NODE_TYPES.TSNullKeyword:
      case AST_NODE_TYPES.TSAnyKeyword:
        return { type: 'undefined' };
      case AST_NODE_TYPES.TSTupleType:
        return {
          type: 'tuple',
          elements: typeNode.elementTypes
            .map(type => this.getRangeFromTypeNode(classLoaded, type, errorIdentifier)),
        };
      case AST_NODE_TYPES.TSArrayType:
        return {
          type: 'array',
          value: this.getRangeFromTypeNode(classLoaded, typeNode.elementType, errorIdentifier),
        };
      case AST_NODE_TYPES.TSRestType:
        return {
          type: 'rest',
          value: this.getRangeFromTypeNode(classLoaded, typeNode.typeAnnotation, errorIdentifier),
        };
    }
    throw new Error(`Could not understand parameter type ${typeNode.type} of ${errorIdentifier
    } in ${classLoaded.localName} at ${classLoaded.fileName}`);
  }

  protected getGenericTypeParameterInstantiations(
    typeParameters: TSTypeParameterInstantiation,
    classLoaded: ClassReferenceLoaded,
  ): ParameterRangeUnresolved[] {
    return typeParameters.params
      .map(genericTypeParameter => this.getRangeFromTypeNode(
        classLoaded,
        genericTypeParameter,
        `generic type instantiation on ${classLoaded.localName} in ${classLoaded.fileName}`,
      ));
  }

  protected getQualifiedPath(qualifiedEntity: EntityName): string[] {
    switch (qualifiedEntity.type) {
      case AST_NODE_TYPES.TSQualifiedName:
        return [ ...this.getQualifiedPath(qualifiedEntity.left), qualifiedEntity.right.name ];
      case AST_NODE_TYPES.Identifier:
        return [ qualifiedEntity.name ];
    }
  }

  public getFieldRange(
    classLoaded: ClassReferenceLoaded,
    field: Identifier | TSPropertySignature,
    commentData: CommentData,
  ): ParameterRangeUnresolved {
    let range: ParameterRangeUnresolved | undefined;

    // Check the typescript raw field type
    if (field.typeAnnotation) {
      range = this.getRangeFromTypeNode(
        classLoaded,
        field.typeAnnotation.typeAnnotation,
        this.getErrorIdentifierField(classLoaded, field),
      );
    }

    // Throw if no range was found
    if (!range) {
      throw new Error(`Missing field type on ${this.getFieldName(classLoaded, field)
      } in ${classLoaded.localName} at ${classLoaded.fileName}`);
    }

    // If the field has the '?' annotation, explicitly allow undefined as value to make it be considered optional.
    if (field.optional) {
      if (range.type === 'union') {
        // Don't add undefined element if it is already present
        if (!range.elements.some(element => element.type === 'undefined')) {
          range.elements.push({ type: 'undefined' });
        }
      } else {
        range = {
          type: 'union',
          elements: [
            range,
            { type: 'undefined' },
          ],
        };
      }
    }

    // Check comment data
    if (commentData.range) {
      range = this.overrideRawRange(range, commentData.range);
    }

    return range;
  }

  /**
   * Apply a range override on the given range
   * @param range The range to override in.
   * @param override The range set set.
   */
  public overrideRawRange(
    range: ParameterRangeUnresolved,
    override: ParameterRangeUnresolved,
  ): ParameterRangeUnresolved {
    switch (range.type) {
      case 'raw':
      case 'literal':
      case 'hash':
      case 'interface':
      case 'genericTypeReference':
        // Replace these types
        return override;
      case 'undefined':
      case 'override':
        // Override has no effect here
        return range;
      case 'union':
      case 'intersection':
      case 'tuple':
        // Recursively apply override operation on elements
        return {
          type: range.type,
          elements: range.elements.map(element => this.overrideRawRange(element, override)),
        };
      case 'rest':
      case 'array':
        // Recursively apply override operation on value
        return {
          type: range.type,
          value: this.overrideRawRange(range.value, override),
        };
    }
  }

  public getFieldComment(commentData: CommentData): string | undefined {
    return commentData.description;
  }

  /**
   * Load the parameter data from the given index signature.
   * @param classLoaded The loaded class in which the field is defined.
   * @param indexSignature An index signature.
   * @param commentData Comment data about the given field.
   */
  public loadIndex(classLoaded: ClassReferenceLoaded, indexSignature: TSIndexSignature, commentData: CommentData):
  ParameterDataIndex<ParameterRangeUnresolved> {
    // Required data
    const parameterData: ParameterDataIndex<ParameterRangeUnresolved> = {
      type: 'index',
      domain: this.getIndexDomain(classLoaded, indexSignature),
      range: this.getIndexRange(classLoaded, indexSignature, commentData),
    };

    // Optional data
    parameterData.defaults = commentData.defaults;

    const comment = this.getFieldComment(commentData);
    if (comment) {
      parameterData.comment = comment;
    }

    return parameterData;
  }

  public getIndexDomain(
    classLoaded: ClassReferenceLoaded,
    indexSignature: TSIndexSignature,
  ): 'string' | 'number' | 'boolean' {
    if (indexSignature.parameters.length !== 1) {
      throw new Error(`Expected exactly one key in index signature in ${
        classLoaded.localName} at ${classLoaded.fileName}`);
    }
    if (indexSignature.parameters[0].type !== 'Identifier') {
      throw new Error(`Only identifier-based index signatures are allowed in ${
        classLoaded.localName} at ${classLoaded.fileName}`);
    }
    if (!indexSignature.parameters[0].typeAnnotation) {
      throw new Error(`Missing key type annotation in index signature in ${
        classLoaded.localName} at ${classLoaded.fileName}`);
    }
    const type = this.getRangeFromTypeNode(
      classLoaded,
      indexSignature.parameters[0].typeAnnotation.typeAnnotation,
      this.getErrorIdentifierIndex(),
    );
    if (type.type !== 'raw') {
      throw new Error(`Only raw types are allowed in index signature keys in ${
        classLoaded.localName} at ${classLoaded.fileName}`);
    }
    return type.value;
  }

  public getIndexRange(
    classLoaded: ClassReferenceLoaded,
    indexSignature: TSIndexSignature,
    commentData: CommentData,
  ): ParameterRangeUnresolved {
    // Check comment data
    if (commentData.range) {
      return commentData.range;
    }

    // Check the typescript raw field type
    if (indexSignature.typeAnnotation) {
      return this.getRangeFromTypeNode(
        classLoaded,
        indexSignature.typeAnnotation.typeAnnotation,
        this.getErrorIdentifierIndex(),
      );
    }

    throw new Error(`Missing field type on ${this.getErrorIdentifierIndex()
    } in ${classLoaded.localName} at ${classLoaded.fileName}`);
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
  commentLoader: CommentLoader;
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
   * The range of the parameter values.
   */
  range: R;
  /**
   * The default values.
   */
  defaults?: DefaultValue[];
  /**
   * The human-readable description of this parameter.
   */
  comment?: string;
  /**
   * The nested default values on parameters.
   */
  defaultNested?: DefaultNested[];
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
   * The default values.
   */
  defaults?: DefaultValue[];
  /**
   * The human-readable description of this parameter.
   */
  comment?: string;
}

export interface GenericTypeParameterData<R> {
  /**
   * The generic type parameter name.
   */
  name: string;
  /**
   * The range of the generic type parameter.
   */
  range?: R;
  /**
   * The human-readable description of this parameter.
   */
  comment?: string;
}

export type ParameterRangeUnresolved = {
  type: 'raw';
  value: 'boolean' | 'number' | 'string';
} | {
  type: 'literal';
  value: boolean | number | string;
} | {
  type: 'override';
  value: string;
} | {
  type: 'interface';
  value: string;
  /**
   * For qualified names, this array contains the path segments.
   */
  qualifiedPath?: string[];
  genericTypeParameterInstantiations: ParameterRangeUnresolved[] | undefined;
  /**
   * The place from which the interface was referenced.
   */
  origin: ClassReferenceLoaded;
} | {
  type: 'hash';
  value: TSTypeLiteral;
} | {
  type: 'undefined';
} | {
  type: 'union';
  elements: ParameterRangeUnresolved[];
} | {
  type: 'intersection';
  elements: ParameterRangeUnresolved[];
} | {
  type: 'tuple';
  elements: ParameterRangeUnresolved[];
} | {
  type: 'rest';
  value: ParameterRangeUnresolved;
} | {
  type: 'array';
  value: ParameterRangeUnresolved;
} | {
  type: 'genericTypeReference';
  value: string;
};

export type ParameterRangeResolved = {
  type: 'raw';
  value: 'boolean' | 'number' | 'string';
} | {
  type: 'literal';
  value: boolean | number | string;
} | {
  type: 'override';
  value: string;
} | {
  type: 'class';
  value: ClassReferenceLoaded;
  genericTypeParameterInstances: ParameterRangeResolved[] | undefined;
} | {
  type: 'nested';
  value: ParameterData<ParameterRangeResolved>[];
} | {
  type: 'undefined';
} | {
  type: 'union';
  elements: ParameterRangeResolved[];
} | {
  type: 'intersection';
  elements: ParameterRangeResolved[];
} | {
  type: 'tuple';
  elements: ParameterRangeResolved[];
} | {
  type: 'rest';
  value: ParameterRangeResolved;
} | {
  type: 'array';
  value: ParameterRangeResolved;
} | {
  type: 'genericTypeReference';
  value: string;
  /**
   * The place in which the generic type was defined.
   */
  origin: ClassReferenceLoaded;
};

/**
 * Represents a default value that is to be set on a nested parameter,
 * indicated by a path of parameter keys.
 */
export interface DefaultNested {
  /**
   * The path of parameter keys in which the default value applies.
   */
  paramPath: string[];
  /**
   * A default value for the path.
   */
  value: DefaultValue;
}

/**
 * A default value
 */
export type DefaultValue = {
  type: 'raw';
  value: string;
} | {
  type: 'iri';
  value?: string;
  typeIri?: string;
  /**
   * The component reference for relative IRIs.
   */
  baseComponent: ClassReference;
};
