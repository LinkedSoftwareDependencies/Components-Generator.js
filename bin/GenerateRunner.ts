#!/usr/bin/env node
import * as minimist from 'minimist';
import { Generator } from '../lib/generate/Generator';
import { ResolutionContext } from '../lib/resolution/ResolutionContext';

function showHelp() {
  process.stderr.write(`Generates component file for a package
Usage:
  componentsjs-generate
  Options:
       -p <package>      # The directory of the package to look in, defaults to working directory
       -m <moduleRoot>   # Directory where we should look for dependencies, relative to the package directory, defaults to working directory
       --help            # Show information about this command
`);
  process.exit(1);
}

const args = minimist(process.argv.slice(2));
if (args.help) {
  showHelp();
} else {
  const generator = new Generator({
    resolutionContext: new ResolutionContext(),
    packageRootDirectory: args.p || process.cwd(),
    moduleRoot: args.m || process.cwd(),
    level: args.l || 'info',
  });
  generator
    .generateComponents()
    // eslint-disable-next-line no-console
    .then((components: any) => console.log(JSON.stringify(components, null, '  ')))
    .catch((error: Error) => process.stderr.write(`${error.message}\n`));
}

