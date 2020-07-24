import * as Path from 'path';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
// eslint-disable-next-line no-duplicate-imports
import * as parser from '@typescript-eslint/typescript-estree';
import {
  ClassElement,
  ClassProperty,
  LineAndColumnData,
  Program,
  TSPropertySignature,
  TypeElement,
  TypeNode,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import ComponentsJsUtil = require('componentsjs/lib/Util');
import * as CommentUtils from './CommentUtils';
import { logger } from './Core';
import * as ImportExportReader from './ImportExportReader';
import {
  ClassDeclarationType,
  ClassImportDeclarations,
  ClassReference,
  ComponentInformation,
  ExportReference,
  FieldDeclaration,
  FieldDeclarationType,
  FieldType,
  NodeModules,
  ParsedClassDeclaration,
  SuperClassChain,
  SuperClassChainElement,
} from './Types';
import * as Utils from './Utils';

/**
 * Utilities to parse information from a syntax tree
 */

/**
 * Gets reference to the class of a field declaration
 *
 * @param property the field to look at
 * @returns reference to the class
 */
export function getFieldClassReference(property: FieldDeclarationType): ClassReference | undefined {
  const typeAnnotation = property.typeAnnotation;
  return typeAnnotation ? getTypeAnnotationReference(typeAnnotation.typeAnnotation) : undefined;
}

/**
 * Gets the superclass of a class or interface declaration
 *
 * @param declaration the class declaration to search in
 * @returns information about the class
 */
export function getSuperClass(declaration: ClassDeclarationType): ClassReference | undefined {
  function getIdentifier(declarationSub: ClassDeclarationType) {
    switch (declarationSub.type) {
      case AST_NODE_TYPES.ClassDeclaration:
        return declarationSub.superClass;
      case AST_NODE_TYPES.TSInterfaceDeclaration: {
        return declarationSub.extends ? declarationSub.extends[0].expression : undefined;
      }
    }
  }

  const identifier = getIdentifier(declaration);
  if (!identifier) {
    return;
  }
  switch (identifier.type) {
    case AST_NODE_TYPES.MemberExpression:
      if (identifier.object.type !== AST_NODE_TYPES.Identifier) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        logger.error(`Could not recognize expression ${identifier} object type ${identifier.property.type}`);
        return;
      }
      if (identifier.property.type !== AST_NODE_TYPES.Identifier) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        logger.error(`Could not recognize expression ${identifier} property type ${identifier.property.type}`);
        return;
      }
      return { namespace: identifier.object.name, className: identifier.property.name };
    case AST_NODE_TYPES.Identifier:
      return { className: identifier.name };
    default:
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      logger.error(`Could not recognize identifier ${identifier} for the superclass`);
  }
}

/**
 * Finds reference of a class according to how it was referenced in the code and imported
 *
 * @param classReference how the class was referenced in the code
 * @param imports the imports of the class that the specific class was referenced in
 * @returns reference to exported class
 */
export function findExportedClass(classReference: ClassReference, imports: ClassImportDeclarations):
ExportReference | undefined {
  for (const [ packageName, importClasses ] of Object.entries(imports)) {
    for (const importClass of importClasses) {
      // Qualified name e.g. `q.B`
      if (classReference.namespace) {
        if (importClass.className === '*' && importClass.importName === classReference.namespace) {
          // Class is imported under it's own name, but through a wildcard
          return { className: classReference.className, exportedFrom: packageName };
        }
      } else if (importClass.importName === classReference.className) {
        // Class is not imported under its own name, we find the real name
        return { className: importClass.className, exportedFrom: packageName };
      }
    }
  }
}

/**
 * Finds the component in a package based on its exported name
 *
 * @param exportedName the name that the class was exported with in the index.ts
 * @param componentsFilePath the filepath of the components file
 * @returns information about the component
 */
