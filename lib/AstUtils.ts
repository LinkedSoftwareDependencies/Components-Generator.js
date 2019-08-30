import ComponentsJsUtil = require("componentsjs/lib/Util");
import * as parser from "@typescript-eslint/typescript-estree";
import {AST_NODE_TYPES} from "@typescript-eslint/typescript-estree";
import {Utils} from "./Utils";
import {logger} from "./Core";
import * as Path from "path";
import {
    ClassElement,
    ClassProperty,
    LineAndColumnData,
    Program,
    TSPropertySignature,
    TypeElement,
    TypeNode
} from "@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree";
import {
    ClassDeclarationType,
    ClassImportDeclarations,
    ClassReference,
    ComponentInformation,
    ExportReference,
    FieldDeclaration,
    FieldDeclarationType,
    FieldType,
    NodeModules,
    ParsedClassDeclaration,
    SuperClassChain,
    SuperClassChainElement
} from "./Types";
import {CommentUtils} from "./CommentUtils";
import {ImportExportReader} from "./ImportExportReader";


/**
 * A utility class to parse information from a syntax tree
 */
export class AstUtils {
    /**
     * Gets reference to the class of a field declaration
     *
     * @param property the field to look at
     * @returns reference to the class
     */
    public static getFieldClassReference(property: FieldDeclarationType): ClassReference {
        let typeAnnotation = property.typeAnnotation;
        return AstUtils.getTypeAnnotationReference(typeAnnotation.typeAnnotation);
    }

    /**
     * Gets the superclass of a class or interface declaration
     *
     * @param declaration the class declaration to search in
     * @returns information about the class
     */
    public static getSuperClass(declaration: ClassDeclarationType): ClassReference {
        function getIdentifier(declaration: ClassDeclarationType) {
            switch (declaration.type) {
                case AST_NODE_TYPES.ClassDeclaration:
                    return declaration.superClass;
                case AST_NODE_TYPES.TSInterfaceDeclaration: {
                    if (!("extends" in declaration)) return;
                    return declaration.extends[0].expression;
                }
            }
        }

        let identifier = getIdentifier(declaration);
        if (identifier == null) return;
        switch (identifier.type) {
            case AST_NODE_TYPES.MemberExpression:
                if (identifier.object.type !== AST_NODE_TYPES.Identifier) {
                    logger.error(`Could not recognize expression ${identifier} object type ${identifier.property.type}`);
                    return;
                }
                if (identifier.property.type !== AST_NODE_TYPES.Identifier) {
                    logger.error(`Could not recognize expression ${identifier} property type ${identifier.property.type}`);
                    return;
                }
                return {namespace: identifier.object.name, className: identifier.property.name};
            case AST_NODE_TYPES.Identifier:
                return {namespace: null, className: identifier.name};
            default:
                logger.error(`Could not recognize identifier ${identifier} for the superclass`);
        }
    }

    /**
     * Finds reference of a class according to how it was referenced in the code and imported
     *
     * @param classReference how the class was referenced in the code
     * @param imports the imports of the class that the specific class was referenced in
     * @returns reference to exported class
     */
    public static findExportedClass(classReference: ClassReference, imports: ClassImportDeclarations): ExportReference {
        for (const [packageName, importClasses] of Object.entries(imports)) {
            for (let importClass of importClasses) {
                // Qualified name e.g. `q.B`
                if (classReference.namespace != null) {
                    if (importClass.className === "*" && importClass.importName === classReference.namespace) {
                        // Class is imported under it's own name, but through a wildcard
                        return {className: classReference.className, exportedFrom: packageName};
                    }
                } else if (importClass.importName === classReference.className) {
                    // Class is not imported under its own name, we find the real name
                    return {className: importClass.className, exportedFrom: packageName};
                }
            }
        }
    }

    /**
     * Finds the component in a package based on its exported name
     *
     * @param exportedName the name that the class was exported with in the index.ts
     * @param componentsFilePath the filepath of the components file
     * @returns information about the component
     */
    public static findComponent(exportedName: string, componentsFilePath: string): ComponentInformation {
        // We won't look at files whose name is in the blacklist
        let blacklist = [Path.basename(componentsFilePath), "context.jsonld"];
        // TODO ideally we'll look at the `import` part of the components file, but parsing these IRI's isn't trivial
        // see issue #8
        let componentsFolder = Path.dirname(componentsFilePath);
        for (let {filePath, json} of Utils.visitJSONLDFiles(componentsFolder)) {
            let baseName = Path.basename(filePath);
            if (blacklist.includes(baseName)) continue;
            if (!("components" in json)) continue;
            for (let component of json["components"]) {
                if (!("requireElement" in component)) {
                    logger.debug(`Component ${component["@id"]} is lacking a requireElement key`)
                }
                // Sometimes people might forget to add a requireElement field. We can 'guess' it based
                // on the value of `@id`
                if (component["requireElement"] === exportedName ||
                    component["@id"].split(/[:/]/).slice(-1)[0] === exportedName)
                    return {component: component, componentContent: json};

            }
        }
    }

