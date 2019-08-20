#!/usr/bin/env node
const minimist = require('minimist');
const Generate = require("../lib/Generate");
const Path = require("path");
const fs = require("fs");
const logger = require("../lib/Core.js").logger;

function showHelp() {
    console.error(`Usage:
  componentsjs-generator -p ./ -c MyActor -l info -o ./components/Actor/MyActor.jsonld
  Options:
       -p <package>      # The directory of the package to look in
       -c <className>    # The class to generate a component for
       -l <level>        # The level for the logger
       -o <outputPath>   # Write output to a specific file
       --print           # Print to standard output
       --help            # Show information about this command
`);
    process.exit(1);
}
let args = minimist(process.argv.slice(2));
if(args.help) {
    showHelp();
} else {
    Generate.generateComponentsFile(args.p, args.c, args.l).then(function (components) {
        if(components === null) {
            logger.info("Failed to generate components file");
            return;
        }
        let jsonString = JSON.stringify(components, null, 4);
        if(args["print"]) {
            console.log(jsonString);
        } else {
            let path = Path.join(args.p, "components", "Actor", args.c + ".jsonld");
            if(args["outputPath"] !== undefined)
                path = args["outputPath"];
            let dir = Path.dirname(path);

            // TODO Make recursive
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir);
            logger.info(`Writing output to ${path}`);
            fs.writeFileSync(path, jsonString);
        }
    });
}



