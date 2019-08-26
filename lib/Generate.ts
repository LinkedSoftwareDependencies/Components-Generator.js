import ComponentsJsUtil = require("componentsjs/lib/Util");
import * as fs from "fs";
import {AstUtils} from "./AstUtils";
import * as Path from "path";
import {Utils} from "./Utils";
import commentParse = require("comment-parser");
import {logger} from "./Core";

// const Utils = require("./Utils");
// const AstUtils = require("./AstUtils");
// const fs = require("fs");
// const jsonld = require("jsonld");
// const Path = require("path");
// const parser = require('@typescript-eslint/typescript-estree');
// const ContextParser = require('jsonld-context-parser').ContextParser;
// const contextParser = new ContextParser();
// const commentParse = require("comment-parser");
// const minimist = require('minimist');
// const logger = require("./Core").logger;

export class Generate {

    /**
     * Generates a components file for a class
     * @param directory the directory of the package to look in
     * @param className the class to generate a component for
     * @param level the level for the logger
     * @returns the contents of the components file as an object
     */
    public static async generateComponents(directory: string, className: string, level: string = "info"): Promise<Object> {
        if (level === null) level = "info";
        logger.level = level;
        if (directory === undefined) {
            logger.error("Missing argument package");
            return;
        }
        if (className === undefined) {
            logger.error("Missing argument class-name");
            return;
        }
        // Analyze imports first, otherwise we can't access package information
        let nodeModules = await ComponentsJsUtil.getModuleComponentPaths(directory);
        const packagePath = Path.join(directory, "package.json");
        if (!fs.existsSync(packagePath)) {
            logger.error("Not a valid package, no package.json");
            return;
        }
        const packageContent = Utils.getJSON(packagePath);
        const pckg = packageContent["name"];
        let componentsPath = Path.join(directory, packageContent["lsd:components"]);
        if (!fs.existsSync(componentsPath)) {
            logger.error("Not a valid components path");
            return;
        }
        const componentsContent = Utils.getJSON(componentsPath);
        let classDeclaration = AstUtils.getDeclaration({
            className: className,
            exportedFrom: pckg
        });
        if (classDeclaration === undefined) {
            logger.error(`Did not find a matching class for name ${className}, please check the name and make sure it has been exported`);
            return;
        }
        let ast = classDeclaration.ast;
        let declaration = classDeclaration.declaration;
        let declarationComment = Utils.getComment(ast.comments, declaration);
        let classComment;
        if (declarationComment !== undefined) {
            let parsedDeclarationComment = commentParse(declarationComment);
            let firstDeclarationComment = parsedDeclarationComment[0];
            if (firstDeclarationComment.description.length !== 0) {
                classComment = firstDeclarationComment.description;
            }
        }
        let newConfig: any = {};
        if (!("lsd:contexts" in packageContent)) {
            logger.error(`Package.json did not include lsd:contexts field`);
            return;
        }
        newConfig["@context"] = Object.keys(packageContent["lsd:contexts"]);
        newConfig["@id"] = componentsContent["@id"];

        let compactPath = `${componentsContent["@id"]}/${className}`;
        let newComponent: any = {};
        newComponent["@id"] = compactPath;
        newComponent["requireElement"] = className;
        // @ts-ignore
        newComponent["@type"] = declaration.abstract ? "AbstractClass" : "Class";
        if (classComment !== undefined) newComponent["comment"] = classComment;
        let imports = AstUtils.getImportDeclarations(ast);
        let superClassChain = AstUtils.getSuperClassChain(classDeclaration, imports, nodeModules);
        // We can use the second element in the chain for the `extends` attribute because it's the superclass
        // of the class we're checking
        if (2 <= superClassChain.length) {
            let chainElement = superClassChain[1];
            if (chainElement.component !== undefined) {
                // @ts-ignore
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
    public static async generateComponentsFile(directory: string, className: string, level: string, print:boolean, outputPath:string) {
        let components = await this.generateComponents(directory, className, level);
        if (components === undefined) {
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
                Utils.mkdirRecursive(dir);
            logger.info(`Writing output to ${path}`);
            fs.writeFileSync(path, jsonString);
        }
    }
}