export function findComponent(exportedName: string, componentsFilePath: string): ComponentInformation | undefined {
  // We won't look at files whose name is in the blacklist
  const blacklist = [ Path.basename(componentsFilePath), 'context.jsonld' ];
  // TODO ideally we'll look at the `import` part of the components file, but parsing these IRI's isn't trivial
  // see issue #8
  const componentsFolder = Path.dirname(componentsFilePath);
  for (const { filePath, json } of Utils.visitJSONLDFiles(componentsFolder)) {
    const baseName = Path.basename(filePath);
    if (blacklist.includes(baseName)) {
      continue;
    }
    if (!('components' in json)) {
      continue;
    }
    for (const component of json.components) {
      if (!('requireElement' in component)) {
        logger.debug(`Component ${component['@id']} is lacking a requireElement key`);
      }
      // Sometimes people might forget to add a requireElement field. We can 'guess' it based
      // on the value of `@id`
      if (component.requireElement === exportedName ||
        component['@id'].split(/[/:]/u).slice(-1)[0] === exportedName) {
        return { component, componentContent: json };
      }
    }
  }
}

/**
 * Searches for a class in a package, given its class name and relative class filepath
 *
 * @param internalClass the internal name of the class
 * @param internalClassPath the filepath that was used to import this class
 * @param packageName the name of the package
 * @param filePath the filepath of the file that this class was imported in.
 *                 This is import if we're dealing with relative
 * imports
 * @returns the result of parsing the class
 */
export function getLocalDeclaration(internalClass: string,
  internalClassPath: string,
  packageName: string,
  filePath: string): ParsedClassDeclaration | undefined {
  const directory = Utils.getPackageRootDirectory(packageName);
  const normalizedFile = Path.normalize(Path.join(Path.dirname(filePath), internalClassPath));
  const fileContent = Utils.getTypeScriptFile(Path.join(directory, normalizedFile));
  let ast;
  try {
    ast = parser.parse(fileContent, { loc: true, comment: true });
  } catch (error) {
    logger.error(`Could not parse file ${normalizedFile}, invalid syntax at line ${error.lineNumber}, column ${error.column}. Message: ${error.message}`);
    return;
  }
  for (const declarationBox of ast.body) {
    if (declarationBox.type === AST_NODE_TYPES.ExportNamedDeclaration) {
      const declaration = declarationBox.declaration;
      if (declaration && (declaration.type === AST_NODE_TYPES.ClassDeclaration ||
        declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration)) {
        if (declaration.id && declaration.id.name === internalClass) {
          const line = declaration.loc.start.line;
          logger.debug(`Found matching class for ${internalClass} on line ${line}`);
          return {
            ast,
            declaration,
            filePath: normalizedFile,
            packageName,
            className: declaration.id.name,
          };
        }
      }
    }
  }
}

/**
 * Searches for a class or interface in a package based on the exports of the package
 *
 * @param classInfo how the class can be referenced externally
 * @returns the result of parsing the class or interface
 */
export function getDeclaration(classInfo: ExportReference): ParsedClassDeclaration | undefined {
  const rootFolder = Utils.getPackageRootDirectory(classInfo.exportedFrom);
  if (!rootFolder) {
    logger.error(`Could not find root directory of package ${classInfo.exportedFrom}`);
    return;
  }
  const indexContent = Utils.getTypeScriptFile(Path.join(rootFolder, 'index'));
  if (!indexContent) {
    logger.error('Could not find index.ts or index.d.ts file');
    return;
  }
  let prgramAst: Program;
  try {
    prgramAst = parser.parse(indexContent, { loc: true, comment: true });
  } catch (error) {
    logger.error(`Could not parse the index file of ${classInfo.exportedFrom}, invalid syntax at line ${error.lineNumber}, column ${error.column}. Message: ${error.message}`);
    return;
  }
  const exports = ImportExportReader.getExportDeclarations(prgramAst);
  // Go through all exported files and search for class name
  for (const [ file, exportDetails ] of Object.entries(exports)) {
    // We need to check all combinations,
    // a function could be exported as {A as B} and {A as C} so we have to check B and C
    const searchNames = new Set();
    for (const exportDetail of exportDetails) {
      // We have to check the file source because we can't know for sure if the file contains the class
      if (exportDetail.className === '*' || exportDetail.exportName === classInfo.className) {
        // Wildcard means the class could be exported under its own name
        // Otherwise A is exported explicitly as {A} or {A as B}
        // In both cases we're looking for a function declaration A in the class
        searchNames.add(exportDetail.className);
      }
    }
    if (searchNames.size === 0) {
      logger.debug(`Did not find a matching class in ${file}`);
      continue;
    }
    logger.debug(`Found potential file ${file} with exported declarations ${[ ...searchNames ].join(', ')}`);
    const fileContent = Utils.getTypeScriptFile(Path.join(rootFolder, file));
    let fileAst;
    try {
      fileAst = parser.parse(fileContent, { loc: true, comment: true });
    } catch (error) {
      logger.error(`Could not parse file ${file}, invalid syntax at line ${error.lineNumber}, column ${error.column}. Message: ${error.message}`);
      return;
    }
    for (const declarationBox of fileAst.body) {
      if (declarationBox.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        const declaration = declarationBox.declaration;
        if (!declaration) {
          logger.debug('Can not parse non-declaration export');
          continue;
        }
        if (declaration.type === AST_NODE_TYPES.ClassDeclaration ||
          declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
          // Check if it has been exported using the wildcard or if it has been exported normally
          if ((searchNames.has('*') && declaration.id && declaration.id.name === classInfo.className) ||
            declaration.id && searchNames.has(declaration.id.name)) {
            const line = declaration.loc.start.line;
            logger.debug(`Found matching class for ${classInfo.className} on line ${line} in ${file}`);
            return {
              ast: fileAst,
              declaration,
              filePath: file,
              packageName: classInfo.exportedFrom,
              className: declaration.id.name,
            };
          }
        }
      }
    }
    logger.debug(`Did not find a matching exported class in ${file} for name ${classInfo.className}`);
  }
}

