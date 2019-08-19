#!/usr/bin/env node
const Utils = require("../lib/Utils");
const AstUtils = require("../lib/AstUtils");
const fs = require("fs");
const jsonld = require("jsonld");
const ComponentsJsUtil = require('componentsjs/lib/Util');
const Path = require("path");
const parser = require('@typescript-eslint/typescript-estree');
const ContextParser = require('jsonld-context-parser').ContextParser;
const contextParser = new ContextParser();
const commentParse = require("comment-parser");
const minimist = require('minimist');
const logger = require("../lib/Core").logger;

// TODO doc
async function generateComponentsFile(directory, className, level) {
    if(level === undefined) level = "info";
    logger.level = level;
    if(directory === undefined) {
        logger.error("Missing argument package");
        return null;
    }
    if(className === undefined) {
        logger.error("Missing argument class-name");
        return null;
    }
    const packagePath = Path.join(directory, "package.json");
    if (!fs.existsSync(packagePath)) {
        logger.error("Not a valid package, no package.json");
        return null;
    }
    const packageContent = Utils.getJSON(packagePath);
    let componentsPath = Path.join(directory, packageContent["lsd:components"]);
    if (!fs.existsSync(componentsPath)) {
        logger.error("Not a valid components path");
        return null;
    }
    const componentsContent = Utils.getJSON(componentsPath);
    let classDeclaration = AstUtils.getDeclaration(packageContent["name"], className, directory);
    if (classDeclaration === null) {
        logger.error(`Did not find a matching class for name ${className}, please check the name and make sure it has been exported`);
        return null;
    }
    let {ast, declaration} = classDeclaration;
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
    let jsonContexts = Object.values(packageContent["lsd:contexts"])
        .map(file => Path.join(directory, file))
        .map(Utils.getJSON);

    // const parsedContext = await contextParser.parse(jsonContexts);
    // TODO we probably want to use something different here as className
    let fullPath = `${componentsContent["@id"]}/${className}`;
    // TODO compaction is not working properly, check on bug in library
    // let compactPath = ContextParser.compactIri(fullPath, parsedContext);
    let compactPath = fullPath;

    let newComponent = {};
    newComponent["@id"] = compactPath;
    newComponent["@type"] = declaration.abstract ? "AbstractClass" : "Class";
    if (classComment != null) newComponent["comment"] = classComment;
    let imports = AstUtils.getImportDeclarations(ast);
    let superClassChain = AstUtils.getSuperClassChain(classDeclaration, imports, nodeModules);
    // We can use the second element in the chain for the `extends` attribute because it's the superclass
    // of the class we're checking
    if (2 <= superClassChain.length) {
        let chainElement = superClassChain[1];
        if(chainElement.component !== null) {
            newComponent["extends"] = chainElement.component.component["@id"];
            for (let contextFile of Utils.getArray(chainElement.component.componentsContent, "@context")) {
                if (!newConfig["@context"].includes(contextFile)) {
                    newConfig["@context"].push(contextFile);
                }
            }
        }
    }
    let {parameters, constructorArguments} = AstUtils.getParametersAndArguments(superClassChain, compactPath, nodeModules);
    newComponent["parameters"] = parameters;
    newComponent["constructorArguments"] = constructorArguments;
    newConfig["components"] = [newComponent];
    return newConfig;
}
module.exports = {
    generateComponentsFile: generateComponentsFile
};
