import { execSync } from 'child_process';
import * as fs from 'fs';
import * as Path from 'path';
import * as rimraf from 'rimraf';
import * as Generate from '../../lib/Generate';
import * as Utils from '../../lib/Utils';
import * as ComponentTester from '../ComponentTester';

const tmpDirectory = 'comunica-temp';
const tmp = Path.join(ComponentTester.testDirectory, tmpDirectory);

/**
 * Tests the validity of the generator tool by testing it on the given NPM packages
 * @param packages the NPM packages
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
    test(packageName, async() => {
      const packageDir = Path.join(tmp, packageName);
      if (!fs.existsSync(packageDir)) {
        Utils.mkdirRecursive(packageDir);
      }
      // Clone a specific version of NPM package based on its tarball
      execSync(`npm view ${packageName} dist.tarball | xargs curl | tar -zx -C ${packageName} --strip-components 1`, {
        cwd: tmp,
        stdio: 'pipe',
      });
      // Install all the dependencies of the clone NPM package
      execSync('yarn install', { cwd: packageDir, stdio: 'pipe' });
      for (const [ className, expectedOutputFile ] of Object.entries(components)) {
        const generatedComponents = await Generate.generateComponent(packageDir, className, '.', 'info');
        ComponentTester.testComponents(generatedComponents, expectedOutputFile, packageName);
      }
    });
  }
}
