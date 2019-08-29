import {Utils} from "../lib/Utils";
import * as Path from "path"

export const testDirectory = "test";
const outputPath = "expected-output";

export class ComponentTester {


    // TODO doc
    public static testComponents(generatedComponents: any, expectedOutputFile: string, pckg: string) {
        let expectedComponents = Utils.getJSON(Path.join(testDirectory, outputPath, pckg, expectedOutputFile));
        console.log(JSON.stringify(generatedComponents));
        expect(generatedComponents["@id"]).toBe(expectedComponents["@id"]);
        // @ts-ignore
        expect(generatedComponents["@context"]).toIncludeSameMembers(expectedComponents["@context"]);
        expect(generatedComponents).toHaveProperty("components");
        expect(generatedComponents["components"]).toHaveLength(1);
        let generatedComponent = generatedComponents["components"][0];
        let expectedComponent = expectedComponents["components"][0];
        // We can enforce that the constructorArguments property needs to have the same order for its values
        for (let property of ["@id", "@type", "comment", "constructorArguments", "requireElement"]) {
            expect(generatedComponent[property]).toEqual(expectedComponent[property]);
        }
        // We can't enforce the same order on the parameters
        // @ts-ignore
        expect(generatedComponent["parameters"]).toIncludeSameMembers(expectedComponent["parameters"])
    }
}
