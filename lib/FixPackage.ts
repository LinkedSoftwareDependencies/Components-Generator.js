import * as fs from 'fs';
import * as Path from 'path';
import { logger } from './Core';
import * as Fix from './Fix';
import * as Utils from './Utils';

/**
 * Creates a fixed component file for all existing components in a package
 *
 * @param directory the directory of the package to look in
 * @param moduleRoot directory where we should look for dependencies, relative to the package directory
 * @param print whether to print to standard output, otherwise files will be overwritten
 * @param level the level for the logger
 * @returns upon completion
 */
export async function fixPackage(directory: string, moduleRoot = '.', print = false, level = 'info') {
  const packagePath = Path.join(directory, 'package.json');
  if (!fs.existsSync(packagePath)) {
    logger.error('Not a valid package, no package.json');
    return;
  }
  const packageContent = Utils.getJSON(packagePath);
  if (!('lsd:components' in packageContent)) {
    logger.error('package.json doesn\'t contain lsd:components');
    return;
  }
  const componentsPath = Path.join(directory, packageContent['lsd:components']);
  if (!fs.existsSync(componentsPath)) {
    logger.error('Not a valid components path');
    return;
  }
  const blacklist = [ Path.basename(componentsPath), 'context.jsonld' ];
  for (const { filePath } of Utils.visitJSONLDFiles(Path.dirname(componentsPath))) {
    const baseName = Path.basename(filePath);
    if (blacklist.includes(baseName)) {
      continue;
    }
    const relativePath = Path.relative(directory, filePath);
    await Fix.fixComponentFile(directory, relativePath, moduleRoot, print, level);
  }
}