/**
 * Parses a field or parameter based on its declaration
 *
 * @param property the property that represents the field
 * @param declaration the declaration of the class where this field was found in
 * @param imports the imports of the class where this field was found in
 * @param nodeModules the node modules to search in
 * @param commentStart if this parameter is set, we will look for an inline comment starting after this position
 * @returns information about this field
 */
export function getField(property: FieldDeclarationType,
  declaration: ParsedClassDeclaration, imports: ClassImportDeclarations,
  nodeModules: NodeModules,
  commentStart?: LineAndColumnData): FieldDeclaration | undefined {
  function getName(propertySub: FieldDeclarationType): string {
    switch (propertySub.type) {
      case AST_NODE_TYPES.Identifier:
        return propertySub.name;
      case AST_NODE_TYPES.TSPropertySignature:
      case AST_NODE_TYPES.ClassProperty:
        if (propertySub.key.type === AST_NODE_TYPES.Identifier) {
          return propertySub.key.name;
        }
        logger.debug(`Could not understand type ${propertySub.key.type}, skipping`);
        return '';
    }
  }

  let required = false;
  const fieldName = getName(property);
  const fieldType = property.typeAnnotation ? property.typeAnnotation.typeAnnotation.type : undefined;
  const isArray = fieldType === AST_NODE_TYPES.TSArrayType;
  const comment = !commentStart ?
    CommentUtils.getComment(declaration.ast.comments || [], property) :
    CommentUtils.getInBetweenComment(declaration.ast.comments || [], commentStart, property.loc.start);
  const { range: rangeOriginal, defaultValue, ignored, description } = CommentUtils.parseFieldComment(comment,
    property.typeAnnotation ? property.typeAnnotation.typeAnnotation : undefined);
  if (ignored) {
    logger.debug(`Field ${fieldName} has an ignore attribute, skipping`);
    return;
  }
  if ('optional' in property) {
    required = !property.optional;
  }
  let range = rangeOriginal || (property.typeAnnotation ?
    Utils.convertTypeToXsd(property.typeAnnotation.typeAnnotation) :
    undefined);
  const type = !range ? FieldType.Complex : FieldType.Simple;
  let fieldDeclaration: ParsedClassDeclaration | undefined;
  let component;
  if (!range) {
    const constructorReference = getFieldClassReference(property);
    if (!constructorReference) {
      return;
    }
    fieldDeclaration = getDeclarationWithContext(constructorReference, declaration, imports);
    if (!fieldDeclaration) {
      logger.debug(`Could not get declaration of class ${constructorReference.className}`);
      return;
    }
    component = getComponentByDeclaration(fieldDeclaration, nodeModules);
    if (component) {
      range = component.component['@id'];
    } else {
      logger.debug(`Could not match class ${constructorReference.className} with any component`);
    }
  }
  const newParameter: any = {
    required,
    unique: !isArray,
  };
  if (range) {
    newParameter.range = range;
  }
  if (defaultValue) {
    newParameter.default = defaultValue;
  }
  if (description) {
    newParameter.comment = description;
  }
  return {
    key: fieldName,
    type,
    parameter: newParameter,
    declaration: <ParsedClassDeclaration> fieldDeclaration,
    component,
  };
}

