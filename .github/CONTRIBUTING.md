This page contains several pointers for people that want to contribute to this project.

## Setup development environment

Start by cloning this repository.

```bash
$ git clone git@github.com:LinkedSoftwareDependencies/Components-Generator.js.git
```

This project requires [Node.js](https://nodejs.org/en/) `>=18.12` and [Yarn](https://yarnpkg.com/) `>=4` to be installed. Preferable, use the Yarn version provided and managed by Node.js' integrated [CorePack](https://yarnpkg.com/corepack) by running `corepack enable`.

After that, you can install the project by running `yarn install`. This will automatically also run `yarn build`, which you can run again at any time to compile any changed code.

## Continuous integration

Given the critical nature of this project, we require a full (100%) test coverage.
Additionally, we have configured strict linting rules.

These checks are run automatically upon each commit, and via continuous integration.

You can run them manually as follows:
```bash
$ yarn test
$ yarn lint
```

## Code architecture

The architecture is decomposed into 5 main packages:

1. [`config`](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/tree/master/lib/config): Loading a generator from configuration files.
2. [`generate`](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/tree/master/lib/generate): Generating component files by parsing type information from TypeScript and serializing it into JSON-LD.
3. [`parse`](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/tree/master/lib/parse): Parsing components from TypeScript.
4. [`resolution`](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/tree/master/lib/resolution): Resolution of dependencies.
5. [`serialize`](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/tree/master/lib/serialize): Serializing components to JSON-LD.
6. [`util`](https://github.com/LinkedSoftwareDependencies/Components-Generator.js/tree/master/lib/util): Various utilities.
