# Components-Generator.js

[![Build status](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/workflows/CI/badge.svg)](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/actions?query=workflow%3ACI)
[![Coverage Status](https://coveralls.io/repos/github/LinkedSoftwareDependencies/Components-Generator.js/badge.svg?branch=master)](https://coveralls.io/github/LinkedSoftwareDependencies/Components-Generator.js?branch=master)
[![npm version](https://badge.fury.io/js/componentsjs-generator.svg)](https://www.npmjs.com/package/componentsjs-generator)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.5644902.svg)](https://doi.org/10.5281/zenodo.5644902)

This is a tool to automatically generate `.jsonld` component files from TypeScript classes
for the [Components.js](https://github.com/LinkedSoftwareDependencies/Components.js) dependency injection framework.

Before you use this tool, it is recommended to first read the [Components.js documentation](https://componentsjs.readthedocs.io/en/latest/).

## Getting started

**1. Install as a dev dependency**

```bash
npm install -D componentsjs-generator
```

or

```bash
yarn add -D componentsjs-generator
```

**2. Declare components in `package.json`**

_If you are already using Components.js, you already have this._

Add the following entry to `package.json`:

```text
{
  ...
  "lsd:module": true,
  ...
}
```

On each line, make sure to replace `my-package` with your package `name`.

**3. _(optional)_ Add generate script**

Call `componentsjs-generator` as a npm script by adding a `scripts` entry to your `package.json`:

```text
{
  ...,
  "scripts": {
    ...
    "build": "npm run build:ts && npm run build:components",
    "build:ts": "tsc",
    "build:components": "componentsjs-generator",
    "prepare": "npm run build",
    ...
  }
}
```

This is only a _recommended_ way of calling `componentsjs-generator`,
you are free to call it in a different way that better suits your pipeline.

**4. _(optional)_ Ignore generated components files**

Since we automatically generate the components files,
we do not have to check them into version control systems like git.
So we can add the following line to `.gitignore`:

```text
components
```

If you do this, make sure that the components folder is published to npm by adding the following to your `package.json`:
```text
{
  ...
  "files": [
    ....
    "components/**/*.jsonld",
    "config/**/*.json",
    ....
  ],
  ....
}
```

## Usage

When invoking `componentsjs-generator`,
this tool will automatically generate `.jsonld` components files for all TypeScript files
that are exported by the current package.

For monorepos, multiple package paths may be provided.

```bash
Generates component file for a package
Usage:
  componentsjs-generator
  Arguments:
       path/to/package         The directories of the packages to look in, defaults to working directory
  Options:
       -p path/to/package      The directory of the package to look in, defaults to working directory
       -s lib                  Relative path to directory containing source files, defaults to 'lib'
       -c components           Relative path to directory that will contain components files, defaults to 'components'
       -e jsonld               Extension for components files (without .), defaults to 'jsonld'
       -i ignore-classes.json  Relative path to an optional file with class names to ignore
       -r prefix               Optional custom JSON-LD module prefix
       --lenient               If unsupported language features must produce a warning instead of an error
       --debugState            If a 'componentsjs-generator-debug-state.json' file should be created with debug information
       --help                  Show information about this command
```

**Note:** This generator will read `.d.ts` files,
so it is important that you invoke the TypeScript compiler (`tsc`) _before_ using this tool.

### Configuration files

While options passed to the CLI tool will always take precedence,
it is possible to add a `.componentsjs-generator-config.json` file to your project to define your configuration.

The following shows an example of the possible options:
```json
{
  "source": "lib",
  "destination": "components",
  "extension": "jsonld",
  "ignorePackagePaths": [ "path/to/package-ignored1", "path/to/package-ignored2" ],
  "ignoreComponents": [ "Class1", "Class2" ],
  "logLevel": "info",
  "modulePrefix": "myprefix",
  "debugState": "true",
  "hardErrorUnsupported": false
}
```

When invoking `componentsjs-generator`, the tool will look for `.componentsjs-generator-config.json` in the current working directory.
If it can not find one, it will recursively go look into the parent directories until it either finds one or is at the root.

### Ignoring classes

If you don't want components to be generated for certain classes,
then you can either add it to the `ignoreComponents` array of the `.componentsjs-generator-config.json` file (as explained above),
or you can pass a JSON file to the `-i` option containing an array of class names to skip.

For example, invoking `componentsjs-generator -i ignore-classes.json` will skip `BadClass` if the contents of `ignore-classes.json` are:
```json
[
  "BadClass"
]
```

If you are looking for a way to ignore parameters, see the `@ignored` argument tag below.

## How it works

For each exported TypeScript class,
its constructor will be checked,
and component parameters will be generated based on the TypeScript type annotations.

### Example

TypeScript class:
```typescript
/**
 * This is a great class!
 */
export class MyClass extends OtherClass {
  /**
   * @param paramA - My parameter
   */
  constructor(paramA: boolean, paramB: number, paramC: string[]) {
  
  }
}
```

Component file:
```json
{
  "@context": [
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld"
  ],
  "@id": "npmd:my-package",
  "components": [
    {
      "@id": "ex:MyFile#MyClass",
      "@type": "Class",
      "requireElement": "MyClass",
      "extends": "ex:OtherFile#OtherClass",
      "comment": "This is a great class!",
      "parameters": [
        {
          "@id": "ex:MyFile#MyClass_paramA",
          "range": "xsd:boolean",
          "comment": "My parameter"
        },
        {
          "@id": "ex:MyFile#MyClass_paramB",
          "range": "xsd:integer"
        },
        {
          "@id": "ex:MyFile#MyClass_paramC",
          "range": {
            "@type": "ParameterRangeArray",
            "parameterRangeValue": "xsd:integer"
          }
        }
      ],
      "constructorArguments": [
        { "@id": "ex:MyFile#MyClass_paramA" },
        { "@id": "ex:MyFile#MyClass_paramB" },
        { "@id": "ex:MyFile#MyClass_paramC" }
      ]
    }
  ]
}
```

### Arguments

Each argument in the constructor of the class must be one of the following:

* A primitive type such as `boolean, number, string`, which will be mapped to an [XSD type](https://componentsjs.readthedocs.io/en/latest/configuration/components/parameters/) 
* Another class, which will be mapped to the component `@id`.
* A record or interface containing key-value pairs where each value matches one of the possible options. Nesting is allowed.
* Reference to a generic type that is defined on the class.
* An array, `keyof`, tuple, union, or intersection over any of the allowed types.
  
Here is an example that showcases all of these options:  
   ```typescript
  import {Logger} from "@comunica/core";
  export class SampleActor {
      constructor(
        args: HashArg,
        number: number,
        component: Logger,
        array: HashArg[],
        complexComposition: (SomeClass & OtherClass) | string,
        complexTuple: [ number, SomeClass, ...string[] ],
        optional?: number,
      ) {}
  }
  export interface HashArg {
      args: NestedHashArg;
      array: NestedHashArg[];
  }
  export interface NestedHashArg extends ExtendsTest {
      test: boolean;
      component: Logger;
  }
  export interface ExtendsTest {
      string: string;
  }
``` 

### Argument tags

Using comment tags, arguments can be customized.

#### Tags

| Tag | Action
|---|---
| `@ignored` | This field will be ignored.
| `@default {value}` | The `default` attribute of the parameter will be set to `value`. See section below for acceptable values.
| `@defaultNested {value} path_to_args` | When the given parameter accepts a nested object (child links delimited by `_`), the `default` attribute of this nested field will be set to `value`. See section below for acceptable values.
| `@range {type}` | The `range` attribute of the parameter will be set to `type`. You can only use values that fit the type of field. Options: `json, boolean, int, integer, number, byte, long, float, decimal, double, string`. For example, if your field has the type `number`, you could explicitly mark it as a `float` by using `@range {float}`. See [the documentation](https://componentsjs.readthedocs.io/en/latest/configuration/components/parameters/).

##### Default values

Default values accept a microsyntax, in which several types of values may be provided:

* Literal values: `@default {abc}`
* IRI values: `@default {<http://example.org/abc>}`
* Blank-node-based instantiation: `@default {a <http://example.org/MyType>}`
* IRI-based instantiation: `@default {<http://example.org/myInstance> a <http://example.org/MyType>}`

#### Examples

**Tagging constructor fields:**

TypeScript class:
```typescript
export class MyActor {
    /**
     * @param myByte - This is an array of bytes @range {byte}
     * @param ignoredArg - @ignored
     */ 
    constructor(myByte: number[], ignoredArg: string) {

    }
}
```

Component file:
```json
{
  "components": [
    {
      "parameters": [
        {
          "@id": "my-actor#TestClass#myByte",
          "range": {
            "@type": "ParameterRangeArray",
            "parameterRangeValue": "xsd:byte"
          },
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

**Tagging constructor fields as raw JSON:**

TypeScript class:
```typescript
export class MyActor {
    /**
     * @param myValue - Values will be passed as parsed JSON @range {json}
     * @param ignoredArg - @ignored
     */ 
    constructor(myValue: any, ignoredArg: string) {

    }
}
```

Component file:
```json
{
  "components": [
    {
      "parameters": [
        {
          "@id": "my-actor#TestClass#myValue",
          "range": "rdf:JSON",
          "comment": "Values will be passed as parsed JSON"
        }
      ],
      "constructorArguments": [
        {
          "@id": "my-actor#TestClass#myValue"
        }
      ]
    }
  ]
}
```

When instantiating TestClass as follows, its JSON value will be passed directly into the constructor:
```json
{
  "@id": "ex:myInstance",
  "@type": "TestClass",
  "myValue": {
    "someKey": {
      "someOtherKey1": 1,
      "someOtherKey2": "abc"
    }  
  }
}
```

**Tagging interface fields:**

TypeScript class:
```typescript
export class MyActor {
  constructor(args: IActorBindingArgs) {
    super(args)
  }
}

export interface IActorBindingArgs {
  /**
   * This field is very important
   * @range {float}
   * @default {5.0}
   */
   floatField: number;
}
```

Component file:
```json
{
  "components": [
    {
      "parameters": [
        {
          "@id": "my-actor#floatField",
          "range": "xsd:float",
          "default": "5.0",
          "comment": "This field is very important"
        }
      ],
      "constructorArguments": [
        {
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

## License
Components.js is written by [Ruben Taelman](http://www.rubensworks.net/).

This code is copyrighted by [Ghent University – imec](http://idlab.ugent.be/)
and released under the [MIT license](http://opensource.org/licenses/MIT).
