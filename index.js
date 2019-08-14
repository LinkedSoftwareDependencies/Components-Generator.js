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

program.parse(process.argv);


async function generate(args) {
    let directory = args.package;
    let className = args.className;
    const packagePath = Path.join(directory, "package.json");
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
    // TODO consider clazz=true?
    let classDeclaration = AstUtils.getDeclaration(packageContent["name"], className, directory);
    if (classDeclaration === null) {
        console.log("Did not find a matching class, please check the name");
        return;
    }
    // TODO these names are confusing
    let {ast, declaration, filePath, _} = classDeclaration;
    let declarationComment = Utils.getComment(ast.comments, declaration);
    let classComment = null;
    if (declarationComment != null) {
        let parsedDeclarationComment = commentParse(declarationComment);
        if (parsedDeclarationComment.length !== 0) {
            let firstDeclarationComment = parsedDeclarationComment[0];
            if (firstDeclarationComment.description.length !== 0) {
                classComment = firstDeclarationComment.description;
            }
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

    // const parsedContext = await contextParser.parse(jsonContexts);
    // TODO we probably want to use something different here a className
    let fullPath = componentsContent["@id"] + "/" + className;
    // TODO compaction is not working properly, check on bug in library

    // let compactPath = ContextParser.compactIri(fullPath, parsedContext);
    let compactPath = fullPath;
    newComponent["@id"] = compactPath;
    newComponent["@type"] = declaration.abstract ? "AbstractClass" : "Class";


    // TODO move to ast utils and document
    let imports = AstUtils.getImportDeclarations(ast);
    if (classComment != null) newComponent["comment"] = classComment;
    let parameters = {};
    // Chain of extends
    // TODO use this for the normal @extends attribute maybe?
    let superClassChain = [];
    let previousSuperClassDeclaration = classDeclaration;
    let previousSuperClassImports = imports;
    while (previousSuperClassDeclaration !== null) {
        // Search for the next superclass here
        let constructorParams = AstUtils.getConstructorParams(previousSuperClassDeclaration, previousSuperClassImports, nodeModules);
        // We don't want to get the first component because that would be for the class that we're currently
        // creating a component for
        let superClassComponent = superClassChain.length === 0 ? null : AstUtils.getComponentByDeclaration(previousSuperClassDeclaration, nodeModules);
        superClassChain.push({
            declaration: previousSuperClassDeclaration,
            component: superClassComponent,
            constructorParams: constructorParams
        });
        // Find the next superclass
        let nextSuperClassInfo = AstUtils.getSuperClass(previousSuperClassDeclaration.declaration);
        if (nextSuperClassInfo === null) break;
        previousSuperClassDeclaration = AstUtils.getDeclarationWithContext(nextSuperClassInfo,
            previousSuperClassDeclaration, previousSuperClassImports);
        if (previousSuperClassDeclaration !== null) {
            // Do stuff with your current declaration here
            previousSuperClassImports = AstUtils.getImportDeclarations(previousSuperClassDeclaration.ast);
        }
    }
    if (2 <= superClassChain.length) {
        let chainElement = superClassChain[1];
        newComponent["extends"] = chainElement.component.component["@id"];
        for (let contextFile of Utils.getArray(chainElement.component.componentsContent, "@context")) {
            if (!newConfig["@context"].includes(contextFile)) {
                newConfig["@context"].push(contextFile);
            }
        }
    }

    function classDeclarationEquals(c1, c2) {
        return c1["pckg"] === c2["pckg"] && c1["filePath"] === c2["filePath"] && c1["internalClass"] === c2["internalClass"];
    }

    let exportedParameters = [];
    let constructorArguments = [];
    // TODO this is way to d e e p imo
    let chosenParametersName = new Set();
    function getUniqueFieldId(path, field) {
        function getId(i) {
            return path + "#" + field + (i === 0 ? "" : i);
        }
        let i = -1;
        while(chosenParametersName.has(getId(++i))) {}
        let id = getId(i);
        chosenParametersName.add(id);
        return id;
    }
    if (1 <= superClassChain.length) {
        for (let constructorParam of superClassChain[0].constructorParams) {
            if (constructorParam.type === "complex") {
                function findSimilarParam(constructorParam) {
                    for (let i = 1; i < superClassChain.length; i++) {
                        for (let x = 0; x < superClassChain[i].constructorParams.length; x++) {
                            let otherConstructorParam = superClassChain[i].constructorParams[x];
                            if (otherConstructorParam.type === "complex") {
                                // Check if same
                                if (classDeclarationEquals(constructorParam, otherConstructorParam.declaration)) {
                                    return superClassChain[i].component.component.constructorArguments[x];
                                }
                            }
                        }
                    }
                    return null;
                }
                let id = getUniqueFieldId(compactPath, "constructorArgumentsObject");
                let similarParam = findSimilarParam(constructorParam.declaration);
                if (similarParam != null) {
                    // TODO copy context!
                    console.log("Found an identical constructor argument");
                    let newParameter = {
                        "@id": id,
                    };
                    if ("@id" in similarParam) {
                        newParameter["extends"] = similarParam["@id"];
                    } else if ("extends" in similarParam) {
                        newParameter["extends"] = similarParam["extends"];
                    } else {
                        console.log("Could not find @id nor extend!")
                    }
                    constructorArguments.push(newParameter);
                    continue;
                }
                // Search extending class
                // TODO kies id
                let superClass = AstUtils.getSuperClass(constructorParam.declaration.declaration);
                if(superClass !== null) {
                    let superClassDeclaration = AstUtils.getDeclarationWithContext(superClass,
                        constructorParam.declaration,
                        AstUtils.getImportDeclarations(constructorParam.declaration.ast));
                    similarParam = findSimilarParam(superClassDeclaration);
                    console.log(similarParam);
                    if (similarParam != null) {
                    } else {
                        console.log("Error, we could not find a matching argument in a superclass");
                        continue;
                    }
                    let exportedFields = [];
                    let fieldData = AstUtils.getFields(constructorParam.declaration, nodeModules);
                    for (let field of fieldData) {
                        let fieldId = getUniqueFieldId(compactPath, field["key"]);
                        exportedFields.push({
                            "keyRaw": field["key"],
                            "value": fieldId
                        });
                        let parameter = field["parameter"];
                        // Some people might find this to be 'hacky', but it makes sure the @id key is the first one
                        parameter = {...{"@id": fieldId}, ...parameter};
                        exportedParameters.push(parameter);
                    }
                    // TODO copy context
                    let newArgument = {
                        "@id": id
                    };
                    if ("@id" in similarParam) {
                        newArgument["extends"] = similarParam["@id"];
                    } else if ("extends" in similarParam) {
                        newArgument["extends"] = similarParam["extends"];
                    } else {
                        console.log("Could not find @id nor extend!")
                    }
                    if (exportedFields.length !== 0) {
                        newArgument["fields"] = exportedFields;
                    }
                    constructorArguments.push(newArgument);
                } else {
                    // TODO copy context
                    if(constructorParam.component === null) {
                        console.log(`Found a constructor param '${constructorParam["key"]}' that isn't used in a superclass nor is it a component`);
                        continue;
                    }
                    let id = getUniqueFieldId(compactPath, constructorParam["key"]);
                    let parameter = constructorParam["parameter"];
                    parameter = {...{"@id": id}, ...parameter};
                    exportedParameters.push(parameter);
                    constructorArguments.push({
                        "@id": id
                    });
                }
            } else {
                let id = getUniqueFieldId(compactPath, constructorParam["key"]);
                let parameter = constructorParam["parameter"];
                parameter = {...{"@id": id}, ...parameter};
                exportedParameters.push(parameter);
                constructorArguments.push({
                    "@id": id
                });
            }
        }
    }
    newComponent["parameters"] = exportedParameters;
    newComponent["constructorArguments"] = constructorArguments;
    newConfig["components"] = [newComponent];
    console.log(JSON.stringify(newConfig, null, 4));
}
