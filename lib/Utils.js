const parser = require('@typescript-eslint/typescript-estree');
const Path = require("path");
const fs = require("fs");

const typeToXsd = {
    [parser.AST_NODE_TYPES.TSBooleanKeyword]: ["boolean"],
    // We default to xsd:int because there's no way to detect the exact number type
    [parser.AST_NODE_TYPES.TSNumberKeyword]: ["int", "integer", "number", "byte", "long", "float", "decimal", "double"],
    [parser.AST_NODE_TYPES.TSStringKeyword]: ["string"],
};

function convertTypeToXsd(type) {
    if (type in typeToXsd) {
        return "xsd:" + typeToXsd[type][0];
    } else {
        return null;
    }
}

function getArray(object, key) {
    let result = object[key];
    return Array.isArray(result) ? result : [result];
}


function isValidXsd(type, matchedType) {
    if (type in typeToXsd) {
        return typeToXsd[type].includes(matchedType);
    } else {
        return null;
    }
}

function getComment(comments, declaration) {
    let line = declaration.loc.start.line;
    for (let comment of comments) {
        if (comment.loc.end.line === line - 1) {
            // The TypeScript parser removes some parts of a comment, we add them back
            return "/*" + comment.value + "*/";
        }
    }
    return null;
}

function getImportDeclarations(ast) {
    let files = {};
    for (let property of ast.body) {
        // TODO do we want to analyze imports such as `import Foo = require("bar");`
        if (property.type === parser.AST_NODE_TYPES.ImportDeclaration) {
            let file = property.source.value;
            let imports = new Set();
            for (let specifier of property.specifiers) {
                if (specifier.type === parser.AST_NODE_TYPES.ImportSpecifier) {
                    imports.add({
                        // className is the actual name of the import as this package sees it
                        // It is possible this name is also different from the actual class, because of export names
                        // e.g. `export {A as B}` and `import {B as C}`
                        className: specifier.imported.name,
                        // importName is the name that this class is giving to the export
                        importName: specifier.local.name
                    });
                } else if (specifier.type === parser.AST_NODE_TYPES.ImportNamespaceSpecifier) {
                    // e.g. `import * as A from "b"`
                    imports.add({
                        className: "*",
                        importName: specifier.local.name
                    });
                } else {
                    console.log("Can't understand specifier " + specifier.type);
                }
            }
            if (imports.size !== 0) {
                if (!(file in files)) {
                    files[file] = new Set();
                }
                let list = files[file];
                for (let importClass of imports) {
                    list.add(importClass);
                }
            }
        }
    }
    return files;
}

// TODO do we want a file as argument or an ast instead?
function getExportedDeclarations(indexFile) {
    let files = {};
    const ast = parser.parse(indexFile);
    for (let declaration of ast.body) {
        // The classes being exported
        let exports = new Set();
        let file = null;
        if (declaration.type === parser.AST_NODE_TYPES.ExportAllDeclaration) {
            const exportSource = declaration.source;
            file = exportSource.value;
            if (exportSource.type === parser.AST_NODE_TYPES.Literal) {
                exports.add({
                    className: "*",
                    exportName: "*"
                });
            }
        } else if (declaration.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
            const exportSource = declaration.source;
            file = exportSource.value;
            const specifiers = declaration.specifiers;
            for (let specifier of specifiers) {
                if (specifier.type === parser.AST_NODE_TYPES.ExportSpecifier) {
                    exports.add({
                        // className is the actual name of the class being exported
                        className: specifier.local.name,
                        // exportName is the name of the class that other packages will see
                        exportName: specifier.exported.name
                    });
                } else {
                    console.log("Can't understand specifier " + specifier.type);
                }
            }
        } else {
            console.log("Skipping line with type " + declaration.type);
        }
        if (file != null) {
            if (!(file in files)) {
                files[file] = new Set();
            }
            let list = files[file];
            for (let exportClass of exports) {
                list.add(exportClass);
            }
        }
    }
    return files;
}

function getClass(directory, className) {
    let indexPath = Path.join(directory, "index.ts");
    let exports = getExportedDeclarations(fs.readFileSync(indexPath, 'utf8'));
    // Go through all exported files and search for class name
    for (const [file, exportDetails] of Object.entries(exports)) {
        let potentialFile = false;
        // We need to check all combinations, a function could be exported as {A as B} and {A as C} so we have to check B and C
        let searchNames = new Set();
        for (let exportDetail of exportDetails) {
            // We have to check the file source because we can't know for sure if the file contains the class
            if (exportDetail.className === "*" || exportDetail.exportName === className) {
                // Wildcard means the class could be exported under its own name
                // Otherwise A is exported explicitly as {A} or {A as B}
                // In both cases we're looking for a function declaration A in the class
                searchNames.add(exportDetail.className);
            }
        }
        if (searchNames.size === 0) {
            console.log("Did not find a matching exported function in " + file);
            continue;
        }
        console.log("Found potential file " + file + " with exported functions " + [...searchNames].join(", "));
        let filePath = Path.join(directory, file + ".ts");
        let fileContent = fs.readFileSync(filePath, 'utf8');
        const ast = parser.parse(fileContent, {loc: true, comment: true});
        for (let declarationBox of ast.body) {
            if (declarationBox.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
                let declaration = declarationBox.declaration;
                if (declaration.type === parser.AST_NODE_TYPES.ClassDeclaration) {
                    // Check if it has been exported using the wildcard or if it has been exported normally
                    if ((searchNames.has("*") && declaration.id.name === className) ||
                        searchNames.has(declaration.id.name)) {
                        let line = declaration.loc.start.line;
                        console.log("Found matching function for " + className + " on line " + line);
                        return {ast: ast, declaration: declaration};
                    }
                }
            }
        }
        console.log("Did not find a matching exported function in " + file)
    }
    return null;
}

module.exports = {
    getFiles: getExportedDeclarations,
    getClass: getClass,
    convertTypeToXsd: convertTypeToXsd,
    getComment: getComment,
    isValidXsd: isValidXsd,
    getImportDeclarations: getImportDeclarations,
    getArray: getArray
};
