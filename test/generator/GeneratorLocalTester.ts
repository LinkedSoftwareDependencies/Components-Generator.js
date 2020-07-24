/* eslint-disable import/namespace */
import { execSync } from 'child_process';
import * as Path from 'path';
import * as fs from 'fs-extra';
import * as rimraf from 'rimraf';
import * as Generate from '../../lib/Generate';
import * as ComponentTester from '../ComponentTester';
import * as LocalCore from '../LocalCore';

const tmpDirectory = 'local-generator-tmp';
const tmp = Path.join(ComponentTester.testDirectory, tmpDirectory);

/**
 * Tests the validity of the fix tool by testing it on the given local packages
 * @param packages the local packages
 */
export function testPackages(packages: { [packageName: string]: { [className: string]: string } }) {
  beforeAll(() => {
    if (!fs.existsSync(tmp)) {
      fs.mkdirSync(tmp);
    }
  });
  afterAll(() => {
    rimraf.sync(tmp);
  });
  for (const [ packageName, components ] of Object.entries(packages)) {
    describe(packageName, () => {
      const packageDir = Path.join(tmp, packageName);
      fs.copySync(Path.join(ComponentTester.testDirectory, LocalCore.testPackages, packageName), packageDir);
      execSync('npm install', { cwd: packageDir, stdio: 'pipe' });
      for (const [ className, expectedOutputFile ] of Object.entries(components)) {
        it(className, async() => {
          const generatedComponents = await Generate.generateComponent(packageDir, className, '.', 'info');
          ComponentTester.testComponents(generatedComponents, expectedOutputFile, packageName);
        });
      }
    });
  }
}
