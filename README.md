# Components.js Generator

A tool to generate `.jsonld` component files for [Components.js](https://github.com/LinkedSoftwareDependencies/Components.js) TypeScript classes. 

## Using the tool

### Generating a `.jsonld` file using the CLI tool

```
componentsjs-generator generate
       -p <package>      # The package to look in
       -c <className>    # The class to generate a component for
       -l, <level>       # The level for the logger
       -o <outputPath>   # Write output to a specific file
       --print           # Print to standard output
```

Using this command you can generate a `.jsonld` file for a specific component.

#### Options

* `<package>`: the filepath to the directory of the package that your component is located in. It is important that you first used `npm install` in this package's directory to make sure all the dependencies can be found.
* `<className>`: the name of the class that represents your component. Your class must be exported in the `index.ts` file of your package and this must be the name that the class was exported as.
* `<level>`: the level of the logger. Options: `emerg, alert, crit, error, warning, notice, info, debug`.
* `--print`: if this flag is used, the output will be printed to console
* `<outputPath>`: if this is set and `--print` is not used, the output will be written to this file. If this is not set and `--print` is not used, the output will be written to a file in the `component` folder of the package.


### Using the tool in your code

// TODO 

## Tweaking the files

### Imports and exports

#### Imports
When the tool analyzes your TypeScript class, it will use the import declarations to link names of classes to filepaths.
The following ways of importing classes are supported:
```
import * as bar from "/foo/bar";
import {FooClass, FooClass as BarClass} from "@bar";
import foo = require("./bar");
```

#### Exports
When the tool analyzes your TypeScript class, it will use the `index.ts` of all dependent packages to link names of classes to existing components.
It does this by checking all the names of the exported classes in the `index.ts` and comparing them with the `requireElement` attribute of each component.
The following ways of exporting classes are supported:
``` 
export * from "./bar"
export {FooClass, FooClass as BarClass} from "/foo/bar"
```
It is very important that each of your existing components has a `requireElement` attribute in their `.jsonld` file. This value must be equal to the exported name of the matching class of that package.

### Tags on fields

This tool allows you to put tags in comments above fields and constructor arguments to add additional information.

### Tags

`@ignored`: this field will be ignored by the tool  
`@default {<value>}`: the `default` attribute of the parameter will be set to `<value`  
`@range {<type>}`: the `range` attribute of the parameter will be set to `<type>`. You can only use values that fit the type of field.  Options: `boolean, int, integer, number, byte, long, float, decimal, double, string`. For example, if your field has the type `number`, you could explicitly mark it as a `float` by using `@range {float}`. 

## For fields

Here's an example of how these annotations can be used to give additional information about the fields of a class.
```typescript
export class MyActor extends OtherActor {
  constructor(args: IActorInitBindingArgs) {
    super(args, 'reduced');
  }
}

export interface IActorInitRdfBindingHashArgs extends IActorInitOtherBindingArgs {
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
## For constructor arguments
