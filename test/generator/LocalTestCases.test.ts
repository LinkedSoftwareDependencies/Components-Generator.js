import {LocalTester} from "./LocalTester";

// TODO doc
const tests = {
    "test-package1": {
        "Actor3": "Actor3.jsonld",
        "Actor2Alt": "Actor2.jsonld",
        "Actor1": "Actor1.jsonld"
    }

};
LocalTester.testComponents(tests);
