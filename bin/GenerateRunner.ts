#!/usr/bin/env node
import * as minimist from "minimist";
import {Generate} from "../lib/Generate";

function showHelp() {
    console.error(`Generates a component file for a specific component
Usage:
  componentsjs-generate -p ./packages/my-package -c MyActor -l info -o ./components/Actor/MyActor.jsonld
  Options:
       -p <package>      # The directory of the package to look in
       -c <className>    # The class to generate a component for
       -o <outputPath>   # Write output to a specific file
       -l <level>        # The level for the logger
       --print           # Print output to standard output
       --help            # Show information about this command`);
    process.exit(1);
}

let args = minimist(process.argv.slice(2));
if (args.help || args.p == null || args.c == null) {
    showHelp();
} else {
    Generate.generateComponentFile(args.p, args.c, args.l, args.o, args.print);
}



