import {ParsedClassDeclaration} from "./Types";
import {TypeNode} from "@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree";
import {AST_NODE_TYPES} from "@typescript-eslint/typescript-estree";
import {logger} from "./Core";
import * as fs from "fs";
import * as Path from "path";
import ComponentsJsUtil = require("componentsjs/lib/Util");

const typescriptExtensions = [".ts", ".d.ts"];

/**
 * A mapping from AST node type to xsd type
 */
const typeToXsd: {
    [key in AST_NODE_TYPES]?: string[];
} = {
    [AST_NODE_TYPES.TSBooleanKeyword]: ["boolean"],
    // We default to xsd:int because there's no way to detect the exact number type
    [AST_NODE_TYPES.TSNumberKeyword]: ["int", "integer", "number", "byte", "long", "float", "decimal", "double"],
    [AST_NODE_TYPES.TSStringKeyword]: ["string"]
};
/**
 * A mapping from built-in Javascript type to AST node type
 * Notice the uppercase names, indicating these are Javascript types
 */
const javascriptTypes: {
    [key: string]: AST_NODE_TYPES;
} = {
    "Boolean": AST_NODE_TYPES.TSBooleanKeyword,
    "Number": AST_NODE_TYPES.TSNumberKeyword,
    "String": AST_NODE_TYPES.TSStringKeyword
};


/**
 * General utility class
 */
export class Utils {

    /**
     * Checks validity of a type and its xsd range
     *
     * @param type the node type from the parser
     * @param matchedType the xsd range
     * @param isArray whether this annotation is the child of an array annotation. We do this to avoid parsing
     * multi-dimensional arrays
     * @returns whether this combination if valid
     */
    public static isValidXsd(type: TypeNode, matchedType: string, isArray: boolean = false): boolean {
        switch (type.type) {
            case AST_NODE_TYPES.TSTypeReference: {
                if (type.typeName.type === AST_NODE_TYPES.Identifier) {
                    // We do this to deal with JavaScript types such as Boolean, Number, String
                    let typeName = type.typeName.name;
                    if (typeName in javascriptTypes) {
                        let nodeType = javascriptTypes[typeName];
                        return typeToXsd[nodeType].includes(matchedType);
                    }
                }
                return false;
            }
            case AST_NODE_TYPES.TSArrayType:
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
     * Converts a type to a xsd range if there's a matching one
     *
     * @param type
     * @param isArray whether this annotation is the child of an array annotation. We do this to avoid parsing
     * multi-dimensional arrays
     * @returns the xsd type
     */
    public static convertTypeToXsd(type: TypeNode, isArray = false): string {
        switch (type.type) {
            case AST_NODE_TYPES.TSTypeReference:
                if (type.typeName.type === AST_NODE_TYPES.Identifier) {
                    // We do this to deal with JavaScript types such as Boolean, Number, String
                    let typeName = type.typeName.name;
                    if (typeName in javascriptTypes) {
                        let nodeType = javascriptTypes[typeName];
                        return `xsd:${typeToXsd[nodeType][0]}`;
                    } else {
                        logger.debug(`Could not match type ${typeName} with a JavaScript type`);
                        return;
                    }
                } else {
                    logger.debug(`Could not understand type ${type.typeName.type}`);
                    return;
                }
            case AST_NODE_TYPES.TSArrayType:
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
     *
     * @param object
     * @param key
     * @returns the value as an array
     */
    public static getArray(object: { [key: string]: any }, key: string): any[] {
        let result = object[key];
        if (result == null) return [];
        return Array.isArray(result) ? result : [result];
    }

    /**
     * Reads the content of a file
     *
     * @param filePath the file path
     * @returns the content of the file
     */
    public static getContent(filePath: string): string {
        return fs.readFileSync(filePath, "utf8");
    }

    /**
     * Parses the content of a file as json
     * @param filePath the file path
     * @returns the content of the file as an object
     */
    public static getJSON(filePath: string): any {
        try {
            return JSON.parse(Utils.getContent(filePath));
        } catch (e) {
            throw new Error(`JSON syntax error in ${filePath}: ${e.message}`);
        }
    }

    /**
     * Visits the files of a directory and its subdirectories recursively
     *
     * @param directory the root to start
     * @returns a generator that yields the path of the currently visited file
     */
    public static* visitFiles(directory: string): IterableIterator<string> {
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
     * Visits the jsonld files of a directory and its subdirectories recursively
     *
     * @param directory the root to start
     * @returns a generator that yields the path of the currently visited file
     */
    public static* visitJSONLDFiles(directory: string) {
        let filePaths = Utils.visitFiles(directory);
        for (let filePath of filePaths) {
            if (!filePath.endsWith(".jsonld")) {
                logger.debug(`Skipping file ${filePath} without .jsonld extension`);
                continue;
            }
            let json;
            try {
                json = Utils.getJSON(filePath);
            } catch (e) {
                logger.debug(`Skipping file ${filePath} with invalid json`);
                logger.debug(e);
                continue;
            }
            yield {filePath: filePath, json: json};
        }
    }

    /**
     * Checks if a file belongs to this package or to an external package
     *
     * @param file the file to check
     * @returns {boolean} whether this file belongs to this package or to an external package
     * @see https://www.typescriptlang.org/docs/handbook/module-resolution.html
     */
    public static isLocalFile(file: string): boolean {
        return file.startsWith("/") || file.startsWith("./") || file.startsWith("../");
    }

    /**
     * Checks if two class declarations represent the same class
     * @param c1 first class
     * @param c2 other class
     * @returns whether they are equal
     */
    public static classDeclarationEquals(c1: ParsedClassDeclaration, c2: ParsedClassDeclaration): boolean {
        return c1.packageName === c2.packageName &&
            c1.filePath === c2.filePath &&
            c1.className === c2.className;
    }

    /**
     * Unions a list by adding the content of the second collection to the first one
     * This modifies the original list
     * No duplicate elements will be added
     *
     * @param original the first list, can be null or undefined. In that case, a new list will be created.
     * @param other the list to copy the contents from
     * @returns the union list
     */
    public static union<T>(original: T[], other: T[]): T[] {
        original = original == null ? [] : original;
        for (let item of other) {
            if (!(original.includes(item))) {
                original.push(item);
            }
        }
        return original;
    }

    /**
     * Creates a directory structure recursively
     *
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
     *
     * @param componentContent the content of the component file
     * @param to destination collection
     */
    public static copyContext(componentContent: any, to: String[]) {
        for (let contextFile of Utils.getArray(componentContent, "@context")) {
            if (!to.includes(contextFile)) {
                to.push(contextFile);
            }
        }
    }

    /**
     * Searches for the root directory of a package
     *
     * @param name the name of the package as declared in the `package.json`
     * @returns the root directory of the package
     */
    public static getPackageRootDirectory(name: string): string {
        let entries: [string, any][] = Object.entries(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS);
        for (const [packageJsonPath, packageInfo] of entries) {
            if (name === packageInfo["name"]) {
                return Path.dirname(packageJsonPath);
            }
        }
    }

    /**
     * Gets the content of a TypeScript file based on its filepath without extension
     * @param path the filepath without extension
     *
     * @returns the content of the file
     */
    public static getTypeScriptFile(path: string): string {
        for (let extension of typescriptExtensions) {
            let filePath = path + extension;
            if (fs.existsSync(filePath)) return Utils.getContent(filePath);
        }
    }
}
