import * as Path from 'path';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import {
  ExportAllDeclaration,
  ExportNamedDeclaration,
  ImportClause,
  Program,
  Statement,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
import { logger } from './Core';
import { ClassExportDeclarations, ClassImportDeclarations, ExportDeclaration, ImportDeclaration } from './Types';
import * as Utils from './Utils';

/**
 * Utilities for parsing imports and exports of a class or interface
 */

/**
 * Parses the imports of the source tree
 *
 * @param ast the syntax tree to look in
 * @returns the parsed import declarations
 */
export function getImportDeclarations(ast: Program): ClassImportDeclarations {
  function getSpecifierImport(specifier: ImportClause) {
    switch (specifier.type) {
      case AST_NODE_TYPES.ImportSpecifier:
        return {
          // It is possible this name is also different from the actual class, because of export names
          // e.g. `export {A as B}` and `import {B as C}`
          className: specifier.imported.name,
          importName: specifier.local.name,
        };
      case AST_NODE_TYPES.ImportNamespaceSpecifier:
        // E.g. `import * as A from "b"`
        return {
          className: '*',
          importName: specifier.local.name,
        };
      default:
        logger.error(`Can't understand specifier ${specifier.type}`);
    }
  }

  function getImports(declaration: Statement): { importSource: string; imports: ImportDeclaration[] } | undefined {
    if (!declaration.type) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (declaration.type) {
      case AST_NODE_TYPES.ImportDeclaration: {
        const importSource = declaration.source;
        const imports: ImportDeclaration[] = <ImportDeclaration[]> declaration.specifiers
          .map(getSpecifierImport)
          .filter(Boolean);
        if (importSource.type === AST_NODE_TYPES.Literal &&
          typeof importSource.value === 'string') {
          return {
            importSource: importSource.value,
            imports,
          };
        }
        logger.error('Could not understand import declaration');

        return;
      }
      case AST_NODE_TYPES.TSImportEqualsDeclaration: {
        const namespace = declaration.id.name;
        const module = declaration.moduleReference;
        if (module.type === AST_NODE_TYPES.TSExternalModuleReference &&
          module.expression.type === AST_NODE_TYPES.Literal &&
          typeof module.expression.value === 'string') {
          return {
            importSource: module.expression.value,
            imports: [{
              className: '*',
              importName: namespace,
            }],
          };
        }
        logger.error('Could not understand import-equals declaration');
      }
    }
  }

  const files: ClassImportDeclarations = {};
  for (const declaration of ast.body) {
    const parsedExport = getImports(declaration);
    if (!parsedExport) {
      continue;
    }
    if (parsedExport.imports.length === 0) {
      continue;
    }
    const file = parsedExport.importSource;
    files[file] = Utils.union(files[file], parsedExport.imports);
  }
  return files;
}

/**
 * Parses the exports of the source tree
 *
 * @param ast the syntax tree to look in
 * @returns the parsed export declarations
 */
export function getExportDeclarations(ast: Program): ClassExportDeclarations {
  function getExports(declaration: ExportAllDeclaration | ExportNamedDeclaration):
  { exportSource: string; exports: ExportDeclaration[] } | undefined {
    switch (declaration.type) {
      case AST_NODE_TYPES.ExportAllDeclaration: {
        const exportSource = declaration.source;
        if (exportSource && exportSource.type === AST_NODE_TYPES.Literal &&
          typeof exportSource.value === 'string') {
          return {
            exportSource: exportSource.value,
            exports: [{
              className: '*',
              exportName: '*',
            }],
          };
        }
        return;
      }
      case AST_NODE_TYPES.ExportNamedDeclaration: {
        const exportSource = declaration.source;
        if (!exportSource) {
          logger.debug('Can not understand exported constant');
          return;
        }
        const specifiers = declaration.specifiers;
        const exports: ExportDeclaration[] = [];
        for (const specifier of specifiers) {
          if (specifier.type === AST_NODE_TYPES.ExportSpecifier) {
            exports.push({
              className: specifier.local.name,
              exportName: specifier.exported.name,
            });
          } else {
            logger.error(`Can't understand specifier ${specifier.type}`);
          }
        }
        if (exportSource.type === AST_NODE_TYPES.Literal) {
          if (typeof exportSource.value === 'string') {
            return {
              exportSource: exportSource.value,
              exports,
            };
          }
        }
      }
    }
  }

  const files: ClassExportDeclarations = {};
  for (const declaration of ast.body) {
    if (declaration.type === AST_NODE_TYPES.ExportAllDeclaration ||
      declaration.type === AST_NODE_TYPES.ExportNamedDeclaration) {
      const parsedExport = getExports(declaration);
      if (!parsedExport) {
        continue;
      }
      if (parsedExport.exports.length === 0) {
        continue;
      }
      const file = Path.normalize(parsedExport.exportSource);
      files[file] = Utils.union(files[file], parsedExport.exports);
    } else {
      logger.debug(`Skipping line with type ${declaration.type}`);
    }
  }
  return files;
}
