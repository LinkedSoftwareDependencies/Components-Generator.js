import {LocalTester} from "./LocalTester";

const tests = {
    "test-package1": {
        "fix-components/Actor3Scrambled.jsonld": "Actor3Scrambled.jsonld",
        "fix-components/Actor3MissingParameter.jsonld": "Actor3MissingParameter.jsonld",
        "fix-components/Actor3AdditionalParameter.jsonld": "Actor3AdditionalParameter.jsonld"
    }

};
LocalTester.testComponents(tests);
