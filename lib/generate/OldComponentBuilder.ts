// eslint-disable-next-line @typescript-eslint/no-require-imports
import commentParse = require('comment-parser');
import { JsonLdContextNormalized } from 'jsonld-context-parser';
import * as CommentUtils from '../OldCommentUtils';
import { NodeModules, ParsedClassDeclaration, SuperClassChain } from '../OldTypes';
import * as Utils from '../OldUtils';
import { OldClassParser } from '../parse/OldClassParser';

/**
 * Incrementally builds a JSON component.
 */
export class OldComponentBuilder {
  private readonly astParser: OldClassParser;
  private readonly className: string;
  private readonly classDeclaration: ParsedClassDeclaration;
  private readonly superClassChain: SuperClassChain;

  private readonly componentJson: any = {};

  public constructor(args: ComponentBuilderArgs) {
    this.astParser = args.astParser;
    this.className = args.className;
    this.classDeclaration = args.classDeclaration;
    this.superClassChain = args.superClassChain;
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
    // Check if we have a superclass
    if (this.superClassChain.length >= 2) {
      const chainElement = this.superClassChain[1];
      if (chainElement.component) {
        this.componentJson.extends = chainElement.component.component['@id'];
        for (const contextFile of Utils.getValueAsArray(chainElement.component.componentContent, '@context')) {
          if (!contextArray.includes(contextFile)) {
            contextArray.push(contextFile);
          }
        }
      }
    }

    // Load parameters and constructor arguments from all superclasses in the chain
    const { contexts, parameters, constructorArguments } = this.astParser
      .getParametersAndArguments(this.superClassChain, this.componentJson['@id'], nodeModules);
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
  astParser: OldClassParser;
  className: string;
  classDeclaration: ParsedClassDeclaration;
  superClassChain: SuperClassChain;
}
