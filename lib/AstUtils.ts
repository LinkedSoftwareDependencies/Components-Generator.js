import ComponentsJsUtil = require("componentsjs/lib/Util");
import * as parser from "@typescript-eslint/typescript-estree";
import {AST_NODE_TYPES} from "@typescript-eslint/typescript-estree";
import {Utils} from "./Utils";
import {logger} from "./Core";
import * as Path from "path";
import {
    BaseNode,
    ClassBody,
    DeclarationStatement,
    ImportClause, LineAndColumnData, Parameter,
    Program,
    SourceLocation,
    Statement, TSInterfaceDeclaration, TSTypeAnnotation, TypeElement
} from "@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree";


/**
 * Represents how a class was referenced in the code
 * e.g. `namespace.ClassName`
 */
interface ClassReference {
    namespace: string;
    className: string;
}

interface ExportDeclaration {
    /** The actual name of the class being exported */
    className: string;
    /** The export name, i.e. the name that other packages will see */
    exportName: string;
}

interface ImportDeclaration {
    /** The exported name of the class, as seen by this package */
    className: string;
    /** The name that this specific class is giving to the import */
    importName: string;
}
type ClassImportDeclarations = {
    [importSource: string]: ImportDeclaration[];
}

type ClassExportDeclarations = {
    [exportSource: string]: ExportDeclaration[];
}

type SuperClassChain = {
    declaration: ClassDeclaration
    component: ComponentInformation,
    constructorParams: FieldDeclaration[]

}[];
type NodeModules = {
    [id: string]: string;
};
enum FieldType {
    Simple,
    Complex
}

export interface FieldDeclaration {
    key: string,
    type: FieldType,
    parameter: {},
    declaration: ClassDeclaration,
    component: ComponentInformation
}


//      * @returns [{declaration:{ast: *, declaration: *,filePath:string, pckg:string, internalClass:string},component:{component:*, componentsContent:*},constructorParams:[
//      {component:{component:*, componentsContent:*},
//      parameter: *, type:string,
//      declaration: *, key:string
//      }]}]


/**
 * Represents how a class was exported
 * e.g. `import {A as B} from C` tells us C exports A
 * `exportedFrom` can also be a relative path in the package
 */
interface ExportReference {
    className: string;
    exportedFrom: string;
}

export interface ClassDeclaration {
    ast: Program;
    declaration: Statement;
    filePath: string;
    pckg: string;
    internalClass: string;
}


interface ComponentInformation {
    component: {};
    componentsContent: {};
}


export class AstUtils {
    /**
     * Gets the class of a type annotation
     * If the type is an array, it will check the type of that array
     *
     * @param annotation the type annotation to look at
     * @param isArray whether this annotation is the child of an array annotation. We do this to avoid parsing
     * multi-dimensional arrays
     * @returns information about the class
     */
    // TODO type??
    private static getTypeAnnotationClass(annotation:any, isArray: boolean = false): ClassReference {
        switch (annotation.type) {
            // A regular class reference
            case AST_NODE_TYPES.TSTypeReference:
                // A namespace reference e.g. `q.B`
                switch (annotation.typeName.type) {
                    case AST_NODE_TYPES.TSQualifiedName:
                        return {namespace: annotation.typeName.left.name, className: annotation.typeName.right.name};
                    case AST_NODE_TYPES.Identifier:
                        return {namespace: undefined, className: annotation.typeName.name};
                    default:
                        logger.error(`Could not recognize inner name type ${annotation.typeName.type}`);
                        return;
                }
            case AST_NODE_TYPES.TSArrayType:
                if (isArray) {
                    logger.error(`Cannot parse nested array types`);
                    return;
                }
                return AstUtils.getTypeAnnotationClass(annotation.elementType, true);
            default:
                logger.error(`Could not recognize annotation type ${annotation.type}`);
                return;
        }
    }

    /**
     * Gets the class of a field declaration
     *
     * @param property the field to look at
     * @returns information about the class
     */
    // TODO type??
    public static getFieldClass(property: any): ClassReference {
        let typeAnnotation = property.typeAnnotation;
        if (typeAnnotation.type === AST_NODE_TYPES.TSTypeAnnotation) {
            return AstUtils.getTypeAnnotationClass(typeAnnotation.typeAnnotation);
        } else {
            logger.error(`Could not recognize annotation type ${typeAnnotation.type}`);
            return;
        }
    }