    /**
     * Searches for a class in a package, given its class name and relative class filepath
     *
     * @param internalClass the internal name of the class
     * @param internalClassPath the filepath that was used to import this class
     * @param packageName the name of the package
     * @param filePath the filepath of the file that this class was imported in. This is import if we're dealing with relative
     * imports
     * @returns the result of parsing the class
     */
    public static getLocalDeclaration(internalClass: string, internalClassPath: string, packageName: string, filePath: string): ParsedClassDeclaration {
        let directory = Utils.getPackageRootDirectory(packageName);
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
                            packageName: packageName,
                            className: declaration.id.name
                        };
                    }
                }
            }
        }
    }

    /**
     * Searches for a class or interface in a package based on the exports of the package
     *
     * @param classInfo how the class can be referenced externally
     * @returns the result of parsing the class or interface
     */
    public static getDeclaration(classInfo: ExportReference): ParsedClassDeclaration {
        let rootFolder = Utils.getPackageRootDirectory(classInfo.exportedFrom);
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
        let exports = ImportExportReader.getExportDeclarations(ast);
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
                    if(declaration == null)  {
                        logger.debug("Can not parse non-declaration export");
                        continue;
                    }
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
                                packageName: classInfo.exportedFrom,
                                className: declaration.id.name
                            };
                        }
                    }
                }
            }
            logger.debug(`Did not find a matching exported class in ${file} for name ${classInfo.className}`);
        }
    }

    /**
     * Parses a field or parameter based on its declaration
     *
     * @param property the property that represents the field
     * @param declaration the declaration of the class where this field was found in
     * @param imports the imports of the class where this field was found in
     * @param nodeModules the node modules to search in
     * @param commentStart if this parameter is set, we will look for an inline comment starting after this position
     * @returns information about this field
     */
    public static getField(property: FieldDeclarationType,
                           declaration: ParsedClassDeclaration, imports: ClassImportDeclarations,
                           nodeModules: NodeModules,
                           commentStart: LineAndColumnData = null): FieldDeclaration {
        function getName(property: FieldDeclarationType) {
            switch (property.type) {
                case AST_NODE_TYPES.Identifier:
                    return property.name;
                case AST_NODE_TYPES.TSPropertySignature:
                case AST_NODE_TYPES.ClassProperty:
                    if (property.key.type === AST_NODE_TYPES.Identifier) {
                        return property.key.name;
                    } else {
                        logger.debug(`Could not understand type ${property.key.type}, skipping`);
                    }
            }
        }

        let required = false;
        let fieldName = getName(property);
        let fieldType = property.typeAnnotation.typeAnnotation.type;
        let isArray = fieldType === AST_NODE_TYPES.TSArrayType;
        let comment = commentStart == null ? CommentUtils.getComment(declaration.ast.comments, property) :
            CommentUtils.getInBetweenComment(declaration.ast.comments, commentStart, property.loc.start);
        let {range, defaultValue, ignored, description} = CommentUtils.parseFieldComment(comment,
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
            let constructorReference = AstUtils.getFieldClassReference(property);
            if (constructorReference == null) return;
            fieldDeclaration = AstUtils.getDeclarationWithContext(constructorReference, declaration, imports);
            if (fieldDeclaration == null) {
                logger.debug(`Could not get declaration of class ${constructorReference.className}`);
                return;
            }
            component = AstUtils.getComponentByDeclaration(fieldDeclaration, nodeModules);
            if (component != null) {
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
        if (description != null) newParameter["comment"] = description;
        return {
            "key": fieldName,
            "type": type,
            "parameter": newParameter,
            "declaration": fieldDeclaration,
            "component": component
        };
    }

    /**
     * Gets information about all the fields in the declaration of a class or interface
     *
     * @param declaration the class to get the fields from
     * @param nodeModules the node modules to look in
     * @returns information about all the fields
     */
    public static getFields(declaration: ParsedClassDeclaration, nodeModules: NodeModules): FieldDeclaration[] {
        let imports = ImportExportReader.getImportDeclarations(declaration.ast);
        switch (declaration.declaration.type) {
            case AST_NODE_TYPES.ClassDeclaration: {
                return declaration.declaration.body.body
                    .filter((x: ClassElement) => x.type === AST_NODE_TYPES.ClassProperty)
                    .map((x: ClassProperty) => AstUtils.getField(x, declaration, imports, nodeModules))
                    .filter((x: FieldDeclaration) => x != null);
            }
            case AST_NODE_TYPES.TSInterfaceDeclaration:
                return declaration.declaration.body.body
                    .filter((x: TypeElement) => x.type === AST_NODE_TYPES.TSPropertySignature)
                    .map((x: TSPropertySignature) => AstUtils.getField(x, declaration, imports, nodeModules))
                    .filter((x: FieldDeclaration) => x != null);
        }
    }

    /**
     * Gets the constructor arguments of a class
     *
     * @param declaration the class to get the constructor parameters from
     * @param imports the imports of the class
     * @param nodeModules the node modules to search in
     * @returns the parsed parameters
     */
    public static getConstructorParams(declaration: ParsedClassDeclaration, imports: ClassImportDeclarations, nodeModules: NodeModules): FieldDeclaration[] {
        let constructorParams: FieldDeclaration[] = [];
        for (let property of declaration.declaration.body.body) {
            if (property.type === AST_NODE_TYPES.MethodDefinition && property.key.type === AST_NODE_TYPES.Identifier
                && property.key.name === "constructor") {
                // We found the constructor
                logger.debug(`Found a constructor for class ${declaration.className}`);
                let constructorParamDeclarations = property.value.params;
                let previousEnd = property.loc.start;
                for (let constructorParamDeclaration of constructorParamDeclarations) {
                    if (constructorParamDeclaration.type === AST_NODE_TYPES.Identifier) {
                        let constructorParam = AstUtils.getField(constructorParamDeclaration, declaration, imports, nodeModules, previousEnd);
                        if (constructorParam != null) constructorParams.push(constructorParam);
                        previousEnd = constructorParamDeclaration.loc.end;
                    } else {
                        logger.error(`Could not understand parameter type ${constructorParamDeclaration.type}`);
                    }
                }
            }
        }
        return constructorParams;
    }

    /**
     * Gets the component of a class based on its declaration
     *
     * @param declaration the declaration of the class to search the component of
     * @param nodeModules the node modules to search in
     * @returns information about the component
     */
    public static getComponentByDeclaration(declaration: ParsedClassDeclaration, nodeModules: NodeModules): ComponentInformation {
        let possibleNames = AstUtils.getPossibleExportNames(declaration);
        let values: any[] = Object.values(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS);
        for (const packageInfo of values) {
            let packageName = packageInfo["name"];
            if (!("lsd:module" in packageInfo)) {
                logger.debug(`Skipping package ${packageName} with missing lsd:module attribute`);
                continue;
            }
            if (declaration.packageName === packageName) {
                for (let possibleName of possibleNames) {
                    let lsdModule = packageInfo["lsd:module"];
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
     * Gets the possible names a declaration has been exported with in its package base on the index.ts file of
     * the package
     *
     * @param declaration the declaration of the class
     * @returns the possible names. This is a set of names because a single class might be exported
     * multiple times with different names
     */
    public static getPossibleExportNames(declaration: ParsedClassDeclaration): Set<string> {
        let possibleNames = new Set<string>();
        let directory = Utils.getPackageRootDirectory(declaration.packageName);
        let indexContent = Utils.getTypeScriptFile(Path.join(directory, "index"));
        let ast = parser.parse(indexContent);
        let exports = ImportExportReader.getExportDeclarations(ast);
        for (const [file, exportDetails] of Object.entries(exports)) {
            let normalizedFile = Path.normalize(file);
            // The same file is being exported
            if (declaration.filePath === normalizedFile) {
                for (let exportDetail of exportDetails) {
                    if (exportDetail.className === "*") {
                        possibleNames.add(declaration.className);
                    } else if (exportDetail.className === declaration.className) {
                        possibleNames.add(exportDetail.exportName);
                    }
                }
            }
        }
        return possibleNames;
    }

    /**
     * Get the chain of extending classes
     *
     * We do this by parsing the current class, parsing its superclass, parsing that class' superclass and so forth
     * @param classDeclaration the declaration of the class to start from
     * @param imports the declaration of the class to start from
     * @param nodeModules the node modules to search in
     * @returns information about all superclasses
     */
    public static getSuperClassChain(classDeclaration: ParsedClassDeclaration,
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
                    logger.error(`Did not find a component for superclass ${previousSuperClassDeclaration.className}`);
            }
            superClassChain.push({
                declaration: previousSuperClassDeclaration,
                component: superClassComponent,
                constructorParams: constructorParams
            });
            // Find the next superclass
            let nextSuperClassInfo = AstUtils.getSuperClass(previousSuperClassDeclaration.declaration);
            if (nextSuperClassInfo == null)
            // We reached the end of the chain
                break;
            // Get its declaration
            previousSuperClassDeclaration = AstUtils.getDeclarationWithContext(nextSuperClassInfo,
                previousSuperClassDeclaration, previousSuperClassImports);
            if (previousSuperClassDeclaration != null) {
                // Do stuff with your current declaration here
                previousSuperClassImports = ImportExportReader.getImportDeclarations(previousSuperClassDeclaration.ast);
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
     *
     * @param classReference information about the class that we want to get the declaration of
     * @param contextClass declaration of the class that the class was referenced in
     * @param contextImports imports of the class that the class was referenced in
     * @returns the result of parsing the class or interface
     */
    public static getDeclarationWithContext(classReference: ClassReference,
                                            contextClass: ParsedClassDeclaration,
                                            contextImports: ClassImportDeclarations): ParsedClassDeclaration {
        // If no namespace is used, it is possible the class is declared in the the same file as our context class
        if (classReference.namespace == null) {
            for (let declarationBox of contextClass.ast.body) {
                if (declarationBox.type === AST_NODE_TYPES.ExportNamedDeclaration) {
                    let declaration = declarationBox.declaration;
                    if(declaration == null)  {
                        logger.debug("Can not parse non-declaration export");
                        continue;
                    }
                    if (declaration.type === AST_NODE_TYPES.ClassDeclaration ||
                        declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
                        if (classReference.className === declaration.id.name) {
                            let line = declaration.loc.start.line;
                            logger.debug(`Found matching class for ${classReference.className} on line ${line}`);
                            return {
                                ast: contextClass.ast,
                                declaration: declaration,
                                filePath: contextClass.filePath,
                                packageName: contextClass.packageName,
                                className: classReference.className
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
                contextClass.packageName, contextClass.filePath);
        } else {
            return AstUtils.getDeclaration(nextClass);
        }
    }

    /**
     * Converts the superclass chain to the correct jsonld `parameters` and `constructorArguments`
     *
     * @param superClassChain the superclass chain
     * @param compactPath the id of the component we're creating
     * @param nodeModules the node modules to search in
     * @returns the parsed parameters and arguments as objects
     */
    public static getParametersAndArguments(superClassChain: SuperClassChain,
                                            compactPath: string,
                                            nodeModules: NodeModules):
        { contexts: string[], parameters: {}[], constructorArguments: {}[] } {

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

        function getConstructorArgument(constructorParam: FieldDeclaration, root: boolean = false): any {
            if (constructorParam.type === FieldType.Complex) {
                /**
                 * Searches in the constructors of the superclasses to find an argument with the same class declaration
                 *
                 * @param param the declaration of the parameter to match
                 * @returns the matching parameter, if any
                 */
                function findSimilarParam(param: ParsedClassDeclaration): { field: SuperClassChainElement, param: any } {
                    for (let i = 1; i < superClassChain.length; i++) {
                        for (let x = 0; x < superClassChain[i].constructorParams.length; x++) {
                            let otherConstructorParam = superClassChain[i].constructorParams[x];
                            if (otherConstructorParam.type !== FieldType.Complex) continue;
                            // Check if the declarations are the same
                            if (!Utils.classDeclarationEquals(param, otherConstructorParam.declaration)) continue;
                            if (superClassChain[i].component == null) continue;
                            return {
                                field: superClassChain[i],
                                param: superClassChain[i].component.component["constructorArguments"][x]
                            };
                        }
                    }
                }

                /**
                 * If this class is a superclass of a parameter, we find an id value that we can use
                 * in the `extends` attribute of its subclass
                 * @param param the parameter
                 *
                 * @returns the value for the `extends` attribute
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
                 * Gets the fields of a hash class as jsonld objects
                 * These fields will also be parsed as if they are constructor arguments
                 *
                 * @returns the parsed fields
                 */
                function getHashFields(): { keyRaw: string, value: {} }[] {
                    let exportedFields: { keyRaw: string, value: {} }[] = [];
                    let fieldData = AstUtils.getFields(constructorParam.declaration, nodeModules);
                    for (let field of fieldData) {
                        let parsedField = getConstructorArgument(field);
                        // This little check verifies whether the field consists
                        // of solely one `@id` attribute
                        if (Object.keys(parsedField).length === 1
                            && parsedField["@id"] != null) {
                            parsedField = parsedField["@id"];
                        }
                        exportedFields.push({
                            "keyRaw": field.key,
                            "value": parsedField
                        });
                    }
                    return exportedFields;
                }
                if(constructorParam.declaration == null) return;
                let similarParam = findSimilarParam(constructorParam.declaration);
                // This means we have found a similar parameter in the constructor of a superclass
                if (similarParam != null) {
                    let parameter: any = root ? {"@id": getUniqueFieldId(compactPath, "constructorArgumentsObject")} : {};
                    logger.debug(`Found an identical constructor argument in other component for argument ${constructorParam.key}`);
                    let extendsAttribute = getExtendsId(similarParam.param);
                    if (extendsAttribute != null) {
                        parameter["extends"] = extendsAttribute;
                    }
                    Utils.copyContext(similarParam.field.component.componentContent, contexts);
                    return parameter;
                }
                // If the parameter is not similar to the parameter of a superclass' constructor, we search if
                // the superclass of the argument is a parameter of a superclass's constructor
                let superClass = AstUtils.getSuperClass(constructorParam.declaration.declaration);
                if (superClass != null) {

                    let superClassDeclaration = AstUtils.getDeclarationWithContext(superClass,
                        constructorParam.declaration,
                        ImportExportReader.getImportDeclarations(constructorParam.declaration.ast));
                    if(superClassDeclaration == null) {
                        logger.error("Could not find superclass declaration");
                        return;
                    }
                    similarParam = findSimilarParam(superClassDeclaration);
                    if (similarParam == null) {
                        logger.error(`We could not find a matching argument for ${superClass.className} in a superclass`);
                        return;
                    }
                    let parameter: any = root ? {"@id": getUniqueFieldId(compactPath, "constructorArgumentsObject")} : {};
                    let exportedFields = getHashFields();
                    let extendsAttribute = getExtendsId(similarParam.param);
                    if (extendsAttribute != null) {
                        parameter["extends"] = extendsAttribute;
                    }
                    parameter["fields"] = exportedFields;
                    Utils.copyContext(similarParam.field.component.componentContent, contexts);
                    return parameter;
                } else {
                    if (constructorParam.component == null) {
                        // In this case we have a hash class that doesn't extend another class
                        let parameter: any = root ? {"@id": getUniqueFieldId(compactPath, constructorParam["key"])} : {};
                        let exportedFields = getHashFields();
                        if (constructorParam.parameter.unique) {
                            parameter["fields"] = exportedFields;
                        } else {
                            parameter["elements"] = exportedFields;
                        }
                        return parameter;
                    } else {
                        // In this case our field references a component
                        let id = getUniqueFieldId(compactPath, constructorParam["key"]);
                        let parameter = {"@id": id, ...constructorParam.parameter};
                        parameters.push(parameter);
                        Utils.copyContext(constructorParam.component.componentContent, contexts);
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

    /**
     * Gets the reference to the class of a type annotation
     * If the type is an array, it will check the type of that array
     *
     * @param annotation the type annotation to look at
     * @param isArray whether this annotation is the child of an array annotation. We do this to avoid parsing
     * multi-dimensional arrays
     * @returns information about the class
     */
    private static getTypeAnnotationReference(annotation: TypeNode, isArray: boolean = false): ClassReference {
        switch (annotation.type) {
            // A regular class reference
            case AST_NODE_TYPES.TSTypeReference:
                switch (annotation.typeName.type) {
                    case AST_NODE_TYPES.TSQualifiedName:
                        // A namespace reference e.g. `q.B`
                        if (annotation.typeName.left.type === AST_NODE_TYPES.Identifier) {
                            return {
                                namespace: annotation.typeName.left.name,
                                className: annotation.typeName.right.name
                            };
                        } else {
                            logger.error(`Could not understand left type ${annotation.typeName.left.type}`);
                        }
                        return;
                    case AST_NODE_TYPES.Identifier:
                        // A normal reference e.g. `q.B`
                        return {namespace: undefined, className: annotation.typeName.name};
                    default:
                        logger.error(`Could not recognize inner name type ${annotation.typeName}`);
                        return;
                }
            case AST_NODE_TYPES.TSArrayType:
                if (isArray) {
                    logger.error(`Cannot parse nested array types`);
                    return;
                }
                return AstUtils.getTypeAnnotationReference(annotation.elementType, true);
            default:
                logger.error(`Could not recognize annotation type ${annotation.type}`);
                return;
        }
    }
}