/**
 * Gets information about all the fields in the declaration of a class or interface
 *
 * @param declaration the class to get the fields from
 * @param nodeModules the node modules to look in
 * @returns information about all the fields
 */
export function getFields(declaration: ParsedClassDeclaration, nodeModules: NodeModules): FieldDeclaration[] {
  const imports = ImportExportReader.getImportDeclarations(declaration.ast);
  switch (declaration.declaration.type) {
    case AST_NODE_TYPES.ClassDeclaration: {
      return <FieldDeclaration[]> declaration.declaration.body.body
        .filter((x: ClassElement) => x.type === AST_NODE_TYPES.ClassProperty)
        .map((x: ClassElement) => getField(<ClassProperty> x, declaration, imports, nodeModules))
        .filter(Boolean);
    }
    case AST_NODE_TYPES.TSInterfaceDeclaration:
      return <FieldDeclaration[]> declaration.declaration.body.body
        .filter((x: TypeElement) => x.type === AST_NODE_TYPES.TSPropertySignature)
        .map((x: TypeElement) => getField(<TSPropertySignature> x, declaration, imports, nodeModules))
        .filter(Boolean);
  }
}

/**
 * Gets the constructor arguments of a class
 *
 * @param declaration the class to get the constructor parameters from
 * @param imports the imports of the class
 * @param nodeModules the node modules to search in
 * @returns the parsed parameters
 */
export function getConstructorParams(declaration: ParsedClassDeclaration,
  imports: ClassImportDeclarations,
  nodeModules: NodeModules): FieldDeclaration[] {
  const constructorParams: FieldDeclaration[] = [];
  for (const property of declaration.declaration.body.body) {
    if (property.type === AST_NODE_TYPES.MethodDefinition && property.key.type === AST_NODE_TYPES.Identifier &&
      property.key.name === 'constructor') {
      // We found the constructor
      logger.debug(`Found a constructor for class ${declaration.className}`);
      const constructorParamDeclarations = property.value.params;
      let previousEnd = property.loc.start;
      for (const constructorParamDeclaration of constructorParamDeclarations) {
        if (constructorParamDeclaration.type === AST_NODE_TYPES.Identifier) {
          const constructorParam = getField(constructorParamDeclaration,
            declaration,
            imports,
            nodeModules,
            previousEnd);
          if (constructorParam) {
            constructorParams.push(constructorParam);
          }
          previousEnd = constructorParamDeclaration.loc.end;
        } else {
          logger.error(`Could not understand parameter type ${constructorParamDeclaration.type}`);
        }
      }
    }
  }
  return constructorParams;
}

/**
 * Gets the component of a class based on its declaration
 *
 * @param declaration the declaration of the class to search the component of
 * @param nodeModules the node modules to search in
 * @returns information about the component
 */
export function getComponentByDeclaration(declaration: ParsedClassDeclaration, nodeModules: NodeModules):
ComponentInformation | undefined {
  const possibleNames = getPossibleExportNames(declaration);
  const values: any[] = Object.values(ComponentsJsUtil.NODE_MODULES_PACKAGE_CONTENTS);
  for (const packageInfo of values) {
    const packageName = packageInfo.name;
    if (!('lsd:module' in packageInfo)) {
      logger.debug(`Skipping package ${packageName} with missing lsd:module attribute`);
      continue;
    }
    if (declaration.packageName === packageName) {
      for (const possibleName of possibleNames) {
        const lsdModule = packageInfo['lsd:module'];
        const componentsFile = nodeModules[lsdModule];
        const component = findComponent(possibleName, componentsFile);
        if (component) {
          return component;
        }
      }
      break;
    }
  }
}

/**
 * Gets the possible names a declaration has been exported with in its package base on the index.ts file of
 * the package
 *
 * @param declaration the declaration of the class
 * @returns the possible names. This is a set of names because a single class might be exported
 * multiple times with different names
 */
