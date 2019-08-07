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
    if(type in typeToXsd) {
        return "xsd:" + typeToXsd[type][0];
    }else {
        return null;
    }
}

function isValidXsd(type, matchedType) {
    if(type in typeToXsd) {
        return typeToXsd[type].includes(matchedType);
    }else {
        return null;
    }
}

function getComment(comments, declaration) {
    let line = declaration.loc.start.line;
    for (let comment of comments) {
        if (comment.loc.end.line === line - 1) {
            return "/*" + comment.value + "*/";
        }
    }
    return null;
}
function getExportedDeclarations(indexFile) {
    let files = {};
    const ast = parser.parse(indexFile);
    for (let declaration of ast.body) {
        let file = null;
        // The class being exported
        let className = null;
        // The name it has been exported with
        let exportName = null;
        if (declaration.type === parser.AST_NODE_TYPES.ExportAllDeclaration) {
            const exportSource = declaration.source;
            if (exportSource.type === parser.AST_NODE_TYPES.Literal) {
                file = exportSource.value;
                className = "*";
                exportName = "*";
            }
        } else if (declaration.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
            const exportSource = declaration.source;
            const specifiers = declaration.specifiers;
            for (let specifier of specifiers) {
                if (specifier.type === parser.AST_NODE_TYPES.ExportSpecifier) {
                    file = exportSource.value;
                    className = specifier.local.name;
                    exportName = specifier.exported.name;
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
            list.add({
                className: className,
                exportName: exportName
            });
        }
    }
    return files;
}

function getClass(directory, className) {
    let indexPath = Path.join(directory, "index.ts");
    let files = getExportedDeclarations(fs.readFileSync(indexPath, 'utf8'));
    // Go through all exported files and search for class name
    for (const [file, exportDetails] of Object.entries(files)) {
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
                        return {ast:ast,declaration: declaration};
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
    isValidXsd:isValidXsd
};
