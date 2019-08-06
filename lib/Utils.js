const parser = require('@typescript-eslint/typescript-estree');
const Path = require("path");
const fs = require("fs");

function getFiles(indexFile) {
    let files = {};
    const ast = parser.parse(indexFile);
    for(let declaration of ast.body) {
        let file = null;
        let className = null;
        let exportName = null;
        if(declaration.type === parser.AST_NODE_TYPES.ExportAllDeclaration) {
            const exportSource = declaration.source;
            if (exportSource.type === parser.AST_NODE_TYPES.Literal) {
                file = exportSource.value;
                className = "*";
                exportName = "*";
            }
        } else if(declaration.type === parser.AST_NODE_TYPES.ExportNamedDeclaration) {
            const exportSource = declaration.source;
            const specifiers = declaration.specifiers;
            for(let specifier of specifiers) {
                if(specifier.type === parser.AST_NODE_TYPES.ExportSpecifier) {
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
        if(file != null) {
            if(!(file in files)) {
                files[file] = new Set();
            }
            let list = files[file];
            list.add({
                className:className,
                exportName:exportName
            });
        }
    }
    return files;
}
function getClass(directory, className) {
    let indexPath = Path.join(directory, "index.ts");
    let files = getFiles(fs.readFileSync(indexPath, 'utf8'));
    // Go through all exported files and search for class name
    for (const [file, exportDetails] of Object.entries(files)) {
        let potentialFile = false;
        // We need to check all combinations, a function could be exported as {A as B} and {A as C} so we have to check B and C
        let searchNames = new Set();
        for (let exportDetail of exportDetails) {
            // We have to check the file source because we can't know for sure if the file contains the class
            if (exportDetail.className === "*") {
                // Wildcard means the class could be exported under its own name
                searchNames.add(className);
            } else if (exportDetail.exportName === className) {
                // In this case the class A is exported explicitely as {A} or {A as B}
                // In both cases we're looking for a function named A
                searchNames.add(exportDetail.className);
            }
        }
        if (searchNames.size === 0) {
            console.log("Did not find a matching exported function in " + file)
            continue;
        }
        console.log("Found potential file " + file + " with exported functions " + [...searchNames].join(", "));
        let filePath = Path.join(directory, file + ".ts")
        let fileContent = fs.readFileSync(filePath, 'utf8');
        const ast = parser.parse(fileContent, {loc: true, comment:true});
        for (let declarationBox of ast.body) {
            if (declarationBox.type == parser.AST_NODE_TYPES.ExportNamedDeclaration) {
                let declaration = declarationBox.declaration;
                if (declaration.type == parser.AST_NODE_TYPES.ClassDeclaration) {
                    if (searchNames.has(declaration.id.name)) {
                        let line = declarationBox.loc.start.line;
                        console.log("Found matching function for " + className + " on line " + line);
                        let declarationComment = null;
                        for(let comment of ast.comments) {
                            if(comment.loc.end.line === line - 1) {
                                declarationComment = comment.value;
                                declarationComment = declarationComment.replace(/\*/g, "")
                                declarationComment = declarationComment.trim();
                                break;
                            }
                        }
                        return {declaration: declaration, declarationComment: declarationComment};
                    }
                }
            }
        }
        console.log("Did not find a matching exported function in " + file)
    }
    return null;
}
module.exports ={
    getFiles:getFiles,
    getClass:getClass
}
