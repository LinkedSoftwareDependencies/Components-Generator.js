import type { AST, TSESTreeOptions, TSESTree } from '@typescript-eslint/typescript-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { Logger } from 'winston';
import type { ResolutionContext } from '../resolution/ResolutionContext';
import { filePathDirName, joinFilePath } from '../util/PathUtil';
import type {
  ClassLoaded,
  ClassReference,
  ClassReferenceLoaded,
  EnumLoaded,
  GenericTypes,
  InterfaceLoaded,
  TypeLoaded,
  GenericallyTyped,
} from './ClassIndex';
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
  public getSuperClassName(
    declaration: TSESTree.ClassDeclaration,
    fileName: string,
  ): GenericallyTyped<string> | undefined {
    if (!declaration.superClass) {
      return;
    }
    if (declaration.superClass.type === AST_NODE_TYPES.Identifier) {
      // Extensions in the form of `class A extends B`
      return {
        value: declaration.superClass.name,
        genericTypeInstantiations: declaration.superTypeArguments,
      };
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
   * @param _fileName The file name of the current class.
   */
  public getSuperInterfaceNames(
    declaration: TSESTree.TSInterfaceDeclaration,
    _fileName: string,
  ): GenericallyTyped<string>[] {
    return <GenericallyTyped<string>[]> declaration.extends
      // eslint-disable-next-line array-callback-return
      .map((extendsExpression) => {
        if (extendsExpression.type === AST_NODE_TYPES.TSInterfaceHeritage &&
          extendsExpression.expression.type === AST_NODE_TYPES.Identifier) {
          // Extensions in the form of `interface A extends B`
          return {
            value: extendsExpression.expression.name,
            genericTypeInstantiations: extendsExpression.typeArguments,
          };
        }
        // Ignore interfaces that we don't understand
        this.logger.debug(`Ignored an interface expression of unknown type ${extendsExpression.expression.type} on ${declaration.id.name}`);
      })
      .filter(Boolean);
  }

  /**
   * Find the interface names of the given class.
   * @param declaration A class declaration.
   * @param fileName The file name of the current class.
   */
  public getClassInterfaceNames(
    declaration: TSESTree.ClassDeclaration,
    fileName: string,
  ): GenericallyTyped<string>[] {
    const interfaceNames: GenericallyTyped<string>[] = [];
    if (declaration.implements) {
      for (const implement of declaration.implements) {
        if (implement.expression.type !== AST_NODE_TYPES.Identifier) {
          throw new Error(`Could not interpret the implements type on a class in ${fileName} on line ${implement.expression.loc.start.line} column ${implement.expression.loc.start.column}`);
        }
        interfaceNames.push({
          value: implement.expression.name,
          genericTypeInstantiations: implement.typeArguments,
        });
      }
    }
    return interfaceNames;
  }

  /**
   * Load the referenced class, and obtain its full class declaration.
   * Classes can either be defined in this file (exported or not), or imported from another file.
   * @param classReference The reference to a class.
   * @param considerInterfaces If the class reference is allows to refer to an interface, as well as a class.
   * @param considerOthers If the class reference is allows to refer to refer to other things,
   *                       such as a type alias or enum.
   */
  public async loadClassDeclaration<CI extends boolean, CT extends boolean>(
    classReference: ClassReference,
    considerInterfaces: CI,
    considerOthers: CT,
  ): Promise<CI extends true ?
      (CT extends true ? (ClassLoaded | InterfaceLoaded | TypeLoaded | EnumLoaded) : (ClassLoaded | InterfaceLoaded)) :
      (CT extends true ? (ClassLoaded | TypeLoaded | EnumLoaded) : (ClassLoaded))> {
    let targetString = 'class';
    if (considerInterfaces) {
      targetString += ' or interface';
    }
    if (considerOthers) {
      targetString += ' or other type';
    }

    // Load the class as an AST
    let ast;
    try {
      ast = await this.resolutionContext.parseTypescriptFile(classReference.fileName);
    } catch (error: unknown) {
      const name = `${classReference.qualifiedPath && classReference.qualifiedPath.length > 0 ? `${classReference.qualifiedPath.join('.')}.` : ''}${classReference.localName}`;
      throw new Error(`Could not load ${targetString} ${name} from ${classReference.fileName}:\n${(<Error> error).message}`);
    }

    return this.loadClassDeclarationFromAst(ast, targetString, classReference, considerInterfaces, considerOthers);
  }

  /**
   * Load the referenced class, and obtain its full class declaration.
   * Classes can either be defined in this file (exported or not), or imported from another file.
   * @param ast An abstract syntax tree.
   * @param targetString A string for error reporting on the considered scope.
   * @param classReference The reference to a class.
   * @param considerInterfaces If the class reference is allows to refer to an interface, as well as a class.
   * @param considerOthers If the class reference is allows to refer to refer to other things,
   *                       such as a type alias or enum.
   */
  public async loadClassDeclarationFromAst<CI extends boolean, CT extends boolean>(
    ast: AST<TSESTreeOptions> | TSESTree.TSModuleBlock,
    targetString: string,
    classReference: ClassReference,
    considerInterfaces: CI,
    considerOthers: CT,
  ): Promise<CI extends true ?
      (CT extends true ? (ClassLoaded | InterfaceLoaded | TypeLoaded | EnumLoaded) : (ClassLoaded | InterfaceLoaded)) :
      (CT extends true ? (ClassLoaded | TypeLoaded | EnumLoaded) : (ClassLoaded))> {
    const {
      exportedClasses,
      exportedInterfaces,
      exportedTypes,
      exportedEnums,
      exportedImportedAllNamed,
      declaredClasses,
      declaredInterfaces,
      declaredTypes,
      declaredEnums,
      declaredNamespaces,
      importedElements,
      importedElementsAllNamed,
      exportedImportedAll,
      exportedImportedElements,
      exportAssignment,
    } = this.getClassElements(classReference.packageName, classReference.fileName, ast);

    let componentName: string;
    let qualifiedPathInner: string[] | undefined;
    if (classReference.qualifiedPath && classReference.qualifiedPath.length > 0) {
      // In all following code, look for the qualified path head
      componentName = classReference.qualifiedPath[0];

      // For recursive calls to getClassElements, we'll have to slice off the head
      qualifiedPathInner = classReference.qualifiedPath.slice(1);
    } else {
      // Otherwise if we don't have a qualified path, look for the class name
      componentName = classReference.localName;

      // If the class has been exported in this file, return directly
      if (componentName in exportedClasses) {
        const declaration = exportedClasses[componentName];
        return <any> this.enhanceLoadedWithComment(<ClassLoaded>{
          type: 'class',
          ...classReference,
          declaration,
          ast,
          abstract: declaration.abstract,
          generics: this.collectGenericTypes(declaration),
        });
      }

      // If the class has been declared in this file, return directly
      if (componentName in declaredClasses) {
        const declaration = declaredClasses[componentName];
        return <any> this.enhanceLoadedWithComment(<ClassLoaded>{
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
        if (componentName in exportedInterfaces) {
          const declaration = exportedInterfaces[componentName];
          return <any> this.enhanceLoadedWithComment(<InterfaceLoaded>{
            type: 'interface',
            ...classReference,
            declaration,
            ast,
            generics: this.collectGenericTypes(declaration),
          });
        }

        // If the interface has been declared in this file, return directly
        if (componentName in declaredInterfaces) {
          const declaration = declaredInterfaces[componentName];
          return <any> this.enhanceLoadedWithComment(<InterfaceLoaded>{
            type: 'interface',
            ...classReference,
            declaration,
            ast,
            generics: this.collectGenericTypes(declaration),
          });
        }
      }

      // Only consider other types if explicitly enabled
      if (considerOthers) {
        // Check types
        if (componentName in exportedTypes) {
          const declaration = exportedTypes[componentName];
          return <any> this.enhanceLoadedWithComment(<TypeLoaded>{
            type: 'type',
            ...classReference,
            declaration,
            ast,
            generics: this.collectGenericTypes(declaration),
          });
        }
        if (componentName in declaredTypes) {
          const declaration = declaredTypes[componentName];
          return <any> this.enhanceLoadedWithComment(<TypeLoaded>{
            type: 'type',
            ...classReference,
            declaration,
            ast,
            generics: this.collectGenericTypes(declaration),
          });
        }

        // Check enums
        if (componentName in exportedEnums) {
          const declaration = exportedEnums[componentName];
          return <any> this.enhanceLoadedWithComment(<EnumLoaded>{
            type: 'enum',
            ...classReference,
            declaration,
            ast,
          });
        }
        if (componentName in declaredEnums) {
          const declaration = declaredEnums[componentName];
          return <any> this.enhanceLoadedWithComment(<EnumLoaded>{
            type: 'enum',
            ...classReference,
            declaration,
            ast,
          });
        }
      }
    }

    // If we haven't found anything so far, we will follow import/export links.

    // If the class is available via an import, follow that import link
    if (componentName in importedElements) {
      const entry = importedElements[componentName];
      let localNameInner: string;
      if (qualifiedPathInner) {
        localNameInner = classReference.localName;
        qualifiedPathInner = [ entry.localName, ...qualifiedPathInner ];
      } else {
        localNameInner = entry.localName;
      }
      return this.loadClassDeclaration(
        {
          ...entry,
          localName: localNameInner,
          qualifiedPath: qualifiedPathInner,
          fileNameReferenced: classReference.fileNameReferenced,
        },
        considerInterfaces,
        considerOthers,
      );
    }

    // If the class is available via an exported import, follow that import link
    if (componentName in exportedImportedElements) {
      const entry = exportedImportedElements[componentName];
      let localNameInner: string;
      if (qualifiedPathInner) {
        localNameInner = classReference.localName;
        qualifiedPathInner = [ entry.localName, ...qualifiedPathInner ];
      } else {
        localNameInner = entry.localName;
      }
      return this.loadClassDeclaration(
        {
          ...entry,
          localName: localNameInner,
          qualifiedPath: qualifiedPathInner,
          fileNameReferenced: classReference.fileNameReferenced,
        },
        considerInterfaces,
        considerOthers,
      );
    }

    // Check for named exported elements
    if (componentName in exportedImportedAllNamed) {
      return await this.loadClassDeclaration({
        localName: classReference.localName,
        qualifiedPath: qualifiedPathInner,
        ...exportedImportedAllNamed[componentName],
        fileNameReferenced: classReference.fileNameReferenced,
      }, considerInterfaces, considerOthers);
    }

    // Follow named import links
    if (componentName in importedElementsAllNamed) {
      return await this.loadClassDeclaration({
        localName: classReference.localName,
        qualifiedPath: qualifiedPathInner,
        ...importedElementsAllNamed[componentName],
        fileNameReferenced: classReference.fileNameReferenced,
      }, considerInterfaces, considerOthers);
    }

    // Check enum values
    if (classReference.qualifiedPath && classReference.qualifiedPath.length === 1) {
      const enumName = classReference.qualifiedPath[0];
      const enumKey = classReference.localName;
      const enumDeclaration = exportedEnums[enumName] || declaredEnums[enumName];
      if (enumDeclaration) {
        for (const enumMember of enumDeclaration.members) {
          if (enumMember.id.type === AST_NODE_TYPES.Identifier && enumMember.id.name === enumKey &&
            enumMember.initializer && enumMember.initializer.type === AST_NODE_TYPES.Literal) {
            // Expose the enum entry as type alias
            const typeNode: TSESTree.TSTypeAliasDeclaration = {
              type: AST_NODE_TYPES.TSTypeAliasDeclaration,
              id: {
                type: AST_NODE_TYPES.Identifier,
                name: enumKey,
                loc: <any> undefined,
                range: <any> undefined,
                parent: <any> undefined,
                typeAnnotation: <any> undefined,
                optional: <any> undefined,
                decorators: <any> undefined,
              },
              typeAnnotation: {
                type: AST_NODE_TYPES.TSLiteralType,
                literal: enumMember.initializer,
                loc: <any> undefined,
                range: <any> undefined,
                parent: <any> undefined,
              },
              loc: <any> undefined,
              range: <any> undefined,
              parent: <any> undefined,
              declare: <any> undefined,
              typeParameters: <any> undefined,
            };
            return <any> <TypeLoaded> {
              type: 'type',
              ...classReference,
              declaration: typeNode,
              ast,
            };
          }
        }
      }
    }

    // If we still haven't found the class, iterate over all export all's
    for (const subFile of exportedImportedAll) {
      try {
        return await this.loadClassDeclaration({
          localName: classReference.localName,
          qualifiedPath: qualifiedPathInner,
          ...subFile,
          fileNameReferenced: classReference.fileNameReferenced,
        }, considerInterfaces, considerOthers);
      } catch {
        // Ignore class not found errors
      }
    }

    // Check if the export assignment refers to a namespace
    if (exportAssignment && typeof exportAssignment === 'string' && exportAssignment in declaredNamespaces) {
      const namespace: TSESTree.TSModuleDeclaration = declaredNamespaces[exportAssignment];
      return this.loadClassDeclarationFromAst(
        <TSESTree.TSModuleBlock>namespace.body,
        targetString,
        classReference,
        considerInterfaces,
        considerOthers,
      );
    }

    const name = `${classReference.qualifiedPath && classReference.qualifiedPath.length > 0 ? `${classReference.qualifiedPath.join('.')}.` : ''}${classReference.localName}`;
    throw new Error(`Could not load ${targetString} ${name} from ${classReference.fileName}`);
  }

  /**
   * Create a hash of generic types in the given class declaration.
   * @param classDeclaration A class or interface declaration.
   */
  public collectGenericTypes(
    classDeclaration: TSESTree.ClassDeclaration | TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration,
  ): GenericTypes {
    const genericTypes: GenericTypes = {};
    if (classDeclaration.typeParameters) {
      for (const param of classDeclaration.typeParameters.params) {
        genericTypes[param.name.name] = { type: param.constraint, default: param.default };
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
   * @param filePath A file path.
   * @returns {Promise<ClassElements & { resolvedPath: string }>} Promise of the class elements along with
   * the resolved file path that was used to load these class elements.
   */
  public async loadClassElements(packageName: string, filePath: string): Promise<
  ClassElements & { resolvedPath: string }
  > {
    const resolvedPath = await this.resolutionContext.resolveTypesPath(filePath);
    const ast = await this.resolutionContext.parseTypescriptFile(resolvedPath);
    const classElements = this.getClassElements(packageName, resolvedPath, ast);
    return { ...classElements, resolvedPath };
  }

  /**
   * Convert the given import path to an absolute file path, coupled with the module it is part of.
   * Result is `undefined` if there was an error resolving the package.
   * @param currentPackageName Package name we are importing from.
   * @param currentFilePath Absolute path to a file in which the import path occurs.
   * @param importPath Possibly relative path that is being imported.
   */
  public importTargetToAbsolutePath(
    currentPackageName: string,
    currentFilePath: string,
    importPath: string,
  ): { packageName: string; fileName: string; fileNameReferenced: string } | undefined {
    // Handle import paths within the current package
    if (importPath.startsWith('.')) {
      const fileName = joinFilePath(filePathDirName(currentFilePath), importPath);
      const indexOfExtension = fileName.indexOf('.', fileName.lastIndexOf('/'));
      const fileNameWithoutExtension = indexOfExtension === -1 ?
        fileName :
        fileName.slice(0, indexOfExtension);
      return {
        packageName: currentPackageName,
        fileName: fileNameWithoutExtension,
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
    let packageRoot: string;
    try {
      packageRoot = this.resolutionContext.resolvePackageIndex(packageName, currentFilePath);
    } catch (error: unknown) {
      this.logger.warn(`Ignoring invalid package "${packageName}": ${(<Error> error).message}`);
      return;
    }
    const remoteFilePath = packagePath ?
      joinFilePath(filePathDirName(packageRoot), packagePath) :
      packageRoot.slice(0, packageRoot.indexOf('.', packageRoot.lastIndexOf('/')));
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
  public getClassElements(
    packageName: string,
    fileName: string,
    ast: AST<TSESTreeOptions> | TSESTree.TSModuleBlock,
  ): ClassElements {
    const exportedClasses: Record<string, TSESTree.ClassDeclaration> = {};
    const exportedInterfaces: Record<string, TSESTree.TSInterfaceDeclaration> = {};
    const exportedTypes: Record<string, TSESTree.TSTypeAliasDeclaration> = {};
    const exportedEnums: Record<string, TSESTree.TSEnumDeclaration> = {};
    const exportedNamespaces: Record<string, TSESTree.TSModuleDeclaration> = {};
    const exportedImportedElements: Record<string, ClassReference> = {};
    const exportedImportedAll: { packageName: string; fileName: string; fileNameReferenced: string }[] = [];
    const exportedImportedAllNamed:
    Record<string, { packageName: string; fileName: string; fileNameReferenced: string }> = {};
    const exportedUnknowns: Record<string, string> = {};
    const declaredClasses: Record<string, TSESTree.ClassDeclaration> = {};
    const declaredInterfaces: Record<string, TSESTree.TSInterfaceDeclaration> = {};
    const declaredTypes: Record<string, TSESTree.TSTypeAliasDeclaration> = {};
    const declaredEnums: Record<string, TSESTree.TSEnumDeclaration> = {};
    const declaredNamespaces: Record<string, TSESTree.TSModuleDeclaration> = {};
    const importedElements: Record<string, ClassReference> = {};
    const importedElementsAllNamed:
    Record<string, { packageName: string; fileName: string; fileNameReferenced: string }> = {};
    let exportAssignment: string | TSESTree.ClassDeclaration | undefined;

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
        } else if (statement.declaration && statement.declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
          // Form: `export type A = ...`
          exportedTypes[statement.declaration.id.name] = statement.declaration;
        } else if (statement.declaration && statement.declaration.type === AST_NODE_TYPES.TSEnumDeclaration) {
          // Form: `export enum A {...}`
          exportedEnums[statement.declaration.id.name] = statement.declaration;
        } else if (statement.declaration && statement.declaration.type === AST_NODE_TYPES.TSModuleDeclaration &&
          'name' in statement.declaration.id) {
          // Form: `export namespace A { ... }`
          exportedNamespaces[statement.declaration.id.name] = statement.declaration;
        } else if (statement.source &&
          statement.source.type === AST_NODE_TYPES.Literal &&
          typeof statement.source.value === 'string') {
          // Form: `export { A as B } from "b"`
          for (const specifier of statement.specifiers) {
            const entry = this.importTargetToAbsolutePath(packageName, fileName, statement.source.value);
            if (entry) {
              exportedImportedElements[specifier.exported.name] = {
                localName: specifier.local.name,
                qualifiedPath: undefined,
                ...entry,
              };
            }
          }
        } else {
          // Form: `export { A as B }`
          for (const specifier of statement.specifiers) {
            exportedUnknowns[specifier.exported.name] = specifier.local.name;
          }
        }
      } else if (statement.type === AST_NODE_TYPES.ExportAllDeclaration) {
        // Form: `export * from "b"` or `export * as B from "b"`
        if (statement.source &&
          statement.source.type === AST_NODE_TYPES.Literal &&
          typeof statement.source.value === 'string') {
          const entry = this.importTargetToAbsolutePath(packageName, fileName, statement.source.value);
          if (entry) {
            if (statement.exported) {
              exportedImportedAllNamed[statement.exported.name] = entry;
            } else {
              exportedImportedAll.push(entry);
            }
          }
        }
      } else if (statement.type === AST_NODE_TYPES.TSExportAssignment) {
        // Form: `export = ...`
        if (statement.expression.type === AST_NODE_TYPES.Identifier) {
          exportAssignment = statement.expression.name;
        } else if (statement.expression.type === AST_NODE_TYPES.ClassExpression) {
          exportAssignment = {
            ...statement.expression,
            type: AST_NODE_TYPES.ClassDeclaration,
          };
        }
      } else if (statement.type === AST_NODE_TYPES.ClassDeclaration && statement.id) {
        // Form: `declare class A {}`
        declaredClasses[statement.id.name] = statement;
      } else if (statement.type === AST_NODE_TYPES.TSInterfaceDeclaration && statement.id) {
        // Form: `declare interface A {}`
        declaredInterfaces[statement.id.name] = statement;
      } else if (statement.type === AST_NODE_TYPES.TSTypeAliasDeclaration && statement.id) {
        // Form: `declare type A = ...`
        declaredTypes[statement.id.name] = statement;
      } else if (statement.type === AST_NODE_TYPES.TSEnumDeclaration && statement.id) {
        // Form: `declare enum A {...}`
        declaredEnums[statement.id.name] = statement;
      } else if (statement.type === AST_NODE_TYPES.TSModuleDeclaration && statement.id && 'name' in statement.id) {
        // Form `declare namespace A { ... }
        declaredNamespaces[statement.id.name] = statement;
      } else if (statement.type === AST_NODE_TYPES.ImportDeclaration &&
        statement.source.type === AST_NODE_TYPES.Literal &&
        typeof statement.source.value === 'string') {
        const entry = this.importTargetToAbsolutePath(packageName, fileName, statement.source.value);
        if (entry) {
          for (const specifier of statement.specifiers) {
            if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
              // Form: `import {A} from './lib/A'`
              importedElements[specifier.local.name] = {
                localName: specifier.imported.name,
                qualifiedPath: undefined,
                ...entry,
              };
            } else if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
              // Form: `import * as A from './lib/A'`
              importedElementsAllNamed[specifier.local.name] = entry;
            }
          }
        }
      }
    }

    return {
      exportedClasses,
      exportedInterfaces,
      exportedTypes,
      exportedEnums,
      exportedNamespaces,
      exportedImportedElements,
      exportedImportedAll,
      exportedImportedAllNamed,
      exportedUnknowns,
      declaredClasses,
      declaredInterfaces,
      declaredTypes,
      declaredEnums,
      declaredNamespaces,
      importedElements,
      importedElementsAllNamed,
      exportAssignment,
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
  exportedClasses: Record<string, TSESTree.ClassDeclaration>;
  // Interfaces that have been declared in a file via `export interface A`
  exportedInterfaces: Record<string, TSESTree.TSInterfaceDeclaration>;
  // Types that have been declared in a file via `export type A = ...`
  exportedTypes: Record<string, TSESTree.TSTypeAliasDeclaration>;
  // Enums that have been declared in a file via `export enum A {...}`
  exportedEnums: Record<string, TSESTree.TSEnumDeclaration>;
  // Namespaces that have been declared in a file via `export namespace A { ... }`
  exportedNamespaces: Record<string, TSESTree.TSModuleDeclaration>;
  // Elements that have been exported via `export { A as B } from "b"`
  exportedImportedElements: Record<string, ClassReference>;
  // Exports via `export * from "b"`
  exportedImportedAll: { packageName: string; fileName: string; fileNameReferenced: string }[];
  // Exports via `export * as A from "b"`
  exportedImportedAllNamed: Record<string, { packageName: string; fileName: string; fileNameReferenced: string }>;
  // Things that have been exported via `export {A as B}`, where the target is not known
  exportedUnknowns: Record<string, string>;
  // Classes that have been declared in a file via `declare class A`
  declaredClasses: Record<string, TSESTree.ClassDeclaration>;
  // Interfaces that have been declared in a file via `declare interface A`
  declaredInterfaces: Record<string, TSESTree.TSInterfaceDeclaration>;
  // Types that have been declared in a file via `declare type A = ...`
  declaredTypes: Record<string, TSESTree.TSTypeAliasDeclaration>;
  // Enums that have been declared in a file via `declare enum A {...}`
  declaredEnums: Record<string, TSESTree.TSEnumDeclaration>;
  // Namespaces that have been declared in a file via `declare namespace A { ... }`
  declaredNamespaces: Record<string, TSESTree.TSModuleDeclaration>;
  // Elements that are imported from elsewhere via `import {A} from ''`
  importedElements: Record<string, ClassReference>;
  // Elements that are imported from elsewhere via `import * as A from ''`
  importedElementsAllNamed: Record<string, { packageName: string; fileName: string; fileNameReferenced: string }>;
  // Element exported via `export = ...`
  exportAssignment: string | TSESTree.ClassDeclaration | undefined;
}
