#!/usr/bin/env node
import * as minimist from 'minimist';
import * as Fix from '../lib/Fix';

function showHelp() {
  process.stderr.write(`Enhances an existing .jsonld file and gives feedback about possible misconfigurations
Usage:
  componentsjs-fix -p ./packages/my-package -c components/MyActor.jsonld -l info
  Options:
       -p <package>      # The directory of the package to look in
       -c <component>    # The path to the existing component file, relative to package root
       -l <level>        # The level for the logger
       -m <moduleRoot>   # Directory where we should look for dependencies, relative to the package directory
       --print           # Print output to standard output
       --help            # Show information about this command
`);
  process.exit(1);
}

const args = minimist(process.argv.slice(2));
if (args.help || !args.p || !args.c) {
  showHelp();
} else {
  Fix.fixComponentFile(args.p, args.c, args.m, args.print, args.l)
    .catch(error => process.stderr.write(`${error.message}\n`));
}