export function getPossibleExportNames(declaration: ParsedClassDeclaration): Set<string> {
  const possibleNames = new Set<string>();
  const directory = Utils.getPackageRootDirectory(declaration.packageName);
  const indexContent = Utils.getTypeScriptFile(Path.join(directory, 'index'));
  const ast = parser.parse(indexContent);
  const exports = ImportExportReader.getExportDeclarations(ast);
  for (const [ file, exportDetails ] of Object.entries(exports)) {
    const normalizedFile = Path.normalize(file);
    // The same file is being exported
    if (declaration.filePath === normalizedFile) {
      for (const exportDetail of exportDetails) {
        if (exportDetail.className === '*') {
          possibleNames.add(declaration.className);
        } else if (exportDetail.className === declaration.className) {
          possibleNames.add(exportDetail.exportName);
        }
      }
    }
  }
  return possibleNames;
}

/**
 * Get the chain of extending classes
 *
 * We do this by parsing the current class, parsing its superclass, parsing that class' superclass and so forth
 * @param classDeclaration the declaration of the class to start from
 * @param imports the declaration of the class to start from
 * @param nodeModules the node modules to search in
 * @returns information about all superclasses
 */
export function getSuperClassChain(classDeclaration: ParsedClassDeclaration,
  imports: ClassImportDeclarations,
  nodeModules: NodeModules): SuperClassChain {
  const superClassChain = [];
  let previousSuperClassDeclaration: ParsedClassDeclaration | undefined = classDeclaration;
  let previousSuperClassImports = imports;
  while (previousSuperClassDeclaration) {
    // We get the constructor parameters of the current class
    const constructorParams = getConstructorParams(previousSuperClassDeclaration,
      previousSuperClassImports,
      nodeModules);
    // We don't want to get the first component because that would be for the class that we're currently
    // creating a component for
    let superClassComponent;
    if (superClassChain.length > 0) {
      superClassComponent = getComponentByDeclaration(previousSuperClassDeclaration, nodeModules);
      if (!superClassComponent) {
        logger.error(`Did not find a component for superclass ${previousSuperClassDeclaration.className}`);
      }
    }
    superClassChain.push({
      declaration: previousSuperClassDeclaration,
      component: superClassComponent,
      constructorParams,
    });
    // Find the next superclass
    const nextSuperClassInfo = getSuperClass(previousSuperClassDeclaration.declaration);
    if (!nextSuperClassInfo) {
      // We reached the end of the chain
      break;
    }
    // Get its declaration
    previousSuperClassDeclaration = getDeclarationWithContext(nextSuperClassInfo,
      previousSuperClassDeclaration,
      previousSuperClassImports);
    if (previousSuperClassDeclaration) {
      // Do stuff with your current declaration here
      previousSuperClassImports = ImportExportReader.getImportDeclarations(previousSuperClassDeclaration.ast);
    } else {
      logger.error(`Could not find declaration of superclass ${nextSuperClassInfo.className}`);
    }
  }
  return <any> superClassChain;
}

/**
 * Searches for a class or interface in a package based on the exports and local context. The important factor here
 * is that the class might be declared in the file of another class, which means it wouldn't be included in the import
 * statements
 *
 * @param classReference information about the class that we want to get the declaration of
 * @param contextClass declaration of the class that the class was referenced in
 * @param contextImports imports of the class that the class was referenced in
 * @returns the result of parsing the class or interface
 */
export function getDeclarationWithContext(classReference: ClassReference,
  contextClass: ParsedClassDeclaration,
  contextImports: ClassImportDeclarations): ParsedClassDeclaration | undefined {
  // If no namespace is used, it is possible the class is declared in the the same file as our context class
  if (!classReference.namespace) {
    for (const declarationBox of contextClass.ast.body) {
      if (declarationBox.type === AST_NODE_TYPES.ExportNamedDeclaration) {
        const declaration = declarationBox.declaration;
        if (!declaration) {
          logger.debug('Can not parse non-declaration export');
          continue;
        }
        if (declaration.type === AST_NODE_TYPES.ClassDeclaration ||
          declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
          if (declaration.id && classReference.className === declaration.id.name) {
            const line = declaration.loc.start.line;
            logger.debug(`Found matching class for ${classReference.className} on line ${line}`);
            return {
              ast: contextClass.ast,
              declaration,
              filePath: contextClass.filePath,
              packageName: contextClass.packageName,
              className: classReference.className,
            };
          }
        }
      }
    }
  }
  const nextClass = findExportedClass(classReference, contextImports);
  if (!nextClass) {
    logger.error(`Could not find declaration of class ${classReference.className}`);
    return;
  }
  if (Utils.isLocalFile(nextClass.exportedFrom)) {
    return getLocalDeclaration(nextClass.className,
      nextClass.exportedFrom,
      contextClass.packageName,
      contextClass.filePath);
  }
  return getDeclaration(nextClass);
}

