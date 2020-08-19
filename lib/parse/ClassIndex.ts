import {
  ClassDeclaration,
  Program,
  TSInterfaceDeclaration,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';

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
 * A loaded reference.
 */
export type ClassReferenceLoaded = ClassLoaded | InterfaceLoaded;

/**
 * A loaded class with a full class declaration.
 */
export interface ClassLoaded extends ClassReference {
  type: 'class';
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
  // If this class is an abstract class that can not be instantiated directly
  abstract?: boolean;
  // The tsdoc comment of this class
  comment?: string;
}

/**
 * A loaded interface with a full interface declaration.
 */
export interface InterfaceLoaded extends ClassReference {
  type: 'interface';
  // The name of the interface within the file.
  localName: string;
  // The name of the file the interface is defined in.
  fileName: string;
  // The loaded interface declaration.
  declaration: TSInterfaceDeclaration;
  // The full AST the interface was present in.
  ast: Program;
  // Super interface references if the interface has them
  superInterfaces?: InterfaceLoaded[];
  // The tsdoc comment of this class
  comment?: string;
}
