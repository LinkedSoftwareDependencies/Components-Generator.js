import * as GeneratorLocalTester from './GeneratorLocalTester';

/**
 * Local test cases to test the generator tool
 * Uses a per-package mapping of exported class name to file to expected result
 */
const tests: { [packageName: string]: { [className: string]: string } } = {
  'test-package1': {
    Actor3: 'Actor3.jsonld',
    Actor2Alt: 'Actor2.jsonld',
    Actor1: 'Actor1.jsonld',
  },

};
GeneratorLocalTester.testPackages(tests);
