import * as Path from 'path';
import type { ClassDeclaration, TSInterfaceDeclaration } from '@typescript-eslint/types/dist/ts-estree';
import type { AST, TSESTreeOptions } from '@typescript-eslint/typescript-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { Logger } from 'winston';
import type { ResolutionContext } from '../resolution/ResolutionContext';
import type { ClassLoaded, ClassReference, ClassReferenceLoaded, GenericTypes, InterfaceLoaded } from './ClassIndex';
import type { CommentLoader } from './CommentLoader';

/**
 * Loads typescript classes from class references.
 */
export class ClassLoader {
  private readonly resolutionContext: ResolutionContext;
  private readonly logger: Logger;
  private readonly commentLoader: CommentLoader;

  public constructor(args: ClassLoaderArgs) {
    this.resolutionContext = args.resolutionContext;
    this.logger = args.logger;
    this.commentLoader = args.commentLoader;
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
    return <string[]> (declaration.extends || [])
      // eslint-disable-next-line array-callback-return
      .map(extendsExpression => {
        if (extendsExpression.type === AST_NODE_TYPES.TSInterfaceHeritage &&
          extendsExpression.expression.type === AST_NODE_TYPES.Identifier) {
          // Extensions in the form of `interface A extends B`
          return extendsExpression.expression.name;
        }
        // Ignore interfaces that we don't understand
        this.logger.debug(`Ignored an interface expression of unknown type ${extendsExpression.expression.type} on ${declaration.id.name}`);
      })
      .filter(iface => Boolean(iface));
  }

  /**
   * Find the interface names of the given class.
   * @param declaration A class declaration.
   * @param fileName The file name of the current class.
   */
  public getClassInterfaceNames(declaration: ClassDeclaration, fileName: string): string[] {
    const interfaceNames = [];
    if (declaration.implements) {
      for (const implement of declaration.implements) {
        if (implement.expression.type !== AST_NODE_TYPES.Identifier) {
          throw new Error(`Could not interpret the implements type on a class in ${fileName} on line ${implement.expression.loc.start.line} column ${implement.expression.loc.start.column}`);
        }
        interfaceNames.push(implement.expression.name);
      }
    }
    return interfaceNames;
  }

  /**
   * Load the referenced class, and obtain its full class declaration.
   * Classes can either be defined in this file (exported or not), or imported from another file.
   * @param classReference The reference to a class.
   * @param considerInterfaces If the class reference is allows to refer to an interface, as well as a class.
   */
  public async loadClassDeclaration<CI extends boolean>(classReference: ClassReference, considerInterfaces: CI):
  Promise<CI extends true ? (ClassLoaded | InterfaceLoaded) : ClassLoaded> {
    // Load the class as an AST
    let ast;
    try {
      ast = await this.resolutionContext.parseTypescriptFile(classReference.fileName);
    } catch (error: unknown) {
      throw new Error(`Could not load ${considerInterfaces ? 'class or interface' : 'class'} ${classReference.localName} from ${classReference.fileName}:\n${(<Error> error).message}`);
    }

    const {
      exportedClasses,
      exportedInterfaces,
      declaredClasses,
      declaredInterfaces,
      importedElements,
      exportedImportedAll,
      exportedImportedElements,
    } = this.getClassElements(classReference.packageName, classReference.fileName, ast);

    // If the class has been exported in this file, return directly
    if (classReference.localName in exportedClasses) {
      const declaration = exportedClasses[classReference.localName];
      return <any> this.enhanceLoadedWithComment(<ClassLoaded> {
        type: 'class',
        ...classReference,
        declaration,
        ast,
        abstract: declaration.abstract,
        generics: this.collectGenericTypes(declaration),
      });
    }

    // If the class has been declared in this file, return directly
    if (classReference.localName in declaredClasses) {
      const declaration = declaredClasses[classReference.localName];
      return <any> this.enhanceLoadedWithComment(<ClassLoaded> {
        type: 'class',
        ...classReference,
        declaration,
        ast,
        abstract: declaration.abstract,
        generics: this.collectGenericTypes(declaration),
      });
    }

    // Only consider interfaces if explicitly enabled
    if (considerInterfaces) {
      // If the interface has been exported in this file, return directly
      if (classReference.localName in exportedInterfaces) {
        const declaration = exportedInterfaces[classReference.localName];
        return <any> this.enhanceLoadedWithComment(<InterfaceLoaded> {
          type: 'interface',
          ...classReference,
          declaration,
          ast,
          generics: this.collectGenericTypes(declaration),
        });
      }

      // If the interface has been declared in this file, return directly
      if (classReference.localName in declaredInterfaces) {
        const declaration = declaredInterfaces[classReference.localName];
        return <any> this.enhanceLoadedWithComment(<InterfaceLoaded> {
          type: 'interface',
          ...classReference,
          declaration,
          ast,
          generics: this.collectGenericTypes(declaration),
        });
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
        return await this.loadClassDeclaration({
          localName: classReference.localName,
          ...subFile,
          fileNameReferenced: classReference.fileNameReferenced,
        }, considerInterfaces);
      } catch {
        // Ignore class not found errors
      }
    }

    throw new Error(`Could not load ${considerInterfaces ? 'class or interface' : 'class'} ${classReference.localName} from ${classReference.fileName}`);
  }

  /**
   * Create a hash of generic types in the given class declaration.
   * @param classDeclaration A class or interface declaration.
   */
  public collectGenericTypes(classDeclaration: ClassDeclaration | TSInterfaceDeclaration): GenericTypes {
    const genericTypes: GenericTypes = {};
    if (classDeclaration.typeParameters) {
      for (const param of classDeclaration.typeParameters.params) {
        genericTypes[param.name.name] = { type: param.constraint };
      }
    }
    return genericTypes;
  }

