const parser = require('@typescript-eslint/typescript-estree');
const ComponentsJsUtil = require('componentsjs/lib/Util');
const Utils = require("./Utils");
const Path = require("path");


/**
 * Gets the class of a type annotation
 * If the type is an array, it will check the type of that array
 *
 * @param typeAnnotation the type annotation to look at
 * @param isArray whether this annotation is the child of an array annotation
 * @returns {{namespace: string|null, className: string}|null} information about the class
 */
function getTypeAnnotationClass(annotation, isArray = false) {
    // A regular class reference
    if (annotation.type === parser.AST_NODE_TYPES.TSTypeReference) {
        // A namespace reference e.g. `q.B`
        if (annotation.typeName.type === parser.AST_NODE_TYPES.TSQualifiedName) {
            return {namespace: annotation.typeName.left.name, className: annotation.typeName.right.name}
        } else if (annotation.typeName.type === parser.AST_NODE_TYPES.TSTypeReference) {
            return {namespace: null, className: annotation.typeName.name}
        } else if (annotation.typeName.type === parser.AST_NODE_TYPES.Identifier) {
            return {namespace: null, className: annotation.typeName.name}
        } else {
            throw new Error(`Could not recognize inner name type ${annotation.typeName.type}`);
        }
    } else if (annotation.type === parser.AST_NODE_TYPES.TSArrayType) {
        if (!isArray) {
            return getTypeAnnotationClass(annotation.elementType, true);
        } else {
            // TODO can we do this?
            throw new Error(`Cannot parse nested array types`);
        }
    } else {
        throw new Error(`Could not recognize annotation type ${annotation.type}`);
    }
}

/**
 * Gets the class of a field declaration
 *
 * @param property the field to look at
 * @returns {{namespace: string|null, className: string}|null} information about the class
 */
function getFieldClass(property) {
    let typeAnnotation = property.typeAnnotation;
    if (typeAnnotation.type === parser.AST_NODE_TYPES.TSTypeAnnotation) {
        return getTypeAnnotationClass(typeAnnotation.typeAnnotation);
    } else {
        throw new Error(`Could not recognize annotation type ${typeAnnotation.type}`);
    }
}

/**
 * Gets the superclass of a class declaration
 *
 * @param declaration the class declaration to search in
 * @returns {{namespace: string|null, className: string}|null} information about the class
 */
function getSuperClass(declaration) {
    let identifier = declaration.superClass;
    if (identifier == null) return null;
    if (identifier.type === parser.AST_NODE_TYPES.MemberExpression) {
        return {namespace: identifier.object.name, className: identifier.property.name}
    } else if (identifier.type === parser.AST_NODE_TYPES.Identifier) {
        return {namespace: null, className: identifier.name}
    } else {
        throw new Error(`Could not recognize indentifier ${identifier} for the superclass`);
    }
}

/**
 * Gets the component and components file based on the namespace and className
 *
 * @param {{namespace:string|null,className:string}} clazz information about the class
 * @param imports to search in
 * @param nodeModules to search in
 * @returns {{component, componentsContent}|null component information
 */
function getComponent(clazz, imports, nodeModules) {
    // The name the library being used is exporting the class
    let exportedName = null;
    // The name of the file exporting this class. Can be a local path or a module
    let exportedFile = null;
    importSearch: for (const [file, importClasses] of Object.entries(imports)) {
        for (let importClass of importClasses) {
            // Qualified name e.g. `q.B`
            if (clazz.namespace !== null) {
                if (importClass.className === "*") {
                    if (importClass.importName === clazz.namespace) {
                        // Class is imported under it's own name, but through a wildcard
                        exportedName = clazz.className;
                        exportedFile = file;
                        break importSearch;
                    }
                }
            } else {
                if (importClass.importName === clazz.className) {
                    // Class is not imported under its own name, we find the real name
                    exportedName = importClass.className;
                    exportedFile = file;
                    break importSearch;
                }
            }
        }
    }
    if (exportedName == null) {
        if (clazz.namespace !== null) {
            console.log(`Could not find exported name of ${clazz.namespace + "." + clazz.className}, using ${clazz.className}`);
        } else {
            console.log(`Could not find exported name of ${clazz.namespace}, using ${clazz.className}`);
        }
        exportedName = clazz.className;
    }
    // The component matched to the exportedName
    let matchedComponent = null;
    // The content of the file that the component was matched in
    let matchedComponentsContent = null;

    function searchComponent(exportedFile) {
        for (const pckgInfo of Object.values(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS)) {
            let pckgName = pckgInfo["name"];
            if (exportedFile === null || exportedFile === pckgName) {
                if (!("lsd:module" in pckgInfo)) continue;
                let lsdModule = pckgInfo["lsd:module"];
                let componentsFile = nodeModules[lsdModule];
                let componentsContent = Utils.getJSON(componentsFile, 'utf8');
                let blacklist = [Path.basename(componentsFile), "context.jsonld"];
                // TODO ideally we'll look at the `import` part of the components file, but parsing these IRI's isn't trivial
                let componentsFolder = Path.dirname(componentsFile);
                for (let {filePath, json} of Utils.visitJSONFiles(componentsFolder)) {
                    let baseName = Path.basename(filePath);
                    if (blacklist.includes(baseName)) continue;
                    if (!("components" in json)) continue;
                    for (let component of json["components"]) {
                        if ("requireElement" in component && component["requireElement"] === exportedName) {
                            matchedComponent = component;
                            matchedComponentsContent = json;
                            break;
                        }
                    }
                }
                if (matchedComponent !== null) break;
            }
        }
    }

    if (exportedFile !== null) {
        // We have the exact package for the import, let's *try* use it first
        searchComponent(exportedFile);
    }
    // We'll need to go through each components file this time
    if (matchedComponent === null) {
        searchComponent(null);
    }
    if (matchedComponent === null) return null;
    return {component: matchedComponent, componentsContent: matchedComponentsContent}
}

