import {logger} from "./Core";
import * as fs from "fs";
import ComponentsJsUtil = require("componentsjs/lib/Util");
import * as Path from "path";
import {Utils} from "./Utils";
import {AstUtils} from "./AstUtils";
import {Generate} from "./Generate";
import {FixUtils} from "./FixUtils";

export class Fix {

    public static async fixComponent(directory: string, component: string, level: string): Promise<any> {
        logger.level = level;
        if (directory == null) {
            logger.error("Missing argument package");
            return;
        }
        if (component == null) {
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
        const componentPath = Path.join(directory, component);
        if (!fs.existsSync(componentPath)) {
            logger.error(`File ${componentPath} does not exist`);
            return;
        }
        let componentContent = Utils.getJSON(componentPath);
        if(!("components" in componentContent)) {
            logger.error(`No components entry in component file`);
            return;
        }
        let componentsEntry = componentContent["components"];
        componentLoop: for(let i = 0; i < componentsEntry.length; i++) {
            let componentObject = componentsEntry[i];
            const requiredAttributes = ["@id", "requireElement", "@type"];
            // Check if required attributes are set
            for(let attribute of requiredAttributes) {
                if (!(attribute in componentObject)) {
                    logger.error(`Missing attribute ${attribute} in component ${i}`);
                    continue componentLoop;
                }
            }
            const validTypes = ["Class", "AbstractClass", "Instance"];
            if(!validTypes.includes(componentObject["@type"])) {
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
                return;
            }
            let generatedComponent = await Generate.generateComponent(directory, className, level);
            componentsEntry[i] = FixUtils.additiveComponentFix(componentObject, generatedComponent["components"][0]);
        }
        return componentContent;
    }
    // TODO doc
    public static async fixComponentFile(directory: string, componentPath: string, level: string, print:boolean) {
        logger.level = level;
        let fixedComponent = await this.fixComponent(directory, componentPath, level);
        if (fixedComponent == null) {
            logger.info("Failed to generate fixed component file");
            return;
        }
        let jsonString = JSON.stringify(fixedComponent, null, 4);
        if (print) {
            // console.log(jsonString);
        } else {
            logger.info(`Writing output to ${componentPath}`);
            // fs.writeFileSync(componentPath, jsonString);
        }
    }
}
