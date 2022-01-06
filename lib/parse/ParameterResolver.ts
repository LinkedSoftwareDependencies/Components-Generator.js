import type { TSTypeLiteral } from '@typescript-eslint/types/dist/ts-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import * as LRUCache from 'lru-cache';
import type { ClassIndex, ClassReference, ClassReferenceLoaded, InterfaceLoaded } from './ClassIndex';
import type { ClassLoader } from './ClassLoader';
import type { CommentLoader } from './CommentLoader';
import type { ConstructorData } from './ConstructorLoader';
import type {
  ExtensionData,
  GenericTypeParameterData,
  ParameterData,
  ParameterDataField,
  ParameterRangeResolved,
  ParameterRangeUnresolved,
} from './ParameterLoader';
import { ParameterLoader } from './ParameterLoader';

export class ParameterResolver {
  private readonly classLoader: ClassLoader;
  private readonly commentLoader: CommentLoader;
  private readonly ignoreClasses: Record<string, boolean>;
  private readonly cacheInterfaceRange: LRUCache<string, ParameterRangeResolved>;

  public constructor(args: ParameterResolverArgs) {
    this.classLoader = args.classLoader;
    this.commentLoader = args.commentLoader;
    this.ignoreClasses = args.ignoreClasses;
    this.cacheInterfaceRange = new LRUCache(2_048);
  }

  /**
   * Resolve all constructor parameters of a given constructor index.
   * @param unresolvedParametersIndex An index of unresolved constructor data.
   */
  public async resolveAllConstructorParameters(
    unresolvedParametersIndex: ClassIndex<ConstructorData<ParameterRangeUnresolved>>,
  ): Promise<ClassIndex<ConstructorData<ParameterRangeResolved>>> {
    const resolvedParametersIndex: ClassIndex<ConstructorData<ParameterRangeResolved>> = {};

    // Resolve parameters for the different constructors in parallel
    await Promise.all(Object.entries(unresolvedParametersIndex)
      .map(async([ className, parameters ]) => {
        if (parameters.classLoaded.type === 'class') {
          resolvedParametersIndex[className] = await this.resolveConstructorParameters(parameters);
        }
      }));

    return resolvedParametersIndex;
  }

  /**
   * Resolve all parameters of a given constructor.
   * @param unresolvedConstructorData Unresolved constructor data.
   */
  public async resolveConstructorParameters(
    unresolvedConstructorData: ConstructorData<ParameterRangeUnresolved>,
  ): Promise<ConstructorData<ParameterRangeResolved>> {
    return {
      genericTypeParameters: await this.resolveGenericTypeParameterData(
        unresolvedConstructorData.genericTypeParameters,
        unresolvedConstructorData.classLoaded,
        {},
      ),
      parameters: <ParameterDataField<ParameterRangeResolved>[]> (await this.resolveParameterData(
        unresolvedConstructorData.parameters,
        unresolvedConstructorData.classLoaded,
        {},
      )).filter(parameter => parameter.type === 'field'),
      classLoaded: unresolvedConstructorData.classLoaded,
    };
  }

  /**
   * Resolve the given array of generic type parameter data in parallel.
   * @param genericTypeParameters An array of unresolved generic type parameters.
   * @param owningClass The class in which the given generic type parameters are declared.
   * @param genericTypeRemappings A remapping of generic type names.
   */
  public async resolveGenericTypeParameterData(
    genericTypeParameters: GenericTypeParameterData<ParameterRangeUnresolved>[],
    owningClass: ClassReferenceLoaded,
    genericTypeRemappings: Record<string, ParameterRangeUnresolved>,
  ): Promise<GenericTypeParameterData<ParameterRangeResolved>[]> {
    return await Promise.all(genericTypeParameters
      .map(async generic => ({
        ...generic,
        range: generic.range ?
          await this.resolveRange(generic.range, owningClass, genericTypeRemappings, false) :
          undefined,
      })));
  }

  /**
   * Resolve the given array of parameter data in parallel.
   * @param parameters An array of unresolved parameters.
   * @param owningClass The class in which the given parameters are declared.
   * @param genericTypeRemappings A remapping of generic type names.
   */
  public async resolveParameterData(
    parameters: ParameterData<ParameterRangeUnresolved>[],
    owningClass: ClassReferenceLoaded,
    genericTypeRemappings: Record<string, ParameterRangeUnresolved>,
  ): Promise<ParameterData<ParameterRangeResolved>[]> {
    return await Promise.all(parameters
      .map(async parameter => ({
        ...parameter,
        range: await this.resolveRange(parameter.range, owningClass, genericTypeRemappings, true),
      })));
  }

