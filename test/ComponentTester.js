const Path = require("path");
const outputPath = "expected-output";
const fs = require("fs");
const Utils = require("../lib/Utils");
const testDirectory = "test";

function testComponents(generatedComponents, pckg, expectedOutputFile) {
    let expectedComponents = Utils.getJSON(Path.join(testDirectory, outputPath, pckg, expectedOutputFile));
    console.log(JSON.stringify(generatedComponents));
    expect(generatedComponents["@id"]).toBe(expectedComponents["@id"]);
    expect(generatedComponents["@context"]).toIncludeSameMembers(expectedComponents["@context"]);
    expect(generatedComponents).toHaveProperty("components");
    expect(generatedComponents["components"]).toHaveLength(1);
    let generatedComponent = generatedComponents["components"][0];
    let expectedComponent = expectedComponents["components"][0];
    // We can enforce that the constructorArguments property needs to have the same order for its values
    for (let property of ["@id", "@type", "comment", "constructorArguments","requireElement"]) {
        expect(generatedComponent[property]).toEqual(expectedComponent[property]);
    }
    // We can't enforce the same order on the parameters
    expect(generatedComponent["parameters"]).toIncludeSameMembers(expectedComponent["parameters"])
}

module.exports = {
    testComponents: testComponents,
    testDirectory: testDirectory
};
