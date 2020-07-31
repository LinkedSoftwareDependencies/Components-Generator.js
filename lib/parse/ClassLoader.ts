import * as Path from 'path';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { ClassDeclaration, Program } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ResolutionContext } from '../resolution/ResolutionContext';
import { ClassLoaded, ClassReference } from './ClassIndex';

/**
 * Loads typescript classes from class references.
 */
export class ClassLoader {
  private readonly resolutionContext: ResolutionContext;

  public constructor(args: ClassLoaderArgs) {
    this.resolutionContext = args.resolutionContext;
  }

  /**
   * Find the super class of the given class.
   * Throws an error for super class definitions that could not be interpreted.
   * @param declaration A class declaration.
   * @param fileName The file name of the current class.
   */
  public getSuperClassName(declaration: ClassDeclaration, fileName: string): string | undefined {
    if (!declaration.superClass) {
      return;
    }
    if (declaration.superClass.type === AST_NODE_TYPES.Identifier) {
      // Extensions in the form of `class A extends B`
      return declaration.superClass.name;
    }
    if (declaration.superClass.type === AST_NODE_TYPES.MemberExpression &&
      declaration.superClass.property.type === AST_NODE_TYPES.Identifier &&
      declaration.superClass.object.type === AST_NODE_TYPES.Identifier) {
      // Extensions in the form of `class A extends x.B`
      throw new Error(`Namespaced superclasses are currently not supported: ${fileName} on line ${declaration.superClass.loc.start.line} column ${declaration.superClass.loc.start.column}`);
    }
    throw new Error(`Could not interpret type of superclass in ${fileName} on line ${declaration.superClass.loc.start.line} column ${declaration.superClass.loc.start.column}`);
  }

  /**
   * Load the referenced class, and obtain its full class declaration.
   * Classes can either be defined in this file (exported or not), or imported from another file.
   * @param classReference The reference to a class.
   */
  public async loadClassDeclaration(classReference: ClassReference): Promise<ClassLoaded> {
    const ast = await this.resolutionContext.parseTypescriptFile(classReference.fileName);
    const {
      exportedClasses,
      declaredClasses,
      importedClasses,
      exportedImportedAll,
      exportedImportedClasses,
    } = this.getClassElements(classReference.fileName, ast);

    // If the class has been exported in this file, return directly
    if (classReference.localName in exportedClasses) {
      return { ...classReference, declaration: exportedClasses[classReference.localName] };
    }

    // If the class has been declared in this file, return directly
    if (classReference.localName in declaredClasses) {
      return { ...classReference, declaration: declaredClasses[classReference.localName] };
    }

    // If the class is available via an import, follow that import link
    if (classReference.localName in importedClasses) {
      return this.loadClassDeclaration(importedClasses[classReference.localName]);
    }

    // If the class is available via an exported import, follow that import link
    if (classReference.localName in exportedImportedClasses) {
      return this.loadClassDeclaration(exportedImportedClasses[classReference.localName]);
    }

    // If we still haven't found the class, iterate over all export all's
    for (const subFile of exportedImportedAll) {
      try {
        return await this.loadClassDeclaration({ localName: classReference.localName, fileName: subFile });
      } catch (error) {
        // Ignore class not found errors
      }
    }

    throw new Error(`Could not load class ${classReference.localName} from ${classReference.fileName}`);
  }

  /**
   * Load a class, and get all class elements from it.
   * @param fileName A file path.
   */
  public async loadClassElements(fileName: string): Promise<ClassElements> {
    const ast = await this.resolutionContext.parseTypescriptFile(fileName);
    return this.getClassElements(fileName, ast);
  }

  /**
   * Get all class elements in a file.
   * @param fileName A file path.
   * @param ast The parsed file.
   */
  public getClassElements(fileName: string, ast: Program): ClassElements {
    const exportedClasses: { [exportedName: string]: ClassDeclaration } = {};
    const exportedImportedClasses: { [exportedName: string]: { localName: string; fileName: string } } = {};
    const exportedImportedAll: string[] = [];
    const exportedUnknowns: { [exportedName: string]: string } = {};
    const declaredClasses: { [localName: string]: ClassDeclaration } = {};
    const importedClasses: { [exportedName: string]: { localName: string; fileName: string } } = {};

    for (const statement of ast.body) {
      if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        if (statement.declaration &&
          statement.declaration.type === AST_NODE_TYPES.ClassDeclaration) {
          // Form: `export class A{}`
          if (!statement.declaration.id) {
            throw new Error(`Export parsing failure: missing exported class name in ${fileName} on line ${statement.declaration.loc.start.line} column ${statement.declaration.loc.start.column}`);
          }
          exportedClasses[statement.declaration.id.name] = statement.declaration;
        } else if (statement.source &&
          statement.source.type === AST_NODE_TYPES.Literal &&
          typeof statement.source.value === 'string') {
          // Form: `export { A as B } from "b"`
          for (const specifier of statement.specifiers) {
            exportedImportedClasses[specifier.exported.name] = {
              localName: specifier.local.name,
              fileName: Path.join(Path.dirname(fileName), statement.source.value),
            };
          }
        } else {
          // Form: `export { A as B }`
          for (const specifier of statement.specifiers) {
            exportedUnknowns[specifier.exported.name] = specifier.local.name;
          }
        }
      } else if (statement.type === AST_NODE_TYPES.ExportAllDeclaration) {
        // Form: `export * from "b"`
        if (statement.source &&
          statement.source.type === AST_NODE_TYPES.Literal &&
          typeof statement.source.value === 'string') {
          exportedImportedAll.push(Path.join(Path.dirname(fileName), statement.source.value));
        }
      } else if (statement.type === AST_NODE_TYPES.ClassDeclaration && statement.id) {
        // Form: `declare class A {}`
        declaredClasses[statement.id.name] = statement;
      } else if (statement.type === AST_NODE_TYPES.ImportDeclaration &&
        statement.source.type === AST_NODE_TYPES.Literal &&
        typeof statement.source.value === 'string') {
        // Form: `import {A} from './lib/A'`
        for (const specifier of statement.specifiers) {
          if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
            importedClasses[specifier.local.name] = {
              localName: specifier.imported.name,
              fileName: Path.join(Path.dirname(fileName), statement.source.value),
            };
          }
        }
      }
    }

    return {
      exportedClasses,
      exportedImportedClasses,
      exportedImportedAll,
      exportedUnknowns,
      declaredClasses,
      importedClasses,
    };
  }
}

export interface ClassLoaderArgs {
  resolutionContext: ResolutionContext;
}

/**
 * Holder for all available classes in a file.
 */
export interface ClassElements {
  // Classes that have been declared in a file via `export class A`
  exportedClasses: {[exportedName: string]: ClassDeclaration};
  // Classes that have been exported via `export { A as B } from "b"`
  exportedImportedClasses: { [exportedName: string]: { localName: string; fileName: string } };
  // Exports via `export * from "b"`
  exportedImportedAll: string[];
  // Things that have been exported via `export {A as B}`, where the target is not known
  exportedUnknowns: { [exportedName: string]: string };
  // Classes that have been declared in a file via `declare class A`
  declaredClasses: {[localName: string]: ClassDeclaration};
  // Classes that are imported from elsewhere via `import {A} from ''`
  importedClasses: {[exportedName: string]: { localName: string; fileName: string }};
}
