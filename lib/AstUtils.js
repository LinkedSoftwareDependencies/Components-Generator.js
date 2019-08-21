const parser = require('@typescript-eslint/typescript-estree');
const ComponentsJsUtil = require('componentsjs/lib/Util');
const Utils = require("./Utils");
const Path = require("path");
const fs = require("fs");
const logger = require("./Core").logger;

/**
 * Gets the class of a type annotation
 * If the type is an array, it will check the type of that array
 *
 * @param annotation the type annotation to look at
 * @param isArray whether this annotation is the child of an array annotation. We do this to avoid parsing
 * multi-dimensional arrays
 * @returns {{namespace: string|null, className: string}|null} information about the class
 */
function getTypeAnnotationClass(annotation, isArray = false) {
    switch (annotation.type) {
        // A regular class reference
        case parser.AST_NODE_TYPES.TSTypeReference:
            // A namespace reference e.g. `q.B`
            switch (annotation.typeName.type) {
                case parser.AST_NODE_TYPES.TSQualifiedName:
                    return {namespace: annotation.typeName.left.name, className: annotation.typeName.right.name};
                case parser.AST_NODE_TYPES.Identifier:
                    return {namespace: null, className: annotation.typeName.name};
                default:
                    logger.error(`Could not recognize inner name type ${annotation.typeName.type}`);
                    return null;
            }
        case parser.AST_NODE_TYPES.TSArrayType:
            if (isArray) {
                logger.error(`Cannot parse nested array types`);
                return null;
            }
            return getTypeAnnotationClass(annotation.elementType, true);
        default:
            logger.error(`Could not recognize annotation type ${annotation.type}`);
            return null;
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
        logger.error(`Could not recognize annotation type ${typeAnnotation.type}`);
        return null;
    }
}

/**
 * Gets the superclass of a class or interface declaration
 *
 * @param declaration the class declaration to search in
 * @returns {null|{namespace: string|null, className: string}} information about the class
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
                    logger.error(`Could not recognize identifier ${identifier} for the superclass`);
                    return null;
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
                    logger.error(`Could not recognize identifier ${identifier} for the superclass`);
                    return null;
            }
        }
    }
    return null;
}

/**
 * Searches for the exact package (or local package path) a class was imported from and what its original name is
 * @param clazz the name of the class
 * @param imports the imports of the class that the specific class was referenced in
 * @returns {null|{pckg: *, exportedName: *}}
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
    return null;
}

/**
 * Finds the component in a package based on its exported name
 *
 * @param exportedName the name that the class was exported with in the index.ts
 * @param componentsFile the filepath of the components filew
 * @returns {{component:*, componentsContent:*}|null} component information where component is the component matched to the
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
            // if ("requireElement" in component) {
            //     if(component["requireElement"] === exportedName)
            //     return {component: component, componentsContent: json};
            // } else {
            //     logger.error(`Component ${component["@id"]} is lacking a requireElement field`);
            // }
            let splitted = component["@id"].split(":");
            if (component["requireElement"] === exportedName ||
                splitted[splitted.length - 1] === exportedName)
                return {component: component, componentsContent: json};

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
                logger.error(`Can't understand specifier ${specifier.type}`);
                return null;
        }
    }

    let files = {};
    for (let property of ast.body) {
        switch (property.type) {
            case parser.AST_NODE_TYPES.ImportDeclaration: {
                let file = property.source.value;
                let imports = new Set(property.specifiers
                    .map(getImport)
                    .filter(x => x != null));
                if (imports.size === 0) continue;
                files[file] = Utils.union(files[file], imports);
                break;
            }
            case parser.AST_NODE_TYPES.TSImportEqualsDeclaration: {
                let namespace = property.id.name;
                let file = property.moduleReference.expression.value;
                let info = {
                    className: "*",
                    importName: namespace
                };
                files[file] = Utils.union(files[file], [info]);
                break;
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
                        logger.error(`Can't understand specifier ${specifier.type}`);
                    }
                }
                if (exports.size === 0) return null;
                return {exportSource: exportSource, exports: exports};
            }
            default:
                logger.error(`Skipping line with type ${declaration.type}`);
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
        files[file] = Utils.union(files[file], parsedExport.exports);

    }
    return files;
}

/**
 * Searches for the root directory of a package
 * @param the name of the package as declared in the `package.json`
 * @returns {string|null} the root directory of the package
 */
