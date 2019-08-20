const Path = require("path");
const fs = require("fs");
const execSync = require("child_process").execSync;
const Utils = require("../lib/Utils");
const Generate = require("../lib/Generate");
const rimraf = require("rimraf");
const outputPath = "expected_output";
const tmpDirectory = "tmp";
const testDirectory = "test";

let moduleTests = {
    "@comunica/actor-query-operation-filter-sparqlee": {
        "ActorQueryOperationFilterSparqlee": "ActorQueryOperationFilterSparqlee.jsonld"
    },
    "@comunica/actor-init-hello-world": {
        "ActorInitHelloWorld": "ActorInitHelloWorld.jsonld"
    },
    "@comunica/bus-rdf-dereference": {
        "ActorRdfDereference": "ActorRdfDereference.jsonld"
    },
    "@comunica/bus-rdf-dereference-paged": {
        "ActorRdfDereferencePaged": "ActorRdfDereferencePaged.jsonld"
    },
    "@comunica/actor-query-operation-reduced-hash": {
        "ActorQueryOperationReducedHash": "ActorQueryOperationReducedHash.jsonld"
    }
};

beforeAll(() => {
    process.chdir(testDirectory);
    if (!fs.existsSync(tmpDirectory)) fs.mkdirSync(tmpDirectory);
});
afterAll(() => {
    rimraf.sync(tmpDirectory);
    process.chdir("..");
});

for (let [module, moduleOptions] of Object.entries(moduleTests)) {
    test(module, async () => {
        process.chdir(tmpDirectory);
        if (!fs.existsSync(module)) Utils.mkdirRecursive(module);
        let fileName = execSync(`npm pack ${module}`, {stdio: "pipe"}).toString().trim();
        execSync(`tar -xvzf ${fileName} -C ${module} --strip-components 1`, {stdio: "pipe"});
        fs.unlinkSync(fileName);
        execSync(`npm install`, {cwd: module, stdio: "pipe"});
        process.chdir("..");
        for (let [className, expectedOutputFile] of Object.entries(moduleOptions)) {
            let generatedComponents = await Generate.generateComponentsFile(Path.join(tmpDirectory, module), className);
            let expectedComponents = Utils.getJSON(Path.join(outputPath, module, expectedOutputFile));
            // console.log(JSON.stringify(generatedComponents));
            expect(generatedComponents["@id"]).toBe(expectedComponents["@id"]);
            expect(generatedComponents["@context"]).toIncludeSameMembers(expectedComponents["@context"]);
            expect(generatedComponents).toHaveProperty("components");
            expect(generatedComponents["components"]).toHaveLength(1);
            let generatedComponent = generatedComponents["components"][0];
            let expectedComponent = expectedComponents["components"][0];

            // We can enforce that the constructorArguments property needs to have the same order for its values
            for (let property of ["@id", "@type", "comment", "constructorArguments"]) {
                expect(generatedComponent[property]).toEqual(expectedComponent[property]);
            }
            // We can't enforce the same order on the parameters
            expect(generatedComponent["parameters"]).toIncludeSameMembers(expectedComponent["parameters"])
        }
    });
}
