# Components.js Generator

## Using the tool

### Generating a `.jsonld` file using the CLI tool

```
componentsjs-generator generate
       --p <package>     # The package to look in
       --c <className>   # The class to generate a component for
       -l, <level>       # The level for the logger
       --print           # Print to standard output
       -o <outputPath>   # Write output to a specific file
```

Using this command you can generate a `.jsonld` file for a specific component.

#### Options

* `<package>`: the filepath to the directory of the package that your component is located in. It is important that you first used `npm install` in this package's directory to make sure all the dependencies can be found.
* `<className>`: the name of the class that represents your component. Your class must be exported in the `index.ts` file of your package and this must be the name that the class was exported as.
* `<level>`: the level of the logger. Options: `emerg, alert, crit, error, warning, notice, info, debug`.
* `--print`: if this flag is used, the output will be printed to console
* `<outputPath>`: if this is set and `--print` is not used, the output will be written to this file. If this is not set and `--print` is not used, the output will be written to a file in the `component` folder of the package.