  /**
   * Resolve all extension data of a given constructor index.
   * @param unresolvedExtensionData An index of unresolved constructor data.
   * @param classIndex The class index containing the owning class references.
   */
  public async resolveAllExtensionData(
    unresolvedExtensionData: ClassIndex<ExtensionData<ParameterRangeUnresolved>[]>,
    classIndex: ClassIndex<ClassReferenceLoaded>,
  ): Promise<ClassIndex<ExtensionData<ParameterRangeResolved>[]>> {
    const resolvedIndex: ClassIndex<ExtensionData<ParameterRangeResolved>[]> = {};

    // Resolve parameters for the different constructors in parallel
    await Promise.all(Object.entries(unresolvedExtensionData)
      .map(async([ className, extensionData ]) => {
        resolvedIndex[className] = await this.resolveExtensionData(extensionData, classIndex[className], {});
      }));

    return resolvedIndex;
  }

  /**
   * Resolve the given array of generic type parameter data in parallel.
   * @param extensionDatas The extensions of the class.
   * @param owningClass The class in which the given generic type parameters are declared.
   * @param genericTypeRemappings A remapping of generic type names.
   */
  public async resolveExtensionData(
    extensionDatas: ExtensionData<ParameterRangeUnresolved>[],
    owningClass: ClassReferenceLoaded,
    genericTypeRemappings: Record<string, ParameterRangeUnresolved>,
  ): Promise<ExtensionData<ParameterRangeResolved>[]> {
    return await Promise.all(extensionDatas.map(async extensionData => ({
      classLoaded: extensionData.classLoaded,
      genericTypeInstantiations: await Promise.all(extensionData.genericTypeInstantiations
        .map(async genericTypeInstantiation => await this.resolveRange(
          genericTypeInstantiation,
          owningClass,
          genericTypeRemappings,
          false,
        ))),
    })));
  }

  protected isIgnored(qualifiedPath: string[] | undefined, className: string): boolean {
    if (qualifiedPath && qualifiedPath.length > 0) {
      className = `${qualifiedPath.join('.')}.${className}`;
    }
    return className in this.ignoreClasses;
  }

  /**
   * Resolve the given parameter range.
   * @param range An unresolved parameter range.
   * @param owningClass The class this range was defined in.
   * @param genericTypeRemappings A remapping of generic type names.
   * @param getNestedFields If Records and interfaces should produce nested field ranges.
   */
  public async resolveRange(
    range: ParameterRangeUnresolved,
    owningClass: ClassReferenceLoaded,
    genericTypeRemappings: Record<string, ParameterRangeUnresolved>,
    getNestedFields: boolean,
  ): Promise<ParameterRangeResolved> {
    switch (range.type) {
      case 'raw':
      case 'literal':
      case 'override':
        return range;
      case 'interface':
        if (this.isIgnored(range.qualifiedPath, range.value)) {
          return {
            type: 'undefined',
          };
        }
        return await this.resolveRangeInterface(
          range.value,
          range.qualifiedPath,
          range.genericTypeParameterInstantiations,
          range.origin,
          owningClass,
          genericTypeRemappings,
          getNestedFields,
        );
      case 'hash':
        return {
          type: 'nested',
          value: await this.getNestedFieldsFromHash(range.value, owningClass, genericTypeRemappings),
        };
      case 'undefined':
        return {
          type: 'undefined',
        };
      case 'union':
      case 'intersection':
      case 'tuple':
        return {
          type: range.type,
          elements: await Promise.all(range.elements
            .map(child => this.resolveRange(child, owningClass, genericTypeRemappings, getNestedFields))),
        };
      case 'array':
      case 'rest':
      case 'keyof':
        return {
          type: range.type,
          // TODO: remove the following any cast when TS bug is fixed
          value: <any> await this.resolveRange(range.value, owningClass, genericTypeRemappings, getNestedFields),
        };
      case 'genericTypeReference':
        // If this generic type was remapped, return that remapped type
        if (range.value in genericTypeRemappings) {
          const mapped = genericTypeRemappings[range.value];
          // Avoid infinite recursion via mapping to itself
          if (mapped.type !== 'genericTypeReference' || mapped.value !== range.value) {
            return this.resolveRange(mapped, owningClass, genericTypeRemappings, getNestedFields);
          }
        }
        return {
          type: 'genericTypeReference',
          value: range.value,
          origin: owningClass,
        };
    }
  }

