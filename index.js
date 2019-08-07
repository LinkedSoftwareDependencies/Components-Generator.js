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
    .description("Generate a component file for a class")
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
    if(declarationComment != null) {
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
    for (let property of declaration.body.body) {
        if (property.type === parser.AST_NODE_TYPES.ClassProperty) {
            let field = property.key.name;
            let fieldType = property.typeAnnotation.typeAnnotation.type;
            let isArray = fieldType === parser.AST_NODE_TYPES.TSArrayType;
            if(isArray) {
                fieldType = property.typeAnnotation.typeAnnotation.elementType.type;
                // TODO can we allow multidimensional arrays?
            }
            let comment = GeneralUtil.getComment(ast.comments, property);
            let xsdType = null;
            let required = false;
            let defaultValue = null;
            // Try deriving details
            let commentDescription = null;
            if(comment != null) {
                let parsedComment = commentParse(comment);
                if(parsedComment.length === 0) continue;
                // TODO check why there can be multiple comments
                let firstComment = parsedComment[0];
                if(firstComment.description.length !== 0) {
                    commentDescription = firstComment.description;
                }
                for (let tag of firstComment.tags) {
                    switch(tag.tag) {
                        case xsdRangeTag:
                            let type = tag.type;
                            if(GeneralUtil.isValidXsd(fieldType, type)) {
                                xsdType = "xsd:" + type;
                            } else {
                                console.log(`Found xsd type ${type} but could not match with ${fieldType}`);
                            }
                            break;
                        case requiredTag:
                            required = true;
                            break;
                        case defaultTag:
                            if(tag.type.length !== 0) defaultValue = tag.type;
                            break;
                        default:
                            console.log(`Could not understand tag ${tag.tag}`);
                            break;
                    }
                }
            }
            if(xsdType == null) xsdType = GeneralUtil.convertTypeToXsd(fieldType);
            // TODO check if xsd: is always included in the current context
            if (xsdType == null) {
                console.log(`Skipping field '${field}' with type '${fieldType}', could not convert to xsd type`);
                continue;
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
            if(defaultValue != null) {
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
