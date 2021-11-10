import type { ClassDeclaration, MethodDefinition } from '@typescript-eslint/types/dist/ts-estree';
import type { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ClassIndex, ClassLoaded, ClassReferenceLoaded } from './ClassIndex';
import type { CommentLoader } from './CommentLoader';
import type { ParameterDataField, ParameterRangeUnresolved } from './ParameterLoader';
import { ParameterLoader } from './ParameterLoader';

/**
 * Loads the constructor data of classes.
 */
export class ConstructorLoader {
  private readonly commentLoader: CommentLoader;

  public constructor(args: ConstructorLoaderArgs) {
    this.commentLoader = args.commentLoader;
  }

  /**
   * Create a class index containing all constructor data from the classes in the given index.
   * @param classIndex An index of loaded classes.
   */
  public getConstructors(
    classIndex: ClassIndex<ClassReferenceLoaded>,
  ): ClassIndex<ConstructorData<ParameterRangeUnresolved>> {
    const constructorDataIndex: ClassIndex<ConstructorData<ParameterRangeUnresolved>> = {};
    for (const [ className, classLoadedRoot ] of Object.entries(classIndex)) {
      // Initialize default value
      constructorDataIndex[className] = { parameters: [], classLoaded: classLoadedRoot };

      // Fill in constructor data if we're loading a class, and we find a constructor in the inheritance chain.
      if (classLoadedRoot.type === 'class') {
        const parameterLoader = new ParameterLoader({
          classLoaded: classLoadedRoot,
          commentLoader: this.commentLoader,
        });
        const constructorChain = this.getConstructorChain(classLoadedRoot);
        if (constructorChain.length > 0) {
          constructorDataIndex[className] = parameterLoader.loadConstructorFields(constructorChain);
        }
      }
    }
    return constructorDataIndex;
  }

  /**
   * Load the superclass chain of constructor holders starting from the given class.
   * @param classLoaded The class to start from.
   */
  public getConstructorChain(classLoaded: ClassLoaded): ConstructorHolder[] {
    const constructorData = this.getConstructor(classLoaded);
    const chain: ConstructorHolder[] = [];
    if (constructorData) {
      chain.push(constructorData);
      if (constructorData.classLoaded.superClass) {
        chain.push(...this.getConstructorChain(constructorData.classLoaded.superClass));
      }
    }
    return chain;
  }

  /**
   * Retrieve the constructor in the given class, or its super class.
   * Can be undefined if no explicit constructor exists in this class or any of its super classes.
   * @param classLoaded A loaded class reference.
   */
  public getConstructor(classLoaded: ClassLoaded): ConstructorHolder | undefined {
    // First look for the constructor in this class
    let constructor: MethodDefinition | undefined = this.getConstructorInClass(classLoaded.declaration);

    // If no constructor was found, look in the super class
    if (!constructor) {
      if (classLoaded.superClass) {
        const constructorDataSuper = this.getConstructor(classLoaded.superClass);
        if (constructorDataSuper) {
          ({ constructor, classLoaded } = constructorDataSuper);
        }
      }
    }

    return constructor ? { constructor, classLoaded } : undefined;
  }

  /**
   * Retrieve the constructor in the given class, or undefined if it could not be found.
   * @param declaration A class declaration
   */
  public getConstructorInClass(declaration: ClassDeclaration): MethodDefinition | undefined {
    for (const element of declaration.body.body) {
      if (element.type === AST_NODE_TYPES.MethodDefinition &&
        element.kind === 'constructor') {
        return element;
      }
    }
  }

  /**
   * Find the first class with the given name in the given parsed typescript file.
   * An error will be thrown if no class could be found with that name.
   * @param className A class name.
   * @param ast A parsed typescript file
   * @param fileName The file name, for error reporting.
   */
  public getClass(className: string, ast: AST<TSESTreeOptions>, fileName: string): ClassDeclaration {
    for (const statement of ast.body) {
      // Classes in the form of `declare class A {}`
      if (statement.type === AST_NODE_TYPES.ClassDeclaration &&
        statement.id &&
        statement.id.name === className) {
        return statement;
      }
      // Classes in the form of `export class A{}`
      if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration &&
        statement.declaration &&
        statement.declaration.type === AST_NODE_TYPES.ClassDeclaration &&
        statement.declaration.id &&
        statement.declaration.id.name === className) {
        return statement.declaration;
      }
    }
    throw new Error(`Could not find class ${className} in ${fileName}`);
  }
}

export interface ConstructorLoaderArgs {
  commentLoader: CommentLoader;
}

/**
 * Constructor parameter information
 */
export interface ConstructorData<R> {
  parameters: ParameterDataField<R>[];
  classLoaded: ClassReferenceLoaded;
}

/**
 * Datastructure for holding a constructor and the class it is part of.
 */
export interface ConstructorHolder {
  constructor: MethodDefinition;
  classLoaded: ClassLoaded;
}
