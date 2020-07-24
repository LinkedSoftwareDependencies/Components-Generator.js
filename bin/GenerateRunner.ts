#!/usr/bin/env node
import * as minimist from 'minimist';
import * as Generate from '../lib/Generate';

function showHelp() {
  process.stderr.write(`Generates a component file for a specific component
Usage:
  componentsjs-generate -p ./packages/my-package -c MyActor -l info -o ./components/Actor/MyActor.jsonld
  Options:
       -p <package>      # The directory of the package to look in
       -c <className>    # The class to generate a component for
       -o <outputPath>   # Write output to a specific file
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
  Generate.generateComponentFile(args.p, args.c, args.o, args.m, args.print, args.l)
    .catch(error => process.stderr.write(`${error.message}\n`));
}

