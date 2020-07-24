/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'fs';
import * as Path from 'path';
import ComponentsJsUtil = require('componentsjs/lib/Util');
import { ContextParser } from 'jsonld-context-parser';

import { JsonLdContextNormalized } from 'jsonld-context-parser/lib/JsonLdContextNormalized';
import { logger } from '../Core';
import * as Utils from '../Utils';
import { ComponentBuilder } from './ComponentBuilder';

/**
 * Generates a components file by parsing a typescript file.
 */
export class Generator {
  private readonly directory: string;
  private readonly className: string;
  private readonly moduleRoot: string;
  private readonly level: string;

  private static readonly CONTEXT_PARSER = new ContextParser();

  public constructor(directory: string, className: string, moduleRoot = '.', level = 'info') {
    this.directory = directory;
    this.className = className;
    this.moduleRoot = moduleRoot;
    this.level = level;
    logger.level = this.level;
  }

  /**
   * Creates a component file for a class
   *
   * @param componentJson The json object of a component
   * @param outputPath write output to a specific file
   * @returns upon completion
   */
  public async writeComponentFile(componentJson: any, outputPath: string) {
    const jsonString = JSON.stringify(componentJson, null, 4);
    let path = Path.join(this.directory, 'components', 'Actor', `${this.className}.jsonld`);
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

  /**
   * Check if the configured package directory is valid, and extract basic metadata from it
   */
  protected async validatePackage(): Promise<{
    packageName: string;
    moduleIri: string;
    packageJson: any;
    nodeModules: {[id: string]: string};
  }> {
    // Check existence of files and directories
    if (!fs.existsSync(this.directory)) {
      throw new Error('Invalid package: Directory does not exist');
    }
    const packagePath = Path.join(this.directory, 'package.json');
    if (!fs.existsSync(packagePath)) {
      throw new Error('Invalid package: package.json does not exist');
    }
    const modulesPath = Path.join(this.directory, this.moduleRoot);
    if (!fs.existsSync(modulesPath)) {
      throw new Error(`Invalid package: Modules path ${modulesPath} does not exist`);
    }

    // Check required elements in package.json
    // Analyze imports first, otherwise we can't access package information
    const nodeModules = await ComponentsJsUtil.getModuleComponentPaths(modulesPath);
    logger.debug(`Loaded ${nodeModules.length} node modules`);

    const packageJson = Utils.getJSON(packagePath);
    const packageName = packageJson.name;
    if (!('lsd:module' in packageJson)) {
      throw new Error(`Invalid package: Missing 'lsd:module' IRI in package.json`);
    }
    const moduleIri = packageJson['lsd:module'];
    if (!('lsd:components' in packageJson)) {
      throw new Error('Invalid package: Missing \'lsd:components\' in package.json');
    }
    const componentsPath = Path.join(this.directory, packageJson['lsd:components']);
    if (!fs.existsSync(componentsPath)) {
      throw new Error(`Invalid package: 'lsd:components' points to invalid path ${componentsPath}`);
    }

    return { packageName, moduleIri, packageJson, nodeModules };
  }

  protected async getContext(packageJson: any): Promise<JsonLdContextNormalized> {
    let context: JsonLdContextNormalized;
    if ('lsd:contexts' in packageJson) {
      context = await Generator.CONTEXT_PARSER.parse(Object.values(packageJson['lsd:contexts'])
        .map((path: any) => Utils.getJSON(Path.join(this.directory, path))));
    } else {
      context = new JsonLdContextNormalized({});
    }
    return context;
  }

  /**
   * Generates a component file for a class
   */
  public async generateComponent(): Promise<any> {
    const { packageName, moduleIri, packageJson, nodeModules } = await this.validatePackage();
    const context = await this.getContext(packageJson);

    // Wrap the component in a JSON object with an @context under the 'components' field
    const componentWrapper: any = {};
    componentWrapper['@context'] = 'lsd:contexts' in packageJson ? Object.keys(packageJson['lsd:contexts']) : [];

    // Build our component
    const builder = new ComponentBuilder({
      className: this.className,
      packageName,
    });
    builder.setId(context, moduleIri);
    builder.setType();
    builder.setRequireElement();
    builder.setComment();
    builder.setParameters(nodeModules, componentWrapper['@context']);

    componentWrapper.components = [ builder.getComponentJson() ];
    return componentWrapper;
  }
}
