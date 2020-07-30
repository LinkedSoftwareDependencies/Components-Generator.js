import { logger } from '../Core';
import * as ImportExportReader from '../OldImportExportReader';
import {
  FieldDeclaration,
  FieldType,
  NodeModules,
  ParsedClassDeclaration,
  SuperClassChain,
  SuperClassChainElement,
} from '../OldTypes';
import * as Utils from '../OldUtils';
import { OldClassParser } from '../parse/OldClassParser';

/**
 * A single-use factory for emitting all parameters in a given super class chain.
 */
export class OldParameterFactory {
  private readonly classParser: OldClassParser;
  private readonly superClassChain: SuperClassChain;
  private readonly compactPath: string;
  private readonly nodeModules: NodeModules;

  private readonly chosenParameterNames: Set<string>;
  private readonly parameters: {}[] = [];
  private readonly constructorArguments: {}[] = [];
  private readonly contexts: string[] = [];

  public constructor(args: ParameterParserArgs) {
    this.classParser = args.classParser;
    this.superClassChain = args.superClassChain;
    this.compactPath = args.compactPath;
    this.nodeModules = args.nodeModules;

    this.chosenParameterNames = new Set();
    this.parameters = [];
    this.constructorArguments = [];
    this.contexts = [];
  }

  /**
   * Determine all parameters that are present in the constructors of the given super class chain.
   */
  public getParameters(): { contexts: string[]; parameters: {}[]; constructorArguments: {}[] } {
    if (this.superClassChain.length === 0) {
      throw new Error('Illegal state: Found an empty super class chain');
    }

    // We analyze each of the constructor parameters of our current class
    for (const constructorParam of this.superClassChain[0].constructorParams) {
      const arg = this.getConstructorArgument(constructorParam, true);
      if (arg) {
        this.constructorArguments.push(arg);
      }
    }
    return {
      contexts: this.contexts,
      parameters: this.parameters,
      constructorArguments: this.constructorArguments,
    };
  }

  /**
   * Get the constructor argument for the given field.
   * @param field A field declaration.
   * @param root If we are calling this method for the first time for this field.
   */
  public getConstructorArgument(field: FieldDeclaration, root = false): {} | undefined {
    if (field.type === FieldType.Complex) {
      if (!field.declaration) {
        return;
      }

      if (field.component) {
        // In this case our field references a component
        const id = this.getUniqueFieldId(this.compactPath, field.key);
        const parameter = { '@id': id, ...field.parameter };
        this.parameters.push(parameter);
        OldParameterFactory.copyContext(field.component.componentContent, this.contexts);
        return { '@id': id };
      }

      // Check if we have a similar parameter in the constructor of a superclass
      let similarParam = this.findSimilarParam(field.declaration);
      if (similarParam) {
        const parameter: any = root ?
          { '@id': this.getUniqueFieldId(this.compactPath, 'constructorArgumentsObject') } :
          {};
        logger.debug(`Found an identical constructor argument in other component for argument ${field.key}`);
        const extendsAttribute = this.getExtendsId(similarParam.param);
        if (extendsAttribute) {
          parameter.extends = extendsAttribute;
        }
        OldParameterFactory.copyContext(similarParam.field.component.componentContent, this.contexts);
        return parameter;
      }

      // If the parameter is not similar to the parameter of a superclass' constructor, we search if
      // the superclass of the argument is a parameter of a superclass's constructor
      const superClass = this.classParser.getSuperClass(field.declaration.declaration);
      if (superClass) {
        const superClassDeclaration = this.classParser.getDeclarationWithContext(superClass,
          field.declaration,
          ImportExportReader.getImportDeclarations(field.declaration.ast));
        if (!superClassDeclaration) {
          logger.error('Could not find superclass declaration');
          return;
        }
        similarParam = this.findSimilarParam(superClassDeclaration);
        if (!similarParam) {
          logger.error(`We could not find a matching argument for ${superClass.className} in a superclass`);
          return;
        }
        const parameter: any = root ?
          { '@id': this.getUniqueFieldId(this.compactPath, 'constructorArgumentsObject') } :
          {};
        const exportedFields = this.getHashFields(field);
        const extendsAttribute = this.getExtendsId(similarParam.param);
        if (extendsAttribute) {
          parameter.extends = extendsAttribute;
        }
        parameter.fields = exportedFields;
        OldParameterFactory.copyContext(similarParam.field.component.componentContent, this.contexts);
        return parameter;
      }

      // In this case we have a hash class that doesn't extend another class
      const parameter: any = root ? { '@id': this.getUniqueFieldId(this.compactPath, field.key) } : {};
      const exportedFields = this.getHashFields(field);
      if (field.parameter.unique) {
        parameter.fields = exportedFields;
      } else {
        parameter.elements = exportedFields;
      }
      return parameter;
    }

    // In this case we have a simple parameter such as string, number, boolean
    const id = this.getUniqueFieldId(this.compactPath, field.key);
    const parameter = { '@id': id, ...field.parameter };
    this.parameters.push(parameter);
    return { '@id': id };
  }