    /**
     * Gets the superclass of a class or interface declaration
     *
     * @param declaration the class declaration to search in
     * @returns information about the class
     */
    public static getSuperClass(declaration: Statement): ClassReference {
        switch (declaration.type) {
            case AST_NODE_TYPES.ClassDeclaration:
                let identifier = declaration.superClass;
                if (identifier == null) return;
                switch (identifier.type) {
                    case AST_NODE_TYPES.MemberExpression:
                        // @ts-ignore
                        return {namespace: identifier.object.name, className: identifier.property.name};
                    case AST_NODE_TYPES.Identifier:
                        return {namespace: null, className: identifier.name};
                    default:
                        logger.error(`Could not recognize identifier ${identifier} for the superclass`);
                        return;
                }
            case AST_NODE_TYPES.TSInterfaceDeclaration: {
                if (!("extends" in declaration)) return;
                let identifier = declaration.extends[0].expression;
                if (identifier == null) return;
                switch (identifier.type) {
                    case AST_NODE_TYPES.MemberExpression:
                        // @ts-ignore
                        return {namespace: identifier.object.name, className: identifier.property.name};
                    case AST_NODE_TYPES.Identifier:
                        return {namespace: null, className: identifier.name};
                    default:
                        logger.error(`Could not recognize identifier ${identifier} for the superclass`);
                        return;
                }
            }
        }
        return;
    }

    /**
     * Searches for the exact package (or local package path) a class was imported from and what its original name is
     * @param classReference the name of the class
     * @param imports the imports of the class that the specific class was referenced in
     * @returns {null|{pckg: *, exportedName: *}}
     */
    public static findExportedClass(classReference: ClassReference, imports: ClassImportDeclarations): ExportReference {
        for (const [pckg, importClasses] of Object.entries(imports)) {
            for (let importClass of importClasses) {
                // Qualified name e.g. `q.B`
                if (classReference.namespace != null) {
                    if (importClass.className === "*" && importClass.importName === classReference.namespace) {
                        // Class is imported under it's own name, but through a wildcard
                        return {className: classReference.className, exportedFrom: pckg};
                    }
                } else if (importClass.importName === classReference.className) {
                    // Class is not imported under its own name, we find the real name
                    return {className: importClass.className, exportedFrom: pckg};
                }
            }
        }
        return;
    }

    /**
     * Finds the component in a package based on its exported name
     *
     * @param exportedName the name that the class was exported with in the index.ts
     * @param componentsFilePath the filepath of the components filew
     * @returns {{component:*, componentsContent:*}|null} component information where component is the component matched to the
     * exportedName and componentsContent is the content of the file that the component was matched in
     */
    public static findComponent(exportedName: string, componentsFilePath: string): ComponentInformation {
        let blacklist = [Path.basename(componentsFilePath), "context.jsonld"];
        // TODO ideally we'll look at the `import` part of the components file, but parsing these IRI's isn't trivial
        let componentsFolder = Path.dirname(componentsFilePath);
        for (let {filePath, json} of Utils.visitJSONFiles(componentsFolder)) {
            let baseName = Path.basename(filePath);
            if (blacklist.includes(baseName)) continue;
            if (!("components" in json)) continue;
            for (let component of json["components"]) {
                // Sometimes people might forget to add a requireElement field. We can 'guess' it based
                if (!("requireElement" in component)) {
                    logger.debug(`Component ${component["@id"]} is lacking a requireElement key`)
                }
                // We temporarily use a check here that tries to 'guess' the requireElement value in
                if (component["requireElement"] === exportedName ||
                    component["@id"].split(/[:/]/).slice(-1)[0] === exportedName)
                    return {component: component, componentsContent: json};

            }
        }
        return;
    }


