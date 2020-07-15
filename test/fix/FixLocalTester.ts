import * as fs from "fs-extra";
import * as Path from "path";
import * as rimraf from "rimraf";
import {ComponentTester, testDirectory} from "../ComponentTester";
import {execSync} from "child_process";
import {Fix} from "../../lib/Fix";
import {testPackages} from "../LocalCore";

const tmpDirectory = "local-fix-tmp";
const tmp = Path.join(testDirectory, tmpDirectory);


export class FixLocalTester {
    /**
     * Tests the validity of the fix tool by testing it on the given local packages
     * @param packages the local packages
     */
    public static testPackages(packages: { [packageName: string]: { [componentFile: string]: string } }) {
        beforeAll(() => {
            if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
        });
        afterAll(() => {
            rimraf.sync(tmp);
        });
        for (let [packageName, components] of Object.entries(packages)) {
            describe(packageName, () => {
                let packageDir = Path.join(tmp, packageName);
                fs.copySync(Path.join(testDirectory, testPackages, packageName), packageDir);
                execSync("npm install", {cwd: packageDir, stdio: "pipe"});
                for (let [originalComponent, expectedComponent] of Object.entries(components)) {
                    it(originalComponent, async () => {
                        let fixedComponent = await Fix.fixComponent(packageDir, originalComponent, ".", "info");
                        ComponentTester.testComponents(fixedComponent, expectedComponent, packageName);
                    });
                }
            });
        }
    }
}
