import * as fs from "fs-extra";
import * as Path from "path";
import * as rimraf from "rimraf";
import {Generate} from "../../lib/Generate"
import {ComponentTester, testDirectory} from "../ComponentTester";
import {execSync} from "child_process";
import {testPackages} from "../LocalCore";

const tmpDirectory = "local-generator-tmp";
const tmp = Path.join(testDirectory, tmpDirectory);


export class GeneratorLocalTester {

    /**
     * Tests the validity of the fix tool by testing it on the given local packages
     * @param packages the local packages
     */
    public static testPackages(packages: { [packageName: string]: { [className: string]: string } }) {
        beforeAll(() => {
            if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
        });
        afterAll(() => {
            rimraf.sync(tmp);
        });
        for (let [packageName, components] of Object.entries(packages)) {
            test(packageName, async () => {
                let packageDir = Path.join(tmp, packageName);
                fs.copySync(Path.join(testDirectory, testPackages, packageName), packageDir);
                execSync("npm install", {cwd: packageDir, stdio: "pipe"});
                for (let [className, expectedOutputFile] of Object.entries(components)) {
                    let generatedComponents = await Generate.generateComponent(packageDir, className, ".","info");
                    ComponentTester.testComponents(generatedComponents, expectedOutputFile, packageName);
                }
            });
        }
    }
}
