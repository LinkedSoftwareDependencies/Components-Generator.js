const parser = require('@typescript-eslint/typescript-estree');
const ComponentsJsUtil = require('componentsjs/lib/Util');
const Utils = require("./Utils");
const Path = require("path");


/**
 * Gets the class of a type annotation
 * If the type is an array, it will check the type of that array
 *
 * @param annotation the type annotation to look at
 * @param isArray whether this annotation is the child of an array annotation
 * @returns {{namespace: string|null, className: string}|null} information about the class
 */
function getTypeAnnotationClass(annotation, isArray = false) {
    // A regular class reference
    switch (annotation.type) {
        case parser.AST_NODE_TYPES.TSTypeReference:
            // A namespace reference e.g. `q.B`
            switch (annotation.typeName.type) {
                case parser.AST_NODE_TYPES.TSQualifiedName:
                    return {namespace: annotation.typeName.left.name, className: annotation.typeName.right.name};
                // TODO how can this be impossible?
                case parser.AST_NODE_TYPES.TSTypeReference:
                    console.log("impossible... ?");
                    return {namespace: null, className: annotation.typeName.name};
                case parser.AST_NODE_TYPES.Identifier:
                    return {namespace: null, className: annotation.typeName.name};
                default:
                    throw new Error(`Could not recognize inner name type ${annotation.typeName.type}`);
            }
        case parser.AST_NODE_TYPES.TSArrayType:
            // TODO can we do this?
            if (isArray) throw new Error(`Cannot parse nested array types`);
            return getTypeAnnotationClass(annotation.elementType, true);
        default:
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
    switch (identifier.type) {
        case parser.AST_NODE_TYPES.MemberExpression:
            return {namespace: identifier.object.name, className: identifier.property.name};
        case parser.AST_NODE_TYPES.Identifier:
            return {namespace: null, className: identifier.name};
        default:
            throw new Error(`Could not recognize identifier ${identifier} for the superclass`);
    }
}

/**
 * Searches for a local component of a specific class in this package, given its class name and class filepath
 *
 * @param internalClass the internal class name
 * @param internalClassPath the path to the class
 * @param directory the directory of the current package
 * @param filePath the path to the file that this class was being imported in
 * @returns {{component, componentsContent}|null component information
 */
function getLocalComponent(internalClass, internalClassPath, directory, filePath) {
    // console.log("Looking for local exported name of " + internalClass + " in " + internalClassPath);
    let normalizedExportFile = Path.normalize(Path.join(Path.dirname(filePath), internalClassPath));
    let indexPath = Path.join(directory, "index.ts");
    let json = Utils.getContent(indexPath);
    let ast = parser.parse(json);
    let exports = getExportedDeclarations(ast);
    // Go through all exported files and search for class name
    let pckg = Utils.getJSON(Path.join(directory, "package.json"));
    let componentsFile = Path.join(directory, pckg["lsd:components"]);
    for (const [file, exportDetails] of Object.entries(exports)) {
        let normalizedFile = Path.normalize(file);
        if (normalizedExportFile === normalizedFile) {
            let filePath = Path.join(directory, normalizedFile + ".ts");
            let fileContent = Utils.getContent(filePath);
            const ast = parser.parse(fileContent);
            for (let declarationBox of ast.body) {
                if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
                    let declaration = declarationBox.declaration;
                    if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration) {
                        // Check if it has been exported using the wildcard or if it has been exported normally or with an alternative name
                        for (let exportDetail of exportDetails) {
                            let component = null;
                            if (exportDetail.className === "*" && internalClass === declaration.id.name) {
                                component = findComponent(internalClass, componentsFile);
                            } else if (exportDetail.className === declaration.id.name) {
                                component = findComponent(exportDetail.exportName, componentsFile);
                            }
                            if (component != null) return component;
                        }
                    }
                }
            }
        }
    }
    // If we couldn't find the class by analyzing exports for some reason (e.g. missing export statements),
    // our last attempt is to just search the name of the class
    return findComponent(internalClass, componentsFile);
}

