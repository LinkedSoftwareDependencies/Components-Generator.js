import {logger} from "./Core";
import * as fs from "fs";
import ComponentsJsUtil = require("componentsjs/lib/Util");
import * as Path from "path";
import {Utils} from "./Utils";
import {AstUtils} from "./AstUtils";
import {Generate} from "./Generate";
import {FixUtils} from "./FixUtils";
import {Fix} from "./Fix";

export class FixPackage {

    /**
     * A simple tool for using the fix-tool on an entire package
     */
    // TODO doc
    public static async fixPackage(directory: string, level: string, print:boolean) {
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
            await Fix.fixComponentFile(directory, relativePath, level, print);
        }

    }
}
