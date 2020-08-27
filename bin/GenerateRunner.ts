#!/usr/bin/env node
import * as minimist from 'minimist';
import { Generator } from '../lib/generate/Generator';
import { ResolutionContext } from '../lib/resolution/ResolutionContext';

function showHelp() {
  process.stderr.write(`Generates components files for TypeScript files in a package
Usage:
  componentsjs-generator
  Options:
       -p path/to/package   The directory of the package to look in, defaults to working directory
       -s lib               Relative path to directory containing source files, defaults to 'lib'
       -c components        Relative path to directory that will contain components files, defaults to 'components'
       -e jsonld            Extension for components files (without .), defaults to 'jsonld'
       --help               Show information about this command
`);
  process.exit(1);
}

const args = minimist(process.argv.slice(2));
if (args.help) {
  showHelp();
} else {
  const generator = new Generator({
    resolutionContext: new ResolutionContext(),
    pathDestination: {
      packageRootDirectory: args.p || process.cwd(),
      originalPath: args.s || 'lib',
      replacementPath: args.c || 'components',
    },
    fileExtension: args.e || 'jsonld',
    level: args.l || 'info',
  });
  generator
    .generateComponents()
    .catch((error: Error) => process.stderr.write(`${error.message}\n`));
}