  /**
   * Resolve a class or interface.
   * @param interfaceName A class or interface name.
   * @param qualifiedPath Qualified path to the class or interface. Is undefined if there is no qualified path.
   * @param genericTypeParameterInstances Generic type parameters that were supplied for instantiation.
   *                                      Note that these generics are NOT the same as the generics that may be defined
   *                                      within the class itself.
   * @param owningClass The class this interface was used in.
   * @param rootOwningClass The top-level class this interface was used in. Necessary for generic type resolution.
   * @param genericTypeRemappings A remapping of generic type names.
   * @param getNestedFields If Records and interfaces should produce nested field ranges.
   */
  public async resolveRangeInterface(
    interfaceName: string,
    qualifiedPath: string[] | undefined,
    genericTypeParameterInstances: ParameterRangeUnresolved[] | undefined,
    owningClass: ClassReferenceLoaded,
    rootOwningClass: ClassReferenceLoaded,
    genericTypeRemappings: Record<string, ParameterRangeUnresolved>,
    getNestedFields: boolean,
  ): Promise<ParameterRangeResolved> {
    const cacheKey = `${interfaceName}::${(qualifiedPath || []).join('.')}::${owningClass.fileName}`;
    let resolved = this.cacheInterfaceRange.get(cacheKey);
    if (!resolved) {
      resolved = await this.resolveRangeInterfaceInner(
        interfaceName,
        qualifiedPath,
        genericTypeParameterInstances,
        owningClass,
        rootOwningClass,
        genericTypeRemappings,
        getNestedFields,
      );
      this.cacheInterfaceRange.set(cacheKey, resolved);
    }
    return resolved;
  }

  protected async resolveRangeInterfaceInner(
    interfaceName: string,
    qualifiedPath: string[] | undefined,
    genericTypeParameterInstances: ParameterRangeUnresolved[] | undefined,
    owningClass: ClassReferenceLoaded,
    rootOwningClass: ClassReferenceLoaded,
    genericTypeRemappings: Record<string, ParameterRangeUnresolved>,
    getNestedFields: boolean,
  ): Promise<ParameterRangeResolved> {
    const classOrInterface = await this.loadClassOrInterfacesChain({
      packageName: owningClass.packageName,
      localName: interfaceName,
      qualifiedPath,
      fileName: owningClass.fileName,
      fileNameReferenced: owningClass.fileNameReferenced,
    });

    // If we find a class, or an interface that is implicitly a class, return the class reference directly
    if (classOrInterface.type === 'class' ||
      (classOrInterface.type === 'interface' &&
        (!getNestedFields || this.isInterfaceImplicitClass(classOrInterface)))) {
      return {
        type: 'class',
        value: classOrInterface,
        genericTypeParameterInstances: genericTypeParameterInstances ?
          await Promise.all(genericTypeParameterInstances
            .map(genericTypeParameter => this
              .resolveRange(genericTypeParameter, rootOwningClass, genericTypeRemappings, getNestedFields))) :
          undefined,
      };
    }

    // If we find a type alias, just interpret the type directly
    if (classOrInterface.type === 'type') {
      const parameterLoader = new ParameterLoader({ commentLoader: this.commentLoader });
      const unresolvedFields = parameterLoader.getRangeFromTypeNode(
        classOrInterface,
        classOrInterface.declaration.typeAnnotation,
        `type alias ${classOrInterface.localName} in ${classOrInterface.fileName}`,
      );
      return this.resolveRange(unresolvedFields, classOrInterface, genericTypeRemappings, getNestedFields);
    }

    // If we find an enum, just interpret the enum value, and return as union type
    if (classOrInterface.type === 'enum') {
      const parameterLoader = new ParameterLoader({ commentLoader: this.commentLoader });
      const enumRangeTypes = await Promise.all(classOrInterface.declaration.members
        .map((enumMember, i) => {
          if (enumMember.initializer && enumMember.initializer.type === AST_NODE_TYPES.Literal) {
            return this.resolveRange(parameterLoader.getRangeFromTypeNode(
              classOrInterface,
              {
                type: AST_NODE_TYPES.TSLiteralType,
                literal: enumMember.initializer,
                loc: <any> undefined,
                range: <any> undefined,
              },
              `enum ${classOrInterface.localName} in ${classOrInterface.fileName}`,
            ), owningClass, genericTypeRemappings, getNestedFields);
          }
          throw new Error(`Detected enum ${classOrInterface.localName} having an unsupported member (member ${i}) in ${classOrInterface.fileName}`);
        }));
      return {
        type: 'union',
        elements: enumRangeTypes,
      };
    }

    // If we find an interface, load it as a hash with nested fields
    if (genericTypeParameterInstances) {
      // If the interfaces has generic type instantiations,
      // map the generic type declarations of the class on the generic types of the interface
      const ifaceGenericTypes = Object.keys(classOrInterface.generics);
      for (const [ i, genericTypeParameterInstance ] of genericTypeParameterInstances.entries()) {
        genericTypeRemappings[ifaceGenericTypes[i]] = genericTypeParameterInstance;
      }
    }
    return {
      type: 'nested',
      value: await this.getNestedFieldsFromInterface(classOrInterface, rootOwningClass, genericTypeRemappings),
    };
  }

