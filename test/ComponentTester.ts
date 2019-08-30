import {Utils} from "../lib/Utils";
import * as Path from "path"

export const testDirectory = "test";
const outputPath = "expected-output";

export class ComponentTester {


    /**
     * Tests whether a generated component matches the expected output
     *
     * @param generatedComponentsContent the content of the generated component file
     * @param expectedOutputFile the filepath to the expected output
     * @param packageName the name of the package of the component
     */
    public static testComponents(generatedComponentsContent: any, expectedOutputFile: string, packageName: string) {
        expect(generatedComponentsContent).not.toBeNull();
        expect(generatedComponentsContent).not.toBeUndefined();
        let expectedComponents = Utils.getJSON(Path.join(testDirectory, outputPath, packageName, expectedOutputFile));
        expect(generatedComponentsContent["@id"]).toBe(expectedComponents["@id"]);
        // @ts-ignore
        expect(generatedComponentsContent["@context"]).toIncludeSameMembers(expectedComponents["@context"]);
        expect(generatedComponentsContent).toHaveProperty("components");
        expect(generatedComponentsContent["components"]).toHaveLength(1);
        let generatedComponent = generatedComponentsContent["components"][0];
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
