import * as Path from 'path';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { ClassDeclaration } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ClassIndex, ClassReference } from './ClassIndex';
import { ClassLoader } from './ClassLoader';
import { ClassScope } from './ConstructorLoader';

/**
 * Load the names and locations of all available classes that are exported by a package.
 */
export class ClassFinder {
  private readonly classLoader: ClassLoader;

  public constructor(args: ClassFinderArgs) {
    this.classLoader = args.classLoader;
  }

  /**
   * From a given package directory, find all named exports.
   * It is assumed that the given package contains an index.d.ts file.
   * @param packageRootDirectory The path of a package.
   */
  public async getPackageExports(packageRootDirectory: string): Promise<ClassIndex<ClassReference>> {
    let exports: ClassIndex<ClassReference> = {};

    // Start from the package index, and collect all named exports.
    const paths = [ Path.join(packageRootDirectory, 'index') ];
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
   * Find the super class of the given class.
   * @param declaration A class declaration.
   * @param currentFileName The file name of the current class, for error reporting.
   */
  public getSuperClass(declaration: ClassDeclaration, currentFileName: string): ClassScope | undefined {
    if (!declaration.superClass) {
      return;
    }
    if (declaration.superClass.type === AST_NODE_TYPES.Identifier) {
      // Extensions in the form of `class A extends B`
      return { className: declaration.superClass.name };
    }
    if (declaration.superClass.type === AST_NODE_TYPES.MemberExpression &&
      declaration.superClass.property.type === AST_NODE_TYPES.Identifier &&
      declaration.superClass.object.type === AST_NODE_TYPES.Identifier) {
      // Extensions in the form of `class A extends x.B`
      return {
        className: declaration.superClass.property.name,
        nameSpace: declaration.superClass.object.name,
      };
    }
    throw new Error(`Could not interpret type of superclass in ${currentFileName} on line ${declaration.superClass.loc.start.line} column ${declaration.superClass.loc.start.column}`);
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
      exportedImportedClasses,
      exportedImportedAll,
      exportedUnknowns,
      declaredClasses,
      importedClasses,
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
    for (const [ exportedName, { localName, fileName: importedFileName }] of Object.entries(exportedImportedClasses)) {
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
        if (localName in importedClasses) {
          exportDefinitions.named[exportedName] = importedClasses[localName];
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
