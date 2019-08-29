import * as fs from "fs-extra";
import * as Path from "path";
import * as rimraf from "rimraf";
import {Generate} from "../../lib/Generate"
import {ComponentTester, testDirectory} from "../ComponentTester";
import {execSync} from "child_process";
import {testPackages} from "../LocalCore";

const tmpDirectory = "local-generator-tmp";
const tmp = Path.join(testDirectory, tmpDirectory);


export class LocalTester {
    public static testComponents(modules: any) {
        beforeAll(() => {
            if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
        });
        afterAll(() => {
            rimraf.sync(tmp);
        });
        for (let [pckg, components] of Object.entries(modules)) {
            test(pckg, async () => {
                let pckgDir = Path.join(tmp, pckg);
                fs.copySync(Path.join(testDirectory, testPackages, pckg), pckgDir);
                execSync("npm install", {cwd: pckgDir, stdio: "pipe"});
                for (let [className, expectedOutputFile] of Object.entries(components)) {
                    let generatedComponents = await Generate.generateComponent(pckgDir, className, "info");
                    ComponentTester.testComponents(generatedComponents, expectedOutputFile, pckg);
                }
            });
        }
    }
}