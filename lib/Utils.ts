import {ClassDeclaration, FieldDeclaration} from "./AstUtils";
import {
    Statement,
    Comment,
    SourceLocation,
    LineAndColumnData
} from "@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree";

const parser = require('@typescript-eslint/typescript-estree');
const Path = require("path");
const fs = require("fs");
const commentParse = require("comment-parser");
const logger = require("./Core").logger;

const rangeTag = "range";
const defaultTag = "default";
const ignoredTag = "ignored";

const extensions = [".ts", ".d.ts"];

const typeToXsd = {
    [parser.AST_NODE_TYPES.TSBooleanKeyword]: ["boolean"],
    // We default to xsd:int because there's no way to detect the exact number type
    [parser.AST_NODE_TYPES.TSNumberKeyword]: ["int", "integer", "number", "byte", "long", "float", "decimal", "double"],
    [parser.AST_NODE_TYPES.TSStringKeyword]: ["string"],
};
const javascriptTypes: {[key: string]:any} = {
    "Boolean": parser.AST_NODE_TYPES.TSBooleanKeyword,
    "Number": parser.AST_NODE_TYPES.TSNumberKeyword,
    "String": parser.AST_NODE_TYPES.TSStringKeyword
};



export class Utils {
    /**
     * Checks validity of a type and its xsd range
     * @param type the node type from the parser
     * @param matchedType the xsd range
     * @returns whether this combination if valid
     */
    // TODO type?
    public static isValidXsd(type: any, matchedType: string, isArray: boolean = false): boolean {
        switch (type.type) {
            case(parser.AST_NODE_TYPES.TSTypeReference):
                // We do this to deal with JavaScript types such as Boolean, Number, String
                let typeName = type.typeName.name;
                if (typeName in javascriptTypes) {
                    let nodeType = javascriptTypes[typeName];
                    return typeToXsd[nodeType].includes(matchedType);
                }
                return false;
            case(parser.AST_NODE_TYPES.TSArrayType):
                if (isArray) {
                    logger.error(`Cannot parse nested array types`);
                    return false;
                }
                return Utils.isValidXsd(type.elementType, matchedType, true);
            default:
                let literal = type.type;
                return literal in typeToXsd ? typeToXsd[literal].includes(matchedType) : false;
        }
    }

    /**
     * Converts a type to a xsd range
     * @param type
     * @returns {string|null}
     */
    // TODO type?
    public static convertTypeToXsd(type: any, isArray = false): string {
        switch (type.type) {
            case(parser.AST_NODE_TYPES.TSTypeReference):
                // We do this to deal with JavaScript types such as Boolean, Number, String
                let typeName = type.typeName.name;
                if (typeName in javascriptTypes) {
                    let nodeType = javascriptTypes[typeName];
                    return `xsd:${typeToXsd[nodeType][0]}`;
                } else {
                    logger.debug(`Could not match type ${typeName} with a JavaScript type`);
                    return;
                }
            case(parser.AST_NODE_TYPES.TSArrayType):
                if (isArray) {
                    logger.error(`Cannot parse nested array types`);
                    return;
                }
                return Utils.convertTypeToXsd(type.elementType, true);
            default:
                let literal = type.type;
                return literal in typeToXsd ? `xsd:${typeToXsd[literal][0]}` : null;
        }
    }

    /**
     * Returns an array representing the value in the object
     * Returns an array if the value is already an array, otherwise wraps it
     * @param object
     * @param key
     * @returns {*[]}
     */
    public static getArray(object: {[key: string]: any}, key: string) {
        let result = object[key];
        if (result == null) return [];
        return Array.isArray(result) ? result : [result];
    }

    /**
     * Parses a comment and its tags
     * @param comment the comment as a string
     * @param fieldType the class of this field
     * @returns {{range:*, defaultValue:*, ignored:boolean, commentDescription:*}}
     */
    // TODO type?
    public static parseFieldComment(comment: string, fieldType: any) {
        let range;
        let defaultValue;
        let commentDescription;
        let ignored = false;
        if (comment != null) {
            let parsedComment = commentParse(comment);
            if (parsedComment.length !== 0) {
                let firstComment = parsedComment[0];
                if (firstComment.description.length !== 0) {
                    commentDescription = firstComment.description;
                }
                for (let tag of firstComment.tags) {
                    switch (tag.tag.toLowerCase()) {
                        case rangeTag:
                            let type = tag.type.toLowerCase();
                            if (Utils.isValidXsd(fieldType, type)) {
                                range = "xsd:" + type;
                            } else {
                                logger.error(`Found range type ${type} but could not match to ${fieldType.type}`);
                            }
                            break;
                        case defaultTag:
                            if (tag.type.length !== 0) defaultValue = tag.type;
                            break;
                        case ignoredTag:
                            ignored = true;
                            break;
                        default:
                            logger.debug(`Could not understand tag ${tag.tag}`);
                            break;
                    }
                }
            }
        }
        return {
            range: range,
            defaultValue: defaultValue,
            ignored: ignored,
            commentDescription: commentDescription
        };

    }

