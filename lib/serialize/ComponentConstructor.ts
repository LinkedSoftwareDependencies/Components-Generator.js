import * as Path from 'path';
import { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser';
import { ClassIndex, ClassLoaded, ClassReference } from '../parse/ClassIndex';
import { ConstructorData } from '../parse/ConstructorLoader';
import { PackageMetadata } from '../parse/PackageMetadataLoader';
import { ParameterData, ParameterRangeResolved } from '../parse/ParameterLoader';
import {
  ComponentDefinition,
  ComponentDefinitions, ComponentDefinitionsIndex,
  ConstructorArgumentDefinition, ConstructorFieldDefinition,
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
        .map(pathAbsolute => this.getPathRelative(`${pathAbsolute}.${fileExtension}`))
        .map(pathRelative => this.getImportPathIri(pathRelative))
        .map(iri => context.compactIri(iri)),
    };
  }

  /**
   * Determine the relative path of a component file within a package.
   * @param sourcePath The absolute path to a class file.
   */
  public getPathRelative(sourcePath: string): string {
    if (!sourcePath.startsWith(this.pathDestination.packageRootDirectory)) {
      throw new Error(`Tried to reference a file outside the current package: ${sourcePath}`);
    }

    let strippedPath = sourcePath.slice(this.pathDestination.packageRootDirectory.length + 1);
    if (Path.sep !== '/') {
      strippedPath = strippedPath.split(Path.sep).join('/');
    }

    return strippedPath.replace(`${this.pathDestination.originalPath}/`, '');
  }

  /**
   * Determine the path a component file should exist at based on a class source file path.
   * @param sourcePath The absolute path to a class file.
   */
  public getPathDestination(sourcePath: string): string {
    if (!sourcePath.startsWith(this.pathDestination.packageRootDirectory)) {
      throw new Error(`Tried to reference a file outside the current package: ${sourcePath}`);
    }

    return sourcePath.replace(this.pathDestination.originalPath, this.pathDestination.replacementPath);
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
      '@id': this.classNameToId(context, classReference),
      '@type': classReference.abstract ? 'AbstractClass' : 'Class',
      requireElement: classReference.localName,
      ...classReference.superClass ? { extends: this.classNameToId(context, classReference.superClass) } : {},
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
   * @param classReference The class reference.
   */
  public classNameToId(context: JsonLdContextNormalized, classReference: ClassReference): string {
    return context.compactIri(`${this.packageMetadata.moduleIri}/${this.getPathRelative(classReference.fileName)}#${classReference.localName}`);
  }

  /**
   * Construct a compacted field IRI.
   * @param context A parsed JSON-LD context.
   * @param classReference The class reference.
   * @param fieldName The name of the field.
   * @param scope The current field scope.
   */
  public fieldNameToId(
    context: JsonLdContextNormalized,
    classReference: ClassReference,
    fieldName: string,
    scope: FieldScope,
  ): string {
    if (scope.parentFieldNames.length > 0) {
      fieldName = `${scope.parentFieldNames.join('_')}_${fieldName}`;
    }
    let id = context.compactIri(`${this.packageMetadata.moduleIri}/${this.getPathRelative(classReference.fileName)}#${classReference.localName}_${fieldName}`);
    if (id in scope.fieldIdsHash) {
      id += `_${scope.fieldIdsHash[id]++}`;
    } else {
      scope.fieldIdsHash[id] = 1;
    }
    return id;
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
    const scope: FieldScope = {
      parentFieldNames: [],
      fieldIdsHash: {},
    };
    return constructorData.parameters.map(parameter => this.parameterDataToConstructorArgument(
      context,
      classReference,
      parameter,
      parameters,
      this.fieldNameToId(context, classReference, parameter.name, scope),
      scope,
    ));
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
   * @param fieldId The @id of the field.
   * @param scope The current field scope.
   */
  public parameterDataToConstructorArgument(
    context: JsonLdContextNormalized,
    classReference: ClassLoaded,
    parameterData: ParameterData<ParameterRangeResolved>,
    parameters: ParameterDefinition[],
    fieldId: string,
    scope: FieldScope,
  ): ConstructorArgumentDefinition {
    if (parameterData.range.type === 'nested') {
      // Create a hash object with `fields` entries.
      // Each entry's value is (indirectly) recursively handled by this method again.
      const fields = parameterData.range.value.map(subParamData => this.constructFieldDefinitionNested(
        context,
        classReference,
        <ParameterData<ParameterRangeResolved> & { range: { type: 'nested' } }> parameterData,
        parameters,
        subParamData,
        scope,
      ));
      return { fields };
    }

    // For all other range types, create a parameter and return its parameter id.
    let param: ParameterDefinition;
    if (parameterData.range.type === 'raw' || parameterData.range.type === 'override') {
      param = this.constructParameterRaw(context, classReference, parameterData, parameterData.range.value, fieldId);
    } else {
      param = this.constructParameterClass(context, classReference, parameterData, parameterData.range.value, fieldId);
    }
    parameters.push(param);
    return { '@id': fieldId };
  }

  /**
   * For the given parameter with nested range, construct field definitions for all sub-parameters.
   * @param context A parsed JSON-LD context.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data with nested range.
   * @param parameters The array of parameters of the owning class, which will be appended to.
   * @param subParamData The sub-parameter of the parameter with nested range.
   * @param scope The current field scope.
   */
  public constructFieldDefinitionNested(
    context: JsonLdContextNormalized,
    classReference: ClassLoaded,
    parameterData: ParameterData<ParameterRangeResolved> & { range: { type: 'nested' } },
    parameters: ParameterDefinition[],
    subParamData: ParameterData<ParameterRangeResolved>,
    scope: FieldScope,
  ): ConstructorFieldDefinition {
    if (subParamData.type === 'field') {
      const subScope: FieldScope = {
        parentFieldNames: [ ...scope.parentFieldNames, subParamData.name ],
        fieldIdsHash: scope.fieldIdsHash,
      };
      return {
        keyRaw: subParamData.name,
        value: this.parameterDataToConstructorArgument(
          context,
          classReference,
          subParamData,
          parameters,
          this.fieldNameToId(context, classReference, subParamData.name, scope),
          subScope,
        ),
      };
    }

    // Handle index type

    // Indexed elements can only occur in a field
    if (parameterData.type === 'index') {
      throw new Error(`Detected illegal indexed element inside a non-field in ${
        classReference.localName} at ${classReference.fileName}`);
    }

    // Determine parameter id's
    const idCollectEntries = this.fieldNameToId(context, classReference, parameterData.name, scope);
    const idKey = this.fieldNameToId(context, classReference, `${parameterData.name}_key`, scope);
    const idValue = this.fieldNameToId(context, classReference, `${parameterData.name}_value`, scope);

    // Create sub parameters for key and value
    const subParameters: ParameterDefinition[] = [];
    subParameters.push({
      '@id': idKey,
      required: true,
      unique: true,
    });
    const value = this.parameterDataToConstructorArgument(
      context,
      classReference,
      subParamData,
      subParameters,
      idValue,
      scope,
    );
    subParameters[subParameters.length - 1].required = true;
    subParameters[subParameters.length - 1].unique = true;

    // Construct parameter, which has key and value as sub-parameters
    const parameter: ParameterDefinition = {
      '@id': idCollectEntries,
      range: {
        '@type': this.fieldNameToId(context, classReference, `${parameterData.name}_range`, scope),
        parameters: subParameters,
      },
    };
    this.populateOptionalParameterFields(parameter, parameterData);
    parameters.push(parameter);

    // Create definition that collect entries from key and value parameters
    return {
      collectEntries: idCollectEntries,
      key: idKey,
      value,
    };
  }

  /**
   * Construct a parameter definition from the given parameter data with raw range.
   * @param context A parsed JSON-LD context.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data.
   * @param range Range of this parameter data.
   * @param fieldId The @id of the field.
   */
  public constructParameterRaw(
    context: JsonLdContextNormalized,
    classReference: ClassLoaded,
    parameterData: ParameterData<ParameterRangeResolved>,
    range: string,
    fieldId: string,
  ): ParameterDefinition {
    // Fill in required fields
    const definition: ParameterDefinition = {
      '@id': fieldId,
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
   * @param fieldId The @id of the field.
   */
  public constructParameterClass(
    context: JsonLdContextNormalized,
    classReference: ClassReference,
    parameterData: ParameterData<ParameterRangeResolved>,
    range: ClassReference,
    fieldId: string,
  ): ParameterDefinition {
    // Fill in required fields
    const definition: ParameterDefinition = {
      '@id': fieldId,
      range: this.classNameToId(context, range),
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
    if ('unique' in parameterData && parameterData.unique) {
      parameterDefinition.unique = parameterData.unique;
    }
    if ('required' in parameterData && parameterData.required) {
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

export interface FieldScope {
  /**
   * All parent field names for the current scope.
   */
  parentFieldNames: string[];
  /**
   * A hash containing all previously created field names, to ensure uniqueness.
   */
  fieldIdsHash: {[fieldName: string]: number};
}