    /**
     * Parses the imports of the source tree
     * @param ast the syntax tree to look in
     * @returns {{className:string, importName:string}[]} the parsed imports
     * where className is the actual name of the import as this package sees it and importName
     * is the name that this specific class is giving to the export
     */
    public static getImportDeclarations(ast: Program): ClassImportDeclarations {
        function getSpecifierImport(specifier: ImportClause) {
            switch (specifier.type) {
                case AST_NODE_TYPES.ImportSpecifier:
                    return {
                        // It is possible this name is also different from the actual class, because of export names
                        // e.g. `export {A as B}` and `import {B as C}`
                        className: specifier.imported.name,
                        importName: specifier.local.name
                    };
                case AST_NODE_TYPES.ImportNamespaceSpecifier:
                    // e.g. `import * as A from "b"`
                    return {
                        className: "*",
                        importName: specifier.local.name
                    };
                default:
                    logger.error(`Can't understand specifier ${specifier.type}`);
                    return;
            }
        }
        function getImports(declaration: Statement): { importSource: string, imports: ImportDeclaration[] } {
            switch (declaration.type) {
                case AST_NODE_TYPES.ImportDeclaration: {
                    let importSource = declaration.source;
                    let imports = declaration.specifiers
                        .map(getSpecifierImport)
                        .filter(x => x != null);
                    if (importSource.type === AST_NODE_TYPES.Literal &&
                        typeof importSource.value === "string") {
                        return {
                            importSource: importSource.value, imports: imports
                        };
                    }
                    return;
                }
                case AST_NODE_TYPES.TSImportEqualsDeclaration: {
                    let namespace = declaration.id.name;
                    let module = declaration.moduleReference;
                    // TODO check other possibilities?
                    if(module.type === AST_NODE_TYPES.TSExternalModuleReference
                        && module.expression.type === AST_NODE_TYPES.Literal
                        && typeof module.expression.value === "string") {
                        return {
                            importSource: module.expression.value, imports: [{
                                className: "*",
                                importName: namespace
                            }]
                        }
                    }
                    return;
                }
            }
        }
        let files: ClassImportDeclarations = {};
        for (let declaration of ast.body) {
            let parsedExport = getImports(declaration);
            if (parsedExport == null) continue;
            if(parsedExport.imports.length === 0) continue;
            let file = Path.normalize(parsedExport.importSource);
            files[file] = Utils.union(files[file], parsedExport.imports);
        }
        return files;
    }

    /**
     * Parses the exports of the source tree
     * @param ast the syntax tree to look in
     * @returns the parsed exports
     */
    public static getExportDeclarations(ast: Program): ClassExportDeclarations {
        // TODO messages if not string or Literal
        function getExports(declaration: Statement): { exportSource: string, exports: ExportDeclaration[] } {
            switch (declaration.type) {
                case AST_NODE_TYPES.ExportAllDeclaration: {
                    let exportSource = declaration.source;
                    if (exportSource.type === AST_NODE_TYPES.Literal &&
                        typeof exportSource.value === "string") {
                        return {
                            exportSource: exportSource.value, exports: [{
                                className: "*",
                                exportName: "*"
                            }]
                        };
                    }
                    return;
                }
                case AST_NODE_TYPES.ExportNamedDeclaration: {
                    let exportSource = declaration.source;
                    const specifiers = declaration.specifiers;
                    let exports: ExportDeclaration[] = [];
                    for (let specifier of specifiers) {
                        if (specifier.type === AST_NODE_TYPES.ExportSpecifier) {
                            exports.push({
                                className: specifier.local.name,
                                exportName: specifier.exported.name
                            });
                        } else {
                            logger.error(`Can't understand specifier ${specifier.type}`);
                        }
                    }
                    if (exportSource.type === AST_NODE_TYPES.Literal) {
                        if (typeof exportSource.value === "string") {
                            return {
                                exportSource: exportSource.value,
                                exports: exports
                            };
                        }
                    }
                    return;
                }
                default:
                    logger.error(`Skipping line with type ${declaration.type}`);
                    return;
            }
        }

        let files: ClassExportDeclarations = {};
        for (let declaration of ast.body) {
            let parsedExport = getExports(declaration);
            if (parsedExport == null) continue;
            if(parsedExport.exports.length === 0) continue;
            let file = Path.normalize(parsedExport.exportSource);
            files[file] = Utils.union(files[file], parsedExport.exports);
        }
        return files;
    }

    /**
     * Searches for the root directory of a package
     * @param name the name of the package as declared in the `package.json`
     * @returns {string|null} the root directory of the package
     */
    public static getPackageRootDirectory(name: string): string {
        for (const [pckgJsonPath, pckgInfo] of Object.entries(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS)) {
            // @ts-ignore
            if (name === pckgInfo["name"]) {
                return Path.dirname(pckgJsonPath);
            }
        }
    }

