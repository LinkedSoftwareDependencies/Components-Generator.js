import {
    ExportAllDeclaration,
    ExportNamedDeclaration,
    ImportClause,
    Program,
    Statement
} from "@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree";
import {ClassExportDeclarations, ClassImportDeclarations, ExportDeclaration, ImportDeclaration} from "./Types";
import {AST_NODE_TYPES} from "@typescript-eslint/typescript-estree";
import {logger} from "./Core";
import {Utils} from "./Utils";
import * as Path from "path";

/**
 * Utility class for parsing imports and exports of a class or interface
 */
export class ImportExportReader {
    /**
     * Parses the imports of the source tree
     *
     * @param ast the syntax tree to look in
     * @returns the parsed import declarations
     */
    public static getImportDeclarations(ast: Program): ClassImportDeclarations {
        function getSpecifierImport(specifier: ImportClause) {
            switch (specifier.type) {
                case AST_NODE_TYPES.ImportSpecifier:
                    return {
                        // It is possible this name is also different from the actual class, because of export names
                        // e.g. `export {A as B}` and `import {B as C}`
                        className: specifier.imported.name,
                        importName: specifier.local.name
                    };
                case AST_NODE_TYPES.ImportNamespaceSpecifier:
                    // e.g. `import * as A from "b"`
                    return {
                        className: "*",
                        importName: specifier.local.name
                    };
                default:
                    logger.error(`Can't understand specifier ${specifier.type}`);
                    return;
            }
        }

        function getImports(declaration: Statement): { importSource: string, imports: ImportDeclaration[] } {
            switch (declaration.type) {
                case AST_NODE_TYPES.ImportDeclaration: {
                    let importSource = declaration.source;
                    let imports = declaration.specifiers
                        .map(getSpecifierImport)
                        .filter(x => x != null);
                    if (importSource.type === AST_NODE_TYPES.Literal &&
                        typeof importSource.value === "string") {
                        return {
                            importSource: importSource.value, imports: imports
                        };
                    } else {
                        logger.error("Could not understand import declaration");
                    }
                    return;
                }
                case AST_NODE_TYPES.TSImportEqualsDeclaration: {
                    let namespace = declaration.id.name;
                    let module = declaration.moduleReference;
                    if (module.type === AST_NODE_TYPES.TSExternalModuleReference
                        && module.expression.type === AST_NODE_TYPES.Literal
                        && typeof module.expression.value === "string") {
                        return {
                            importSource: module.expression.value, imports: [{
                                className: "*",
                                importName: namespace
                            }]
                        }
                    } else {
                        logger.error("Could not understand import-equals declaration");
                    }
                    return;
                }
            }
        }

        let files: ClassImportDeclarations = {};
        for (let declaration of ast.body) {
            let parsedExport = getImports(declaration);
            if (parsedExport == null) continue;
            if (parsedExport.imports.length === 0) continue;
            let file = parsedExport.importSource;
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
    public static getExportDeclarations(ast: Program): ClassExportDeclarations {
        function getExports(declaration: ExportAllDeclaration | ExportNamedDeclaration): { exportSource: string, exports: ExportDeclaration[] } {
            switch (declaration.type) {
                case AST_NODE_TYPES.ExportAllDeclaration: {
                    let exportSource = declaration.source;
                    if (exportSource.type === AST_NODE_TYPES.Literal &&
                        typeof exportSource.value === "string") {
                        return {
                            exportSource: exportSource.value, exports: [{
                                className: "*",
                                exportName: "*"
                            }]
                        };
                    }
                    return;
                }
                case AST_NODE_TYPES.ExportNamedDeclaration: {
                    let exportSource = declaration.source;
                    if (exportSource == null) {
                        logger.debug("Can not understand exported constant");
                        return;
                    }
                    const specifiers = declaration.specifiers;
                    let exports: ExportDeclaration[] = [];
                    for (let specifier of specifiers) {
                        if (specifier.type === AST_NODE_TYPES.ExportSpecifier) {
                            exports.push({
                                className: specifier.local.name,
                                exportName: specifier.exported.name
                            });
                        } else {
                            logger.error(`Can't understand specifier ${specifier.type}`);
                        }
                    }
                    if (exportSource.type === AST_NODE_TYPES.Literal) {
                        if (typeof exportSource.value === "string") {
                            return {
                                exportSource: exportSource.value,
                                exports: exports
                            };
                        }
                    }
                    return;
                }
            }
        }

        let files: ClassExportDeclarations = {};
        for (let declaration of ast.body) {
            if (declaration.type === AST_NODE_TYPES.ExportAllDeclaration ||
                declaration.type === AST_NODE_TYPES.ExportNamedDeclaration) {
                let parsedExport = getExports(declaration);
                if (parsedExport == null) continue;
                if (parsedExport.exports.length === 0) continue;
                let file = Path.normalize(parsedExport.exportSource);
                files[file] = Utils.union(files[file], parsedExport.exports);
            } else {
                logger.error(`Skipping line with type ${declaration.type}`);
            }
        }
        return files;
    }
}
