import type { ClassDeclaration, MethodDefinition } from '@typescript-eslint/types/dist/ts-estree';
import type { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ClassIndex, ClassLoaded } from './ClassIndex';
import type { ParameterDataField, ParameterRangeUnresolved } from './ParameterLoader';
import { ParameterLoader } from './ParameterLoader';

/**
 * Loads the constructor data of classes.
 */
export class ConstructorLoader {
  /**
   * Create a class index containing all constructor data from the classes in the given index.
   * @param classIndex An index of loaded classes.
   */
  public getConstructors(classIndex: ClassIndex<ClassLoaded>): ClassIndex<ConstructorData<ParameterRangeUnresolved>> {
    const constructorDataIndex: ClassIndex<ConstructorData<ParameterRangeUnresolved>> = {};
    for (const [ className, classLoaded ] of Object.entries(classIndex)) {
      const constructor = this.getConstructor(classLoaded);
      if (constructor) {
        const parameterLoader = new ParameterLoader({ classLoaded });
        constructorDataIndex[className] = parameterLoader.loadConstructorFields(constructor);
      } else {
        constructorDataIndex[className] = { parameters: []};
      }
    }
    return constructorDataIndex;
  }

  /**
   * Retrieve the constructor in the given class, or its super class.
   * Can be undefined if no explicit constructor exists in this class or any of its super classes.
   * @param classLoaded A loaded class reference.
   */
  public getConstructor(classLoaded: ClassLoaded): MethodDefinition | undefined {
    // First look for the constructor in this class
    let constructor = this.getConstructorInClass(classLoaded.declaration);

    // If no constructor was found, look in the super class
    if (!constructor) {
      if (classLoaded.superClass) {
        constructor = this.getConstructor(classLoaded.superClass);
      }
    }

    return constructor;
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

/**
 * Constructor parameter information
 */
export interface ConstructorData<R> {
  parameters: ParameterDataField<R>[];
}
