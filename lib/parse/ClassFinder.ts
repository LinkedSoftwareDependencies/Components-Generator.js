import * as Path from 'path';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import {
  ClassDeclaration,
  ExportNamedDeclaration, Program,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ResolutionContext } from '../resolution/ResolutionContext';

/**
 * Load the names and locations of all available classes that are exported by a package.
 */
export class ClassFinder {
  private readonly resolutionContext: ResolutionContext;

  public constructor(args: ClassDependencyTreeArgs) {
    this.resolutionContext = args.resolutionContext;
  }

  /**
   * From a given package directory, find all named exports.
   * It is assumed that the given package contains an index.d.ts file.
   * @param packageRootDirectory The path of a package.
   */
  public async getPackageExports(packageRootDirectory: string): Promise<NamedExports> {
    let exports: NamedExports = {};

    // Start from the package index, and collect all named exports.
    const paths = [ Path.join(packageRootDirectory, 'index') ];
    for (const path of paths) {
      const { named, unnamed } = await this.getFileExports(path);
      exports = { ...exports, ...named };
      for (const additionalPath of unnamed) {
        paths.push(Path.join(Path.dirname(path), additionalPath));
      }
    }

    return exports;
  }

  /**
   * Get all named and unnamed exports from the given file.
   * @param filePath The path to a typescript file.
   */
  public async getFileExports(filePath: string): Promise<{ named: NamedExports; unnamed: UnnamedExports }> {
    const ast = await this.resolutionContext.parseTypescriptFile(filePath);
    const exportDefinitions: { named: NamedExports; unnamed: UnnamedExports } = {
      named: {},
      unnamed: [],
    };

    // Iterate over all statements in the file to find the exports
    const exportTargetsUnknown: ExportNamedDeclaration[] = [];
    for (const statement of ast.body) {
      if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        if (statement.declaration) {
          // A named class or property export, such as `export class A{}`
          if (statement.declaration.type === AST_NODE_TYPES.ClassDeclaration) {
            if (!statement.declaration.id) {
              throw new Error(`Export parsing failure: missing exported class name in ${filePath} on line ${statement.declaration.loc.start.line} column ${statement.declaration.loc.start.column}`);
            }
            exportDefinitions.named[statement.declaration.id.name] = {
              localName: statement.declaration.id.name,
              fileName: filePath,
            };
          }
        } else if (statement.source &&
          statement.source.type === AST_NODE_TYPES.Literal &&
          typeof statement.source.value === 'string') {
          // A named export declaration, such as `export { A as B } from "b"`
          for (const specifier of statement.specifiers) {
            exportDefinitions.named[specifier.exported.name] = {
              localName: specifier.local.name,
              fileName: Path.join(Path.dirname(filePath), statement.source.value),
            };
          }
        } else {
          // We have an export of something that is defined elsewhere in the file, such as `export {A as B}`.
          // We store it for later after all statements in the file have been iterated.
          exportTargetsUnknown.push(statement);
        }
      } else if (statement.type === AST_NODE_TYPES.ExportAllDeclaration) {
        // An export all, such as `export * from "b"`
        if (statement.source &&
          statement.source.type === AST_NODE_TYPES.Literal &&
          typeof statement.source.value === 'string') {
          exportDefinitions.unnamed.push(statement.source.value);
        }
      }
    }

    // Iterate over all named export that had an unknown target,
    // and attempt to link them to classes available in the file
    if (exportTargetsUnknown.length > 0) {
      const { declaredClasses, importedClasses } = this.getAvailableClasses(filePath, ast);
      for (const exportTargetUnknown of exportTargetsUnknown) {
        for (const specifier of exportTargetUnknown.specifiers) {
          // First check declared classes
          if (specifier.local.name in declaredClasses) {
            exportDefinitions.named[specifier.exported.name] = {
              localName: specifier.local.name,
              fileName: filePath,
            };
            break;
          }

          // Next, check imports
          if (specifier.local.name in importedClasses) {
            exportDefinitions.named[specifier.exported.name] = importedClasses[specifier.local.name];
          }
        }
      }
    }

    return exportDefinitions;
  }

  /**
   * Get all available classes in a file.
   * @param filePath A file path.
   * @param ast The parsed file.
   */
  public getAvailableClasses(filePath: string, ast: Program): AvailableClasses {
    const declaredClasses: {[id: string]: ClassDeclaration} = {};
    const importedClasses: {[id: string]: { localName: string; fileName: string }} = {};

    for (const statement of ast.body) {
      if (statement.type === AST_NODE_TYPES.ClassDeclaration && statement.id) {
        // Something in the form of `declare class A {}`
        declaredClasses[statement.id.name] = statement;
      } else if (statement.type === AST_NODE_TYPES.ImportDeclaration &&
        statement.source.type === AST_NODE_TYPES.Literal &&
        typeof statement.source.value === 'string') {
        // Something in the form of `import {A} from`
        for (const specifier of statement.specifiers) {
          if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
            importedClasses[specifier.local.name] = {
              localName: specifier.imported.name,
              fileName: Path.join(Path.dirname(filePath), statement.source.value),
            };
          }
        }
      }
    }

    return {
      declaredClasses,
      importedClasses,
    };
  }
}

export interface ClassDependencyTreeArgs {
  resolutionContext: ResolutionContext;
}

/**
 * A collection of named exports.
 */
export interface NamedExports {
  // The exported name of the class, as visible by externals importing it.
  [className: string]: {
    // The name of the class within the file.
    localName: string;
    // The name of the file the class is defined in.
    fileName: string;
  };
}

/**
 * An array of unnamed exports.
 * This array contains file names.
 */
export type UnnamedExports = string[];

/**
 * Holder for all available classes in a file.
 */
export interface AvailableClasses {
  // Classes that have been declared in a file via `declare`
  declaredClasses: {[id: string]: ClassDeclaration};
  // Classes that are imported from elsewhere via `import`
  importedClasses: {[id: string]: { localName: string; fileName: string }};
}
