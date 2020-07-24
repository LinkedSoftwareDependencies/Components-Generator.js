#!/usr/bin/env node
import * as minimist from 'minimist';
import * as FixPackage from '../lib/FixPackage';

function showHelp(): void {
  process.stderr.write(`Enhances all existing .jsonld files in a package and gives feedback about possible misconfigurations
Usage:
  componentsjs-fixpackage -p ./packages/my-package -l info
  Options:
       -p <package>      # The directory of the package to look in
       -l <level>        # The level for the logger
       -m <moduleRoot>   # Directory where we should look for dependencies, relative to the package directory
       --print           # Print output to standard output
       --help            # Show information about this command
`);
  process.exit(1);
}

const args = minimist(process.argv.slice(2));
if (args.help || !args.p) {
  showHelp();
} else {
  FixPackage.fixPackage(args.p, args.m, args.print, args.l)
    .catch(error => process.stderr.write(`${error.message}\n`));
}