/**
 * Gets the component and components file based on the namespace and className
 *
 * @param {{namespace:string|null,className:string}} clazz information about the class
 * @param imports to search in
 * @param nodeModules to search in
 * @param directory the directory of the current package
 * @param classFilePath the path relative to the package root of the file that contains the class
 * @returns {{component, componentsContent}|null component information
 */
function getComponent(clazz, imports, nodeModules, directory, classFilePath) {
    // The name the library being used is exporting the class
    let exportedName = null;
    // The name of the file exporting this class. Can be a local path or a module
    let pckg = null;
    importSearch: for (const [file, importClasses] of Object.entries(imports)) {
        for (let importClass of importClasses) {
            // Qualified name e.g. `q.B`
            if (clazz.namespace !== null) {
                if (importClass.className === "*") {
                    if (importClass.importName === clazz.namespace) {
                        // Class is imported under it's own name, but through a wildcard
                        exportedName = clazz.className;
                        pckg = file;
                        break importSearch;
                    }
                }
            } else {
                if (importClass.importName === clazz.className) {
                    // Class is not imported under its own name, we find the real name
                    exportedName = importClass.className;
                    pckg = file;
                    break importSearch;
                }
            }
        }
    }
    // Local files are tricky. Their name can be different from the exported name and thus the requireElement value
    // We do *an attempt* at getting the exported name
    if (pckg !== null && Utils.isLocalFile(pckg)) {
        return getLocalComponent(exportedName, pckg, directory, classFilePath);
    }
    if (exportedName == null) {
        if (clazz.namespace !== null) {
            console.log(`Could not find exported name of ${clazz.namespace + "." + clazz.className}, using ${clazz.className}`);
        } else {
            console.log(`Could not find exported name of ${clazz.namespace}, using ${clazz.className}`);
        }
        exportedName = clazz.className;
    }

    /**
     * Search through all or just a specific package to find a component
     *
     * @param pckg the package to filter on, if null it will go through all packages
     * @returns {{component, componentsContent}|null component information
     */
    function searchComponentInModules(pckg = null) {
        for (const pckgInfo of Object.values(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS)) {
            let pckgName = pckgInfo["name"];
            if (pckg === null || pckg === pckgName) {
                if (!("lsd:module" in pckgInfo)) continue;
                let lsdModule = pckgInfo["lsd:module"];
                let componentsFile = nodeModules[lsdModule];
                let component = findComponent(exportedName, componentsFile);
                if (component != null) {
                    return component;
                }
            }
        }
        return null;
    }

    if (pckg !== null) {
        // We have the exact package for the import, let's *try* use it first
        let component = searchComponentInModules(pckg);
        if (component != null) return component;
    }
    // We'll need to go through each components file this time
    return searchComponentInModules();
}

/**
 * Finds the component in a package based on its exported name
 *
 * @param exportedName the name that the class was exported with in the index.ts
 * @param componentsFile the components file
 * @returns {{component, componentsContent}|null component information
 */
function findComponent(exportedName, componentsFile) {
    Utils.getJSON(componentsFile, 'utf8');
    let blacklist = [Path.basename(componentsFile), "context.jsonld"];
    // TODO ideally we'll look at the `import` part of the components file, but parsing these IRI's isn't trivial
    let componentsFolder = Path.dirname(componentsFile);
    for (let {filePath, json} of Utils.visitJSONFiles(componentsFolder)) {
        let baseName = Path.basename(filePath);
        if (blacklist.includes(baseName)) continue;
        if (!("components" in json)) continue;
        for (let component of json["components"]) {
            if ("requireElement" in component && component["requireElement"] === exportedName) {
                // TODO move to doc
                // The component matched to the exportedName
                // The content of the file that the component was matched in
                return {component: component, componentsContent: json};
            }
        }
    }
    return null;
}


/**
 * Parses the imports of the source tree
 * @param ast the syntax tree to look in
 * @returns {{className:string, importName:string}[]} the parsed imports
 * where className is the actual name of the import as this package sees it and importName
 * is the name that this specific class is giving to the export
 */