    /**
     * Searches for a class in a package, given its class name and class filepath
     * @param internalClass the internal name of the class
     * @param internalClassPath the filepath that was used to import this class
     * @param pckg the name of the package
     * @param filePath the filepath of the file that this class was imported in. This is import if we're dealing with relative
     * imports
     * @returns {null|{ast: *, declaration: *,filePath:string, pckg:string,internalClass:string}} the result of parsing the class
     */
    public static getLocalDeclaration(internalClass: string, internalClassPath: string, pckg: string, filePath: string): ClassDeclaration {
        let directory = AstUtils.getPackageRootDirectory(pckg);
        let normalizedFile = Path.normalize(Path.join(Path.dirname(filePath), internalClassPath));
        let fileContent = Utils.getTypeScriptFile(Path.join(directory, normalizedFile));
        let ast;
        try {
            ast = parser.parse(fileContent, {loc: true, comment: true});
        } catch (e) {
            logger.error(`Could not parse file ${normalizedFile}, invalid syntax at line ${e.lineNumber}, column ${e.column}. Message: ${e.message}`);
            return;
        }
        for (let declarationBox of ast.body) {
            if (declarationBox.type === AST_NODE_TYPES.ExportNamedDeclaration) {
                let declaration = declarationBox.declaration;
                if (declaration.type === AST_NODE_TYPES.ClassDeclaration ||
                    declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
                    if (declaration.id.name === internalClass) {
                        let line = declaration.loc.start.line;
                        logger.debug(`Found matching class for ${internalClass} on line ${line}`);
                        return {
                            ast: ast,
                            declaration: declaration,
                            filePath: normalizedFile,
                            pckg: pckg,
                            internalClass: declaration.id.name
                        };
                    }
                }
            }
        }
        return;
    }


    /**
     * Searches for a class or interface in a package based on the exports
     * @param classInfo {pckg:string,exportedName:string} where pckg is the name of the package to search in
     * and exportedName the exported name of the class or interface to look for. This is the exported name, not the internal name.
     * @returns {null|{ast: *, declaration: *,filePath:string, pckg:string, internalClass:string}} the result of parsing the class or interface
     */
    public static getDeclaration(classInfo: ExportReference): ClassDeclaration {
        let rootFolder = AstUtils.getPackageRootDirectory(classInfo.exportedFrom);
        if (rootFolder == null) {
            logger.error(`Could not find root directory of package ${classInfo.exportedFrom}`);
            return;
        }
        let indexContent = Utils.getTypeScriptFile(Path.join(rootFolder, "index"));
        if (indexContent == null) {
            logger.error("Could not find index.ts or index.d.ts file");
            return;
        }
        let ast: Program;
        try {
            ast = parser.parse(indexContent, {loc: true, comment: true});
        } catch (e) {
            logger.error(`Could not parse the index file of ${classInfo.exportedFrom}, invalid syntax at line ${e.lineNumber}, column ${e.column}. Message: ${e.message}`);
            return;
        }
        let exports = AstUtils.getExportDeclarations(ast);
        // Go through all exported files and search for class name
        for (const [file, exportDetails] of Object.entries(exports)) {
            // We need to check all combinations, a function could be exported as {A as B} and {A as C} so we have to check B and C
            let searchNames = new Set();
            for (let exportDetail of exportDetails) {
                // We have to check the file source because we can't know for sure if the file contains the class
                if (exportDetail.className === "*" || exportDetail.exportName === classInfo.className) {
                    // Wildcard means the class could be exported under its own name
                    // Otherwise A is exported explicitly as {A} or {A as B}
                    // In both cases we're looking for a function declaration A in the class
                    searchNames.add(exportDetail.className);
                }
            }
            if (searchNames.size === 0) {
                logger.debug(`Did not find a matching class in ${file}`);
                continue;
            }
            logger.debug(`Found potential file ${file} with exported declarations ${[...searchNames].join(", ")}`);
            let fileContent = Utils.getTypeScriptFile(Path.join(rootFolder, file));
            let ast;
            try {
                ast = parser.parse(fileContent, {loc: true, comment: true});
            } catch (e) {
                logger.error(`Could not parse file ${file}, invalid syntax at line ${e.lineNumber}, column ${e.column}. Message: ${e.message}`);
                return;
            }
            for (let declarationBox of ast.body) {
                if (declarationBox.type === AST_NODE_TYPES.ExportNamedDeclaration) {
                    let declaration = declarationBox.declaration;
                    if (declaration.type === AST_NODE_TYPES.ClassDeclaration ||
                        declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
                        // Check if it has been exported using the wildcard or if it has been exported normally
                        if ((searchNames.has("*") && declaration.id.name === classInfo.className) ||
                            searchNames.has(declaration.id.name)) {
                            let line = declaration.loc.start.line;
                            logger.debug(`Found matching class for ${classInfo.className} on line ${line} in ${file}`);
                            return {
                                ast: ast,
                                declaration: declaration,
                                filePath: file,
                                pckg: classInfo.exportedFrom,
                                internalClass: declaration.id.name
                            };
                        }
                    }
                }
            }
            logger.debug(`Did not find a matching exported class in ${file} for name ${classInfo.className}`);
        }
        return;
    }

