const GeneralUtil = require("./lib/Utils");
const fs = require("fs");
const jsonld = require("jsonld");
const Util = require('componentsjs/lib/Util');
const Path = require("path");
const parser = require('@typescript-eslint/typescript-estree');
const program = require('commander');
const ContextParser = require('jsonld-context-parser').ContextParser;
const contextParser = new ContextParser();
const commentParse = require("comment-parser");
const xsdRangeTag = "xsd_range";
const requiredTag = "required";
const defaultTag = "default";
program
    .command("generate")
    .description("Generate a .jsonld component file for a class")
    .option('-p, --package <package>', 'The package to look in')
    .option('-c, --class-name <className>', 'The class to generate a component for')
    .action(generate);

// TODO scan command
program
    .command("scan")
    .description("SCAN TODO")
    .option('-p, --package <package>', 'The package to look in')
    .option('-c, --class-name <className>', 'The class to generate a component for')
    .action(generate);

program.parse(process.argv);


async function generate(args) {
    let directory = args.package;
    let className = args.className;
    const packagePath = Path.join(directory, 'package.json');
    if (!fs.existsSync(packagePath)) {
        console.log("Not a valid package, no package.json");
        return;
    }
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    let componentsPath = Path.join(directory, packageContent["lsd:components"]);
    if (!fs.existsSync(componentsPath)) {
        console.log("Not a valid components path");
        return;
    }
    const componentsContent = JSON.parse(fs.readFileSync(componentsPath, 'utf8'));
    let classDeclaration = GeneralUtil.getClass(directory, className);
    if (classDeclaration == null) {
        console.log("Did not find a matching function, please check the name");
        return;
    }
    let ast = classDeclaration.ast;
    let declaration = classDeclaration.declaration;

    let declarationComment = GeneralUtil.getComment(ast.comments, declaration);
    let classComment = null;
    if (declarationComment != null) {
        let parsedDeclarationComment = commentParse(declarationComment);
        let firstDeclarationComment = parsedDeclarationComment[0];
        if (firstDeclarationComment.description.length !== 0) {
            classComment = firstDeclarationComment.description;
        }
    }
    let newConfig = {};
    newConfig["@context"] = Object.keys(packageContent["lsd:contexts"]);
    newConfig["@id"] = componentsContent["@id"];
    let newComponent = {};
    let jsonContexts = Object.values(packageContent["lsd:contexts"])
        .map(file => JSON.parse(
            fs.readFileSync(Path.join(directory, file),
                'utf8')));

    const parsedContext = await contextParser.parse(jsonContexts);

    // TODO we probably want to use something different here a className
    let fullPath = componentsContent["@id"] + "/" + className;
    // TODO compaction is not working properly, check on bug in library
    let compactPath = ContextParser.compactIri(fullPath, parsedContext);
    newComponent["@id"] = compactPath;

    newComponent["@type"] = declaration.abstract ? "AbstractClass" : "Class";
    if (classComment != null) newComponent["comment"] = classComment;
    let parameters = [];
    // Analyze imports first
    let imports = GeneralUtil.getImportDeclarations(ast);
    let nodeModules = await Util.getModuleComponentPaths(directory);
    for (let property of declaration.body.body) {
        if (property.type === parser.AST_NODE_TYPES.ClassProperty) {
            let field = property.key.name;
            let fieldType = property.typeAnnotation.typeAnnotation.type;
            let isArray = fieldType === parser.AST_NODE_TYPES.TSArrayType;
            if (isArray) {
                fieldType = property.typeAnnotation.typeAnnotation.elementType.type;
                // TODO can we allow multidimensional arrays?
            }
            let comment = GeneralUtil.getComment(ast.comments, property);
            let xsdType = null;
            // TODO should argument be non-required by defaul?
            let required = false;
            let defaultValue = null;
            // Try deriving details
            let commentDescription = null;
            if (comment != null) {
                let parsedComment = commentParse(comment);
                if (parsedComment.length === 0) continue;
                // TODO check why there can be multiple comments
                let firstComment = parsedComment[0];
                if (firstComment.description.length !== 0) {
                    commentDescription = firstComment.description;
                }
                for (let tag of firstComment.tags) {
                    switch (tag.tag) {
                        case xsdRangeTag:
                            let type = tag.type;
                            if (GeneralUtil.isValidXsd(fieldType, type)) {
                                xsdType = "xsd:" + type;
                            } else {
                                console.log(`Found xsd type ${type} but could not match with ${fieldType}`);
                            }
                            break;
                        case requiredTag:
                            required = true;
                            break;
                        case defaultTag:
                            if (tag.type.length !== 0) defaultValue = tag.type;
                            break;
                        default:
                            console.log(`Could not understand tag ${tag.tag}`);
                            break;
                    }
                }
            }
            if (xsdType == null) xsdType = GeneralUtil.convertTypeToXsd(fieldType);
            if (xsdType == null) {
                // TODO this will have to be reworked when we analyze constructorArguments
                // The type is not built-in, we try go through the imports to find
                // the real name of the class because it might be imported with another name
                let reference = property.typeAnnotation.typeAnnotation.typeName;
                let exportedName = null;
                let exportedFile = null;
                for (const [file, importClasses] of Object.entries(imports)) {
                    for (let importClass of importClasses) {
                        // Qualified name e.g. `q.B`
                        if (reference.type === parser.AST_NODE_TYPES.TSQualifiedName) {
                            if (importClass.className === "*") {
                                if (importClass.importName === reference.left.name) {
                                    // Class is imported under it's own name, but through a wildcard
                                    exportedName = reference.right.name;
                                    exportedFile = file;
                                }
                            }
                        } else if (reference.type === parser.AST_NODE_TYPES.Identifier) {
                            if (importClass.importName === reference.name) {
                                // Class is not imported under its own name, we find the real name
                                exportedName = importClass.className;
                                exportedFile = file;
                            }
                        }
                    }
                }
                if (exportedName == null) {
                    if (reference.type === parser.AST_NODE_TYPES.TSQualifiedName) {
                        console.log(`Could not find exported name of ${reference.left.name + "." + reference.right.name}, using ${reference.right.name}`);
                        exportedName = reference.right.name;
                    } else if (reference.type === parser.AST_NODE_TYPES.Identifier) {
                        console.log(`Could not find exported name of ${reference.name}, using ${reference.name}`);
                        exportedName = reference.name;
                    }
                }
                let matchedComponent = null;
                let matchedComponentsFile = null;

                function searchComponent(exportedFile) {
                    for (const [pckg, pckgInfo] of Object.entries(Util.NODE_MODULES_PACKAGE_CONTENTS)) {
                        let pckgName = pckgInfo["name"];
                        if (exportedFile === null || exportedFile === pckgName) {
                            if (!("lsd:module" in pckgInfo)) continue;
                            let lsdModule = pckgInfo["lsd:module"];
                            let componentsFile = nodeModules[lsdModule];
                            let componentsContent = JSON.parse(fs.readFileSync(componentsFile, 'utf8'));
                            let blacklist = [Path.basename(componentsFile), "context.jsonld"];
                            // TODO ideally we'll look at the `import` part of the components file, but parsing these IRI's isn't trivial
                            let componentsFolder = Path.dirname(componentsFile);

                            function visitDirectory(searchFolder) {
                                const componentFiles = fs.readdirSync(searchFolder);
                                for (const componentFile of componentFiles) {
                                    if (blacklist.includes(componentFile)) continue;
                                    let filePath = Path.join(searchFolder, componentFile);
                                    if (fs.lstatSync(filePath).isDirectory()) {
                                        visitDirectory(filePath);
                                        continue;
                                    }
                                    let componentContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                                    if (!("components" in componentContent)) continue;
                                    for (let component of componentContent["components"]) {
                                        if (component["requireElement"] === exportedName) {
                                            matchedComponent = component;
                                            matchedComponentsFile = componentContent;
                                            return;
                                        }
                                    }
                                }
                            }

                            visitDirectory(componentsFolder);
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
                if (matchedComponent === null) {
                    console.log(`Skipping field '${field}' with type '${fieldType}', could not convert to xsd type or existing component`);
                    continue;
                }
                xsdType = matchedComponent["@id"];
                console.log(matchedComponentsFile);
                for (let contextFile of GeneralUtil.getArray(matchedComponentsFile, "@context")) {
                    if (!newConfig["@context"].includes(contextFile)) {
                        newConfig["@context"].push(contextFile);
                    }
                }
            }
            console.log(`Checking field '${field}' with xsd type '${xsdType}'`);
            // TODO perhaps we want a different naming strategy for fields?
            let parameterPath = compactPath + "/" + field;
            let newParameter = {
                "@id": parameterPath,
                "range": xsdType,
                "required": required,
                "unique": !isArray,
            };
            if (defaultValue != null) {
                newParameter["default"] = defaultValue;
            }
            if (commentDescription != null) {
                newParameter["comment"] = commentDescription;
            }
            parameters.push(newParameter);
        }
    }
    newComponent["parameters"] = parameters;
    newConfig["components"] = [newComponent];
    console.log(JSON.stringify(newConfig, null, 4));
}
