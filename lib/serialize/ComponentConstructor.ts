import * as Path from 'path';
import type { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser';
import type { ClassIndex, ClassLoaded, ClassReference, ClassReferenceLoaded } from '../parse/ClassIndex';
import type { ConstructorData } from '../parse/ConstructorLoader';
import type { PackageMetadata } from '../parse/PackageMetadataLoader';
import type { ParameterData, ParameterRangeResolved } from '../parse/ParameterLoader';
import type { ExternalComponents } from '../resolution/ExternalModulesLoader';
import type {
  ComponentDefinition,
  ComponentDefinitions, ComponentDefinitionsIndex,
  ConstructorArgumentDefinition, ConstructorFieldDefinition,
  ParameterDefinition,
} from './ComponentDefinitions';
import type { ContextConstructor } from './ContextConstructor';

/**
 * Creates declarative JSON components for the given classes.
 */
export class ComponentConstructor {
  private readonly packageMetadata: PackageMetadata;
  private readonly contextConstructor: ContextConstructor;
  private readonly pathDestination: PathDestinationDefinition;
  private readonly classAndInterfaceIndex: ClassIndex<ClassReferenceLoaded>;
  private readonly classConstructors: ClassIndex<ConstructorData<ParameterRangeResolved>>;
  private readonly externalComponents: ExternalComponents;
  private readonly contextParser: ContextParser;

  public constructor(args: ComponentConstructorArgs) {
    this.packageMetadata = args.packageMetadata;
    this.contextConstructor = args.contextConstructor;
    this.pathDestination = args.pathDestination;
    this.classAndInterfaceIndex = args.classAndInterfaceIndex;
    this.classConstructors = args.classConstructors;
    this.externalComponents = args.externalComponents;
    this.contextParser = args.contextParser;
  }

  /**
   * Construct component definitions for all classes in the current index.
   */
  public async constructComponents(): Promise<ComponentDefinitions> {
    const definitions: ComponentDefinitions = {};

    // Construct a minimal context
    const context: JsonLdContextNormalized = await this.contextParser.parse(this.contextConstructor.constructContext());

    for (const [ className, classReference ] of Object.entries(this.classAndInterfaceIndex)) {
      // Initialize or get context and component array
      const path = this.getPathDestination(classReference.fileName);
      if (!(path in definitions)) {
        definitions[path] = {
          '@context': Object.keys(this.packageMetadata.contexts),
          '@id': this.moduleIriToId(context),
          components: [],
        };
      }
      const { components, '@context': contexts } = definitions[path];

      // Construct the component for this class
      components.push(await this.constructComponent(
        context,
        externalContextUrl => {
          // Append external contexts URLs to @context array
          if (!contexts.includes(externalContextUrl)) {
            contexts.push(externalContextUrl);
          }
        },
        classReference,
        this.classConstructors[className],
      ));
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
   * @param externalContextsCallback Callback for external contexts.
   * @param classReference Class reference of the class component.
   * @param constructorData Constructor data of the owning class.
   */
  public async constructComponent(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    classReference: ClassReferenceLoaded,
    constructorData: ConstructorData<ParameterRangeResolved>,
  ): Promise<ComponentDefinition> {
    // Fill in parameters and constructor arguments
    const parameters: ParameterDefinition[] = [];
    const constructorArguments = classReference.type === 'class' ?
      await this.constructParameters(
        context,
        externalContextsCallback,
        classReference,
        constructorData,
        parameters,
      ) :
      [];

    // Determine extends field based on super class and implementing interfaces.
    // Components.js makes no distinction between a super class and implementing interface, so we merge them here.
    let ext: string[] | undefined;
    if (classReference.type === 'class') {
      if (classReference.superClass || classReference.implementsInterfaces) {
        ext = [];
        if (classReference.superClass) {
          ext.push(await this.classNameToId(context, externalContextsCallback, classReference.superClass));
        }
        if (classReference.implementsInterfaces) {
          for (const iface of classReference.implementsInterfaces) {
            ext.push(await this.classNameToId(context, externalContextsCallback, iface));
          }
        }
      }
    } else if (classReference.superInterfaces) {
      ext = [];
      for (const iface of classReference.superInterfaces) {
        ext.push(await this.classNameToId(context, externalContextsCallback, iface));
      }
    }

    // Fill in fields
    const scopedId = await this.classNameToId(context, externalContextsCallback, classReference);
    return {
      '@id': scopedId,
      '@type': classReference.type === 'interface' || classReference.abstract ? 'AbstractClass' : 'Class',
      requireElement: classReference.localName,
      ...ext ? { extends: ext } : {},
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
   * @param externalContextsCallback Callback for external contexts.
   * @param classReference The class reference.
   */
  public async classNameToId(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    classReference: ClassReference,
  ): Promise<string> {
    // Mint a new IRI if class is in the current package
    if (classReference.packageName === this.packageMetadata.name) {
      return context.compactIri(`${this.packageMetadata.moduleIri}/${this.getPathRelative(classReference.fileName)}#${classReference.localName}`);
    }

    // Use existing IRI if class is in another package
    const moduleComponents = this.externalComponents.components[classReference.packageName];
    if (!moduleComponents) {
      throw new Error(`Tried to reference a class '${classReference.localName}' from an external module '${classReference.packageName}' that is not a dependency`);
    }
    moduleComponents.contextIris.forEach(iri => externalContextsCallback(iri));
    const componentIri = moduleComponents.componentNamesToIris[classReference.localName];
    if (!componentIri) {
      throw new Error(`Tried to reference a class '${classReference.localName}' from an external module '${classReference.packageName}' that does not expose this component`);
    }
    const contextExternal = await this.contextParser.parse(moduleComponents.contextIris);
    return contextExternal.compactIri(componentIri);
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
   * @param externalContextsCallback Callback for external contexts.
   * @param classReference Class reference of the class component owning this constructor.
   * @param constructorData Constructor data of the owning class.
   * @param parameters The array of parameters of the owning class, which will be appended to.
   */
  public async constructParameters(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    classReference: ClassLoaded,
    constructorData: ConstructorData<ParameterRangeResolved>,
    parameters: ParameterDefinition[],
  ): Promise<ConstructorArgumentDefinition[]> {
    const scope: FieldScope = {
      parentFieldNames: [],
      fieldIdsHash: {},
    };
    return await Promise.all(constructorData.parameters.map(parameter => this.parameterDataToConstructorArgument(
      context,
      externalContextsCallback,
      classReference,
      parameter,
      parameters,
      this.fieldNameToId(context, classReference, parameter.name, scope),
      scope,
    )));
  }

  /**
   * Construct a constructor argument from the given parameter data.
   * Additionally, one (or more) parameters will be appended to the parameters array.
   *
   * This may be invoked recursively based on the parameter type.
   *
   * @param context A parsed JSON-LD context.
   * @param externalContextsCallback Callback for external contexts.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data.
   * @param parameters The array of parameters of the owning class, which will be appended to.
   * @param fieldId The @id of the field.
   * @param scope The current field scope.
   */
  public async parameterDataToConstructorArgument(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    classReference: ClassLoaded,
    parameterData: ParameterData<ParameterRangeResolved>,
    parameters: ParameterDefinition[],
    fieldId: string,
    scope: FieldScope,
  ): Promise<ConstructorArgumentDefinition> {
    // Append the current field name to the scope
    if (parameterData.type === 'field') {
      scope = {
        ...scope,
        parentFieldNames: [ ...scope.parentFieldNames, parameterData.name ],
      };
    }

    if (parameterData.range.type === 'nested') {
      // Create a hash object with `fields` entries.
      // Each entry's value is (indirectly) recursively handled by this method again.
      const fields: ConstructorFieldDefinition[] = [];
      for (const subParamData of parameterData.range.value) {
        fields.push(await this.constructFieldDefinitionNested(
          context,
          externalContextsCallback,
          classReference,
          <ParameterData<ParameterRangeResolved> & { range: { type: 'nested' } }>parameterData,
          parameters,
          subParamData,
          fieldId,
          scope,
        ));
      }
      return { fields };
    }

    // For all other range types, create a parameter and return its parameter id.
    let param: ParameterDefinition;
    switch (parameterData.range.type) {
      case 'raw':
      case 'override':
        param = this.constructParameterRaw(context, classReference, parameterData, parameterData.range.value, fieldId);
        break;
      case 'undefined':
        param = this.constructParameterRangeUndefined(context, classReference, parameterData, fieldId);
        break;
      case 'class':
        // eslint-disable-next-line no-case-declarations
        param = await this.constructParameterClass(
          context,
          externalContextsCallback,
          classReference,
          parameterData,
          parameterData.range.value,
          fieldId,
        );
        break;
    }
    parameters.push(param);
    return { '@id': fieldId };
  }

  /**
   * For the given parameter with nested range, construct field definitions for all sub-parameters.
   * @param context A parsed JSON-LD context.
   * @param externalContextsCallback Callback for external contexts.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data with nested range.
   * @param parameters The array of parameters of the owning class, which will be appended to.
   * @param subParamData The sub-parameter of the parameter with nested range.
   * @param fieldId The @id of the field.
   * @param scope The current field scope.
   */
  public async constructFieldDefinitionNested(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    classReference: ClassLoaded,
    parameterData: ParameterData<ParameterRangeResolved> & { range: { type: 'nested' } },
    parameters: ParameterDefinition[],
    subParamData: ParameterData<ParameterRangeResolved>,
    fieldId: string,
    scope: FieldScope,
  ): Promise<ConstructorFieldDefinition> {
    if (subParamData.type === 'field') {
      return {
        keyRaw: subParamData.name,
        value: await this.parameterDataToConstructorArgument(
          context,
          externalContextsCallback,
          classReference,
          subParamData,
          parameters,
          this.fieldNameToId(context, classReference, subParamData.name, scope),
          scope,
        ),
      };
    }

    // Handle index type

    // Indexed elements can only occur in a field
    if (parameterData.type === 'index') {
      throw new Error(`Detected illegal indexed element inside a non-field in ${
        classReference.localName} at ${classReference.fileName}`);
    }

    // Remove the last element of the parent field names when we're in an indexed field,
    // to avoid the field name to be in the IRI twice.
    scope = {
      ...scope,
      parentFieldNames: scope.parentFieldNames.slice(0, -1),
    };

    // Determine parameter id's
    const idCollectEntries = fieldId;
    const idKey = this.fieldNameToId(context, classReference, `${parameterData.name}_key`, scope);
    const idValue = this.fieldNameToId(context, classReference, `${parameterData.name}_value`, scope);

    // Create sub parameters for key and value
    const subParameters: ParameterDefinition[] = [];
    subParameters.push({
      '@id': idKey,
      required: true,
      unique: true,
    });
    const value = await this.parameterDataToConstructorArgument(
      context,
      externalContextsCallback,
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
        '@id': this.fieldNameToId(context, classReference, `${parameterData.name}_range`, scope),
        parameters: subParameters,
      },
    };
    // Params for collected entries are never required, and can have more than one entry.
    parameterData.unique = false;
    parameterData.required = false;
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
      range: range === 'json' ? 'rdf:JSON' : `xsd:${range}`,
    };

    // Fill in optional fields
    this.populateOptionalParameterFields(definition, parameterData);

    return definition;
  }

  /**
   * Construct a parameter definition from the given parameter data with an undefined range.
   * @param context A parsed JSON-LD context.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data.
   * @param fieldId The @id of the field.
   */
  public constructParameterRangeUndefined(
    context: JsonLdContextNormalized,
    classReference: ClassLoaded,
    parameterData: ParameterData<ParameterRangeResolved>,
    fieldId: string,
  ): ParameterDefinition {
    // Fill in required fields
    const definition: ParameterDefinition = {
      '@id': fieldId,
    };

    // Fill in optional fields
    this.populateOptionalParameterFields(definition, parameterData);

    return definition;
  }

  /**
   * Construct a parameter definition from the given parameter data with class reference range.
   * @param context A parsed JSON-LD context.
   * @param externalContextsCallback Callback for external contexts.
   * @param classReference Class reference of the class component owning this parameter.
   * @param parameterData Parameter data.
   * @param range Range of this parameter data.
   * @param fieldId The @id of the field.
   */
  public async constructParameterClass(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    classReference: ClassReference,
    parameterData: ParameterData<ParameterRangeResolved>,
    range: ClassReference,
    fieldId: string,
  ): Promise<ParameterDefinition> {
    // Fill in required fields
    const definition: ParameterDefinition = {
      '@id': fieldId,
      range: await this.classNameToId(context, externalContextsCallback, range),
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
  ): void {
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
  classAndInterfaceIndex: ClassIndex<ClassReferenceLoaded>;
  classConstructors: ClassIndex<ConstructorData<ParameterRangeResolved>>;
  externalComponents: ExternalComponents;
  contextParser: ContextParser;
}

export interface PathDestinationDefinition {
  /**
   * Absolute path to the package root.
   */
  packageRootDirectory: string;
  /**
   * Absolute path to the package source directory.
   */
  originalPath: string;
  /**
   * Absolute path to the package components target directory.
   */
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
  fieldIdsHash: Record<string, number>;
}

export type ExternalContextCallback = (contextUrl: string) => void;
