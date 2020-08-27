# Components-Generator.js

[![Build Status](https://travis-ci.org/LinkedSoftwareDependencies/Components-Generator.js.svg?branch=master)](https://travis-ci.org/LinkedSoftwareDependencies/Components-Generator.js)
[![Coverage Status](https://coveralls.io/repos/github/LinkedSoftwareDependencies/Components-Generator.js/badge.svg?branch=master)](https://coveralls.io/github/LinkedSoftwareDependencies/Components-Generator.js?branch=master)
[![npm version](https://badge.fury.io/js/componentjs-generator.svg)](https://www.npmjs.com/package/componentjs-generator)

This is a tool to automatically generate `.jsonld` component files from TypeScript classes
for the [Components.js](https://github.com/LinkedSoftwareDependencies/Components.js) dependency injection framework.

Before you use this tool, it is recommended to first read the [Components.js documentation](https://componentsjs.readthedocs.io/en/latest/).

## Getting started

**1. Install as a dev dependency**

```bash
npm install -D componentjs-generator
```

or

```bash
yarn add -D componentjs-generator
```

**2. Declare components in `package.json`**

_If you are already using Components.js, you already have this._

Add the following entries to `package.json`:

```text
{
  ...
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/my-package",
  "lsd:components": "components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/my-package/^1.0.0/components/context.jsonld": "components/context.jsonld"
  },
  "lsd:importPaths": {
    "https://linkedsoftwaredependencies.org/bundles/npm/my-package/^1.0.0/components/": "components/",
    "https://linkedsoftwaredependencies.org/bundles/npm/my-package/^1.0.0/config/": "config/"
  },
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

```bash
Generates component file for a package
Usage:
  componentsjs-generator
  Options:
       -p path/to/package   The directory of the package to look in, defaults to working directory
       -s lib               Relative path to directory containing source files, defaults to 'lib'
       -c components        Relative path to directory that will contain components files, defaults to 'components'
       -e jsonld            Extension for components files (without .), defaults to 'jsonld'
       --help               Show information about this command
```

**Note:** This generator will read `.d.ts` files,
so it is important that you invoke the TypeScript compiler (`tsc`) _before_ using this tool.

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
  constructor(paramA: boolean, paramB: number) {
  
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
          "comment": "My parameter",
          "unique": true,
          "required": true
        },
        {
          "@id": "ex:MyFile#MyClass_paramB",
          "range": "xsd:integer",
          "unique": true,
          "required": true
        }
      ],
      "constructorArguments": [
        { "@id": "ex:MyFile#MyClass_paramA" },
        { "@id": "ex:MyFile#MyClass_paramB" }
      ]
    }
  ]
}
```

### Arguments

Each argument in the constructor of the class must be one of the following:

* A primitive type such as `boolean, number, string`, which will be mapped to an [XSD type](https://componentsjs.readthedocs.io/en/latest/configuration/components/parameters/) 
* Another class, which will be mapped to the component `@id`.
* A hash or interface containing key-value pairs where each value matches one of the possible options. Nesting is allowed.  
* An array of any of the allowed types.
  
Here is an example that showcases all of these options:  
   ```typescript
  import {Logger} from "@comunica/core";
  export class SampleActor {
      constructor(args:HashArg, testArray:HashArg[], numberSample: number, componentExample: Logger) {}
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

### Argument tags

Using comment tags, arguments can be customized.

#### Tags

| Tag | Action
|---|---
| `@ignored` | This field will be ignored.
| `@default {<value>}` | The `default` attribute of the parameter will be set to `<value>` 
| `@range {<type>}` | The `range` attribute of the parameter will be set to `<type>`. You can only use values that fit the type of field. Options: `boolean, int, integer, number, byte, long, float, decimal, double, string`. For example, if your field has the type `number`, you could explicitly mark it as a `float` by using `@range {float}`. See [the documentation](https://componentsjs.readthedocs.io/en/latest/configuration/components/parameters/).

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
   floatField?: number;
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
          "required": false,
          "unique": true,
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
