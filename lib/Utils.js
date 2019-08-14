const parser = require('@typescript-eslint/typescript-estree');
const Path = require("path");
const fs = require("fs");
const commentParse = require("comment-parser");

const rangeTag = "range";
const requiredTag = "required";
const defaultTag = "default";
const ignoredTag = "ignored";


const typeToXsd = {
    [parser.AST_NODE_TYPES.TSBooleanKeyword]: ["boolean"],
    // We default to xsd:int because there's no way to detect the exact number type
    [parser.AST_NODE_TYPES.TSNumberKeyword]: ["int", "integer", "number", "byte", "long", "float", "decimal", "double"],
    [parser.AST_NODE_TYPES.TSStringKeyword]: ["string"],
};

/**
 * Checks validity of a type and its xsd range
 * @param type the node type from the parser
 * @param matchedType the xsd range
 * @returns {boolean} whether this combination if valid
 */
function isValidXsd(type, matchedType) {
    return type in typeToXsd ? typeToXsd[type].includes(matchedType) : false;
}

/**
 * Converts a type to a xsd range
 * @param type
 * @returns {string|null}
 */
function convertTypeToXsd(type) {
    return type in typeToXsd ? ("xsd:" + typeToXsd[type][0]) : null;
}

/**
 * Returns an array representing the value in the object
 * Returns an array if the value is already an array, otherwise wraps it
 * @param object
 * @param key
 * @returns {*[]}
 */
function getArray(object, key) {
    let result = object[key];
    if (result === null) return [];
    return Array.isArray(result) ? result : [result];
}

/**
 * Parses a comment and its tags
 * @param comment the comment as a string
 * @param fieldType the class of this field
 * @returns {{range:*, required:boolean, defaultValue:*, commentDescription:*, ignored:boolean}}
 */
function parseFieldComment(comment, fieldType) {
    let range = null;
    let required = true;
    let defaultValue = null;
    let commentDescription = null;
    let ignored = false;
    if (comment != null) {
        let parsedComment = commentParse(comment);
        if (parsedComment.length !== 0) {
            // TODO why there can be multiple comments?
            let firstComment = parsedComment[0];
            if (firstComment.description.length !== 0) {
                commentDescription = firstComment.description;
            }
            for (let tag of firstComment.tags) {
                switch (tag.tag) {
                    case rangeTag:
                        let type = tag.type;
                        if (isValidXsd(fieldType, type)) {
                            range = "xsd:" + type;
                        } else {
                            console.log(`Found range type ${type} but could not match to ${fieldType}`);
                        }
                        break;
                    case requiredTag:
                        required = true;
                        break;
                    case defaultTag:
                        if (tag.type.length !== 0) defaultValue = tag.type;
                        break;
                    case ignoredTag:
                        ignored = true;
                        break;
                    default:
                        console.log(`Could not understand tag ${tag.tag}`);
                        break;
                }
            }
        }
    }
    return {
        range: range,
        required: required,
        defaultValue: defaultValue,
        commentDescription: commentDescription,
        ignored: ignored
    };

}

/**
 * @returns {string} the comment with proper surrounding slashes so it can be parsed
 */
// TODO do we need the trailing star?
function fixComment(comment) {
    // The TypeScript parser removes some parts of a comment, we add them back
    return "/*" + comment.value + "*/";
}

/**
 * Gets comment from a declaration by checking if the comment ends just before the start of the declaration
 * @param comments to comments to search through
 * @param declaration the declaration to match
 * @returns {string|null} the matched comment as a string
 */
function getComment(comments, declaration) {
    let line = declaration.loc.start.line;
    for (let comment of comments) {
        if (comment.loc.end.line === line - 1) {
            return fixComment(comment);
        }
    }
    return null;
}

/**
 * Gets comment from a declaration by checking if the comment ends just before the start of the declaration
 * @param comments to comments to search through
 * @param {{line:int,column:int}} start the place after which a comment should be matched
 * @param {{line:int,column:int}} end the place before which a comment should be matched
 * @returns {string|null} the matched comment as a string
 */
function getInBetweenComment(comments, start, end) {
    /**
     * @returns whether loc1 occurs after loc2
     */
    function isAfter(loc1, loc2) {
        return loc2.line < loc1.line || (loc1.line === loc2.line && loc2.column <= loc1.column);
    }
    for (let comment of comments) {
        if (isAfter(comment.loc.start, start) && isAfter(end, comment.loc.end)) {
            return fixComment(comment);
        }
    }
    return null;
}


/**
 * Reads the content of a file
 * @param filePath the file path
 * @returns {string} the content of the file
 */
function getContent(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

/**
 * Parses the content of a file as json
 * @param filePath the file path
 * @returns {object} the content of the file as an object
 */
function getJSON(filePath) {
    return JSON.parse(getContent(filePath));
}

/**
 * Visits the files of a directory and its subdirectories recursively
 *
 * @param directory the root to start
 * @yields {filePath} the path of the currently visited file
 */
function* visitFiles(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        let filePath = Path.join(directory, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            yield* visitFiles(filePath);
            continue;
        }
        yield filePath;
    }
    return false;
}

/**
 * Visits the json files of a directory and its subdirectories recursively
 *
 * @param directory the root to start
 * @yields {{filePath:string,json}} the path of the currently visited file
 */
function* visitJSONFiles(directory) {
    let filePaths = visitFiles(directory);
    for (let filePath of filePaths) {
        yield {filePath: filePath, json: getJSON(filePath)};
    }
}

/**
 * Checks if a file belongs to this package or to an external package
 * @param file the file to check
 * @returns {boolean} whether this file belongs to this package or to an external package
 */
function isLocalFile(file) {
    return file.startsWith("/") || file.startsWith("./") || file.startsWith("../");
}

module.exports = {
    convertTypeToXsd: convertTypeToXsd,
    getComment: getComment,
    isValidXsd: isValidXsd,
    getArray: getArray,
    getJSON: getJSON,
    getContent: getContent,
    visitJSONFiles: visitJSONFiles,
    parseFieldComment: parseFieldComment,
    isLocalFile: isLocalFile,
    getInBetweenComment: getInBetweenComment
};