  /**
   * Searches in the constructors of the superclasses to find an argument with the same class declaration
   *
   * @param param the declaration of the parameter to match
   * @returns the matching parameter, if any
   */
  public findSimilarParam(param: ParsedClassDeclaration): { field: SuperClassChainElement; param: any } | undefined {
    for (let i = 1; i < this.superClassChain.length; i++) {
      for (let x = 0; x < this.superClassChain[i].constructorParams.length; x++) {
        const otherConstructorParam = this.superClassChain[i].constructorParams[x];
        if (otherConstructorParam.type !== FieldType.Complex) {
          continue;
        }
        // Check if the declarations are the same
        if (!otherConstructorParam.declaration ||
          !Utils.classDeclarationEquals(param, otherConstructorParam.declaration)) {
          continue;
        }
        if (!this.superClassChain || !this.superClassChain[i].component) {
          continue;
        }
        return {
          field: this.superClassChain[i],
          param: this.superClassChain[i].component.component.constructorArguments[x],
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
  public getExtendsId(param: any): string | undefined {
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
  public getHashFields(field: FieldDeclaration): { keyRaw?: string; value: {} }[] | undefined {
    const exportedFields: { keyRaw?: string; value: {} }[] = [];
    const subFieldData = this.classParser.getFields(field.declaration, this.nodeModules);
    for (const subField of subFieldData) {
      let parsedField = this.getConstructorArgument(subField);
      if (!parsedField) {
        continue;
      }
      // This little check verifies whether the field consists
      // of solely one `@id` attribute
      // If so, it converts the result to a string
      if (Object.keys(parsedField).length === 1 && '@id' in parsedField) {
        parsedField = parsedField['@id'];
      }
      exportedFields.push({
        keyRaw: subField.key,
        value: parsedField,
      });
    }
    return exportedFields;
  }

  /**
   * Determine a unique field id for the given field path and field name.
   * @param path Components path of a field.
   * @param field A field name.
   */
  public getUniqueFieldId(path: string, field: string): string {
    function getId(i: number) {
      return `${path}#${field}${i === 0 ? '' : i}`;
    }

    let i = -1;
    while (this.chosenParameterNames.has(getId(++i))) {
      // Do nothing
    }
    const id = getId(i);
    this.chosenParameterNames.add(id);
    return id;
  }

  /**
   * Copies the context of a component
   *
   * @param componentContent the content of the component file
   * @param to destination collection
   */
  public static copyContext(componentContent: any, to: string[]) {
    for (const contextFile of Utils.getValueAsArray(componentContent, '@context')) {
      if (!to.includes(contextFile)) {
        to.push(contextFile);
      }
    }
  }
}

export interface ParameterParserArgs {
  classParser: OldClassParser;
  superClassChain: SuperClassChain;
  compactPath: string;
  nodeModules: NodeModules;
}
