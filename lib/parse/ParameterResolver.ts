import type { TSTypeLiteral } from '@typescript-eslint/types/dist/ts-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ClassIndex, ClassLoaded, ClassReference, ClassReferenceLoaded, InterfaceLoaded } from './ClassIndex';
import type { ClassLoader } from './ClassLoader';
import type { CommentLoader } from './CommentLoader';
import type { ConstructorData } from './ConstructorLoader';
import type { ParameterData,
  ParameterDataField,
  ParameterRangeResolved,
  ParameterRangeUnresolved } from './ParameterLoader';
import {
  ParameterLoader,
} from './ParameterLoader';

export class ParameterResolver {
  private readonly classLoader: ClassLoader;
  private readonly commentLoader: CommentLoader;
  private readonly ignoreClasses: Record<string, boolean>;

  public constructor(args: ParameterResolverArgs) {
    this.classLoader = args.classLoader;
    this.commentLoader = args.commentLoader;
    this.ignoreClasses = args.ignoreClasses;
  }

  /**
   * Resolve all constructor parameters of a given constructor index.
   * @param unresolvedParametersIndex An index of unresolved constructor data.
   * @param classIndex A class index.
   */
  public async resolveAllConstructorParameters(
    unresolvedParametersIndex: ClassIndex<ConstructorData<ParameterRangeUnresolved>>,
    classIndex: ClassIndex<ClassReferenceLoaded>,
  ): Promise<ClassIndex<ConstructorData<ParameterRangeResolved>>> {
    const resolvedParametersIndex: ClassIndex<ConstructorData<ParameterRangeResolved>> = {};

    // Resolve parameters for the different constructors in parallel
    await Promise.all(Object.entries(unresolvedParametersIndex)
      .map(async([ className, parameters ]) => {
        const classOrInterface = classIndex[className];
        if (classOrInterface.type === 'class') {
          resolvedParametersIndex[className] = await this.resolveConstructorParameters(parameters, classOrInterface);
        }
      }));

    return resolvedParametersIndex;
  }

  /**
   * Resolve all parameters of a given constructor.
   * @param unresolvedConstructorData Unresolved constructor data.
   * @param owningClass The class in which the given constructor is declared.
   */
  public async resolveConstructorParameters(
    unresolvedConstructorData: ConstructorData<ParameterRangeUnresolved>,
    owningClass: ClassLoaded,
  ): Promise<ConstructorData<ParameterRangeResolved>> {
    return {
      parameters: await this.resolveParameterData(unresolvedConstructorData.parameters, owningClass),
    };
  }

  /**
   * Resolve the given array of parameter data in parallel.
   * @param parameters An array of unresolved parameters.
   * @param owningClass The class in which the given parameters are declared.
   */
  public async resolveParameterData(
    parameters: ParameterData<ParameterRangeUnresolved>[],
    owningClass: ClassReferenceLoaded,
  ): Promise<ParameterDataField<ParameterRangeResolved>[]> {
    return await Promise.all(parameters
      .map(async parameter => ({ ...parameter, range: await this.resolveRange(parameter.range, owningClass) })));
  }

  /**
   * Resolve the given parameter range.
   * @param range An unresolved parameter range.
   * @param owningClass The class this range was defined in.
   */
  public async resolveRange(range: ParameterRangeUnresolved, owningClass: ClassReferenceLoaded):
  Promise<ParameterRangeResolved> {
    switch (range.type) {
      case 'raw':
      case 'override':
        return range;
      case 'interface':
        if (range.value in this.ignoreClasses) {
          return {
            type: 'undefined',
          };
        }
        return await this.resolveRangeInterface(range.value, owningClass);
      case 'hash':
        return {
          type: 'nested',
          value: await this.getNestedFieldsFromHash(range.value, owningClass),
        };
      case 'undefined':
        return {
          type: 'undefined',
        };
      case 'union':
        return {
          type: 'union',
          children: await Promise.all(range.children.map(child => this.resolveRange(child, owningClass))),
        };
      case 'intersection':
        return {
          type: 'intersection',
          children: await Promise.all(range.children.map(child => this.resolveRange(child, owningClass))),
        };
    }
  }

  /**
   * Resolve a class or interface.
   * @param interfaceName A class or interface name.
   * @param owningClass The class this interface was used in.
   */
  public async resolveRangeInterface(
    interfaceName: string,
    owningClass: ClassReferenceLoaded,
  ): Promise<ParameterRangeResolved> {
    const classOrInterface = await this.loadClassOrInterfacesChain({
      packageName: owningClass.packageName,
      localName: interfaceName,
      fileName: owningClass.fileName,
      fileNameReferenced: owningClass.fileNameReferenced,
    });

    // If we find a class, or an interface that is implicitly a class, return the class reference directly
    if (classOrInterface.type === 'class' ||
      (classOrInterface.type === 'interface' && this.isInterfaceImplicitClass(classOrInterface))) {
      return {
        type: 'class',
        value: classOrInterface,
      };
    }

    // If we find an interface, load it as a hash with nested fields
    return {
      type: 'nested',
      value: await this.getNestedFieldsFromInterface(classOrInterface),
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
  public async loadClassOrInterfacesChain(classReference: ClassReference): Promise<ClassLoaded | InterfaceLoaded> {
    const classOrInterface = await this.classLoader.loadClassDeclaration(classReference, true);

    // If the result is an interface, load all its super interfaces recursively
    if (classOrInterface.type === 'interface') {
      classOrInterface.superInterfaces = await Promise.all(this.classLoader
        .getSuperInterfaceNames(classOrInterface.declaration, classOrInterface.fileName)
        .filter(interfaceName => !(interfaceName in this.ignoreClasses))
        .map(async interfaceName => {
          const superInterface = await this.loadClassOrInterfacesChain({
            packageName: classOrInterface.packageName,
            localName: interfaceName,
            fileName: classOrInterface.fileName,
            fileNameReferenced: classOrInterface.fileNameReferenced,
          });
          if (superInterface.type !== 'interface') {
            throw new Error(`Detected interface ${classOrInterface.localName} extending from a class ${interfaceName} in ${classReference.fileName}`);
          }
          return superInterface;
        }));
    }
    return classOrInterface;
  }

  /**
   * Recursively get all fields from the given interface.
   * @param iface A loaded interface.
   */
  public async getNestedFieldsFromInterface(iface: InterfaceLoaded): Promise<ParameterData<ParameterRangeResolved>[]> {
    const parameterLoader = new ParameterLoader({ classLoaded: iface, commentLoader: this.commentLoader });
    const unresolvedFields = parameterLoader.loadInterfaceFields(iface);
    return this.resolveParameterData(unresolvedFields, iface);
  }

  /**
   * Recursively get all fields from the given hash.
   * @param hash A hash object.
   * @param owningClass The class this hash is declared in.
   */
  public async getNestedFieldsFromHash(hash: TSTypeLiteral, owningClass: ClassReferenceLoaded):
  Promise<ParameterData<ParameterRangeResolved>[]> {
    const parameterLoader = new ParameterLoader({ classLoaded: owningClass, commentLoader: this.commentLoader });
    const unresolvedFields = parameterLoader.loadHashFields(owningClass, hash);
    return this.resolveParameterData(unresolvedFields, owningClass);
  }
}

export interface ParameterResolverArgs {
  classLoader: ClassLoader;
  commentLoader: CommentLoader;
  ignoreClasses: Record<string, boolean>;
}
