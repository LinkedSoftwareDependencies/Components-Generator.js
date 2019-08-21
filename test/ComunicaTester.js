const Path = require("path");
const Generate = require("../lib/Generate");
const Utils = require("../lib/Utils");
const ComponentTester = require("./ComponentTester");
const fs = require("fs");
const rimraf = require("rimraf");
const execSync = require("child_process").execSync;
const tmpDirectory = "comunica-temp";
const testDirectory = ComponentTester.testDirectory;
const tmp = Path.join(testDirectory, tmpDirectory);


function testModules(modules) {
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
            execSync(`npm v ${pckg} dist.tarball | xargs curl | tar -zx -C ${pckg} --strip-components 1`, {
                cwd: tmp,
                stdio: "pipe"});
            execSync(`npm install`, {cwd: pckgDir, stdio: "pipe"});
            for (let [className, expectedOutputFile] of Object.entries(components)) {
                let generatedComponents = await Generate.generateComponentsFile(pckgDir, className, "debug");
                ComponentTester.testComponents(generatedComponents, pckg, expectedOutputFile);
            }
        });
    }
}
module.exports = testModules;
