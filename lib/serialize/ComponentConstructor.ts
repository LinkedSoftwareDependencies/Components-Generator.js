import { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser';
import { ClassIndex, ClassLoaded, ClassReference } from '../parse/ClassIndex';
import { ConstructorData } from '../parse/ConstructorLoader';
import { PackageMetadata } from '../parse/PackageMetadataLoader';
import { ParameterData, ParameterRangeResolved } from '../parse/ParameterLoader';
import {
  ComponentDefinition,
  ComponentDefinitions, ComponentDefinitionsIndex,
  ConstructorArgumentDefinition,
  ParameterDefinition,
} from './ComponentDefinitions';
import { ContextConstructor } from './ContextConstructor';

/**
 * Creates declarative JSON components for the given classes.
 */
export class ComponentConstructor {
  private readonly packageMetadata: PackageMetadata;
  private readonly contextConstructor: ContextConstructor;
  private readonly pathDestination: PathDestinationDefinition;
  private readonly classReferences: ClassIndex<ClassLoaded>;
  private readonly classConstructors: ClassIndex<ConstructorData<ParameterRangeResolved>>;
  private readonly contextParser: ContextParser;

  public constructor(args: ComponentConstructorArgs) {
    this.packageMetadata = args.packageMetadata;
    this.contextConstructor = args.contextConstructor;
    this.pathDestination = args.pathDestination;
    this.classReferences = args.classReferences;
    this.classConstructors = args.classConstructors;
    this.contextParser = args.contextParser;
  }

  /**
   * Construct component definitions for all classes in the current index.
   */
  public async constructComponents(): Promise<ComponentDefinitions> {
    const definitions: ComponentDefinitions = {};

    // Construct a minimal context
    const context: JsonLdContextNormalized = await this.contextParser.parse(this.contextConstructor.constructContext());

    for (const [ className, classReference ] of Object.entries(this.classReferences)) {
      // Initialize or get context and component array
      const path = this.getPathDestination(classReference.fileName);
      if (!(path in definitions)) {
        definitions[path] = {
          '@context': Object.keys(this.packageMetadata.contexts),
          '@id': this.moduleIriToId(context),
          components: [],
        };
      }
      const { components } = definitions[path];

      // Construct the component for this class
      components.push(this.constructComponent(context, classReference, this.classConstructors[className]));
    }

    return definitions;
  }

  /**
   * Construct a component definitions index.
   * @param definitions The component definitions for which the index should be constructed.
   * @param fileExtension The file extension to apply on files.
   */
  public async constructComponentsIndex(
    definitions: ComponentDefinitions,
    fileExtension: string,
  ): Promise<ComponentDefinitionsIndex> {
    // Construct a minimal context
    const context: JsonLdContextNormalized = await this.contextParser.parse(this.contextConstructor.constructContext());

    return {
      '@context': Object.keys(this.packageMetadata.contexts),
      '@id': this.moduleIriToId(context),
      '@type': 'Module',
      requireName: this.packageMetadata.name,
      import: Object.keys(definitions)
        .map(pathAbsolute => `${pathAbsolute.slice(this.pathDestination.packageRootDirectory.length)}.${fileExtension}`)
        .map(pathRelative => this.getImportPathIri(pathRelative))
        .map(iri => context.compactIri(iri)),
    };
  }

  /**
   * Determine the path a component file should exist at based on a class source file path.
   * @param sourcePath The relative path to a class file.
   */
  public getPathDestination(sourcePath: string): string {
    if (!sourcePath.startsWith(this.pathDestination.packageRootDirectory)) {
      throw new Error(`Tried to reference a file outside the current package: ${sourcePath}`);
    }

    return this.pathDestination.packageRootDirectory + sourcePath
      .slice(this.pathDestination.packageRootDirectory.length)
      .replace(this.pathDestination.originalPath, this.pathDestination.replacementPath);
  }

  /**
   * Determine the IRI of the given source path.
   * @param sourcePath The relative path to a components file.
   */
  public getImportPathIri(sourcePath: string): string {
    if (sourcePath.startsWith('/')) {
      sourcePath = sourcePath.slice(1);
    }
    for (const [ iri, path ] of Object.entries(this.packageMetadata.importPaths)) {
      if (sourcePath.startsWith(path)) {
        return iri + sourcePath.slice(path.length);
      }
    }
    throw new Error(`Could not find a valid import path for ${sourcePath}. 'lsd:importPaths' in package.json may be invalid.`);
  }

  /**
   * Construct a component definition from the given constructor data.
   * @param context A parsed JSON-LD context.
   * @param classReference Class reference of the class component.
   * @param constructorData Constructor data of the owning class.
   */
  public constructComponent(
    context: JsonLdContextNormalized,
    classReference: ClassLoaded,
    constructorData: ConstructorData<ParameterRangeResolved>,
  ): ComponentDefinition {
    // Fill in parameters and constructor arguments
    const parameters: ParameterDefinition[] = [];
    const constructorArguments = this.constructParameters(context, classReference, constructorData, parameters);

    // Fill in fields
    return {
      '@id': this.classNameToId(context, classReference.localName),
      '@type': classReference.abstract ? 'AbstractClass' : 'Class',
      requireElement: classReference.localName,
      ...classReference.superClass ? { extends: this.classNameToId(context, classReference.superClass.localName) } : {},
      ...classReference.comment ? { comment: classReference.comment } : {},
      parameters,
      constructorArguments,
    };
  }

  /**
   * Construct a compacted module IRI.
   * @param context A parsed JSON-LD context.
   */
  public moduleIriToId(context: JsonLdContextNormalized): string {
    return context.compactIri(`${this.packageMetadata.moduleIri}`);
  }

  /**
   * Construct a compacted class IRI.
   * @param context A parsed JSON-LD context.
   * @param className The class name.
   */
  public classNameToId(context: JsonLdContextNormalized, className: string): string {
    return context.compactIri(`${this.packageMetadata.moduleIri}/${className}`);
  }

  /**
   * Construct a compacted field IRI.
   * @param context A parsed JSON-LD context.
   * @param className The class name owning the field.
   * @param fieldName The name of the field.
   */
  public fieldNameToId(context: JsonLdContextNormalized, className: string, fieldName: string): string {
    return context.compactIri(`${this.packageMetadata.moduleIri}/${className}#${fieldName}`);
  }

  /**
   * Construct constructor arguments from the given constructor data.
   * Additionally, parameters will be appended to the parameters array.
   *
   * @param context A parsed JSON-LD context.
   * @param classReference Class reference of the class component owning this constructor.
   * @param constructorData Constructor data of the owning class.
   * @param parameters The array of parameters of the owning class, which will be appended to.
   */
  public constructParameters(
    context: JsonLdContextNormalized,
    classReference: ClassLoaded,
    constructorData: ConstructorData<ParameterRangeResolved>,
    parameters: ParameterDefinition[],
  ): ConstructorArgumentDefinition[] {
    return constructorData.parameters
      .map(parameter => this.parameterDataToConstructorArgument(context, classReference, parameter, parameters));
  }

  /**
   * Construct a constructor argument from the given parameter data.
   * Additionally, one (or more) parameters will be appended to the parameters array.
   *
   * This may be invoked recursively based on the parameter type.
   *
   * @param context A parsed JSON-LD context.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data.
   * @param parameters The array of parameters of the owning class, which will be appended to.
   */
  public parameterDataToConstructorArgument(
    context: JsonLdContextNormalized,
    classReference: ClassLoaded,
    parameterData: ParameterData<ParameterRangeResolved>,
    parameters: ParameterDefinition[],
  ): ConstructorArgumentDefinition {
    if (parameterData.range.type === 'nested') {
      // Create a hash object with `fields` entries.
      // Each entry's value is recursively handled by this method again.
      const fields = parameterData.range.value
        .map(subParamData => ({
          keyRaw: subParamData.name,
          value: this.parameterDataToConstructorArgument(context, classReference, subParamData, parameters),
        }));
      return { fields };
    }

    // For all other range types, create a parameter and return its parameter id.
    let parameter: ParameterDefinition;
    if (parameterData.range.type === 'raw' || parameterData.range.type === 'override') {
      parameter = this.constructParameterRaw(context, classReference, parameterData, parameterData.range.value);
    } else {
      parameter = this.constructParameterClass(context, classReference, parameterData, parameterData.range.value);
    }
    parameters.push(parameter);
    return parameter['@id'];
  }

  /**
   * Construct a parameter definition from the given parameter data with raw range.
   * @param context A parsed JSON-LD context.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data.
   * @param range Range of this parameter data.
   */
  public constructParameterRaw(
    context: JsonLdContextNormalized,
    classReference: ClassLoaded,
    parameterData: ParameterData<ParameterRangeResolved>,
    range: string,
  ): ParameterDefinition {
    // Fill in required fields
    const definition: ParameterDefinition = {
      '@id': this.fieldNameToId(context, classReference.localName, parameterData.name),
      range: `xsd:${range}`,
    };

    // Fill in optional fields
    this.populateOptionalParameterFields(definition, parameterData);

    return definition;
  }

  /**
   * Construct a parameter definition from the given parameter data with class reference range.
   * @param context A parsed JSON-LD context.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data.
   * @param range Range of this parameter data.
   */
  public constructParameterClass(
    context: JsonLdContextNormalized,
    classReference: ClassReference,
    parameterData: ParameterData<ParameterRangeResolved>,
    range: ClassReference,
  ): ParameterDefinition {
    // Fill in required fields
    const definition: ParameterDefinition = {
      '@id': this.fieldNameToId(context, classReference.localName, parameterData.name),
      range: this.classNameToId(context, range.localName),
    };

    // Fill in optional fields
    this.populateOptionalParameterFields(definition, parameterData);

    return definition;
  }

  /**
   * Fill in the optional parameter definition values based on the given parameter data.
   * @param parameterDefinition A paramater definition to fill in.
   * @param parameterData Parameter data to read from.
   */
  public populateOptionalParameterFields(
    parameterDefinition: ParameterDefinition,
    parameterData: ParameterData<ParameterRangeResolved>,
  ) {
    if (parameterData.comment) {
      parameterDefinition.comment = parameterData.comment;
    }
    if (parameterData.unique) {
      parameterDefinition.unique = parameterData.unique;
    }
    if (parameterData.required) {
      parameterDefinition.required = parameterData.required;
    }
  }
}

export interface ComponentConstructorArgs {
  packageMetadata: PackageMetadata;
  contextConstructor: ContextConstructor;
  pathDestination: PathDestinationDefinition;
  classReferences: ClassIndex<ClassLoaded>;
  classConstructors: ClassIndex<ConstructorData<ParameterRangeResolved>>;
  contextParser: ContextParser;
}

export interface PathDestinationDefinition {
  packageRootDirectory: string;
  originalPath: string;
  replacementPath: string;
}
