const GenerateUtil = require("./lib/Utils");
const fs = require("fs");
const jsonld = require("jsonld");
const Util = require('componentsjs/lib/Util');
const Path = require("path");
const parser = require('@typescript-eslint/typescript-estree');
const program = require('commander');

program
    .command("generate")
    .description("Generate a component file for a class")
    .option('-p, --package <package>', 'The package to look in')
    .option('-c, --class-name <className>', 'The class to generate a component for')
    .action(generate);

// TODO scan command
program
    .command("scan")
    .description("SCAN TODO")
    .option('-p, --package <package>', 'The package to look in')
    .option('-c, --class-name <className>', 'The class to generate a component for')
    .action(generate);

program.parse(process.argv);


async function generate(args) {
    let directory = args.package;
    let className = args.className;
    const packagePath = Path.join(directory, 'package.json');
    if (!fs.existsSync(packagePath)) {
        console.log("Not a valid package, no package.json")
        return;
    }
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    let componentsPath = Path.join(directory, packageContent["lsd:components"]);
    if (!fs.existsSync(componentsPath)) {
        console.log("Not a valid components path")
        return;
    }
    const componentsContent = JSON.parse(fs.readFileSync(componentsPath, 'utf8'));
    let classDeclaration = GenerateUtil.getClass(directory, className);
    if(classDeclaration == null) {
        console.log("Did not find a matching function, please check the name")
        return;
    }
    let declaration = classDeclaration.declaration;
    let declarationComment = classDeclaration.comment;
    let newComponent = {};
    newComponent["@context"] = Object.keys(packageContent["lsd:contexts"]);
    newComponent["@id"] = componentsContent["@id"];
    console.log(JSON.stringify(newComponent, null, 4));


}

// // TODO find way to 'scan' package
// // TODO we probably don't want to use filenames here
// async function scan(inputFile, outputFile) {
//     const parser = new tsparser.TypescriptParser();
//     const parsed = await parser.parseFile(inputFile);
//     const rawOutput = fs.readFileSync(outputFile, 'utf8');
//     let output = JSON.parse(rawOutput);
//     // TODO handle this better
//     const compactedOutput = await jsonld.compact(output, []);
//     let id = compactedOutput["@id"];
//     let matchedParameters = [];
//     for(let declaration of parsed.declarations) {
//         // We're in the main class
//         // TODO check edge cases
//         if(declaration instanceof tsparser.ClassDeclaration) {
//             console.log(declaration);
//             for(let property of declaration.properties) {
//                 if(property instanceof tsparser.PropertyDeclaration) {
//                     let matched = null;
//                     for(let component of getArray(compactedOutput, "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#component")) {
//                         for(let parameter of getArray(component, "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#parameter")) {
//                             if(parameter["@id"] === (id + "/" + property.name)) {
//                                 let parameterRange = parameter["http://www.w3.org/2000/01/rdf-schema#range"]["@id"];
//                                 let rdfField = convertFromType(property.type);
//                                 if(parameterRange === rdfField) {
//                                     matched = parameter;
//                                     break
//                                 } else {
//                                     console.log(`❌ Could not match configured type '${parameterRange}' with actual type '${property.type}' on field '${property.name}', skipping`);
//                                 }
//                             }
//                         }
//                     }
//                     if(matched === null) {
//                         console.log(`❌ Field '${property.name}' did not match any configured parameter`);
//                     } else {
//                         console.log(`✓ Matched field '${property.name}'`);
//                         matchedParameters.push(paramater);
//                     }
//                 }
//             }
//             // TODO test class without parameter
//             for(let parameter of declaration.ctor.parameters) {
//                 // console.log(`Property ${parameter.name} ${parameter.type}`);
//             }
//         }
//     }
//     for(let component of getArray(compactedOutput, "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#component")) {
//         for (let parameter of getArray(component, "https://linkedsoftwaredependencies.org/vocabularies/object-oriented#parameter")) {
//             if(!matchedParameters.includes(parameter)) {
//                 console.log(`❌ Configured parameter '${parameter["@id"]}' did not match any field`);
//             }
//
//         }
//     }
// }
// // From rdfs:range to parameter type
// const rdfTypes = {
//     "boolean": "boolean",
//     "integer": "number",
//     "number": "number",
//     "int": "number",
//     "byte": "number",
//     "long": "number",
//     "float": "float",
//     "decimal": "float",
//     "double": "float"
// };
// /**
//  * Converts a rdfs:range to a parameter type
//  */
// function convertFromType(type) {
//     return rdfTypes[type] || "http://www.w3.org/2001/XMLSchema#string";
// }
// function getArray(structure, path) {
//     let result = structure[path];
//     return Array.isArray(result) ? result : [result];
// }