    /**
     *
     * @param property the property that represents the field
     * @param declaration the declaration of the class where this field was found in
     * @param imports the imports of the class where this field was found in
     * @param nodeModules the node modules to search in
     * @param commentStart if this parameter is set, we will look for an inline comment starting after this position
     * @returns {{component:{component:*, componentsContent:*}, parameter: *, type:string, declaration: *, key:string}|null}
     * the information about this field
     */
    public static getField(property: any,
                           declaration: ClassDeclaration, imports: ClassImportDeclarations,
                           nodeModules: NodeModules,
                           commentStart: LineAndColumnData = null): FieldDeclaration {
        // TODO find actual type
        function getName(property: any) {
            switch (property.type) {
                case AST_NODE_TYPES.TSPropertySignature:
                    return property.key.name;
                case AST_NODE_TYPES.Identifier:
                    return property.name;
                case AST_NODE_TYPES.ClassProperty:
                    return property.key.name;
            }
        }
        let required = false;
        let fieldName = getName(property);
        let fieldType = property.typeAnnotation.typeAnnotation.type;
        let isArray = fieldType === AST_NODE_TYPES.TSArrayType;
        let comment = commentStart == null ? Utils.getComment(declaration.ast.comments, property) :
            Utils.getInBetweenComment(declaration.ast.comments, commentStart, property.loc.start);
        let {range, defaultValue, ignored, commentDescription} = Utils.parseFieldComment(comment,
            property.typeAnnotation.typeAnnotation);
        if (ignored) {
            logger.debug(`Field ${fieldName} has an ignore attribute, skipping`);
            return;
        }
        if ("optional" in property) required = !property["optional"];
        if (range == null) range = Utils.convertTypeToXsd(property.typeAnnotation.typeAnnotation);
        let type = range == null ? FieldType.Complex : FieldType.Simple;
        let fieldDeclaration;
        let component;
        if (range == null) {
            let constructorReference = AstUtils.getFieldClass(property);
            if (constructorReference == null) return;
            fieldDeclaration = AstUtils.getDeclarationWithContext(constructorReference, declaration, imports);
            if (fieldDeclaration == null) {
                logger.debug(`Could not get declaration of class ${constructorReference.className}`);
                return;
            }
            component = AstUtils.getComponentByDeclaration(fieldDeclaration, nodeModules);
            if (component != null) {
                // @ts-ignore
                range = component.component["@id"];
            } else {
                logger.debug(`Could not match class ${constructorReference.className} with any component`);
            }
        }
        let newParameter: any = {
            "required": required,
            "unique": !isArray,
        };
        if (range != null) {
            newParameter["range"] = range;
        }
        if (defaultValue != null) newParameter["default"] = defaultValue;
        if (commentDescription != null) newParameter["comment"] = commentDescription;
        return {
            "key": fieldName,
            "type": type,
            "parameter": newParameter,
            "declaration": fieldDeclaration,
            "component": component
        };
    }

    /**
     * Gets information about all the fields in the declaration of a class
     * @param declaration the class to get the fields from
     * @param nodeModules the node modules to look in
     * @returns [{component:{component:*, componentsContent:*}, parameter: *, type:string, declaration: *, key:string}]
     * information about all the fields
     */
    public static getFields(declaration: ClassDeclaration, nodeModules: NodeModules): FieldDeclaration[] {
        let imports = AstUtils.getImportDeclarations(declaration.ast);
        // TODO check which type we actually need
        // @ts-ignore
        return declaration.declaration.body.body
            .map((property: TypeElement) => AstUtils.getField(property, declaration, imports, nodeModules))
            .filter((x: FieldDeclaration) => x != null);
    }

    /**
     * Gets the constructor arguments of a class
     * @param declaration the class to get the constructor parameters from
     * @param imports
     * @param nodeModules
     * @returns [{component:{component:*, componentsContent:*}, parameter: *, type:string, declaration: *, key:string}]
     * the parameters
     */
    public static getConstructorParams(declaration: ClassDeclaration, imports: ClassImportDeclarations, nodeModules: NodeModules) {
        let constructorParams = [];
        // @ts-ignore
        for (let property of declaration.declaration.body.body) {
            if (property.type === AST_NODE_TYPES.MethodDefinition && property.key.name === "constructor") {
                // This is the constructor
                logger.debug(`Found a constructor for class ${declaration.internalClass}`);
                let constructorParamDeclarations = property.value.params;
                let previousEnd = property.loc.start;
                for (let constructorParamDeclaration of constructorParamDeclarations) {
                    let constructorParam = AstUtils.getField(constructorParamDeclaration, declaration, imports, nodeModules, previousEnd);
                    if (constructorParam != null) constructorParams.push(constructorParam);
                    previousEnd = constructorParamDeclaration.loc.end;
                }
            }
        }
        return constructorParams;
    }

