/**
 * Represents how a class was referenced in the code
 * e.g. `namespace.ClassName`
 */
import {
    ClassDeclaration, ClassProperty, Identifier,
    Program,
    Statement,
    TSInterfaceBody, TSInterfaceDeclaration, TSPropertySignature
} from "@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree";

export interface ClassReference {
    namespace: string;
    className: string;
}

export interface ExportDeclaration {
    /** The actual name of the class being exported */
    className: string;
    /** The export name, i.e. the name that other packages will see */
    exportName: string;
}

export interface ImportDeclaration {
    /** The exported name of the class, as seen by this package */
    className: string;
    /** The name that this specific class is giving to the import */
    importName: string;
}
export type ClassImportDeclarations = {
    [importSource: string]: ImportDeclaration[];
}

export type ClassExportDeclarations = {
    [exportSource: string]: ExportDeclaration[];
}

export type SuperClassChain = {
    declaration: ParsedClassDeclaration
    component: ComponentInformation,
    constructorParams: FieldDeclaration[]

}[];
export type NodeModules = {
    [id: string]: string;
};
export enum FieldType {
    Simple,
    Complex
}

export interface FieldDeclaration {
    key: string,
    type: FieldType,
    parameter: {},
    declaration: ParsedClassDeclaration,
    component: ComponentInformation
}
/**
 * Represents how a class was exported
 * e.g. `import {A as B} from C` tells us C exports A
 * `exportedFrom` can also be a relative path in the package
 */
export interface ExportReference {
    className: string;
    exportedFrom: string;
}

export interface ParsedClassDeclaration {
    ast: Program;
    declaration: ClassDeclaration | TSInterfaceDeclaration;
    filePath: string;
    pckg: string;
    internalClass: string;
}


export interface ComponentInformation {
    component: {};
    componentsContent: {};
}
export type FieldDeclarationType = TSPropertySignature | Identifier | ClassProperty
