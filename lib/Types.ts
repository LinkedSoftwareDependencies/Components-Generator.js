import {
    ClassDeclaration,
    ClassProperty,
    Identifier,
    Program,
    TSInterfaceDeclaration,
    TSPropertySignature
} from "@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree";


/**
 * Represents how a class was referenced in the code
 * e.g. `namespace.ClassName`
 */
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
    /** A mapping from import source to a list of import declarations */
    [importSource: string]: ImportDeclaration[];
}

export type ClassExportDeclarations = {
    /** A mapping from exported source to a list of export declarations */
    [exportSource: string]: ExportDeclaration[];
}
/**
 * An element in the super class chain
 */
export type SuperClassChainElement = {
    /** Declaration of the class */
    declaration: ParsedClassDeclaration
    /** Component information about this class */
    component: ComponentInformation,
    /** The parsed fields of this class */
    constructorParams: FieldDeclaration[]
}
/**
 * The chain of super class chain elements
 */
export type SuperClassChain = SuperClassChainElement[];

export type NodeModules = {
    [id: string]: string;
};

/**
 * Possible fields
 */
export enum FieldType {
    /** A simple type that can be matched to an xsd range */
    Simple,
    /** Any type that can not be matched to an xsd range */
    Complex
}

/**
 * Declaration of a field
 */
export interface FieldDeclaration {
    /** Name of the field */
    key: string,
    /** Type of the field */
    type: FieldType,
    /** jsonld parameter */
    parameter: any,
    /** Declaration of the class that the field references */
    declaration: ParsedClassDeclaration,
    /** Component information of the class that the field references */
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

/**
 * Parsed declaration of a class
 */
export interface ParsedClassDeclaration {
    /** The syntax tree of the entire file */
    ast: Program;
    /** Declaration of the class or interace itself */
    declaration: ClassDeclaration | TSInterfaceDeclaration;
    /** Filepath of the class file relative to the package root */
    filePath: string;
    /** Name of the package */
    packageName: string;
    /** Name of the class */
    className: string;
}

/**
 * Information about a component
 */
export interface ComponentInformation {
    /** Object that represents this specific component */
    component: any;
    /** Object that represents the entire content of the component file */
    componentContent: any;
}

export type FieldDeclarationType = TSPropertySignature | Identifier | ClassProperty
export type ClassDeclarationType = ClassDeclaration | TSInterfaceDeclaration

/**
 * Parsed comment
 */
export interface ParsedComment {
    /** The range of
     *
     * field */
    range: string,
    /** The default value of the field */
    defaultValue: string,
    /** Whether this field is ignored */
    ignored: boolean,
    /** Description of the field */
    description: string
}