  /**
   * Check if the given interface should actually be considered a class.
   * Concretely, it will check whether or not there is at least one method or constructor.
   * @param iface An interface.
   */
  public isInterfaceImplicitClass(iface: InterfaceLoaded): boolean {
    for (const field of iface.declaration.body.body) {
      if (field.type === AST_NODE_TYPES.TSMethodSignature ||
        field.type === AST_NODE_TYPES.TSConstructSignatureDeclaration ||
        (field.type === AST_NODE_TYPES.TSPropertySignature && field.typeAnnotation &&
          field.typeAnnotation.typeAnnotation.type === AST_NODE_TYPES.TSFunctionType)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Load the given class reference, which could either be a class or interface.
   *
   * If it's a class, just load it, without loading its superclasses.
   * If it's an interface, load all of its superinterfaces recursively.
   *
   * This method will throw if an interface extends from a class.
   *
   * @param classReference A class reference.
   */
  public async loadClassOrInterfacesChain(classReference: ClassReference): Promise<ClassReferenceLoaded> {
    const classOrInterface = await this.classLoader.loadClassDeclaration(classReference, true, true);

    // If the result is an interface, load all its super interfaces recursively
    if (classOrInterface.type === 'interface') {
      classOrInterface.superInterfaces = await Promise.all(this.classLoader
        .getSuperInterfaceNames(classOrInterface.declaration, classOrInterface.fileName)
        .filter(interfaceName => !this.isIgnored(classReference.qualifiedPath, interfaceName.value))
        .map(async interfaceName => {
          const superInterface = await this.loadClassOrInterfacesChain({
            packageName: classOrInterface.packageName,
            localName: interfaceName.value,
            qualifiedPath: [],
            fileName: classOrInterface.fileName,
            fileNameReferenced: classOrInterface.fileNameReferenced,
          });
          if (superInterface.type !== 'interface') {
            throw new Error(`Detected interface ${classOrInterface.localName} extending from a non-interface ${interfaceName.value} in ${classReference.fileName}`);
          }
          return { value: superInterface, genericTypeInstantiations: interfaceName.genericTypeInstantiations };
        }));
    }

    // If the result is a type, check if it is an alias for another interface, and load that
    if (classOrInterface.type === 'type') {
      if (classOrInterface.declaration.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
        classOrInterface.declaration.typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier) {
        return await this.loadClassOrInterfacesChain({
          packageName: classOrInterface.packageName,
          localName: classOrInterface.declaration.typeAnnotation.typeName.name,
          qualifiedPath: [],
          fileName: classOrInterface.fileName,
          fileNameReferenced: classOrInterface.fileNameReferenced,
        });
      }
    }

    return classOrInterface;
  }

  /**
   * Recursively get all fields from the given interface.
   * @param iface A loaded interface.
   * @param owningClass The class this hash is declared in.
   * @param genericTypeRemappings A remapping of generic type names.
   */
  public async getNestedFieldsFromInterface(
    iface: InterfaceLoaded,
    owningClass: ClassReferenceLoaded,
    genericTypeRemappings: Record<string, ParameterRangeUnresolved>,
  ): Promise<ParameterData<ParameterRangeResolved>[]> {
    const parameterLoader = new ParameterLoader({ commentLoader: this.commentLoader });
    const unresolvedFields = parameterLoader.loadInterfaceFields(iface);
    return this.resolveParameterData(unresolvedFields, owningClass, genericTypeRemappings);
  }

  /**
   * Recursively get all fields from the given hash.
   * @param hash A hash object.
   * @param owningClass The class this hash is declared in.
   * @param genericTypeRemappings A remapping of generic type names.
   */
  public async getNestedFieldsFromHash(
    hash: TSTypeLiteral,
    owningClass: ClassReferenceLoaded,
    genericTypeRemappings: Record<string, ParameterRangeUnresolved>,
  ): Promise<ParameterData<ParameterRangeResolved>[]> {
    const parameterLoader = new ParameterLoader({ commentLoader: this.commentLoader });
    const unresolvedFields = parameterLoader.loadHashFields(owningClass, hash);
    return this.resolveParameterData(unresolvedFields, owningClass, genericTypeRemappings);
  }
}

export interface ParameterResolverArgs {
  classLoader: ClassLoader;
  commentLoader: CommentLoader;
  ignoreClasses: Record<string, boolean>;
}