function getImportDeclarations(ast) {
    function getImport(specifier) {
        switch (specifier.type) {
            case parser.AST_NODE_TYPES.ImportSpecifier:
                return {
                    // It is possible this name is also different from the actual class, because of export names
                    // e.g. `export {A as B}` and `import {B as C}`
                    className: specifier.imported.name,
                    importName: specifier.local.name
                };
            case parser.AST_NODE_TYPES.ImportNamespaceSpecifier:
                // e.g. `import * as A from "b"`
                return {
                    className: "*",
                    importName: specifier.local.name
                };
            default:
                console.log("Can't understand specifier " + specifier.type);
                return null;
        }
    }

    let files = {};
    for (let property of ast.body) {
        // TODO do we want to analyze imports such as `import Foo = require("bar");`?
        if (property.type === parser.AST_NODE_TYPES.ImportDeclaration) {
            let file = property.source.value;
            let imports = new Set(property.specifiers
                .map(getImport)
                .filter(x => x != null));
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
 * @returns {[{className:string, exportName:string}]} the parsed exports where className is the actual name of
 * the class being exported and exportName is the exported name of the class that other packages will see
 */
function getExportedDeclarations(ast) {
    function getExports(declaration) {
        // The classes being exported
        let exports = new Set();
        let exportSource = null;
        switch (declaration.type) {
            case parser.AST_NODE_TYPES.ExportAllDeclaration:
                exportSource = declaration.source;
                if (exportSource.type === parser.AST_NODE_TYPES.Literal) {
                    exports.add({
                        className: "*",
                        exportName: "*"
                    });
                }
                break;
            case parser.AST_NODE_TYPES.ExportNamedDeclaration:
                exportSource = declaration.source;
                const specifiers = declaration.specifiers;
                for (let specifier of specifiers) {
                    if (specifier.type === parser.AST_NODE_TYPES.ExportSpecifier) {
                        exports.add({
                            className: specifier.local.name,
                            exportName: specifier.exported.name
                        });
                    } else {
                        console.log("Can't understand specifier " + specifier.type);
                    }
                }
                break;
            default:
                console.log("Skipping line with type " + declaration.type);
                break;
        }
        if (exportSource === null || exports.size === 0) return null;
        return {exportSource: exportSource, exports: exports};
    }

    let files = {};
    for (let declaration of ast.body) {
        let parsedExport = getExports(declaration);
        if (parsedExport === null) continue;
        let exportSource, exports = parsedExport;
        let file = Path.normalize(parsedExport.exportSource.value);
        if (!(file in files)) {
            files[file] = new Set();
        }
        let list = files[file];
        for (let exportClass of parsedExport.exports) {
            list.add(exportClass);
        }
    }
    return files;
}

/**
 * Searches for a class in a package based on the exports
 * @param pckg the package to search in
 * @param className the exported class to look for. This is the exported name, not the internal name
 * @returns {null|{ast: *, declaration: *,filePath:string}} the result of parsing the class
 */
function getClass(pckg, className) {
    let indexPath = Path.join(pckg, "index.ts");
    let json = Utils.getContent(indexPath);
    let ast = parser.parse(json);
    let exports = getExportedDeclarations(ast);
    // Go through all exported files and search for class name
    for (const [file, exportDetails] of Object.entries(exports)) {
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
            // console.log("Did not find a matching class function in " + file);
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
                        // let line = declaration.loc.start.line;
                        // console.log("Found matching class for " + className + " on line " + line);
                        return {ast: ast, declaration: declaration, filePath: file};
                    }
                }
            }
        }
        // console.log("Did not find a matching exported class in " + file)
    }
    return null;
}


module.exports = {
    getClass: getClass,
    getSuperClass: getSuperClass,
    getFieldClass: getFieldClass,
    getComponent: getComponent,
    getImportDeclarations: getImportDeclarations,
    getExportedDeclarations: getExportedDeclarations
};
