#!/usr/bin/env node
import * as Path from 'path';
import * as minimist from 'minimist';
import { GeneratorFactory } from '../lib/config/GeneratorFactory';
import { ResolutionContext } from '../lib/resolution/ResolutionContext';

function showHelp(): void {
  process.stderr.write(`Generates components files for TypeScript files in a package
Usage:
  componentsjs-generator
  Arguments:
       path/to/package         The directories of the packages to look in, defaults to working directory
  Options:
       -s lib                  Relative path to directory containing source files, defaults to 'lib'
       -c components           Relative path to directory that will contain components files, defaults to 'components'
       -e jsonld               Extension for components files (without .), defaults to 'jsonld'
       -i ignore-classes.json  Relative path to an optional file with class names to ignore
       -l info                 The logger level
       -r prefix               Optional custom JSON-LD module prefix
       --debugState            If a 'componentsjs-generator-debug-state.json' file should be created with debug information
       --help                  Show information about this command
`);
  process.exit(1);
}

const args = minimist(process.argv.slice(2));

// TODO: remove in next major version
if (args.typeScopedContexts) {
  process.stderr.write(`The flag '--typeScopedContexts' must not be used anymore, as this is default behaviour as of version 3.x\n`);
  process.exit(1);
}

if (args.help) {
  showHelp();
} else {
  const packageRootDirectories = (args._.length > 0 ? args._ : [ '' ])
    .map(path => Path.posix.join(process.cwd(), path));
  new GeneratorFactory({ resolutionContext: new ResolutionContext() })
    .createGenerator(process.cwd(), args, packageRootDirectories)
    .then(generator => generator.generateComponents())
    .catch((error: Error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    });
}