/**
 * Converts the superclass chain to the correct jsonld `parameters` and `constructorArguments`
 *
 * @param superClassChain the superclass chain
 * @param compactPath the id of the component we're creating
 * @param nodeModules the node modules to search in
 * @returns the parsed parameters and arguments as objects
 */
export function getParametersAndArguments(superClassChain: SuperClassChain,
  compactPath: string,
  nodeModules: NodeModules):
  { contexts: string[]; parameters: {}[]; constructorArguments: {}[] } {
  const parameters: {}[] = [];
  const constructorArguments: {}[] = [];
  const chosenParameterNames = new Set();
  const contexts: string[] = [];

  function getUniqueFieldId(path: string, field: string): string {
    function getId(i: number) {
      return `${path}#${field}${i === 0 ? '' : i}`;
    }

    let i = -1;
    while (chosenParameterNames.has(getId(++i))) {
      // Do nothing
    }
    const id = getId(i);
    chosenParameterNames.add(id);
    return id;
  }

  function getConstructorArgument(constructorParam: FieldDeclaration, root = false): any {
    if (constructorParam.type === FieldType.Complex) {
      /**
       * Searches in the constructors of the superclasses to find an argument with the same class declaration
       *
       * @param param the declaration of the parameter to match
       * @returns the matching parameter, if any
       */
      // eslint-disable-next-line no-inner-declarations
      function findSimilarParam(param: ParsedClassDeclaration):
      { field: SuperClassChainElement; param: any } | undefined {
        for (let i = 1; i < superClassChain.length; i++) {
          for (let x = 0; x < superClassChain[i].constructorParams.length; x++) {
            const otherConstructorParam = superClassChain[i].constructorParams[x];
            if (otherConstructorParam.type !== FieldType.Complex) {
              continue;
            }
            // Check if the declarations are the same
            if (!otherConstructorParam.declaration ||
              !Utils.classDeclarationEquals(param, otherConstructorParam.declaration)) {
              continue;
            }
            if (!superClassChain || !superClassChain[i].component) {
              continue;
            }
            return {
              field: superClassChain[i],
              param: superClassChain[i].component.component.constructorArguments[x],
            };
          }
        }
      }

      /**
       * If this class is a superclass of a parameter, we find an id value that we can use
       * in the `extends` attribute of its subclass
       * @param param the parameter
       *
       * @returns the value for the `extends` attribute
       */
      // eslint-disable-next-line no-inner-declarations
      function getExtendsId(param: any): string | undefined {
        if ('@id' in param) {
          return param['@id'];
        }
        if ('extends' in param) {
          return param.extends;
        }
        logger.error('Could not find @id nor extend!');
      }

      /**
       * Gets the fields of a hash class as jsonld objects
       * These fields will also be parsed as if they are constructor arguments
       *
       * @returns the parsed fields
       */
      // eslint-disable-next-line no-inner-declarations
      function getHashFields(): { keyRaw?: string; value: {} }[] | undefined {
        const exportedFields: { keyRaw?: string; value: {} }[] = [];
        const fieldData = getFields(constructorParam.declaration, nodeModules);
        for (const field of fieldData) {
          let parsedField = getConstructorArgument(field);
          if (!parsedField) {
            continue;
          }
          // This little check verifies whether the field consists
          // of solely one `@id` attribute
          // If so, it converts the result to a string
          if (Object.keys(parsedField).length === 1 &&
            parsedField['@id']) {
            parsedField = parsedField['@id'];
          }
          exportedFields.push({
            keyRaw: field.key,
            value: parsedField,
          });
        }
        return exportedFields;
      }

      if (!constructorParam.declaration) {
        return;
      }

      if (constructorParam.component) {
        // In this case our field references a component
        const id = getUniqueFieldId(compactPath, constructorParam.key);
        const parameter = { '@id': id, ...constructorParam.parameter };
        parameters.push(parameter);
        Utils.copyContext(constructorParam.component.componentContent, contexts);
        return { '@id': id };
      }

      let similarParam = findSimilarParam(constructorParam.declaration);
      // This means we have found a similar parameter in the constructor of a superclass
      if (similarParam) {
        const parameter: any = root ? { '@id': getUniqueFieldId(compactPath, 'constructorArgumentsObject') } : {};
        logger.debug(`Found an identical constructor argument in other component for argument ${constructorParam.key}`);
        const extendsAttribute = getExtendsId(similarParam.param);
        if (extendsAttribute) {
          parameter.extends = extendsAttribute;
        }
        Utils.copyContext(similarParam.field.component.componentContent, contexts);
        return parameter;
      }
      // If the parameter is not similar to the parameter of a superclass' constructor, we search if
      // the superclass of the argument is a parameter of a superclass's constructor
      const superClass = getSuperClass(constructorParam.declaration.declaration);
      if (superClass) {
        const superClassDeclaration = getDeclarationWithContext(superClass,
          constructorParam.declaration,
          ImportExportReader.getImportDeclarations(constructorParam.declaration.ast));
        if (!superClassDeclaration) {
          logger.error('Could not find superclass declaration');
          return;
        }
        similarParam = findSimilarParam(superClassDeclaration);
        if (!similarParam) {
          logger.error(`We could not find a matching argument for ${superClass.className} in a superclass`);
          return;
        }
        const parameter: any = root ? { '@id': getUniqueFieldId(compactPath, 'constructorArgumentsObject') } : {};
        const exportedFields = getHashFields();
        const extendsAttribute = getExtendsId(similarParam.param);
        if (extendsAttribute) {
          parameter.extends = extendsAttribute;
        }
        parameter.fields = exportedFields;
        Utils.copyContext(similarParam.field.component.componentContent, contexts);
        return parameter;
      }
      // In this case we have a hash class that doesn't extend another class
      const parameter: any = root ? { '@id': getUniqueFieldId(compactPath, constructorParam.key) } : {};
      const exportedFields = getHashFields();
      if (constructorParam.parameter.unique) {
        parameter.fields = exportedFields;
      } else {
        parameter.elements = exportedFields;
      }
      return parameter;
    }
    // In this case we have a simple parameter such as string, number, boolean
    const id = getUniqueFieldId(compactPath, constructorParam.key);
    const parameter = { '@id': id, ...constructorParam.parameter };
    parameters.push(parameter);
    return { '@id': id };
  }

  // We analyze each of the constructor parameters of our current class
  for (const constructorParam of superClassChain[0].constructorParams) {
    const arg = getConstructorArgument(constructorParam, true);
    if (arg) {
      constructorArguments.push(arg);
    }
  }
  return { contexts, parameters, constructorArguments };
}

