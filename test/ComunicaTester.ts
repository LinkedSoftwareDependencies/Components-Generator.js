import * as rimraf from "rimraf";
import {ComponentTester, testDirectory} from "./ComponentTester";
import * as fs from "fs"
import * as Path from "path"
import {Utils} from "../lib/Utils";
import {Generate} from "../lib/Generate";
import {execSync} from "child_process";

const tmpDirectory = "comunica-temp";
const tmp = Path.join(testDirectory, tmpDirectory);

export class ComunicaTester {
    public static testModules(modules: any) {
        beforeAll(() => {
            if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
        });
        afterAll(() => {
            rimraf.sync(tmp);
        });
        for (let [pckg, components] of Object.entries(modules)) {
            test(pckg, async () => {
                let pckgDir = Path.join(tmp, pckg);
                if (!fs.existsSync(pckgDir)) Utils.mkdirRecursive(pckgDir);
                execSync(`npm view ${pckg} dist.tarball | xargs curl | tar -zx -C ${pckg} --strip-components 1`, {
                    cwd: tmp,
                    stdio: "pipe"
                });
                execSync(`npm install`, {cwd: pckgDir, stdio: "pipe"});
                for (let [className, expectedOutputFile] of Object.entries(components)) {
                    let generatedComponents = await Generate.generateComponent(pckgDir, className, "info");
                    ComponentTester.testComponents(generatedComponents, pckg, expectedOutputFile);
                }
            });
        }
    }
}
