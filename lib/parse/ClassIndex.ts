import { ClassDeclaration, Program } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';

/**
 * A collection of classes, with exported name as key.
 */
export interface ClassIndex<T> {
  // The exported name of the class, as visible by externals importing it.
  [className: string]: T;
}

/**
 * The name and location of a class.
 */
export interface ClassReference {
  // The name of the class within the file.
  localName: string;
  // The name of the file the class is defined in.
  fileName: string;
}

/**
 * A loaded class with a full class declaration.
 */
export interface ClassLoaded extends ClassReference {
  // The name of the class within the file.
  localName: string;
  // The name of the file the class is defined in.
  fileName: string;
  // The loaded class declaration.
  declaration: ClassDeclaration;
  // The full AST the class was present in.
  ast: Program;
  // A super class reference if the class has one
  superClass?: ClassLoaded;
}
