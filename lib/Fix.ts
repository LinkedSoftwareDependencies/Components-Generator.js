import {logger} from "./Core";
import * as fs from "fs";
import * as Path from "path";
import {Utils} from "./Utils";
import {AstUtils} from "./AstUtils";
import {Generate} from "./Generate";
import {FixUtils} from "./FixUtils";
import ComponentsJsUtil = require("componentsjs/lib/Util");

export class Fix {

    /** Generates a fixed component file for an existing component
     *
     * @param directory the directory of the package to look in
     * @param componentPath the the filepath to your existing .jsonld file
     * @param level the level for the logger
     * @returns upon completion
     */
    public static async fixComponent(directory: string, componentPath: string, level: string): Promise<any> {
        logger.level = level;
        if (directory == null) {
            logger.error("Missing argument package");
            return;
        }
        if (componentPath == null) {
            logger.error("Missing argument component");
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
        const packageName = packageContent["name"];
        const absoluteComponentPath = Path.join(directory, componentPath);
        if (!fs.existsSync(absoluteComponentPath)) {
            logger.error(`File ${componentPath} does not exist`);
            return;
        }
        let componentContent = Utils.getJSON(absoluteComponentPath);
        if (!("components" in componentContent)) {
            logger.error(`No components entry in component file ${componentPath}, skipping`);
            return;
        }
        let componentsEntry = componentContent["components"];
        componentLoop: for (let i = 0; i < componentsEntry.length; i++) {
            let componentObject = componentsEntry[i];
            const requiredAttributes = ["@id", "requireElement", "@type"];
            // Check if required attributes are set
            for (let attribute of requiredAttributes) {
                if (!(attribute in componentObject)) {
                    logger.error(`Missing attribute ${attribute} in component ${0} in file ${componentPath}`);
                    continue componentLoop;
                }
            }
            // Check if @type is valid
            const validTypes = ["Class", "AbstractClass", "Instance"];
            if (!validTypes.includes(componentObject["@type"])) {
                logger.error(`Attribute @type must have one of the following values: ${validTypes.join(", ")}`);
                continue;
            }
            let className = componentObject["requireElement"];
            let classDeclaration = AstUtils.getDeclaration({
                className: className,
                exportedFrom: packageName
            });
            if (classDeclaration == null) {
                logger.error(`Did not find a matching class for name ${className}, please check the name and make sure it has been exported`);
                continue;
            }
            let generatedComponent = await Generate.generateComponent(directory, className, level);
            componentsEntry[i] = FixUtils.additiveComponentFix(componentObject, generatedComponent["components"][0]);
        }
        return componentContent;
    }

    /**
     * Creates a fixed component file for an existing component
     *
     * @param directory the directory of the package to look in
     * @param componentPath the the filepath to your existing .jsonld file
     * @param print whether to print to standard output, otherwise files will be overwritten
     * @param level the level for the logger
     * @returns upon completion
     */
    public static async fixComponentFile(directory: string, componentPath: string, print: boolean, level: string) {
        logger.level = level;
        let fixedComponent = await this.fixComponent(directory, componentPath, level);
        if (fixedComponent == null) {
            logger.info(`Failed to generate fixed component file for file ${componentPath}`);
            return;
        }
        let jsonString = JSON.stringify(fixedComponent, null, 4);
        if (print) {
            console.log(jsonString);
        } else {
            logger.info(`Writing output to ${componentPath}`);
            fs.writeFileSync(componentPath, jsonString);
        }
    }
}