    /**
     * Gets the component of a class based on its declaration
     * @param declaration the declaration of the class to search the component of
     * @param nodeModules the node modules to search in
     * @returns {{component:*, componentsContent:*}|null} component information where component is the component matched to the
     * exportedName and componentsContent is the content of the file that the component was matched in
     */
    public static getComponentByDeclaration(declaration: ClassDeclaration, nodeModules: NodeModules): ComponentInformation {
        let possibleNames = AstUtils.getPossibleExportNames(declaration);
        for (const pckgInfo of Object.values(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS)) {
            // @ts-ignore
            let pckgName = pckgInfo["name"];
            // @ts-ignore
            if (!("lsd:module" in pckgInfo)) {
                logger.debug(`Skipping package ${pckgName} with missing lsd:module attribute`);
                continue;
            }
            if (declaration.pckg === pckgName) {
                for (let possibleName of possibleNames) {
                    // @ts-ignore
                    let lsdModule = pckgInfo["lsd:module"];
                    let componentsFile = nodeModules[lsdModule];
                    let component = AstUtils.findComponent(possibleName, componentsFile);
                    if (component != null) {
                        return component;
                    }
                }
                break;
            }
        }
        return;
    }


    /**
     * Gets the possible names a declaration has been exported with in its package
     * @param declaration the declaration of the class
     * @returns {Set<string>} the possible names. This is a set of names because a single class might be exported
     * multiple times with different names
     */
    public static getPossibleExportNames(declaration: ClassDeclaration): Set<string> {
        let possibleNames = new Set<string>();
        let directory = AstUtils.getPackageRootDirectory(declaration.pckg);
        let indexContent = Utils.getTypeScriptFile(Path.join(directory, "index"));
        let ast = parser.parse(indexContent);
        let exports = AstUtils.getExportDeclarations(ast);
        for (const [file, exportDetails] of Object.entries(exports)) {
            let normalizedFile = Path.normalize(file);
            // The same file is being exported
            if (declaration.filePath === normalizedFile) {
                for (let exportDetail of exportDetails) {
                    if (exportDetail.className === "*") {
                        possibleNames.add(declaration.internalClass);
                    } else if (exportDetail.className === declaration.internalClass) {
                        possibleNames.add(exportDetail.exportName);
                    }
                }
            }
        }
        return possibleNames;
    }


    /**
     * Get the 'chain of extending classes'
     * We do this by parsing the current class, parsing its superclass, parsing that class' superclass and so forth
     * @param classDeclaration the declaration of the class to start from
     * @param imports the declaration of the class to start from
     * @param nodeModules the node modules to look in
     * @returns [{declaration:{ast: *, declaration: *,filePath:string, pckg:string, internalClass:string},component:{component:*, componentsContent:*},constructorParams:[{component:{component:*, componentsContent:*}, parameter: *, type:string, declaration: *, key:string}]}]
     * information about all superclasses
     */
    public static getSuperClassChain(classDeclaration: ClassDeclaration,
                                     imports: ClassImportDeclarations,
                                     nodeModules: NodeModules): SuperClassChain {
        let superClassChain = [];
        let previousSuperClassDeclaration = classDeclaration;
        let previousSuperClassImports = imports;
        while (previousSuperClassDeclaration != null) {
            // We get the constructor parameters of the current class
            let constructorParams = AstUtils.getConstructorParams(previousSuperClassDeclaration, previousSuperClassImports, nodeModules);
            // We don't want to get the first component because that would be for the class that we're currently
            // creating a component for
            let superClassComponent;
            if (superClassChain.length !== 0) {
                superClassComponent = AstUtils.getComponentByDeclaration(previousSuperClassDeclaration, nodeModules);
                if (superClassComponent == null)
                    logger.error(`Did not find a component for superclass ${previousSuperClassDeclaration.internalClass}`);
            }
            superClassChain.push({
                declaration: previousSuperClassDeclaration,
                component: superClassComponent,
                constructorParams: constructorParams
            });
            // Find the next superclass
            let nextSuperClassInfo = AstUtils.getSuperClass(previousSuperClassDeclaration.declaration);
            if (nextSuperClassInfo == null) break;
            // Get its declaration
            previousSuperClassDeclaration = AstUtils.getDeclarationWithContext(nextSuperClassInfo,
                previousSuperClassDeclaration, previousSuperClassImports);
            if (previousSuperClassDeclaration != null) {
                // Do stuff with your current declaration here
                previousSuperClassImports = AstUtils.getImportDeclarations(previousSuperClassDeclaration.ast);
            } else {
                logger.error(`Could not find declaration of superclass ${nextSuperClassInfo.className}`);
            }
        }
        return superClassChain;
    }