    /** Fixes a comment so it can be parsed by the library we're using
     * @returns the comment with proper surrounding slashes
     */
    public static fixComment(comment: Comment): string {
        // The TypeScript parser removes some parts of a comment, we add them back
        return `/*${comment.value}*/`;
    }

    /**
     * Gets comment from a declaration by checking if the comment ends on the line before the start of the declaration
     * @param comments to comments to search through
     * @param declaration the declaration to match
     * @returns the matched comment as a string
     */
    public static getComment(comments: Comment[], declaration: Statement): string {
        let line = declaration.loc.start.line;
        for (let comment of comments) {
            if (comment.loc.end.line === line - 1) {
                return Utils.fixComment(comment);
            }
        }
    }

    /**
     * Gets comment from a declaration by checking if the comment ends just before the start of the declaration
     * @param comments to comments to search through
     * @param {{line:int,column:int}} start the place after which a comment should be matched
     * @param {{line:int,column:int}} end the place before which a comment should be matched
     * @returns {string|null} the matched comment as a string
     */
    public static getInBetweenComment(comments: Comment[], start: LineAndColumnData, end: LineAndColumnData) {
        /**
         * @returns whether loc1 occurs after loc2
         */
        function isAfter(loc1: LineAndColumnData, loc2: LineAndColumnData): boolean {
            return loc2.line < loc1.line || (loc1.line === loc2.line && loc2.column <= loc1.column);
        }

        for (let comment of comments) {
            if (isAfter(comment.loc.start, start) && isAfter(end, comment.loc.end)) {
                return Utils.fixComment(comment);
            }
        }
    }


    /**
     * Reads the content of a file
     * @param filePath the file path
     * @returns {string} the content of the file
     */
    public static getContent(filePath: string): string {
        return fs.readFileSync(filePath, "utf8");
    }

    /**
     * Parses the content of a file as json
     * @param filePath the file path
     * @returns {object} the content of the file as an object
     */
    public static getJSON(filePath: string): any {
        return JSON.parse(Utils.getContent(filePath));
    }

    /**
     * Visits the files of a directory and its subdirectories recursively
     *
     * @param directory the root to start
     * @yields {filePath} the path of the currently visited file
     */
    public static *visitFiles(directory: string): IterableIterator<string> {
        const files = fs.readdirSync(directory);
        for (const file of files) {
            let filePath = Path.join(directory, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                yield* Utils.visitFiles(filePath);
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
    public static * visitJSONFiles(directory: string) {
        let filePaths = Utils.visitFiles(directory);
        for (let filePath of filePaths) {
            yield {filePath: filePath, json: Utils.getJSON(filePath)};
        }
    }

    /**
     * Checks if a file belongs to this package or to an external package
     * @param file the file to check
     * @returns {boolean} whether this file belongs to this package or to an external package
     */
    public static isLocalFile(file: string): boolean {
        return file.startsWith("/") || file.startsWith("./") || file.startsWith("../");
    }

    /**
     * Checks if two class declarations represent the same class
     * @param c1 first class
     * @param c2 other class
     * @returns {boolean} whether they are equal
     */
    public static classDeclarationEquals(c1: ClassDeclaration, c2: ClassDeclaration): boolean {
        return c1.pckg === c2.pckg &&
            c1.filePath === c2.filePath &&
            c1.internalClass === c2.internalClass;
    }

    /**
     * Unions a set by adding the content of the second collection to the first one
     * @param original the first set, can be null or undefined. In that case, a new set will be created.
     * @param other the set to copy the contents from
     */
    // TODO doc
    public static union<T>(original: T[], other: T[]): T[] {
        original = original == null ? [] : original;
        for (let item of other) {
            if(!(original.includes(item))) {
                original.push(item);
            }
        }
        return original;
    }

    /**
     * Creates a directory structure recursively
     * @param dir the directory create
     */
    public static mkdirRecursive(dir: string) {
        dir.split("/").forEach((dir, index, splits) => {
            const curParent = splits.slice(0, index).join('/');
            const dirPath = Path.resolve(curParent, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath);
            }
        });
    }

    /**
     * Copies the context of a component
     * @param fromDeclaration the declaration object that contains the component
     * @param to destination collection
     */
    public static copyContext(fromDeclaration: FieldDeclaration, to: String[]) {
        for (let contextFile of Utils.getArray(fromDeclaration.component.componentsContent, "@context")) {
            if (!to.includes(contextFile)) {
                to.push(contextFile);
            }
        }
    }


    /**
     * Gets the content of a TypeScript file based on its filepath without extension
     * @param path the filepath without extension
     * @returns {string|null} the content of the file
     */
    public static getTypeScriptFile(path: string): string {
        for (let extension of extensions) {
            let filePath = path + extension;
            if (fs.existsSync(filePath)) return Utils.getContent(filePath);
        }
    }
}
