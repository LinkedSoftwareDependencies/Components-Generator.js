// eslint-disable-next-line @typescript-eslint/no-require-imports
import commentParse = require('comment-parser');
import { JsonLdContextNormalized } from 'jsonld-context-parser';
import * as AstUtils from '../AstUtils';
import * as CommentUtils from '../CommentUtils';
import * as ImportExportReader from '../ImportExportReader';
import { NodeModules, ParsedClassDeclaration } from '../Types';
import * as Utils from '../Utils';

/**
 * Incrementally builds a JSON component.
 */
export class ComponentBuilder {
  private readonly className: string;
  private readonly classDeclaration: ParsedClassDeclaration;

  private readonly componentJson: any = {};

  public constructor(args: ComponentBuilderArgs) {
    this.className = args.className;
    this.classDeclaration = AstUtils.getDeclaration({
      className: args.className,
      exportedFrom: args.packageName,
    });
  }

  /**
   * Get the currently built JSON representation of the component.
   */
  public getComponentJson(): any {
    return this.componentJson;
  }

  /**
   * Set the '@id' field.
   * @param context A JSON-LD context.
   * @param moduleIri The module IRI.
   */
  public setId(context: JsonLdContextNormalized, moduleIri: string) {
    this.componentJson['@id'] = context.compactIri(`${moduleIri}/${this.className}`);
  }

  /**
   * Set the '@type' field.
   */
  public setType() {
    this.componentJson['@type'] = this.classDeclaration.declaration.abstract ? 'AbstractClass' : 'Class';
  }

  /**
   * Set the 'requireElement' field.
   */
  public setRequireElement() {
    this.componentJson.requireElement = this.className;
  }

  /**
   * Set the optional 'comment' field.
   */
  public setComment(): void {
    const declarationComment = CommentUtils.getComment(
      this.classDeclaration.ast.comments || [],
      this.classDeclaration.declaration,
    );
    if (declarationComment) {
      const parsedDeclarationComment = commentParse(declarationComment)[0];
      if (parsedDeclarationComment && parsedDeclarationComment.description.length > 0) {
        this.componentJson.comment = parsedDeclarationComment.description;
      }
    }
  }

  /**
   * Set the 'parameters' and 'constructorArguments' fields.
   * If applicable, this will also set the 'extends' field.
   * @param nodeModules The available node modules.
   * @param contextArray An array of contexts that can be appended to when parameters from superclasses are loaded.
   */
  public setParameters(nodeModules: NodeModules, contextArray: string[]) {
    const imports = ImportExportReader.getImportDeclarations(this.classDeclaration.ast);

    // Check if we have a superclass
    const superClassChain = AstUtils.getSuperClassChain(this.classDeclaration, imports, nodeModules);
    if (superClassChain.length >= 2) {
      const chainElement = superClassChain[1];
      if (chainElement.component) {
        this.componentJson.extends = chainElement.component.component['@id'];
        for (const contextFile of Utils.getArray(chainElement.component.componentContent, '@context')) {
          if (!contextArray.includes(contextFile)) {
            contextArray.push(contextFile);
          }
        }
      }
    }

    // Load parameters and constructor arguments from all superclasses in the chain
    const { contexts, parameters, constructorArguments } = AstUtils
      .getParametersAndArguments(superClassChain, this.componentJson['@id'], nodeModules);
    for (const contextFile of contexts) {
      if (!contextArray.includes(contextFile)) {
        contextArray.push(contextFile);
      }
    }
    this.componentJson.parameters = parameters;
    this.componentJson.constructorArguments = constructorArguments;
  }
}

export interface ComponentBuilderArgs {
  className: string;
  packageName: string;
}