    /**
     * Searches for a class or interface in a package based on the exports and local context. The important factor here
     * is that the class might be declared in the file of another class, which means it wouldn't be included in the import
     * statements
     * @param classReference information about the class
     * @param contextClass declaration of the class that the class was used in
     * @param contextImports imports of the class that the class was used in
     * @returns {null|{ast: *, declaration: *,filePath:string, pckg:string, internalClass:string}} the result of parsing the class or interface
     */
    public static getDeclarationWithContext(classReference: ClassReference,
                                            contextClass: ClassDeclaration,
                                            contextImports: ClassImportDeclarations): ClassDeclaration {
        // If no namespace is used, it is possible the class is declared in the the same file as our context class
        if (classReference.namespace == null) {
            for (let declarationBox of contextClass.ast.body) {
                if (declarationBox.type === AST_NODE_TYPES.ExportNamedDeclaration) {
                    let declaration = declarationBox.declaration;
                    if (declaration.type === AST_NODE_TYPES.ClassDeclaration ||
                        declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
                        if (classReference.className === declaration.id.name) {
                            let line = declaration.loc.start.line;
                            logger.debug(`Found matching class for ${classReference.className} on line ${line}`);
                            return {
                                ast: contextClass.ast,
                                declaration: declaration,
                                filePath: contextClass.filePath,
                                pckg: contextClass.pckg,
                                internalClass: classReference.className
                            };
                        }
                    }
                }
            }
        }
        let nextClass = AstUtils.findExportedClass(classReference, contextImports);
        if (nextClass == null) {
            logger.error(`Could not find declaration of class ${classReference.className}`);
            return;
        }
        if (Utils.isLocalFile(nextClass.exportedFrom)) {
            return AstUtils.getLocalDeclaration(nextClass.className, nextClass.exportedFrom,
                contextClass.pckg, contextClass.filePath);
        } else {
            return AstUtils.getDeclaration(nextClass);
        }
    }

