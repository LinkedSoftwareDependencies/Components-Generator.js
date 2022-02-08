import type { AST, TSESTreeOptions, TSESTree } from '@typescript-eslint/typescript-estree';

/**
 * A collection of classes, with exported name as key.
 */
export type ClassIndex<T> = Record<string, T>;

/**
 * The name and location of a class.
 */
export interface ClassReference {
  // Name of the package this class is part of.
  packageName: string;
  // The name of the class within the file.
  localName: string;
  // Qualified path to the class.
  qualifiedPath?: string[];
  // The name of the file the class is defined in.
  fileName: string;
  // The first name of the file this class was referenced from, in a chain of imports/exports (in top-down order)
  fileNameReferenced: string;
}

/**
 * A loaded reference.
 */
export type ClassReferenceLoaded = ClassLoaded | InterfaceLoaded | TypeLoaded | EnumLoaded;

/**
 * A loaded reference without type aliases and enums.
 */
export type ClassReferenceLoadedClassOrInterface = ClassLoaded | InterfaceLoaded;

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
  declaration: TSESTree.ClassDeclaration;
  // The full AST the class was present in.
  ast: AST<TSESTreeOptions>;
  // A super class reference if the class has one
  superClass?: GenericallyTyped<ClassLoaded>;
  // Interface or (abstract) class references if the class implements them
  implementsInterfaces?: GenericallyTyped<ClassReferenceLoadedClassOrInterface>[];
  // If this class is an abstract class that can not be instantiated directly
  abstract?: boolean;
  // The tsdoc comment of this class
  comment?: string;
  // The generic types of this class
  generics: GenericTypes;
}

/**
 * A hash of generic type name to its properties.
 */
export type GenericTypes = Record<string, { type?: TSESTree.TypeNode }>;

/**
 * Something (like a class or interface) that may have generic types assigned to it as instantiation.
 */
export interface GenericallyTyped<T> {
  // The typed value
  value: T;
  // The generic types of this value
  genericTypeInstantiations?: TSESTree.TSTypeParameterInstantiation;
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
  declaration: TSESTree.TSInterfaceDeclaration;
  // The full AST the interface was present in.
  ast: AST<TSESTreeOptions>;
  // Super interface references if the interface has them
  superInterfaces?: GenericallyTyped<InterfaceLoaded>[];
  // The tsdoc comment of this class
  comment?: string;
  // The generic types of this class
  generics: GenericTypes;
}

/**
 * A member field of a class or interface.
 */
export interface MemberField {
  name: string;
  range: TSESTree.TypeNode | undefined;
}

/**
 * A loaded type alias with a full type declaration.
 */
export interface TypeLoaded extends ClassReference {
  type: 'type';
  // The name of the interface within the file.
  localName: string;
  // The name of the file the interface is defined in.
  fileName: string;
  // The loaded type declaration.
  declaration: TSESTree.TSTypeAliasDeclaration;
  // The full AST the interface was present in.
  ast: AST<TSESTreeOptions>;
  // The tsdoc comment of this class
  comment?: string;
  // The generic types of this class
  generics: GenericTypes;
}

/**
 * A loaded enum with a full type declaration.
 */
export interface EnumLoaded extends ClassReference {
  type: 'enum';
  // The name of the interface within the file.
  localName: string;
  // The name of the file the interface is defined in.
  fileName: string;
  // The loaded enum declaration.
  declaration: TSESTree.TSEnumDeclaration;
  // The full AST the interface was present in.
  ast: AST<TSESTreeOptions>;
  // The tsdoc comment of this class
  comment?: string;
}