/**
 * Gets the reference to the class of a type annotation
 * If the type is an array, it will check the type of that array
 *
 * @param annotation the type annotation to look at
 * @param isArray whether this annotation is the child of an array annotation. We do this to avoid parsing
 * multi-dimensional arrays
 * @returns information about the class
 */
function getTypeAnnotationReference(annotation: TypeNode, isArray = false): ClassReference | undefined {
  switch (annotation.type) {
    // A regular class reference
    case AST_NODE_TYPES.TSTypeReference:
      switch (annotation.typeName.type) {
        case AST_NODE_TYPES.TSQualifiedName:
          // A namespace reference e.g. `q.B`
          if (annotation.typeName.left.type === AST_NODE_TYPES.Identifier) {
            return {
              namespace: annotation.typeName.left.name,
              className: annotation.typeName.right.name,
            };
          }
          logger.error(`Could not understand left type ${annotation.typeName.left.type}`);

          return;
        case AST_NODE_TYPES.Identifier:
          // A normal reference e.g. `q.B`
          return { namespace: undefined, className: annotation.typeName.name };
        default:
          logger.error(`Could not recognize inner name type ${annotation.typeName}`);
          return;
      }
    case AST_NODE_TYPES.TSArrayType:
      if (isArray) {
        logger.error(`Cannot parse nested array types`);
        return;
      }
      return getTypeAnnotationReference(annotation.elementType, true);
    default:
      logger.error(`Could not recognize annotation type ${annotation.type}`);
  }
}
