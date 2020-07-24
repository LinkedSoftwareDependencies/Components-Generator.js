import * as fs from 'fs';
import * as Path from 'path';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { TypeNode } from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import ComponentsJsUtil = require('componentsjs/lib/Util');
import { logger } from './Core';
import { ParsedClassDeclaration } from './Types';

const typescriptExtensions = [ '.ts', '.d.ts' ];

/**
 * A mapping from AST node type to xsd type
 */
const typeToXsd: {
  [key in AST_NODE_TYPES]?: string[];
} = {
  [AST_NODE_TYPES.TSBooleanKeyword]: [ 'boolean' ],
  // We default to xsd:int because there's no way to detect the exact number type
  [AST_NODE_TYPES.TSNumberKeyword]: [ 'int', 'integer', 'number', 'byte', 'long', 'float', 'decimal', 'double' ],
  [AST_NODE_TYPES.TSStringKeyword]: [ 'string' ],
};
/**
 * A mapping from built-in Javascript type to AST node type
 * Notice the uppercase names, indicating these are Javascript types
 */
const javascriptTypes: {
  [key: string]: AST_NODE_TYPES;
} = {
  Boolean: AST_NODE_TYPES.TSBooleanKeyword,
  Number: AST_NODE_TYPES.TSNumberKeyword,
  String: AST_NODE_TYPES.TSStringKeyword,
};

/**
 * General utilities
 */

/**
 * Checks validity of a type and its xsd range
 *
 * @param type the node type from the parser
 * @param matchedType the xsd range
 * @param isArray whether this annotation is the child of an array annotation. We do this to avoid parsing
 * multi-dimensional arrays
 * @returns whether this combination if valid
 */
export function isValidXsd(type: TypeNode, matchedType: string, isArray = false): boolean {
  const typeType = type.type;
  switch (type.type) {
    case AST_NODE_TYPES.TSTypeReference: {
      if (type.typeName.type === AST_NODE_TYPES.Identifier) {
        // We do this to deal with JavaScript types such as Boolean, Number, String
        const typeName = type.typeName.name;
        if (typeName in javascriptTypes) {
          const nodeType = javascriptTypes[typeName];
          return (<string[]> typeToXsd[nodeType]).includes(matchedType);
        }
      }
      return false;
    }
    case AST_NODE_TYPES.TSArrayType:
      if (isArray) {
        logger.error(`Cannot parse nested array types`);
        return false;
      }
      return isValidXsd(type.elementType, matchedType, true);
    default:
      return typeType in typeToXsd ? (<string[]> typeToXsd[typeType]).includes(matchedType) : false;
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
export function convertTypeToXsd(type: TypeNode, isArray = false): string | undefined {
  const typeType = type.type;
  switch (type.type) {
    case AST_NODE_TYPES.TSTypeReference:
      if (type.typeName.type === AST_NODE_TYPES.Identifier) {
        // We do this to deal with JavaScript types such as Boolean, Number, String
        const typeName = type.typeName.name;
        if (typeName in javascriptTypes) {
          const nodeType = javascriptTypes[typeName];
          return `xsd:${(<string[]> typeToXsd[nodeType])[0]}`;
        }
        logger.debug(`Could not match type ${typeName} with a JavaScript type`);
        return;
      }
      logger.debug(`Could not understand type ${type.typeName.type}`);
      return;

    case AST_NODE_TYPES.TSArrayType:
      if (isArray) {
        logger.error(`Cannot parse nested array types`);
        return;
      }
      return convertTypeToXsd(type.elementType, true);
    default:
      return typeType in typeToXsd ? `xsd:${(<string[]> typeToXsd[typeType])[0]}` : undefined;
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
export function getArray(object: { [key: string]: any }, key: string): any[] {
  const result = object[key];
  if (!result) {
    return [];
  }
  return Array.isArray(result) ? result : [ result ];
}

/**
 * Reads the content of a file
 *
 * @param filePath the file path
 * @returns the content of the file
 */
export function getContent(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Parses the content of a file as json
 * @param filePath the file path
 * @returns the content of the file as an object
 */
export function getJSON(filePath: string): any {
  try {
    return JSON.parse(getContent(filePath));
  } catch (error) {
    throw new Error(`JSON syntax error in ${filePath}: ${error.message}`);
  }
}

/**
 * Visits the files of a directory and its subdirectories recursively
 *
 * @param directory the root to start
 * @returns a generator that yields the path of the currently visited file
 */
export function * visitFiles(directory: string): IterableIterator<string> {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = Path.join(directory, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      yield * visitFiles(filePath);
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
export function * visitJSONLDFiles(directory: string) {
  const filePaths = visitFiles(directory);
  for (const filePath of filePaths) {
    if (!filePath.endsWith('.jsonld')) {
      logger.debug(`Skipping file ${filePath} without .jsonld extension`);
      continue;
    }
    let json;
    try {
      json = getJSON(filePath);
    } catch (error) {
      logger.debug(`Skipping file ${filePath} with invalid json`);
      logger.debug(error);
      continue;
    }
    yield { filePath, json };
  }
}

/**
 * Checks if a file belongs to this package or to an external package
 *
 * @param file the file to check
 * @returns {boolean} whether this file belongs to this package or to an external package
 * @see https://www.typescriptlang.org/docs/handbook/module-resolution.html
 */
export function isLocalFile(file: string): boolean {
  return file.startsWith('/') || file.startsWith('./') || file.startsWith('../');
}

/**
 * Checks if two class declarations represent the same class
 * @param c1 first class
 * @param c2 other class
 * @returns whether they are equal
 */
export function classDeclarationEquals(c1: ParsedClassDeclaration, c2: ParsedClassDeclaration): boolean {
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
export function union<T>(original: T[], other: T[]): T[] {
  original = !original ? [] : original;
  for (const item of other) {
    if (!original.includes(item)) {
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
export function mkdirRecursive(dir: string) {
  dir.split('/').forEach((dirInner, index, splits) => {
    const curParent = splits.slice(0, index).join('/');
    const dirPath = Path.resolve(curParent, dirInner);
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
export function copyContext(componentContent: any, to: string[]) {
  for (const contextFile of getArray(componentContent, '@context')) {
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
export function getPackageRootDirectory(name: string): string {
  const entries: [string, any][] = Object.entries(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS);
  for (const [ packageJsonPath, packageInfo ] of entries) {
    if (name === packageInfo.name) {
      return Path.dirname(packageJsonPath);
    }
  }
  throw new Error(`Could not find package root of ${name}`);
}

/**
 * Gets the content of a TypeScript file based on its filepath without extension
 * @param path the filepath without extension
 *
 * @returns the content of the file
 */
export function getTypeScriptFile(path: string): string {
  for (const extension of typescriptExtensions) {
    const filePath = path + extension;
    if (fs.existsSync(filePath)) {
      return getContent(filePath);
    }
  }
  throw new Error(`Could not find typescript file at ${path}`);
}
