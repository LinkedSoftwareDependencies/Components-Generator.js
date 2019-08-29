import {logger} from "./Core";
import * as fs from "fs";
import * as Path from "path";
import {Utils} from "./Utils";
import {Fix} from "./Fix";


export class FixPackage {


    /**
     * Creates a fixed component file for all existing components in a package
     *
     * @param directory the directory of the package to look in
     * @param print whether to print to standard output, otherwise files will be overwritten
     * @param level the level for the logger
     * @returns upon completion
     */
    public static async fixPackage(directory: string, print: boolean, level: string) {
        const packagePath = Path.join(directory, "package.json");
        if (!fs.existsSync(packagePath)) {
            logger.error("Not a valid package, no package.json");
            return;
        }
        const packageContent = Utils.getJSON(packagePath);
        let componentsPath = Path.join(directory, packageContent["lsd:components"]);
        if (!fs.existsSync(componentsPath)) {
            logger.error("Not a valid components path");
            return;
        }
        let blacklist = [Path.basename(componentsPath), "context.jsonld"];
        for (let {filePath} of Utils.visitJSONLDFiles(Path.dirname(componentsPath))) {
            let baseName = Path.basename(filePath);
            if (blacklist.includes(baseName)) continue;
            let relativePath = Path.relative(directory, filePath);
            await Fix.fixComponentFile(directory, relativePath, print, level);
        }

    }
}
