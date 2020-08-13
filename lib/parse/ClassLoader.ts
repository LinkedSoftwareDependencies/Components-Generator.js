import * as Path from 'path';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import {
  ClassDeclaration,
  Program,
  TSInterfaceDeclaration,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { ResolutionContext } from '../resolution/ResolutionContext';
import { ClassLoaded, ClassReference, InterfaceLoaded } from './ClassIndex';

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
   * Find the super interfaces of the given interface.
   * Throws an error for interface definitions that could not be interpreted.
   * @param declaration An interface declaration.
   * @param fileName The file name of the current class.
   */
  public getSuperInterfaceNames(declaration: TSInterfaceDeclaration, fileName: string): string[] {
    return (declaration.extends || [])
      .map(extendsExpression => {
        if (extendsExpression.type === AST_NODE_TYPES.TSInterfaceHeritage &&
          extendsExpression.expression.type === AST_NODE_TYPES.Identifier) {
          // Extensions in the form of `interface A extends B`
          return extendsExpression.expression.name;
        }
        throw new Error(`Could not interpret type of super interface in ${fileName} on line ${extendsExpression.loc.start.line} column ${extendsExpression.loc.start.column}`);
      });
  }

  /**
   * Load the referenced class, and obtain its full class declaration.
   * Classes can either be defined in this file (exported or not), or imported from another file.
   * @param classReference The reference to a class.
   * @param considerInterfaces If the class reference is allows to refer to an interface, as well as a class.
   */
  public async loadClassDeclaration<CI extends boolean>(classReference: ClassReference, considerInterfaces: CI):
  Promise<CI extends true ? (ClassLoaded | InterfaceLoaded) : ClassLoaded> {
    const ast = await this.resolutionContext.parseTypescriptFile(classReference.fileName);
    const {
      exportedClasses,
      exportedInterfaces,
      declaredClasses,
      declaredInterfaces,
      importedElements,
      exportedImportedAll,
      exportedImportedElements,
    } = this.getClassElements(classReference.fileName, ast);

    // If the class has been exported in this file, return directly
    if (classReference.localName in exportedClasses) {
      return <any> <ClassLoaded> {
        type: 'class',
        ...classReference,
        declaration: exportedClasses[classReference.localName],
        ast,
      };
    }

    // If the class has been declared in this file, return directly
    if (classReference.localName in declaredClasses) {
      return <any> <ClassLoaded> {
        type: 'class',
        ...classReference,
        declaration: declaredClasses[classReference.localName],
        ast,
      };
    }

    // Only consider interfaces if explicitly enabled
    if (considerInterfaces) {
      // If the interface has been exported in this file, return directly
      if (classReference.localName in exportedInterfaces) {
        return <any> <InterfaceLoaded> {
          type: 'interface',
          ...classReference,
          declaration: exportedInterfaces[classReference.localName],
          ast,
        };
      }

      // If the interface has been declared in this file, return directly
      if (classReference.localName in declaredInterfaces) {
        return <any> <InterfaceLoaded> {
          type: 'interface',
          ...classReference,
          declaration: declaredInterfaces[classReference.localName],
          ast,
        };
      }
    }

    // If the class is available via an import, follow that import link
    if (classReference.localName in importedElements) {
      return this.loadClassDeclaration(importedElements[classReference.localName], considerInterfaces);
    }

    // If the class is available via an exported import, follow that import link
    if (classReference.localName in exportedImportedElements) {
      return this.loadClassDeclaration(exportedImportedElements[classReference.localName], considerInterfaces);
    }

    // If we still haven't found the class, iterate over all export all's
    for (const subFile of exportedImportedAll) {
      try {
        return await this.loadClassDeclaration({ localName: classReference.localName, fileName: subFile },
          considerInterfaces);
      } catch (error) {
        // Ignore class not found errors
      }
    }

    throw new Error(`Could not load ${considerInterfaces ? 'class or interface' : 'class'} ${classReference.localName} from ${classReference.fileName}`);
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
    const exportedInterfaces: { [exportedName: string]: TSInterfaceDeclaration } = {};
    const exportedImportedElements: { [exportedName: string]: { localName: string; fileName: string } } = {};
    const exportedImportedAll: string[] = [];
    const exportedUnknowns: { [exportedName: string]: string } = {};
    const declaredClasses: { [localName: string]: ClassDeclaration } = {};
    const declaredInterfaces: { [localName: string]: TSInterfaceDeclaration } = {};
    const importedElements: { [exportedName: string]: { localName: string; fileName: string } } = {};

    for (const statement of ast.body) {
      if (statement.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        if (statement.declaration &&
          statement.declaration.type === AST_NODE_TYPES.ClassDeclaration) {
          // Form: `export class A{}`
          if (!statement.declaration.id) {
            throw new Error(`Export parsing failure: missing exported class name in ${fileName} on line ${statement.declaration.loc.start.line} column ${statement.declaration.loc.start.column}`);
          }
          exportedClasses[statement.declaration.id.name] = statement.declaration;
        } else if (statement.declaration &&
          statement.declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
          // Form: `export interface A{}`
          exportedInterfaces[statement.declaration.id.name] = statement.declaration;
        } else if (statement.source &&
          statement.source.type === AST_NODE_TYPES.Literal &&
          typeof statement.source.value === 'string') {
          // Form: `export { A as B } from "b"`
          for (const specifier of statement.specifiers) {
            exportedImportedElements[specifier.exported.name] = {
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
      } else if (statement.type === AST_NODE_TYPES.TSInterfaceDeclaration && statement.id) {
        // Form: `declare interface A {}`
        declaredInterfaces[statement.id.name] = statement;
      } else if (statement.type === AST_NODE_TYPES.ImportDeclaration &&
        statement.source.type === AST_NODE_TYPES.Literal &&
        typeof statement.source.value === 'string') {
        // Form: `import {A} from './lib/A'`
        for (const specifier of statement.specifiers) {
          if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
            importedElements[specifier.local.name] = {
              localName: specifier.imported.name,
              fileName: Path.join(Path.dirname(fileName), statement.source.value),
            };
          }
        }
      }
    }

    return {
      exportedClasses,
      exportedInterfaces,
      exportedImportedElements,
      exportedImportedAll,
      exportedUnknowns,
      declaredClasses,
      declaredInterfaces,
      importedElements,
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
  // Interfaces that have been declared in a file via `export interface A`
  exportedInterfaces: {[exportedName: string]: TSInterfaceDeclaration};
  // Elements that have been exported via `export { A as B } from "b"`
  exportedImportedElements: { [exportedName: string]: { localName: string; fileName: string } };
  // Exports via `export * from "b"`
  exportedImportedAll: string[];
  // Things that have been exported via `export {A as B}`, where the target is not known
  exportedUnknowns: { [exportedName: string]: string };
  // Classes that have been declared in a file via `declare class A`
  declaredClasses: {[localName: string]: ClassDeclaration};
  // Interfaces that have been declared in a file via `declare interface A`
  declaredInterfaces: {[localName: string]: TSInterfaceDeclaration};
  // Elements that are imported from elsewhere via `import {A} from ''`
  importedElements: {[exportedName: string]: { localName: string; fileName: string }};
}
