# Components-Generator.js

[![Build Status](https://travis-ci.org/LinkedSoftwareDependencies/Components-Generator.js.svg?branch=master)](https://travis-ci.org/LinkedSoftwareDependencies/Components-Generator.js)
[![Coverage Status](https://coveralls.io/repos/github/LinkedSoftwareDependencies/Components-Generator.js/badge.svg?branch=master)](https://coveralls.io/github/LinkedSoftwareDependencies/Components-Generator.js?branch=master)
[![npm version](https://badge.fury.io/js/componentjs-generator.svg)](https://www.npmjs.com/package/componentjs-generator)

A tool to generate `.jsonld` component files for [Components.js](https://github.com/LinkedSoftwareDependencies/Components.js) TypeScript classes.  
Please check the [Components.js documentation](https://componentsjs.readthedocs.io/en/latest/) first.

## Install

1. Clone this repo
2. Go to the root of the repo
3. `npm install -g`

## Using the tool

### Generating a `.jsonld` file using the CLI tool

This tool can assist you in developing components by creating and filling in the boilerplate `.jsonld` file that is linked to your component. It does this by analyzing the TypeScript file that contains your class declaration.

```bash
Generates a component file for a specific component
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
```

#### Options

* `<package>`: the filepath to the directory of the package that your component is located in. It is important that you first used `npm install` in this package's directory to make sure all the dependencies can be found.
* `<outputPath>`: if this is set and `--print` is not used, the output will be written to this file. If this is not set and `--print` is not used, the output will be written to a file in the `components` folder of the package.
* `<className>`: the name of the class that represents your component. Your class must be exported in the `index.ts` file of your package and this must be the name that the class was exported as.
* `<level>`: the level of the logger. Options: `emerg, alert, crit, error, warning, notice, info, debug`. Defaults to `info`.
* `<moduleRoot>`: directory where we should look for dependencies, relative to the package directory. Defaults to `.` .
* `--print`: if this flag is used, the output will be printed to console.

### Using the tool in your code

```typescript
// Importing the tool
const Generate = require("componentjs-oldgenerator").Generate;

// Path to the root of the package
let directory = "modules/test-module";
// Name of the class
let className = "MyActor";
// Module directory
let moduleRoot = ".";
// Logger level
let level = "debug";

async function run() {
    
    // Returns a Javascript object that represents the contents of the component file
    // No actual file will be created
    let component = await Generate.generateComponent(directory, className, moduleRoot, level);
    let print = false;
    let outputPath = "components/Actor/MyActor.jsonld";
    
    // Creates a file with the generated component content
    // The other options are the same as in the CLI tool
    await Generate.generateComponentFile(directory, className, outputPath, moduleRoot, print, level);
}
```

## Tweaking the files

### General guidelines

* The superclass of a class that you parse must also be linked to a component
* Each argument in the constructor of the class that you parse must be either:
    - A simple type that can be matched to an [XSD type](https://componentsjs.readthedocs.io/en/latest/configuration/components/parameters/) such as `boolean, number, string`
    - Linked to an existing component
    - A hash containing key-value pairs where each value matches one of the possible options. This means you can used nested classes. This class can also extend another hash.  
    - An array containing a type that matches one of the above options
  
Here is an example that showcases all of these options:  
   ```typescript
  import {Logger} from "@comunica/core";
  export class SampleActor {
      constructor(args:HashArg,testArray:HashArg[], numberSample: number, componentExample: Logger) {}
  }
  export interface HashArg {
      args: NestedHashArg;
      arraySample: NestedHashArg[];
  }
  export interface NestedHashArg extends ExtendsTest {
      test: boolean;
      componentTest: Logger;
  }
  export interface ExtendsTest {
      stringTest: String;
  }
``` 
### Imports and exports

#### Imports
When the tool analyzes your TypeScript class, it will use the import declarations to link names of classes to filepaths.
The following ways of importing classes in your TypeScript files are supported:
```typescript
import * as bar from "/foo/bar";
import {FooClass} from "@bar";
import {FooClass as BarClass} from "@bar";
import foo = require("./bar");
```

#### Exports
When the tool analyzes your TypeScript class, it will use the `index.ts` of all dependent packages to link names of classes to existing components.
It does this by checking all the names of the exported classes in the `index.ts` and comparing them with the `requireElement` attribute of each component.
The following ways of exporting classes are supported:
```typescript
export * from "./bar";
export {FooClass} from "/foo/bar";
export {FooClass as BarClass} from "/foo/bar";
```
It is very important that each of your existing components has a `requireElement` attribute in their `.jsonld` file. This value must be equal to the exported name of the matching class of that package. Otherwise, the tool might make a guess to match, but it can fail.

### Tags for fields and constructors arguments

This tool allows you to put tags in comments above fields and constructor arguments in your TypeScript file to add additional information to the generated files.

#### Tags

| Tag | Action
|---|---
| `@ignored` | This field will be ignored by the tool and will not be added to the generated file.
| `@default {<value>}` | The `default` attribute of the parameter will be set to `<value>` 
| `@range {<type>}` | The `range` attribute of the parameter will be set to `<type>`. You can only use values that fit the type of field. Options: `boolean, int, integer, number, byte, long, float, decimal, double, string`. For example, if your field has the type `number`, you could explicitly mark it as a `float` by using `@range {float}`. See [the documentation](https://componentsjs.readthedocs.io/en/latest/configuration/components/parameters/).

#### For fields

Here's an example of how these annotations can be used to give additional information about the fields of a class.
Comments must be placed above your field and they must end on the line before the line that the declaration of your field starts on.  
An example:
```typescript
export class MyActor extends OtherActor {
  constructor(args: IActorBindingArgs) {
    super(args)
  }
}

export interface IActorBindingArgs extends IActorOtherBindingArgs {
  /**
   * This field is very important
   * @range {float}
   * @default {5.0}
   */
   floatField?: number;
}
```
will become 
```json
{
    ...
    "components": [
        {
            ...
            "parameters": [
                {
                    "@id": "my-actor#floatField",
                    "range": "xsd:float",
                    "required": false,
                    "unique": true,
                    "default": "5.0",
                    "comment": "This field is very important"
                }
            ],
            "constructorArguments": [
                {
                    "@id": "my-actor#constructorArgumentsObject",
                    "extends": "other-actor#constructorArgumentsObject",
                    "fields": [
                        {
                            "keyRaw": "floatField",
                            "value": "my-actor#floatField"
                        }
                    ]
                }
            ]
        }
    ]
}
```

As you can see the tool recognized `floatField` as an optional field and set its value of `required` to `false`. It also parses the header of each comment and puts it in the `comment` attribute. 

#### For constructor arguments

Here's an example of how these annotations can be used to give additional information about the constructor arguments of a class and how you can make the parser ignore specific fields.
These comments must be placed inline in your constructor.  
An example:
```typescript
export class MyActor {
    constructor(/** This is an array of bytes
                    @range {byte}
                 */ myByte: number[], /** @ignored */ ignoredArg: string) {
        console.log(myByte);
    }
}
```
will become

```json
{
    ...
    "components": [
        {
            ...
            "parameters": [
                {
                    "@id": "my-actor#TestClass#myByte",
                    "range": "xsd:byte",
                    "required": false,
                    "unique": false,
                    "comment": "This is an array of bytes"
                }
            ],
            "constructorArguments": [
                {
                    "@id": "my-actor#TestClass#myByte"
                }
            ]
        }
    ]
}
```

As you can see the tool recognized `myByte` as an array field and set its value of `unique` to `false`.
The tool also noticed the `@ignored` tag on the `ignoredArg` field and did not parse it.

## Examples and test tests


### Running tests

```bash
npm run test
```