/**
 * Parses the imports of the source tree
 * @param ast the syntax tree to look in
 * @returns {[{className:string, importName:string}]} the parsed imports
 */
function getImportDeclarations(ast) {
    let files = {};
    for (let property of ast.body) {
        // TODO do we want to analyze imports such as `import Foo = require("bar");`?
        if (property.type === parser.AST_NODE_TYPES.ImportDeclaration) {
            let file = property.source.value;
            let imports = new Set();
            for (let specifier of property.specifiers) {
                if (specifier.type === parser.AST_NODE_TYPES.ImportSpecifier) {
                    imports.add({
                        // className is the actual name of the import as this package sees it
                        // It is possible this name is also different from the actual class, because of export names
                        // e.g. `export {A as B}` and `import {B as C}`
                        className: specifier.imported.name,
                        // importName is the name that this class is giving to the export
                        importName: specifier.local.name
                    });
                } else if (specifier.type === parser.AST_NODE_TYPES.ImportNamespaceSpecifier) {
                    // e.g. `import * as A from "b"`
                    imports.add({
                        className: "*",
                        importName: specifier.local.name
                    });
                } else {
                    console.log("Can't understand specifier " + specifier.type);
                }
            }
            if (imports.size !== 0) {
                if (!(file in files)) {
                    files[file] = new Set();
                }
                let list = files[file];
                for (let importClass of imports) {
                    list.add(importClass);
                }
            }
        }
    }
    return files;
}

/**
 * Parses the exports of the source tree
 * @param ast the syntax tree to look in
 * @returns {[{className:string, exportName:string}]} the parsed exports
 */
function getExportedDeclarations(ast) {
    let files = {};
    for (let declaration of ast.body) {
        // The classes being exported
        let exports = new Set();
        let file = null;
        if (declaration.type === parser.AST_NODE_TYPES.ExportAllDeclaration) {
            const exportSource = declaration.source;
            file = exportSource.value;
            if (exportSource.type === parser.AST_NODE_TYPES.Literal) {
                exports.add({
                    className: "*",
                    exportName: "*"
                });
            }
        } else if (declaration.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
            const exportSource = declaration.source;
            file = exportSource.value;
            const specifiers = declaration.specifiers;
            for (let specifier of specifiers) {
                if (specifier.type === parser.AST_NODE_TYPES.ExportSpecifier) {
                    exports.add({
                        // className is the actual name of the class being exported
                        className: specifier.local.name,
                        // exportName is the name of the class that other packages will see
                        exportName: specifier.exported.name
                    });
                } else {
                    console.log("Can't understand specifier " + specifier.type);
                }
            }
        } else {
            console.log("Skipping line with type " + declaration.type);
        }
        if (file != null) {
            if (!(file in files)) {
                files[file] = new Set();
            }
            let list = files[file];
            for (let exportClass of exports) {
                list.add(exportClass);
            }
        }
    }
    return files;
}

/**
 * Searches for a class in a package based on the exports
 * @param pckg the package to search in
 * @param className the exported class to look for. This is the exported name, not the internal name
 * @returns {null|{ast: *, declaration: *}} the result of parsing the class
 */
function getClass(pckg, className) {
    let indexPath = Path.join(pckg, "index.ts");
    let json = Utils.getContent(indexPath);
    let ast = parser.parse(json);
    let exports = getExportedDeclarations(ast);
    // Go through all exported files and search for class name
    for (const [file, exportDetails] of Object.entries(exports)) {
        let potentialFile = false;
        // We need to check all combinations, a function could be exported as {A as B} and {A as C} so we have to check B and C
        let searchNames = new Set();
        for (let exportDetail of exportDetails) {
            // We have to check the file source because we can't know for sure if the file contains the class
            if (exportDetail.className === "*" || exportDetail.exportName === className) {
                // Wildcard means the class could be exported under its own name
                // Otherwise A is exported explicitly as {A} or {A as B}
                // In both cases we're looking for a function declaration A in the class
                searchNames.add(exportDetail.className);
            }
        }
        if (searchNames.size === 0) {
            console.log("Did not find a matching exported function in " + file);
            continue;
        }
        // console.log("Found potential file " + file + " with exported functions " + [...searchNames].join(", "));
        let filePath = Path.join(pckg, file + ".ts");
        let fileContent = Utils.getContent(filePath);
        const ast = parser.parse(fileContent, {loc: true, comment: true});
        for (let declarationBox of ast.body) {
            if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
                let declaration = declarationBox.declaration;
                if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration) {
                    // Check if it has been exported using the wildcard or if it has been exported normally
                    if ((searchNames.has("*") && declaration.id.name === className) ||
                        searchNames.has(declaration.id.name)) {
                        let line = declaration.loc.start.line;
                        // console.log("Found matching function for " + className + " on line " + line);
                        return {ast: ast, declaration: declaration};
                    }
                }
            }
        }
        console.log("Did not find a matching exported function in " + file)
    }
    return null;
}


module.exports = {
    getClass:getClass,
    getSuperClass: getSuperClass,
    getFieldClass: getFieldClass,
    getComponent: getComponent,
    getImportDeclarations: getImportDeclarations,
    getExportedDeclarations: getExportedDeclarations
};