    /**
     * Converts the superclass chain to the correct jsonld `parameters` and `constructorArguments`
     * @param superClassChain the superclass chain
     * @param compactPath the id of the component we're creating
     * @param nodeModules the node modules to look in
     * @returns {{constructorArguments: *, parameters: *}}
     */
    public static getParametersAndArguments(superClassChain: SuperClassChain,
                                            compactPath: string,
                                            nodeModules: NodeModules):
         {contexts: string[], parameters: {}[], constructorArguments: {}[]} {

        let parameters: {}[] = [];
        let constructorArguments: {}[] = [];
        let chosenParameterNames = new Set();
        let contexts: string[] = [];

        function getUniqueFieldId(path: string, field: string): string {
            function getId(i: number) {
                return `${path}#${field}${i === 0 ? "" : i}`;
            }

            let i = -1;
            while (chosenParameterNames.has(getId(++i))) {
            }
            let id = getId(i);
            chosenParameterNames.add(id);
            return id;
        }

        function getConstructorArgument(constructorParam: FieldDeclaration, root: boolean = false) {
            if (constructorParam.type === FieldType.Complex) {
                /**
                 * Searches in the constructors of the superclasses to find an argument with the same class declaration
                 * @param param the declaration of the parameter to match
                 * @returns {null|*} the matching parameter, if any
                 */
                function findSimilarParam(param: ClassDeclaration) {
                    for (let i = 1; i < superClassChain.length; i++) {
                        for (let x = 0; x < superClassChain[i].constructorParams.length; x++) {
                            let otherConstructorParam = superClassChain[i].constructorParams[x];
                            if (otherConstructorParam.type !== FieldType.Complex) continue;
                            // Check if the declarations are the same
                            if (!Utils.classDeclarationEquals(param, otherConstructorParam.declaration)) continue;
                            if (superClassChain[i].component == null) continue;
                            return {
                                field: superClassChain[i],
                                // @ts-ignore
                                param: superClassChain[i].component.component["constructorArguments"][x]
                            };
                        }
                    }
                }

                /**
                 * If this class is a superclass of a parameter, we find an id value that we can use
                 * in the `extends` attribute of its subclass
                 * @param param the parameter
                 * @returns {null|*}
                 */
                function getExtendsId(param: {}): string {
                    if ("@id" in param) {
                        return param["@id"];
                    } else if ("extends" in param) {
                        return param["extends"];
                    } else {
                        logger.error("Could not find @id nor extend!");
                    }
                }

                /**
                 * Gets the fields of a hash class. These fields will also be parsed as if they are constructor arguments.
                 * @returns [{keyRaw:*,value:*}] the fields
                 */
                function getHashFields(): {keyRaw: string, value: {}}[] {
                    let exportedFields: {keyRaw: string, value: {}}[] = [];
                    let fieldData = AstUtils.getFields(constructorParam.declaration, nodeModules);
                    for (let field of fieldData) {
                        let parsedField = getConstructorArgument(field);
                        if (Object.keys(parsedField).length === 1
                            && parsedField["@id"] != null) {
                                // @ts-ignore
                                parsedField = parsedField["@id"];
                            }
                        exportedFields.push({
                            "keyRaw": field.key,
                            "value": parsedField
                        });
                    }
                    return exportedFields;
                }

                let parameter = root ? {"@id": getUniqueFieldId(compactPath, "constructorArgumentsObject")} : {};
                let similarParam = findSimilarParam(constructorParam.declaration);
                // This means we have found a similar parameter in the constructor of a superclass
                if (similarParam != null) {
                    logger.debug(`Found an identical constructor argument in other component for argument ${constructorParam.key}`);
                    let extendsAttribute = getExtendsId(similarParam.param);
                    if (extendsAttribute != null) {
                        // @ts-ignore
                        parameter["extends"] = extendsAttribute;
                    }
                    // @ts-ignore
                    Utils.copyContext(similarParam.field, contexts);
                    return parameter;
                }
                // If the parameter is not similar to the parameter of a superclass' constructor, we search if
                // the superclass of the argument is a parameter of a superclass's constructor
                let superClass = AstUtils.getSuperClass(constructorParam.declaration.declaration);
                if (superClass != null) {
                    let superClassDeclaration = AstUtils.getDeclarationWithContext(superClass,
                        constructorParam.declaration,
                        AstUtils.getImportDeclarations(constructorParam.declaration.ast));
                    similarParam = findSimilarParam(superClassDeclaration);
                    if (similarParam == null) {
                        logger.error(`We could not find a matching argument for ${superClass.className} in a superclass`);
                        return;
                    }
                    let exportedFields = getHashFields();
                    let extendsAttribute = getExtendsId(similarParam.param);
                    if (extendsAttribute != null) {
                        // @ts-ignore
                        parameter["extends"] = extendsAttribute;
                    }
                    // @ts-ignore
                    parameter["fields"] = exportedFields;
                    // @ts-ignore
                    Utils.copyContext(similarParam.field, contexts);
                    return parameter;
                } else {
                    if (constructorParam.component == null) {
                        // In this case we have a hash class that doesn't extend another class
                        let parameter = root ? {"@id": getUniqueFieldId(compactPath, constructorParam["key"])} : {};
                        let exportedFields = getHashFields();
                        // @ts-ignore
                        if (constructorParam.parameter.unique) {
                            // @ts-ignore
                            parameter["fields"] = exportedFields;
                        } else {
                            // @ts-ignore
                            parameter["elements"] = exportedFields;
                        }
                        return parameter;
                    } else {
                        // In this case our field references a component
                        let id = getUniqueFieldId(compactPath, constructorParam["key"]);
                        let parameter = {"@id": id, ...constructorParam.parameter};
                        parameters.push(parameter);
                        Utils.copyContext(constructorParam, contexts);
                        return {"@id": id};
                    }
                }
            } else {
                // In this case we have a simple parameter such as string, number, boolean
                let id = getUniqueFieldId(compactPath, constructorParam["key"]);
                let parameter = {"@id": id, ...constructorParam.parameter};
                parameters.push(parameter);
                return {"@id": id};
            }
        }

        // We analyze each of the constructor parameters of our current class
        for (let constructorParam of superClassChain[0].constructorParams) {
            let arg = getConstructorArgument(constructorParam, true);
            if (arg != null) constructorArguments.push(arg);
        }
        return {contexts: contexts, parameters: parameters, constructorArguments: constructorArguments};
    }
}
