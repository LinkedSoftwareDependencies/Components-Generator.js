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

/**
 * Generates a components file for a class
 * @param directory the directory of the package to look in
 * @param className the class to generate a component for
 * @param level the level for the logger
 * @returns {Promise<Object>} the contents of the components file as an object
 */
async function generateComponents(directory, className, level = "info") {
    if (level === undefined) level = "info";
    logger.level = level;
    if (directory === undefined) {
        logger.error("Missing argument package");
        return null;
    }
    if (className === undefined) {
        logger.error("Missing argument class-name");
        return null;
    }
    // Analyze imports first, otherwise we can't access package information
    let nodeModules = await ComponentsJsUtil.getModuleComponentPaths(directory);
    const packagePath = Path.join(directory, "package.json");
    if (!fs.existsSync(packagePath)) {
        logger.error("Not a valid package, no package.json");
        return null;
    }
    const packageContent = Utils.getJSON(packagePath);
    const pckg = packageContent["name"];
    let componentsPath = Path.join(directory, packageContent["lsd:components"]);
    if (!fs.existsSync(componentsPath)) {
        logger.error("Not a valid components path");
        return null;
    }
    const componentsContent = Utils.getJSON(componentsPath);
    const classInfo = {pckg: pckg, exportedName: className};
    let classDeclaration = AstUtils.getDeclaration(classInfo);
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
    let newConfig = {};
    if (!("lsd:contexts" in packageContent)) {
        logger.error(`Package.json did not include lsd:contexts field`);
        return null;
    }
    newConfig["@context"] = Object.keys(packageContent["lsd:contexts"]);
    newConfig["@id"] = componentsContent["@id"];

    let compactPath = `${componentsContent["@id"]}/${className}`;
    let newComponent = {};
    newComponent["@id"] = compactPath;
    newComponent["requireElement"] = className;
    newComponent["@type"] = declaration.abstract ? "AbstractClass" : "Class";
    if (classComment != null) newComponent["comment"] = classComment;
    let imports = AstUtils.getImportDeclarations(ast);
    let superClassChain = AstUtils.getSuperClassChain(classDeclaration, imports, nodeModules, directory);
    // We can use the second element in the chain for the `extends` attribute because it's the superclass
    // of the class we're checking
    if (2 <= superClassChain.length) {
        let chainElement = superClassChain[1];
        if (chainElement.component !== null) {
            newComponent["extends"] = chainElement.component.component["@id"];
            for (let contextFile of Utils.getArray(chainElement.component.componentsContent, "@context")) {
                if (!newConfig["@context"].includes(contextFile)) {
                    newConfig["@context"].push(contextFile);
                }
            }
        }
    }
    let {contexts, parameters, constructorArguments} = AstUtils.getParametersAndArguments(superClassChain, compactPath, nodeModules);
    for (let contextFile of contexts) {
        if (!newConfig["@context"].includes(contextFile)) {
            newConfig["@context"].push(contextFile);
        }
    }
    newComponent["parameters"] = parameters;
    newComponent["constructorArguments"] = constructorArguments;
    newConfig["components"] = [newComponent];
    return newConfig;
}

/**
 * Creates a components file for a class
 * @param directory The directory of the package to look in
 * @param className The class to generate a component for
 * @param level The level for the logger
 * @param print Whether to print to standard output
 * @param outputPath Write output to a specific file
 * @returns {Promise<void>} upon completion
 */
async function generateComponentsFile(directory, className, level, print, outputPath) {
    let components = await generateComponents(directory, className, level);
    if (components === null) {
        logger.info("Failed to generate components file");
        return;
    }
    let jsonString = JSON.stringify(components, null, 4);
    if (print) {
        console.log(jsonString);
    } else {
        let path = Path.join(directory, "components", "Actor", className + ".jsonld");
        if (outputPath !== undefined)
            path = outputPath;
        let dir = Path.dirname(path);

        if (!fs.existsSync(dir))
            fs.mkdirRecursive(dir);
        logger.info(`Writing output to ${path}`);
        fs.writeFileSync(path, jsonString);
    }
}

module.exports = {
    generateComponents: generateComponents,
    generateComponentsFile: generateComponentsFile
};
