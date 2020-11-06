import type { ClassIndex, ClassReference } from './ClassIndex';
import type { ClassLoader } from './ClassLoader';

/**
 * Load the names and locations of all available classes that are exported by a package.
 * This will not load classes, but it will merely provide references to classes.
 */
export class ClassFinder {
  private readonly classLoader: ClassLoader;

  public constructor(args: ClassFinderArgs) {
    this.classLoader = args.classLoader;
  }

  /**
   * From a given types index, find all named exports.
   * @param typesPath The path to the index typings file.
   */
  public async getPackageExports(typesPath: string): Promise<ClassIndex<ClassReference>> {
    let exports: ClassIndex<ClassReference> = {};

    // Start from the package index, and collect all named exports.
    const paths = [ typesPath ];
    for (const path of paths) {
      const { named, unnamed } = await this.getFileExports(path);
      exports = { ...exports, ...named };
      for (const additionalPath of unnamed) {
        paths.push(additionalPath);
      }
    }

    return exports;
  }

  /**
   * Get all named and unnamed exports from the given file.
   * @param fileName The path to a typescript file.
   */
  public async getFileExports(fileName: string):
  Promise<{ named: ClassIndex<ClassReference>; unnamed: string[] }> {
    // Load the elements of the class
    const {
      exportedClasses,
      exportedImportedElements,
      exportedImportedAll,
      exportedUnknowns,
      declaredClasses,
      importedElements,
    } = await this.classLoader.loadClassElements(fileName);
    const exportDefinitions: { named: ClassIndex<ClassReference>; unnamed: string[] } = { named: {}, unnamed: []};

    // Get all named exports
    for (const localName in exportedClasses) {
      exportDefinitions.named[localName] = {
        localName,
        fileName,
      };
    }

    // Get all named exports from other files
    for (const [ exportedName, { localName, fileName: importedFileName }] of Object.entries(exportedImportedElements)) {
      exportDefinitions.named[exportedName] = {
        localName,
        fileName: importedFileName,
      };
    }

    // Iterate over all named export that had an unknown target,
    // and attempt to link them to classes available in the file
    if (Object.keys(exportedUnknowns).length > 0) {
      for (const [ exportedName, localName ] of Object.entries(exportedUnknowns)) {
        // First check declared classes
        if (localName in declaredClasses) {
          exportDefinitions.named[exportedName] = {
            localName,
            fileName,
          };
          break;
        }

        // Next, check imports
        if (localName in importedElements) {
          exportDefinitions.named[exportedName] = importedElements[localName];
        }
      }
    }

    // Handle export *
    exportDefinitions.unnamed = exportedImportedAll;

    return exportDefinitions;
  }
}

export interface ClassFinderArgs {
  classLoader: ClassLoader;
}
