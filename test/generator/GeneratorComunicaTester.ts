import * as rimraf from "rimraf";
import {ComponentTester, testDirectory} from "../ComponentTester";
import * as fs from "fs"
import * as Path from "path"
import {Utils} from "../../lib/Utils";
import {Generate} from "../../lib/Generate";
import {execSync} from "child_process";

const tmpDirectory = "comunica-temp";
const tmp = Path.join(testDirectory, tmpDirectory);

export class GeneratorComunicaTester {

    /**
     * Tests the validity of the generator tool by testing it on the given NPM packages
     * @param packages the NPM packages
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
                if (!fs.existsSync(packageDir)) Utils.mkdirRecursive(packageDir);
                // Clone a specific version of NPM package based on its tarball
                execSync(`npm view ${packageName} dist.tarball | xargs curl | tar -zx -C ${packageName} --strip-components 1`, {
                    cwd: tmp,
                    stdio: "pipe"
                });
                // Install all the dependencies of the clone NPM package
                execSync("yarn install", {cwd: packageDir, stdio: "pipe"});
                for (let [className, expectedOutputFile] of Object.entries(components)) {
                    let generatedComponents = await Generate.generateComponent(packageDir, className, ".", "info");
                    ComponentTester.testComponents(generatedComponents, expectedOutputFile, packageName);
                }
            });
        }
    }
}
