import {FixLocalTester} from "./FixLocalTester";

/**
 * Local test cases to test the fix tool
 * Uses a per-package mapping of component file to expected result
 */
const tests: { [packageName: string]: { [componentFile: string]: string } } = {
    "test-package1": {
        "fix-components/Actor3Scrambled.jsonld": "Actor3Scrambled.jsonld",
        "fix-components/Actor3MissingParameter.jsonld": "Actor3MissingParameter.jsonld",
        "fix-components/Actor3AdditionalParameter.jsonld": "Actor3AdditionalParameter.jsonld"
    }

};
FixLocalTester.testPackages(tests);
