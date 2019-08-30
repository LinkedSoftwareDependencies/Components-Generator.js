import ComponentsJsUtil = require("componentsjs/lib/Util");
import commentParse = require("comment-parser");
import * as fs from "fs";
import {AstUtils} from "./AstUtils";
import * as Path from "path";
import {Utils} from "./Utils";
import {logger} from "./Core";
import {CommentUtils} from "./CommentUtils";
import {ImportExportReader} from "./ImportExportReader";

export class Generate {

    /**
     * Generates a component file for a class
     *
     * @param directory the directory of the package to look in
     * @param className the class to generate a component for
     * @param moduleRoot directory where we should look for dependencies, relative to the package directory
     * @param level the level for the logger
     * @returns the contents of the components file as an object
     */
    public static async generateComponent(directory: string, className: string, moduleRoot: string = ".", level: string = "info"): Promise<any> {
        logger.level = level;
        if (directory == null) {
            logger.error("Missing argument package");
            return;
        }
        if (className == null) {
            logger.error("Missing argument class-name");
            return;
        }
        if (!fs.existsSync(directory)) {
            logger.error("Not a valid package, directory does not exist");
            return;
        }
        const packagePath = Path.join(directory, "package.json");
        if (!fs.existsSync(packagePath)) {
            logger.error("Not a valid package, no package.json");
            return;
        }
        const modulesPath = Path.join(directory, moduleRoot);
        if (!fs.existsSync(modulesPath)) {
            logger.error(`Modules path ${modulesPath} does not exist`);
            return;
        }
        // Analyze imports first, otherwise we can't access package information
        let nodeModules = await ComponentsJsUtil.getModuleComponentPaths(modulesPath);
        logger.debug(`Loaded ${nodeModules.length} node modules`);
        const packageContent = Utils.getJSON(packagePath);
        const packageName = packageContent["name"];
        if (!("lsd:components" in packageContent)) {
            logger.error("package.json doesn't contain lsd:components");
            return;
        }
        let componentsPath = Path.join(directory, packageContent["lsd:components"]);
        if (!fs.existsSync(componentsPath)) {
            logger.error("Not a valid components path");
            return;
        }
        const componentsContent = Utils.getJSON(componentsPath);
        let classDeclaration = AstUtils.getDeclaration({
            className: className,
            exportedFrom: packageName
        });
        if (classDeclaration == null) {
            logger.error(`Did not find a matching class for name ${className}, please check the name and make sure it has been exported`);
            return;
        }
        let ast = classDeclaration.ast;
        let declaration = classDeclaration.declaration;
        let declarationComment = CommentUtils.getComment(ast.comments, declaration);
        let classComment;
        if (declarationComment != null) {
            let parsedDeclarationComment = commentParse(declarationComment)[0];
            if (parsedDeclarationComment != null && parsedDeclarationComment.description.length !== 0) {
                classComment = parsedDeclarationComment.description;
            }
        }
        let newConfig: any = {};
        if ("lsd:contexts" in packageContent) {
            newConfig["@context"] = Object.keys(packageContent["lsd:contexts"]);
        } else {
            newConfig["@context"] = [];
        }
        newConfig["@id"] = componentsContent["@id"];

        let compactPath = `${componentsContent["@id"]}/${className}`;
        let newComponent: any = {};
        newComponent["@id"] = compactPath;
        newComponent["requireElement"] = className;
        newComponent["@type"] = declaration.abstract ? "AbstractClass" : "Class";
        if (classComment != null) newComponent["comment"] = classComment;
        let imports = ImportExportReader.getImportDeclarations(ast);
        let superClassChain = AstUtils.getSuperClassChain(classDeclaration, imports, nodeModules);
        // We can use the second element in the chain for the `extends` attribute because it's the superclass
        // of the class we're checking
        if (2 <= superClassChain.length) {
            let chainElement = superClassChain[1];
            if (chainElement.component != null) {
                newComponent["extends"] = chainElement.component.component["@id"];
                for (let contextFile of Utils.getArray(chainElement.component.componentContent, "@context")) {
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
     * Creates a component file for a class
     *
     * @param directory the directory of the package to look in
     * @param className the class to generate a component for
     * @param outputPath write output to a specific file
     * @param moduleRoot directory where we should look for dependencies, relative to the package directory
     * @param print whether to print to standard output
     * @param level the level for the logger
     * @returns upon completion
     */
    public static async generateComponentFile(directory: string, className: string, outputPath: string, moduleRoot:string=".", print: boolean, level: string = "info") {
        logger.level = level;
        let component = await this.generateComponent(directory, className, moduleRoot, level);
        if (component == null) {
            logger.info("Failed to generate component file");
            return;
        }
        let jsonString = JSON.stringify(component, null, 4);
        if (print) {
            console.log(jsonString);
        } else {
            let path = Path.join(directory, "components", "Actor", className + ".jsonld");
            if (outputPath != null)
                path = outputPath;
            let dir = Path.dirname(path);
            if (!fs.existsSync(dir))
                Utils.mkdirRecursive(dir);
            logger.info(`Writing output to ${path}`);
            fs.writeFileSync(path, jsonString);
        }
    }
}
