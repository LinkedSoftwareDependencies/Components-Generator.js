const parser = require('@typescript-eslint/typescript-estree');
const ComponentsJsUtil = require('componentsjs/lib/Util');
const Utils = require("./Utils");
const Path = require("path");
const fs = require("fs");

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
                // TODO how can this be impossible? We need more tests
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
 * Gets the superclass of a class or interface declaration
 *
 * @param declaration the class declaration to search in
 * @returns {{namespace: string|null, className: string}|null} information about the class
 */
function getSuperClass(declaration) {
    switch (declaration.type) {
        case parser.AST_NODE_TYPES.ClassDeclaration:
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
        case parser.AST_NODE_TYPES.TSInterfaceDeclaration: {
            if (!("extends" in declaration)) return null;
            let identifier = declaration.extends[0].expression;
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
    }
    return null;
}

/**
 * Searches for the exact package (or local package path) a class was imported and what its exported name is
 * @param clazz the name of the class
 * @param imports the imports of the class that the specific class was referenced in
 * @returns {{pckg: *, exportedName: *}}
 */
function findExportedClass(clazz, imports) {
    for (const [pckg, importClasses] of Object.entries(imports)) {
        for (let importClass of importClasses) {
            // Qualified name e.g. `q.B`
            if (clazz.namespace !== null) {
                if (importClass.className === "*" && importClass.importName === clazz.namespace) {
                    // Class is imported under it's own name, but through a wildcard
                    return {exportedName: clazz.className, pckg: pckg};
                }
            } else if (importClass.importName === clazz.className) {
                // Class is not imported under its own name, we find the real name
                return {exportedName: importClass.className, pckg: pckg};
            }
        }
    }
    return {exportedName: null, pckg: null};
}

/**
 * Finds the component in a package based on its exported name
 *
 * @param exportedName the name that the class was exported with in the index.ts
 * @param componentsFile the components file
 * @returns {{component, componentsContent}|null} component information where component is the component matched to the
 * exportedName and componentsContent is the content of the file that the component was matched in
 */
function findComponent(exportedName, componentsFile) {
    let blacklist = [Path.basename(componentsFile), "context.jsonld"];
    // TODO ideally we'll look at the `import` part of the components file, but parsing these IRI's isn't trivial
    let componentsFolder = Path.dirname(componentsFile);
    for (let {filePath, json} of Utils.visitJSONFiles(componentsFolder)) {
        let baseName = Path.basename(filePath);
        if (blacklist.includes(baseName)) continue;
        if (!("components" in json)) continue;
        for (let component of json["components"]) {
            if ("requireElement" in component && component["requireElement"] === exportedName) {
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
        switch (declaration.type) {
            case parser.AST_NODE_TYPES.ExportAllDeclaration: {
                let exportSource = declaration.source;
                if (exportSource.type === parser.AST_NODE_TYPES.Literal) {
                    return {
                        exportSource: exportSource, exports: [{
                            className: "*",
                            exportName: "*"
                        }]
                    };
                } else {
                    return null;
                }
            }
            case parser.AST_NODE_TYPES.ExportNamedDeclaration: {
                let exportSource = declaration.source;
                const specifiers = declaration.specifiers;
                let exports = new Set();
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
                if (exports.size === 0) return null;
                return {exportSource: exportSource, exports: exports};
            }
            default:
                console.log("Skipping line with type " + declaration.type);
                return null;
        }
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

// TODO document
function getPackageRootFolder(name) {
    for (const [pckgJsonPath, pckgInfo] of Object.entries(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS)) {
        if (name === pckgInfo["name"]) {
            return Path.dirname(pckgJsonPath);
        }
    }
    return null;
}

/**
 * Searches for a local class a package, given its class name and class filepath
 * @returns {null|{ast: *, declaration: *,filePath:string, pckg:string,internalClass:string}} the result of parsing the class
 *
 */
// TODO doc this
function getLocalDeclaration(internalClass, internalClassPath, pckg, filePath) {
    let directory = getPackageRootFolder(pckg);
    let normalizedFile = Path.normalize(Path.join(Path.dirname(filePath), internalClassPath));
    let fileContent = getTypeScriptFile(Path.join(directory, normalizedFile));
    const ast = parser.parse(fileContent, {loc: true, comment: true});
    for (let declarationBox of ast.body) {
        if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
            let declaration = declarationBox.declaration;
            if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration ||
                declaration.type === parser.AST_NODE_TYPES.TSInterfaceDeclaration) {
                if (declaration.id.name === internalClass) {
                    let line = declaration.loc.start.line;
                    console.log("Found matching class for " + internalClass + " on line " + line);
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
    return null;
}


/**
 * Searches for a class or interface in a package based on the exports
 * @param pckg the name of the package to search in
 * @param exportedName the exported name of the class or interface to look for.
 * This is the exported name, not the internal name.
 * @returns {null|{ast: *, declaration: *,filePath:string, pckg:string, internalClass:string}} the result of parsing the class or interfacae
 */
// TODO document extra params
function getDeclaration(pckg, exportedName, directory = null) {
    let rootFolder = directory == null ? getPackageRootFolder(pckg) : directory;
    let indexContent = getTypeScriptFile(Path.join(rootFolder, "index"));
    let ast = parser.parse(indexContent);
    let exports = getExportedDeclarations(ast);
    // Go through all exported files and search for class name
    for (const [file, exportDetails] of Object.entries(exports)) {
        // We need to check all combinations, a function could be exported as {A as B} and {A as C} so we have to check B and C
        let searchNames = new Set();
        for (let exportDetail of exportDetails) {
            // We have to check the file source because we can't know for sure if the file contains the class
            if (exportDetail.className === "*" || exportDetail.exportName === exportedName) {
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
        console.log("Found potential file " + file + " with exported functions " + [...searchNames].join(", "));
        let fileContent = getTypeScriptFile(Path.join(rootFolder, file));
        const ast = parser.parse(fileContent, {loc: true, comment: true});
        for (let declarationBox of ast.body) {
            if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
                let declaration = declarationBox.declaration;
                if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration ||
                    declaration.type === parser.AST_NODE_TYPES.TSInterfaceDeclaration) {
                    // Check if it has been exported using the wildcard or if it has been exported normally
                    if ((searchNames.has("*") && declaration.id.name === exportedName) ||
                        searchNames.has(declaration.id.name)) {
                        let line = declaration.loc.start.line;
                        console.log("Found matching class for " + exportedName + " on line " + line);
                        return {
                            ast: ast,
                            declaration: declaration,
                            filePath: file,
                            pckg: pckg,
                            internalClass: declaration.id.name
                        };
                    }
                }
            }
        }
        console.log(`Did not find a matching exported class in ${file} for name ${exportedName}`);
    }
    return null;
}

// TODO doc
function getField(property, declaration, imports, nodeModules, commentStart=null) {
    function getName(property) {
        switch(property.type) {
            case parser.AST_NODE_TYPES.TSPropertySignature:
                return property.key.name;
            case parser.AST_NODE_TYPES.Identifier:
                return property.name;
        }
    }
    let fieldName = getName(property);
    let fieldType = property.typeAnnotation.typeAnnotation.type;
    let isArray = fieldType === parser.AST_NODE_TYPES.TSArrayType;
    if (isArray) {
        fieldType = property.typeAnnotation.typeAnnotation.elementType.type;
        // TODO can we allow multidimensional arrays?
    }
    let comment = commentStart === null ? Utils.getComment(declaration.ast.comments, property) :
        Utils.getInBetweenComment(declaration.ast.comments, commentStart, property.loc.start);
    let {range, required, defaultValue, commentDescription, ignored} = Utils.parseFieldComment(comment, fieldType);
    if (ignored) {
        console.log(`Field ${fieldName} has an ignore attribute, skipping`);
        return null;
    }
    if ("optional" in property) required = !property["optional"];
    if (range === null) range = Utils.convertTypeToXsd(fieldType);
    let type = range === null ? "complex" : "simple";
    let fieldDeclaration = null;
    let component = null;
    if (range == null) {
        let constructorReference = getFieldClass(property);
        fieldDeclaration = getDeclarationWithContext(constructorReference, declaration, imports);
        component = getComponentByDeclaration(fieldDeclaration, nodeModules);
        if(component != null) {
            range = component.component["@id"];
        }
    }
    let newParameter = {
        "range": range,
        "required": required,
        "unique": !isArray,
    };
    if (defaultValue != null) {
        newParameter["default"] = defaultValue;
    }
    if (commentDescription != null) {
        newParameter["comment"] = commentDescription;
    }
    return {
        "key": fieldName,
        "type": type,
        "parameter": newParameter,
        "declaration": fieldDeclaration,
        "component": component
    };
}

// TODO doc
function getFields(declaration, nodeModules) {
    // if (property.type === parser.AST_NODE_TYPES.ClassProperty ||
    //     property.type === parser.AST_NODE_TYPES.TSPropertySignature) {
    let imports = getImportDeclarations(declaration.ast);
    return declaration.declaration.body.body
        .map(property => getField(property, declaration, imports, nodeModules))
        .filter(x => x !== null);
}

function getConstructorParams(declaration, imports, nodeModules) {
    let constructorParams = [];
    for (let property of declaration.declaration.body.body) {
        if (property.type === parser.AST_NODE_TYPES.MethodDefinition && property.key.name === "constructor") {
            // This is the constructor
            // TODO can there be multiple 'ExpresionStatement' elements?
            let constructorParamDeclarations = property.value.params;
            let previousEnd = property.loc.start;
            for (let constructorParamDeclaration of constructorParamDeclarations) {
                let constructorParam = getField(constructorParamDeclaration, declaration, imports, nodeModules, previousEnd);
                if(constructorParam !== null) constructorParams.push(constructorParam);
                previousEnd = constructorParamDeclaration.loc.end;
            }
        }
    }
    return constructorParams;
}

function getComponentByDeclaration(declaration, nodeModules) {
    let possibleNames = getPossibleExportNames(declaration);
    for (const pckgInfo of Object.values(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS)) {
        if (!("lsd:module" in pckgInfo)) continue;
        let pckgName = pckgInfo["name"];
        if (declaration.pckg === pckgName) {
            for (let possibleName of possibleNames) {
                let lsdModule = pckgInfo["lsd:module"];
                let componentsFile = nodeModules[lsdModule];
                let component = findComponent(possibleName, componentsFile);
                if (component !== null) {
                    return component;
                }
            }
            break;
        }
    }
    return null;
}

const extensions = [".ts", ".d.ts"];

function getTypeScriptFile(path) {
    for (let extension of extensions) {
        let filePath = path + extension;
        if (fs.existsSync(filePath)) return Utils.getContent(filePath);
    }
    return null;
}

function getPossibleExportNames(declaration) {
    let possibleNames = new Set();
    let directory = getPackageRootFolder(declaration.pckg);
    let indexContent = getTypeScriptFile(Path.join(directory, "index"));
    let ast = parser.parse(indexContent);
    let exports = getExportedDeclarations(ast);
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

function getDeclarationWithContext(classInfo, contextClass, contextImports) {
    // Uhm, namespace needed?
    if (classInfo.namespace === null) {
        for (let declarationBox of contextClass.ast.body) {
            if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
                let declaration = declarationBox.declaration;
                if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration ||
                    declaration.type === parser.AST_NODE_TYPES.TSInterfaceDeclaration) {
                    if (classInfo.className === declaration.id.name) {
                        let line = declaration.loc.start.line;
                        console.log("Found matching class for " + classInfo.className + " on line " + line);
                        return {
                            ast: contextClass.ast,
                            declaration: declaration,
                            filePath: contextClass.filePath,
                            pckg: contextClass.pckg,
                            internalClass: classInfo.className
                        };
                    }
                }
            }
        }
        let nextClass = findExportedClass(classInfo, contextImports);
        if (Utils.isLocalFile(nextClass.pckg)) {
            return getLocalDeclaration(nextClass.exportedName, nextClass.pckg,
                contextClass.pckg, contextClass.filePath);
        } else {
            return getDeclaration(nextClass.pckg, nextClass.exportedName);
        }
    }
}

module.exports = {
    getDeclaration: getDeclaration,
    getDeclarationWithContext: getDeclarationWithContext,
    getSuperClass: getSuperClass,
    getFieldClass: getFieldClass,
    getImportDeclarations: getImportDeclarations,
    getExportedDeclarations: getExportedDeclarations,
    findExportedClass: findExportedClass,
    getTypeAnnotationClass: getTypeAnnotationClass,
    getLocalDeclaration: getLocalDeclaration,
    getPackageRootFolder: getPackageRootFolder,
    getFields: getFields,
    getConstructorParams: getConstructorParams,
    getComponentByDeclaration: getComponentByDeclaration
};