  /**
   * Annotate the given loaded class or interface with a comment if it is present on the declaration.
   * @param classLoaded A loaded class or interface.
   */
  public enhanceLoadedWithComment(classLoaded: ClassReferenceLoaded): ClassReferenceLoaded {
    const commentData = this.commentLoader.getCommentDataFromClassOrInterface(classLoaded);
    if (commentData.description) {
      classLoaded.comment = commentData.description;
    }
    return classLoaded;
  }

  /**
   * Load a class, and get all class elements from it.
   * @param packageName Package name we are importing from.
   * @param fileName A file path.
   */
  public async loadClassElements(packageName: string, fileName: string): Promise<ClassElements> {
    const ast = await this.resolutionContext.parseTypescriptFile(fileName);
    return this.getClassElements(packageName, fileName, ast);
  }

  /**
   * Convert the given import path to an absolute file path, coupled with the module it is part of.
   * @param currentPackageName Package name we are importing from.
   * @param currentFilePath Absolute path to a file in which the import path occurs.
   * @param importPath Possibly relative path that is being imported.
   */
  public importTargetToAbsolutePath(
    currentPackageName: string,
    currentFilePath: string,
    importPath: string,
  ): { packageName: string; fileName: string; fileNameReferenced: string } {
    // Handle import paths within the current package
    if (importPath.startsWith('.')) {
      return {
        packageName: currentPackageName,
        fileName: Path.join(Path.dirname(currentFilePath), importPath),
        fileNameReferenced: currentFilePath,
      };
    }

    // Handle import paths to other packages
    let packageName: string;
    let packagePath: string | undefined;
    if (importPath.startsWith('@')) {
      const slashIndexFirst = importPath.indexOf('/');
      if (slashIndexFirst < 0) {
        throw new Error(`Invalid scoped package name for import path '${importPath}' in '${currentFilePath}'`);
      }
      const slashIndexSecond = importPath.indexOf('/', slashIndexFirst + 1);
      if (slashIndexSecond < 0) {
        // Import form: "@scope/package"
        packageName = importPath;
      } else {
        // Import form: "@scope/package/path"
        packageName = importPath.slice(0, Math.max(0, slashIndexSecond));
        packagePath = importPath.slice(slashIndexSecond + 1);
      }
    } else {
      const slashIndex = importPath.indexOf('/');
      if (slashIndex < 0) {
        // Import form: "package"
        packageName = importPath;
      } else {
        // Import form: "package/path"
        packageName = importPath.slice(0, Math.max(0, slashIndex));
        packagePath = importPath.slice(slashIndex + 1);
      }
    }

    // Resolve paths
    const packageRoot = this.resolutionContext.resolvePackageIndex(packageName, currentFilePath);
    const remoteFilePath = packagePath ?
      Path.join(Path.dirname(packageRoot), packagePath) :
      packageRoot.slice(0, packageRoot.lastIndexOf('.'));
    return {
      packageName,
      fileName: remoteFilePath,
      fileNameReferenced: currentFilePath,
    };
  }

  /**
   * Get all class elements in a file.
   * @param packageName Package name we are importing from.
   * @param fileName A file path.
   * @param ast The parsed file.
   */
  public getClassElements(packageName: string, fileName: string, ast: AST<TSESTreeOptions>): ClassElements {
    const exportedClasses: Record<string, ClassDeclaration> = {};
    const exportedInterfaces: Record<string, TSInterfaceDeclaration> = {};
    const exportedImportedElements: Record<string, ClassReference> = {};
    const exportedImportedAll: { packageName: string; fileName: string; fileNameReferenced: string }[] = [];
    const exportedUnknowns: Record<string, string> = {};
    const declaredClasses: Record<string, ClassDeclaration> = {};
    const declaredInterfaces: Record<string, TSInterfaceDeclaration> = {};
    const importedElements: Record<string, ClassReference> = {};

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
              ...this.importTargetToAbsolutePath(packageName, fileName, statement.source.value),
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
          exportedImportedAll.push(this.importTargetToAbsolutePath(packageName, fileName, statement.source.value));
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
            try {
              importedElements[specifier.local.name] = {
                localName: specifier.imported.name,
                ...this.importTargetToAbsolutePath(packageName, fileName, statement.source.value),
              };
            } catch {
              // Omit imports that throw an error
            }
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
  logger: Logger;
  commentLoader: CommentLoader;
}

/**
 * Holder for all available classes in a file.
 */
export interface ClassElements {
  // Classes that have been declared in a file via `export class A`
  exportedClasses: Record<string, ClassDeclaration>;
  // Interfaces that have been declared in a file via `export interface A`
  exportedInterfaces: Record<string, TSInterfaceDeclaration>;
  // Elements that have been exported via `export { A as B } from "b"`
  exportedImportedElements: Record<string, ClassReference>;
  // Exports via `export * from "b"`
  exportedImportedAll: { packageName: string; fileName: string; fileNameReferenced: string }[];
  // Things that have been exported via `export {A as B}`, where the target is not known
  exportedUnknowns: Record<string, string>;
  // Classes that have been declared in a file via `declare class A`
  declaredClasses: Record<string, ClassDeclaration>;
  // Interfaces that have been declared in a file via `declare interface A`
  declaredInterfaces: Record<string, TSInterfaceDeclaration>;
  // Elements that are imported from elsewhere via `import {A} from ''`
  importedElements: Record<string, ClassReference>;
}
