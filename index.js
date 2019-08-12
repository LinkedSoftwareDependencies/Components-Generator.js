const Utils = require("./lib/Utils");
const AstUtils = require("./lib/AstUtils");
const fs = require("fs");
const jsonld = require("jsonld");
const ComponentsJsUtil = require('componentsjs/lib/Util');
const Path = require("path");
const parser = require('@typescript-eslint/typescript-estree');
const program = require('commander');
const ContextParser = require('jsonld-context-parser').ContextParser;
const contextParser = new ContextParser();
const commentParse = require("comment-parser");

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
    const packageContent = Utils.getJSON(packagePath);
    let componentsPath = Path.join(directory, packageContent["lsd:components"]);
    if (!fs.existsSync(componentsPath)) {
        console.log("Not a valid components path");
        return;
    }
    const componentsContent = Utils.getJSON(componentsPath);
    let classDeclaration = AstUtils.getClass(directory, className);
    if (classDeclaration === null) {
        console.log("Did not find a matching class, please check the name");
        return;
    }
    let {ast, declaration, filePath} = classDeclaration;
    let declarationComment = Utils.getComment(ast.comments, declaration);
    let classComment = null;
    if (declarationComment != null) {
        let parsedDeclarationComment = commentParse(declarationComment);
        let firstDeclarationComment = parsedDeclarationComment[0];
        if (firstDeclarationComment.description.length !== 0) {
            classComment = firstDeclarationComment.description;
        }
    }
    // Analyze imports first, otherwise we can't access package information
    let nodeModules = await ComponentsJsUtil.getModuleComponentPaths(directory);

    let newConfig = {};
    newConfig["@context"] = Object.keys(packageContent["lsd:contexts"]);
    newConfig["@id"] = componentsContent["@id"];
    let newComponent = {};
    let jsonContexts = Object.values(packageContent["lsd:contexts"])
        .map(file => Path.join(directory, file))
        .map(Utils.getJSON);

    const parsedContext = await contextParser.parse(jsonContexts);

    // TODO we probably want to use something different here a className
    let fullPath = componentsContent["@id"] + "/" + className;
    // TODO compaction is not working properly, check on bug in library
    let compactPath = ContextParser.compactIri(fullPath, parsedContext);
    newComponent["@id"] = compactPath;
    newComponent["@type"] = declaration.abstract ? "AbstractClass" : "Class";

    // TODO move to ast utils and document
    let imports = AstUtils.getImportDeclarations(ast);
    // Resolve superClass and add it to the extends attribute
    let superClass = AstUtils.getSuperClass(declaration);
    if (superClass !== null) {
        let superClassInformation = AstUtils.getComponent(superClass, imports, nodeModules, directory, filePath);
        if (superClassInformation !== null) {
            newComponent["extends"] = superClassInformation.component["@id"];
            for (let contextFile of Utils.getArray(superClassInformation.componentsContent, "@context")) {
                if (!newConfig["@context"].includes(contextFile)) {
                    newConfig["@context"].push(contextFile);
                }
            }
        }
    }

    if (classComment != null) newComponent["comment"] = classComment;
    let parameters = [];
    for (let property of declaration.body.body) {
        if (property.type === parser.AST_NODE_TYPES.ClassProperty) {
            let field = property.key.name;
            let fieldType = property.typeAnnotation.typeAnnotation.type;
            let isArray = fieldType === parser.AST_NODE_TYPES.TSArrayType;
            if (isArray) {
                fieldType = property.typeAnnotation.typeAnnotation.elementType.type;
                // TODO can we allow multidimensional arrays?
            }
            let comment = Utils.getComment(ast.comments, property);
            let {range, required, defaultValue, commentDescription} = Utils.parseFieldComment(comment, fieldType);
            if (range == null) range = Utils.convertTypeToXsd(fieldType);
            if (range == null) {
                let fieldClassInformation = AstUtils.getFieldClass(property);
                let fieldInformation = AstUtils.getComponent(fieldClassInformation, imports, nodeModules, directory, filePath);
                if (fieldInformation !== null) {
                    range = fieldInformation.component["@id"];
                    for (let contextFile of Utils.getArray(fieldInformation.componentsContent, "@context")) {
                        if (!newConfig["@context"].includes(contextFile)) {
                            newConfig["@context"].push(contextFile);
                        }
                    }
                }
            }
            // TODO perhaps we want a different naming strategy for fields?
            let parameterPath = compactPath + "/" + field;
            let newParameter = {
                "@id": parameterPath,
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
            parameters.push(newParameter);
        }
    }
    newComponent["parameters"] = parameters;
    newConfig["components"] = [newComponent];
    console.log(JSON.stringify(newConfig, null, 4));
}
