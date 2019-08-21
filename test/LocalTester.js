const rimraf = require("rimraf");
const ComponentTester = require("./ComponentTester");
const Path = require("path");
const fs = require('fs-extra');
const Generate = require("../lib/Generate");
const execSync = require("child_process").execSync;

const tmpDirectory = "local-tmp";
const testDirectory = ComponentTester.testDirectory;
const tmp = Path.join(testDirectory, tmpDirectory);

const testPackages = "test-packages";


function testComponents(modules) {
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
            execSync(`npm install`, {cwd: pckgDir, stdio: "pipe"});
            for (let [className, expectedOutputFile] of Object.entries(components)) {
                let generatedComponents = await Generate.generateComponents(pckgDir, className, "debug");
                ComponentTester.testComponents(generatedComponents, pckg, expectedOutputFile);
            }
        });
    }
}
module.exports = testComponents;