function getPackageRootDirectory(name) {
    for (const [pckgJsonPath, pckgInfo] of Object.entries(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS)) {
        if (name === pckgInfo["name"]) {
            return Path.dirname(pckgJsonPath);
        }
    }
    return null;
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
function getLocalDeclaration(internalClass, internalClassPath, pckg, filePath) {
    let directory = getPackageRootDirectory(pckg);
    let normalizedFile = Path.normalize(Path.join(Path.dirname(filePath), internalClassPath));
    let fileContent = getTypeScriptFile(Path.join(directory, normalizedFile));
    let ast;
    try {
        ast = parser.parse(fileContent, {loc: true, comment: true});
    } catch (e) {
        logger.error(`Could not parse file ${normalizedFile}, invalid syntax at line ${e.lineNumber}, column ${e.column}. Message: ${e.message}`);
        return null;
    }
    for (let declarationBox of ast.body) {
        if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
            let declaration = declarationBox.declaration;
            if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration ||
                declaration.type === parser.AST_NODE_TYPES.TSInterfaceDeclaration) {
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
    return null;
}


/**
 * Searches for a class or interface in a package based on the exports
 * @param pckg the name of the package to search in
 * @param exportedName the exported name of the class or interface to look for.
 * This is the exported name, not the internal name
 * @param directory if this parameter is set, we will look in this directory instead of the root directory of the
 * package that was passed
 * @returns {null|{ast: *, declaration: *,filePath:string, pckg:string, internalClass:string}} the result of parsing the class or interface
 */

// pckg, exportedName
function getDeclaration(classInfo) {
    let rootFolder = getPackageRootDirectory(classInfo.pckg);
    if (rootFolder === null) {
        logger.error(`Could not find root directory of package ${classInfo.pckg}`);
        return null;
    }
    let indexContent = getTypeScriptFile(Path.join(rootFolder, "index"));
    if (indexContent === null) {
        logger.error("Could not find index.ts or index.d.ts file");
        return null;
    }
    let ast;
    try {
        ast = parser.parse(indexContent, {loc: true, comment: true});
    } catch (e) {
        logger.error(`Could not parse the index file of ${classInfo.pckg}, invalid syntax at line ${e.lineNumber}, column ${e.column}. Message: ${e.message}`);
        return null;
    }
    let exports = getExportedDeclarations(ast);
    // Go through all exported files and search for class name
    for (const [file, exportDetails] of Object.entries(exports)) {
        // We need to check all combinations, a function could be exported as {A as B} and {A as C} so we have to check B and C
        let searchNames = new Set();
        for (let exportDetail of exportDetails) {
            // We have to check the file source because we can't know for sure if the file contains the class
            if (exportDetail.className === "*" || exportDetail.exportName === classInfo.exportedName) {
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
        let fileContent = getTypeScriptFile(Path.join(rootFolder, file));
        let ast;
        try {
            ast = parser.parse(fileContent, {loc: true, comment: true});
        } catch (e) {
            logger.error(`Could not parse file ${file}, invalid syntax at line ${e.lineNumber}, column ${e.column}. Message: ${e.message}`);
            return null;
        }
        for (let declarationBox of ast.body) {
            if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
                let declaration = declarationBox.declaration;
                if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration ||
                    declaration.type === parser.AST_NODE_TYPES.TSInterfaceDeclaration) {
                    // Check if it has been exported using the wildcard or if it has been exported normally
                    if ((searchNames.has("*") && declaration.id.name === classInfo.exportedName) ||
                        searchNames.has(declaration.id.name)) {
                        let line = declaration.loc.start.line;
                        logger.debug(`Found matching class for ${classInfo.exportedName} on line ${line} in ${file}`);
                        return {
                            ast: ast,
                            declaration: declaration,
                            filePath: file,
                            pckg: classInfo.pckg,
                            internalClass: declaration.id.name
                        };
                    }
                }
            }
        }
        logger.debug(`Did not find a matching exported class in ${file} for name ${classInfo.exportedName}`);
    }
    return null;
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
function getField(property, declaration, imports, nodeModules, commentStart = null) {
    function getName(property) {
        switch (property.type) {
            case parser.AST_NODE_TYPES.TSPropertySignature:
                return property.key.name;
            case parser.AST_NODE_TYPES.Identifier:
                return property.name;
            case parser.AST_NODE_TYPES.ClassProperty:
                return property.key.name;
        }
    }

    let required = false;
    let fieldName = getName(property);
    let fieldType = property.typeAnnotation.typeAnnotation.type;
    let isArray = fieldType === parser.AST_NODE_TYPES.TSArrayType;
    let comment = commentStart === null ? Utils.getComment(declaration.ast.comments, property) :
        Utils.getInBetweenComment(declaration.ast.comments, commentStart, property.loc.start);
    let {range, defaultValue, ignored, commentDescription} = Utils.parseFieldComment(comment,
        property.typeAnnotation.typeAnnotation);
    if (ignored) {
        logger.debug(`Field ${fieldName} has an ignore attribute, skipping`);
        return null;
    }
    if ("optional" in property) required = !property["optional"];
    if (range === null) range = Utils.convertTypeToXsd(property.typeAnnotation.typeAnnotation);
    let type = range === null ? "complex" : "simple";
    let fieldDeclaration = null;
    let component = null;
    if (range == null) {
        let constructorReference = getFieldClass(property);
        if (constructorReference === null) return null;
        fieldDeclaration = getDeclarationWithContext(constructorReference, declaration, imports);
        if (fieldDeclaration === null) return null;
        component = getComponentByDeclaration(fieldDeclaration, nodeModules);
        if (component !== null) {
            range = component.component["@id"];
        } else {
            logger.debug(`Could not match class ${constructorReference.className} with any component`);
        }
    }
    let newParameter = {
        "required": required,
        "unique": !isArray,
    };
    if (range !== null) {
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
function getFields(declaration, nodeModules) {
    let imports = getImportDeclarations(declaration.ast);
    return declaration.declaration.body.body
        .map(property => getField(property, declaration, imports, nodeModules))
        .filter(x => x !== null);
}

/**
 * Gets the constructor arguments of a class
 * @param declaration the class to get the constructor parameters from
 * @param imports
 * @param nodeModules
 * @returns [{{component:{component:*, componentsContent:*}, parameter: *, type:string, declaration: *, key:string}|null}]
 * the parameters
 */
function getConstructorParams(declaration, imports, nodeModules) {
    let constructorParams = [];
    for (let property of declaration.declaration.body.body) {
        if (property.type === parser.AST_NODE_TYPES.MethodDefinition && property.key.name === "constructor") {
            // This is the constructor
            // TODO can there be multiple 'ExpresionStatement' elements?
            logger.debug("Found a constructor");
            let constructorParamDeclarations = property.value.params;
            let previousEnd = property.loc.start;
            for (let constructorParamDeclaration of constructorParamDeclarations) {
                let constructorParam = getField(constructorParamDeclaration, declaration, imports, nodeModules, previousEnd);
                if (constructorParam !== null) constructorParams.push(constructorParam);
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
function getComponentByDeclaration(declaration, nodeModules) {
    let possibleNames = getPossibleExportNames(declaration);
    for (const pckgInfo of Object.values(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS)) {
        let pckgName = pckgInfo["name"];
        if (!("lsd:module" in pckgInfo)) {
            logger.debug(`Skipping package ${pckgName} with missing lsd:module attribute`);
            continue;
        }
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

/**
 * Gets the content of a TypeScript file based on its filepath without extension
 * @param path the filepath without extension
 * @returns {string|null} the content of the file
 */
function getTypeScriptFile(path) {
    for (let extension of extensions) {
        let filePath = path + extension;
        if (fs.existsSync(filePath)) return Utils.getContent(filePath);
    }
    return null;
}

/**
 * Gets the possible names a declaration has been exported with in its package
 * @param declaration the declaration of the class
 * @returns {Set<string>} the possible names. This is a set of names because a single class might be exported
 * multiple times with different names
 */
function getPossibleExportNames(declaration) {
    let possibleNames = new Set();
    let directory = getPackageRootDirectory(declaration.pckg);
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

/**
 * Searches for a class or interface in a package based on the exports and local context. The important factor here
 * is that the class might be declared in the file of another class, which means it wouldn't be included in the import
 * statements
 * @param classInfo information about the class
 * @param contextClass declaration of the class that the class was used in
 * @param contextImports imports of the class that the class was used in
 * @returns {null|{ast: *, declaration: *,filePath:string, pckg:string, internalClass:string}} the result of parsing the class or interface
 */
function getDeclarationWithContext(classInfo, contextClass, contextImports) {
    // If no namespace is used, it is possible the class is declared in the the same file as our context class
    if (classInfo.namespace === null) {
        for (let declarationBox of contextClass.ast.body) {
            if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
                let declaration = declarationBox.declaration;
                if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration ||
                    declaration.type === parser.AST_NODE_TYPES.TSInterfaceDeclaration) {
                    if (classInfo.className === declaration.id.name) {
                        let line = declaration.loc.start.line;
                        logger.debug(`Found matching class for ${classInfo.className} on line ${line}`);
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
    }
    let nextClass = findExportedClass(classInfo, contextImports);
    if (nextClass === null) {
        logger.error(`Could not find declaration of class ${classInfo.className}`);
        return null;
    }
    if (Utils.isLocalFile(nextClass.pckg)) {
        return getLocalDeclaration(nextClass.exportedName, nextClass.pckg,
            contextClass.pckg, contextClass.filePath);
    } else {
        return getDeclaration(nextClass);
    }
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
function getSuperClassChain(classDeclaration, imports, nodeModules, directory, pckg) {
    let superClassChain = [];
    let previousSuperClassDeclaration = classDeclaration;
    let previousSuperClassImports = imports;
    while (previousSuperClassDeclaration !== null) {
        // We get the constructor parameters of the current class
        let constructorParams = getConstructorParams(previousSuperClassDeclaration, previousSuperClassImports, nodeModules);
        // We don't want to get the first component because that would be for the class that we're currently
        // creating a component for
        let superClassComponent = null;
        if (superClassChain.length !== 0) {
            superClassComponent = getComponentByDeclaration(previousSuperClassDeclaration, nodeModules);
            if (superClassComponent === null)
                logger.error(`Did not find a component for superclass ${previousSuperClassDeclaration.internalClass}`);
        }
        superClassChain.push({
            declaration: previousSuperClassDeclaration,
            component: superClassComponent,
            constructorParams: constructorParams
        });
        // Find the next superclass
        let nextSuperClassInfo = getSuperClass(previousSuperClassDeclaration.declaration);
        if (nextSuperClassInfo === null) break;
        // Get its declaration
        previousSuperClassDeclaration = getDeclarationWithContext(nextSuperClassInfo,
            previousSuperClassDeclaration, previousSuperClassImports);
        if (previousSuperClassDeclaration !== null) {
            // Do stuff with your current declaration here
            previousSuperClassImports = getImportDeclarations(previousSuperClassDeclaration.ast);
        } else {
            logger.error(`Could not find declaration of superclass ${nextSuperClassInfo.className}`);
        }
    }
    return superClassChain;
}

/**
 * Converts the superclass chain to the correct jsonld `parameters` and `constructorArguments`
 * @param superClassChain the superclass chain
 * @param compactPath the id of the component we're creating
 * @param nodeModules the node modules to look in
 * @returns {{constructorArguments: *, parameters: *}}
 */
function getParametersAndArguments(superClassChain, compactPath, nodeModules) {
    let parameters = [];
    let constructorArguments = [];
    let chosenParametersName = new Set();

    function getUniqueFieldId(path, field) {
        function getId(i) {
            return `${path}#${field}${i === 0 ? "" : i}`;
        }

        let i = -1;
        while (chosenParametersName.has(getId(++i))) {
        }
        let id = getId(i);
        chosenParametersName.add(id);
        return id;
    }

    function getConstructorArgument(constructorParam, root = false) {
        if (constructorParam.type === "complex") {
            // TODO doc
            function findSimilarParam(param) {
                for (let i = 1; i < superClassChain.length; i++) {
                    for (let x = 0; x < superClassChain[i].constructorParams.length; x++) {
                        let otherConstructorParam = superClassChain[i].constructorParams[x];
                        if (otherConstructorParam.type !== "complex") continue;
                        // Check if the declarations are the same
                        if (!Utils.classDeclarationEquals(param, otherConstructorParam.declaration)) continue;
                        if (superClassChain[i].component === null) continue;
                        return superClassChain[i].component.component.constructorArguments[x];
                    }
                }
                return null;
            }

            // TODO doc
            function getExtendsId(param) {
                if ("@id" in param) {
                    return param["@id"];
                } else if ("extends" in param) {
                    return similarParam["extends"];
                } else {
                    logger.error("Could not find @id nor extend!");
                    return null;
                }
            }

            function getExportedFields() {
                let exportedFields = [];
                let fieldData = getFields(constructorParam.declaration, nodeModules);
                for (let field of fieldData) {
                    let parsedField = getConstructorArgument(field);
                    if (Object.keys(parsedField).length === 1 && parsedField["@id"] !== undefined)
                        parsedField = parsedField["@id"];
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
                // TODO copy context!
                logger.debug("Found an identical constructor argument");
                let extendsAttribute = getExtendsId(similarParam);
                if (extendsAttribute !== null) parameter["extends"] = extendsAttribute;
                return parameter;
            }
            // If the parameter is not similar to the parameter of a superclass' constructor, we search if
            // the superclass of the argument is a parameter of a superclass's constructor
            let superClass = getSuperClass(constructorParam.declaration.declaration);
            if (superClass !== null) {
                let superClassDeclaration = getDeclarationWithContext(superClass,
                    constructorParam.declaration,
                    getImportDeclarations(constructorParam.declaration.ast));
                similarParam = findSimilarParam(superClassDeclaration);
                if (similarParam === null) {
                    logger.error(`We could not find a matching argument for ${superClass.className} in a superclass`);
                    return null;
                }
                // TODO copy context
                let exportedFields = getExportedFields();
                let extendsAttribute = getExtendsId(similarParam);
                if (extendsAttribute !== null) parameter["extends"] = extendsAttribute;
                parameter["fields"] = exportedFields;
                return parameter;
            } else {
                // TODO copy context.. ?
                if (constructorParam.component === null) {
                    let parameter = root ? {"@id": getUniqueFieldId(compactPath, constructorParam["key"])} : {};
                    let exportedFields = getExportedFields();
                    if (constructorParam.parameter.unique) {
                        parameter["fields"] = exportedFields;
                    } else {
                        parameter["elements"] = exportedFields;
                    }
                    return parameter;
                } else {
                    let id = getUniqueFieldId(compactPath, constructorParam["key"]);
                    let parameter = {"@id": id, ...constructorParam.parameter};
                    parameters.push(parameter);
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
        if (arg !== null) constructorArguments.push(arg);
    }
    return {parameters: parameters, constructorArguments: constructorArguments};
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
    getPackageRootFolder: getPackageRootDirectory,
    getFields: getFields,
    getConstructorParams: getConstructorParams,
    getComponentByDeclaration: getComponentByDeclaration,
    getSuperClassChain: getSuperClassChain,
    getParametersAndArguments: getParametersAndArguments
};

