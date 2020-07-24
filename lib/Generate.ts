/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'fs';
import * as Path from 'path';
import commentParse = require('comment-parser');
import ComponentsJsUtil = require('componentsjs/lib/Util');
import { ContextParser } from 'jsonld-context-parser';

import { JsonLdContextNormalized } from 'jsonld-context-parser/lib/JsonLdContextNormalized';
import * as AstUtils from './AstUtils';
import * as CommentUtils from './CommentUtils';
import { logger } from './Core';
import * as ImportExportReader from './ImportExportReader';
import * as Utils from './Utils';

const CONTEXT_PARSER = new ContextParser();

/**
 * Generates a component file for a class
 *
 * @param directory the directory of the package to look in
 * @param className the class to generate a component for
 * @param moduleRoot directory where we should look for dependencies, relative to the package directory
 * @param level the level for the logger
 * @returns the contents of the components file as an object
 */
export async function generateComponent(directory: string, className: string, moduleRoot = '.', level = 'info'):
Promise<any> {
  logger.level = level;
  if (!directory) {
    logger.error('Missing argument package');
    return;
  }
  if (!className) {
    logger.error('Missing argument class-name');
    return;
  }
  if (!fs.existsSync(directory)) {
    logger.error('Not a valid package, directory does not exist');
    return;
  }
  const packagePath = Path.join(directory, 'package.json');
  if (!fs.existsSync(packagePath)) {
    logger.error('Not a valid package, no package.json');
    return;
  }
  const modulesPath = Path.join(directory, moduleRoot);
  if (!fs.existsSync(modulesPath)) {
    logger.error(`Modules path ${modulesPath} does not exist`);
    return;
  }
  // Analyze imports first, otherwise we can't access package information
  const nodeModules = await ComponentsJsUtil.getModuleComponentPaths(modulesPath);
  logger.debug(`Loaded ${nodeModules.length} node modules`);
  const packageContent = Utils.getJSON(packagePath);
  const packageName = packageContent.name;
  if (!('lsd:module' in packageContent)) {
    logger.error(`Missing 'lsd:module' IRI in package.json`);
    return;
  }
  const moduleIri = packageContent['lsd:module'];
  if (!('lsd:components' in packageContent)) {
    logger.error('package.json doesn\'t contain lsd:components');
    return;
  }
  const componentsPath = Path.join(directory, packageContent['lsd:components']);
  if (!fs.existsSync(componentsPath)) {
    logger.error(`Not a valid components path: ${componentsPath}`);
    return;
  }
  const classDeclaration = AstUtils.getDeclaration({
    className,
    exportedFrom: packageName,
  });
  if (!classDeclaration) {
    logger.error(`Did not find a matching class for name ${className}, please check the name and make sure it has been exported`);
    return;
  }
  const ast = classDeclaration.ast;
  const declaration = classDeclaration.declaration;
  const declarationComment = CommentUtils.getComment(ast.comments || [], declaration);
  let classComment;
  if (declarationComment) {
    const parsedDeclarationComment = commentParse(declarationComment)[0];
    if (parsedDeclarationComment && parsedDeclarationComment.description.length > 0) {
      classComment = parsedDeclarationComment.description;
    }
  }
  const newConfig: any = {};
  let context: JsonLdContextNormalized;
  if ('lsd:contexts' in packageContent) {
    newConfig['@context'] = Object.keys(packageContent['lsd:contexts']);
    context = await CONTEXT_PARSER.parse(Object.values(packageContent['lsd:contexts'])
      .map((path: any) => Utils.getJSON(Path.join(directory, path))));
  } else {
    newConfig['@context'] = [];
    context = new JsonLdContextNormalized({});
  }
  newConfig['@id'] = context.compactIri(moduleIri);

  const compactPath = context.compactIri(`${moduleIri}/${className}`);
  const newComponent: any = {};
  newComponent['@id'] = compactPath;
  newComponent.requireElement = className;
  newComponent['@type'] = declaration.abstract ? 'AbstractClass' : 'Class';
  if (classComment) {
    newComponent.comment = classComment;
  }
  const imports = ImportExportReader.getImportDeclarations(ast);
  const superClassChain = AstUtils.getSuperClassChain(classDeclaration, imports, nodeModules);
  // We can use the second element in the chain for the `extends` attribute because it's the superclass
  // of the class we're checking
  if (superClassChain.length >= 2) {
    const chainElement = superClassChain[1];
    if (chainElement.component) {
      newComponent.extends = chainElement.component.component['@id'];
      for (const contextFile of Utils.getArray(chainElement.component.componentContent, '@context')) {
        if (!newConfig['@context'].includes(contextFile)) {
          newConfig['@context'].push(contextFile);
        }
      }
    }
  }
  const { contexts, parameters, constructorArguments } = AstUtils
    .getParametersAndArguments(superClassChain, compactPath, nodeModules);
  for (const contextFile of contexts) {
    if (!newConfig['@context'].includes(contextFile)) {
      newConfig['@context'].push(contextFile);
    }
  }
  newComponent.parameters = parameters;
  newComponent.constructorArguments = constructorArguments;
  newConfig.components = [ newComponent ];
  return newConfig;
}

/**
 * Creates a component file for a class
 *
 * @param directory the directory of the package to look in
 * @param className the class to generate a component for
 * @param outputPath write output to a specific file
 * @param moduleRoot directory where we should look for dependencies, relative to the package directory
 * @param print whether to print to standard output
 * @param level the level for the logger
 * @returns upon completion
 */
export async function generateComponentFile(directory: string,
  className: string,
  outputPath: string,
  moduleRoot = '.',
  print = false,
  level = 'info') {
  logger.level = level;
  const component = await generateComponent(directory, className, moduleRoot, level);
  if (!component) {
    logger.info('Failed to generate component file');
    return;
  }
  const jsonString = JSON.stringify(component, null, 4);
  if (print) {
    process.stdout.write(`${jsonString}\n`);
  } else {
    let path = Path.join(directory, 'components', 'Actor', `${className}.jsonld`);
    if (outputPath) {
      path = outputPath;
    }
    const dir = Path.dirname(path);
    if (!fs.existsSync(dir)) {
      Utils.mkdirRecursive(dir);
    }
    logger.info(`Writing output to ${path}`);
    fs.writeFileSync(path, jsonString);
  }
}
