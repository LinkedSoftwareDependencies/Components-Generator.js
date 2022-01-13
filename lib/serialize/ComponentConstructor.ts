import * as Path from 'path';
import type { ContextParser, JsonLdContextNormalized } from 'jsonld-context-parser';
import semverMajor = require('semver/functions/major');
import type {
  ClassIndex,
  ClassLoaded,
  ClassReference,
  ClassReferenceLoadedClassOrInterface,
} from '../parse/ClassIndex';
import type { ConstructorData } from '../parse/ConstructorLoader';
import type { GenericsData } from '../parse/GenericsLoader';
import type { PackageMetadata } from '../parse/PackageMetadataLoader';
import type { DefaultNested,
  DefaultValue,
  GenericTypeParameterData,
  ParameterData,
  ParameterRangeResolved,
  ExtensionData } from '../parse/ParameterLoader';
import type { ExternalComponents } from '../resolution/ExternalModulesLoader';
import type { ComponentDefinition,
  ComponentDefinitions, ComponentDefinitionsIndex,
  ConstructorArgumentDefinition, ConstructorFieldDefinition, DefaultValueDefinition,
  ParameterDefinition, ParameterDefinitionRange,
  GenericTypeParameterDefinition, ExtensionDefinition } from './ComponentDefinitions';
import { ContextConstructor } from './ContextConstructor';

/**
 * Creates declarative JSON components for the given classes.
 */
export class ComponentConstructor {
  private readonly packageMetadata: PackageMetadata;
  private readonly fileExtension: string;
  private readonly contextConstructor: ContextConstructor;
  private readonly pathDestination: PathDestinationDefinition;
  private readonly classAndInterfaceIndex: ClassIndex<ClassReferenceLoadedClassOrInterface>;
  private readonly classConstructors: ClassIndex<ConstructorData<ParameterRangeResolved>>;
  private readonly classGenerics: ClassIndex<GenericsData<ParameterRangeResolved>>;
  private readonly classExtensions: ClassIndex<ExtensionData<ParameterRangeResolved>[]>;
  private readonly externalComponents: ExternalComponents;
  private readonly contextParser: ContextParser;

  public constructor(args: ComponentConstructorArgs) {
    this.packageMetadata = args.packageMetadata;
    this.fileExtension = args.fileExtension;
    this.contextConstructor = args.contextConstructor;
    this.pathDestination = args.pathDestination;
    this.classAndInterfaceIndex = args.classAndInterfaceIndex;
    this.classConstructors = args.classConstructors;
    this.classGenerics = args.classGenerics;
    this.classExtensions = args.classExtensions;
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
      const sourcePath = classReference.packageName !== this.packageMetadata.name ?
        classReference.fileNameReferenced :
        classReference.fileName;
      const path = ComponentConstructor.getPathDestination(this.pathDestination, sourcePath);
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
        this.classGenerics[className],
        this.classExtensions[className],
      ));
    }

    return definitions;
  }

  /**
   * Construct a component definitions index.
   * @param definitions The component definitions for which the index should be constructed.
   */
  public async constructComponentsIndex(
    definitions: ComponentDefinitions,
  ): Promise<ComponentDefinitionsIndex> {
    // Construct a minimal context
    const context: JsonLdContextNormalized = await this.contextParser.parse(this.contextConstructor.constructContext());

    return {
      '@context': Object.keys(this.packageMetadata.contexts),
      '@id': this.moduleIriToId(context),
      '@type': 'Module',
      requireName: this.packageMetadata.name,
      import: Object.keys(definitions)
        .map(pathAbsolute => ComponentConstructor.getPathRelative(this.pathDestination, `${pathAbsolute}.${this.fileExtension}`))
        .map(pathRelative => this.getImportPathIri(pathRelative))
        .map(iri => context.compactIri(iri)),
    };
  }

  /**
   * Determine the relative path of a component file within a package.
   * @param pathDestination The path destination.
   * @param sourcePath The absolute path to a class file.
   */
  public static getPathRelative(pathDestination: PathDestinationDefinition, sourcePath: string): string {
    if (!sourcePath.startsWith(pathDestination.packageRootDirectory)) {
      throw new Error(`Tried to reference a file outside the current package: ${sourcePath}`);
    }

    let strippedPath = sourcePath.slice(pathDestination.packageRootDirectory.length + 1);
    if (Path.sep !== '/') {
      strippedPath = strippedPath.split(Path.sep).join('/');
    }

    return strippedPath.replace(`${pathDestination.originalPath}/`, '');
  }

  /**
   * Determine the path a component file should exist at based on a class source file path.
   * @param pathDestination The path destination.
   * @param sourcePath The absolute path to a class file.
   */
  public static getPathDestination(pathDestination: PathDestinationDefinition, sourcePath: string): string {
    if (!sourcePath.startsWith(pathDestination.packageRootDirectory)) {
      throw new Error(`Tried to reference a file outside the current package: ${sourcePath}`);
    }

    return sourcePath.replace(pathDestination.originalPath, pathDestination.replacementPath);
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
   * @param genericsData Generics data of the owning class.
   * @param classExtensions Class extensions of the owning class.
   */
  public async constructComponent(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    classReference: ClassReferenceLoadedClassOrInterface,
    constructorData: ConstructorData<ParameterRangeResolved> | undefined,
    genericsData: GenericsData<ParameterRangeResolved> | undefined,
    classExtensions: ExtensionData<ParameterRangeResolved>[] | undefined,
  ): Promise<ComponentDefinition> {
    // Determine generic type parameters
    const genericTypeParameters = genericsData ?
      await this.constructGenericTypeParameters(
        context,
        externalContextsCallback,
        classReference,
        genericsData.genericTypeParameters,
      ) :
      undefined;

    // Fill in parameters and constructor arguments
    const parameters: ParameterDefinition[] = [];
    const scopedId = await this.classNameToId(context, externalContextsCallback, classReference);
    const constructorArguments = constructorData && classReference.type === 'class' ?
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
    const ext: ExtensionDefinition[] | undefined = classExtensions && classExtensions.length > 0 ?
      await Promise.all(classExtensions.map(async classExtension => await this
        .constructExtensionDefinition(context, externalContextsCallback, classExtension))) :
      undefined;

    // Obtain the keys of all members
    const memberKeys = classReference.memberKeys;

    // Fill in fields
    return {
      '@id': scopedId,
      '@type': classReference.type === 'interface' || classReference.abstract ? 'AbstractClass' : 'Class',
      requireElement: classReference.localName,
      ...ext ? { extends: ext } : {},
      ...classReference.comment ? { comment: classReference.comment } : {},
      ...genericTypeParameters && genericTypeParameters.length > 0 ? { genericTypeParameters } : {},
      parameters,
      memberKeys,
      constructorArguments,
    };
  }

  /**
   * Construct a compacted class IRI.
   * @param context A parsed JSON-LD context.
   * @param externalContextsCallback Callback for external contexts.
   * @param extensionData The extension data.
   */
  public async constructExtensionDefinition(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    extensionData: ExtensionData<ParameterRangeResolved>,
  ): Promise<ExtensionDefinition> {
    const id = await this.classNameToId(context, externalContextsCallback, extensionData.classLoaded);
    if (extensionData.genericTypeInstantiations.length > 0) {
      return {
        '@type': 'GenericComponentExtension',
        component: id,
        genericTypeInstances: await Promise.all(extensionData.genericTypeInstantiations
          .map(async genericTypeInstantiation => this.constructParameterRange(
            genericTypeInstantiation,
            context,
            externalContextsCallback,
            '',
          ))),
      };
    }
    return id;
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
      return ComponentConstructor.classNameToIdForPackage(
        context,
        this.packageMetadata,
        this.pathDestination,
        classReference,
        this.fileExtension,
      );
    }

    // Use existing IRI if class is in another package (that is also being built currently)
    const otherPackageMetadata = this.externalComponents.packagesBeingGenerated[classReference.packageName];
    if (otherPackageMetadata) {
      Object.keys(otherPackageMetadata.packageMetadata.contexts).forEach(iri => externalContextsCallback(iri));
      return await ComponentConstructor.classNameToIdForPackage(
        otherPackageMetadata.minimalContext,
        otherPackageMetadata.packageMetadata,
        otherPackageMetadata.pathDestination,
        classReference,
        this.fileExtension,
      );
    }

    // Use existing IRI if class is in another package (pre-built)
    const moduleComponents = this.externalComponents.components[classReference.packageName];
    if (!moduleComponents) {
      // Mint a dummy IRI if the component is not exposing components files
      return `urn:npm:${classReference.packageName}:${classReference.localName}`;
    }
    moduleComponents.contextIris.forEach(iri => externalContextsCallback(iri));
    const componentIri = moduleComponents.componentNamesToIris[classReference.localName];
    if (!componentIri) {
      throw new Error(`Tried to reference a class '${classReference.localName}' from an external module '${classReference.packageName}' that does not expose this component`);
    }
    const contextExternal = await this.contextParser.parse(moduleComponents.contextIris);
    return contextExternal.compactIri(componentIri);
  }

  public static async classNameToIdForPackage(
    context: JsonLdContextNormalized,
    packageMetadata: PackageMetadata,
    pathDestination: PathDestinationDefinition,
    classReference: ClassReference,
    fileExtension: string,
  ): Promise<string> {
    return context.compactIri(ComponentConstructor
      .classNameToIriForPackage(packageMetadata, pathDestination, classReference, fileExtension));
  }

  public static classNameToIriForPackage(
    packageMetadata: PackageMetadata,
    pathDestination: PathDestinationDefinition,
    classReference: ClassReference,
    fileExtension: string,
  ): string {
    const filePath = ComponentConstructor.getPathRelative(
      pathDestination,
      ComponentConstructor.getPathDestination(pathDestination, classReference.fileName),
    );
    return `${packageMetadata.moduleIri}/^${semverMajor(packageMetadata.version)}.0.0/${filePath}.${fileExtension}#${classReference.localName}`;
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

    // Mint a new IRI if class is in the current package
    let iri: string | undefined;
    if (classReference.packageName === this.packageMetadata.name) {
      iri = ComponentConstructor.classNameToIriForPackage(
        this.packageMetadata,
        this.pathDestination,
        classReference,
        this.fileExtension,
      );
    }

    // Use existing IRI if class is in another package (that is also being built currently)
    const otherPackageMetadata = this.externalComponents.packagesBeingGenerated[classReference.packageName];
    if (otherPackageMetadata) {
      iri = ComponentConstructor.classNameToIriForPackage(
        otherPackageMetadata.packageMetadata,
        otherPackageMetadata.pathDestination,
        classReference,
        this.fileExtension,
      );
    }

    if (!iri) {
      throw new Error(`Tried to reference a field ${fieldName} in "${this.pathDestination.packageRootDirectory}" outside the current package: ${classReference.fileName}`);
    }

    let id = context.compactIri(`${iri}_${fieldName}`);
    if (id in scope.fieldIdsHash) {
      id += `_${scope.fieldIdsHash[id]++}`;
    } else {
      scope.fieldIdsHash[id] = 1;
    }
    return id;
  }

  /**
   * Construct a compacted generic name IRI.
   * @param context A parsed JSON-LD context.
   * @param classReference The class reference.
   * @param genericTypeName The name of the generic type.
   */
  public genericNameToId(
    context: JsonLdContextNormalized,
    classReference: ClassReference,
    genericTypeName: string,
  ): string {
    return this.fieldNameToId(context, classReference, `_generic_${genericTypeName}`, {
      parentFieldNames: [],
      fieldIdsHash: {},
      defaultNested: [],
    });
  }

  /**
   * Construct constructor arguments from the given constructor data.
   * Additionally, parameters will be appended to the parameters array.
   *
   * @param context A parsed JSON-LD context.
   * @param externalContextsCallback Callback for external contexts.
   * @param classReference Class reference of the class component owning this constructor.
   * @param genericTypes Generic types of the class.
   */
  public async constructGenericTypeParameters(
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    classReference: ClassReferenceLoadedClassOrInterface,
    genericTypes: GenericTypeParameterData<ParameterRangeResolved>[],
  ): Promise<GenericTypeParameterDefinition[]> {
    const definitions: GenericTypeParameterDefinition[] = [];
    for (const genericType of genericTypes) {
      const id = this.genericNameToId(context, classReference, genericType.name);
      definitions.push({
        '@id': id,
        ...genericType.range ?
          { range: await this.constructParameterRange(genericType.range, context, externalContextsCallback, id) } :
          {},
      });
    }
    return definitions;
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
      defaultNested: [],
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
    if (parameterData.type === 'field') {
      // Append the current field name to the scope
      scope = {
        ...scope,
        parentFieldNames: [ ...scope.parentFieldNames, parameterData.name ],
      };
      // Obtain the defaultNested targets
      if (parameterData.defaultNested) {
        scope.defaultNested = parameterData.defaultNested;
      }
    }

    if (parameterData.range.type === 'nested' ||
      (parameterData.range.type === 'union' &&
        parameterData.range.elements.some(element => element.type === 'nested'))) {
      // TODO: this union type check is not great, so solve this when refactoring nested fields
      // Create a hash object with `fields` entries.
      // Each entry's value is (indirectly) recursively handled by this method again.
      const fields: ConstructorFieldDefinition[] = [];
      const subParams: ParameterData<ParameterRangeResolved>[] = parameterData.range.type === 'nested' ?
        parameterData.range.value :
        (<any> parameterData.range.elements.find(element => element.type === 'nested')).value;
      for (const subParamData of subParams) {
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
      return { '@id': `${fieldId}__constructorArgument`, fields };
    }

    // Check if we have a defaultNested value that applies on this field
    const defaultValues: DefaultValue[] = parameterData.defaults || [];
    for (const defaultNested of scope.defaultNested) {
      if (defaultNested.paramPath.join('_') === scope.parentFieldNames.join('_')) {
        defaultValues.push(defaultNested.value);
      }
    }

    const defaultValuesConstructed = await Promise.all(defaultValues
      .map(defaultValue => this.constructDefaultValueDefinition(
        fieldId,
        context,
        externalContextsCallback,
        defaultValue,
        parameterData.range,
      )));

    // For all other range types, create a parameter and return its parameter id.
    const range = await this.constructParameterRange(parameterData.range, context, externalContextsCallback, fieldId);
    const param: ParameterDefinition = {
      '@id': fieldId,
      range,
      ...defaultValuesConstructed.length > 0 ?
        {
          default: defaultValuesConstructed.length > 1 || ContextConstructor.isParameterRangeList(range) ?
            { '@list': defaultValuesConstructed } :
            defaultValuesConstructed[0],
        } :
        {},
    };

    // Fill in optional fields
    this.populateOptionalParameterFields(param, parameterData);

    parameters.push(param);
    return { '@id': fieldId };
  }

  public async constructDefaultValueDefinition(
    fieldId: string,
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    defaultValue: DefaultValue,
    range: ParameterRangeResolved,
  ): Promise<DefaultValueDefinition> {
    if (defaultValue.type === 'raw') {
      if ((range.type === 'override' && range.value === 'json') ||
        (range.type === 'union' &&
          range.elements.some(subRange => subRange.type === 'override' && subRange.value === 'json'))) {
        try {
          return {
            '@type': '@json',
            '@value': JSON.parse(defaultValue.value),
          };
        } catch (error: unknown) {
          throw new Error(`JSON parsing error in default value of ${fieldId}: ${(<Error> error).message}`);
        }
      }
      return defaultValue.value;
    }

    // Resolve relative IRI
    let iri = defaultValue.value;
    if (iri && !iri.includes(':')) {
      const baseIRI = await this.classNameToId(context, externalContextsCallback, defaultValue.baseComponent);
      iri = `${baseIRI}_${iri}`;
    }

    return { '@id': iri, '@type': defaultValue.typeIri };
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
    subParameters.push({ '@id': idKey });
    const value = await this.parameterDataToConstructorArgument(
      context,
      externalContextsCallback,
      classReference,
      subParamData,
      subParameters,
      idValue,
      scope,
    );

    // Construct parameter, which has key and value as sub-parameters
    const parameter: ParameterDefinition = {
      '@id': idCollectEntries,
      range: {
        '@type': 'ParameterRangeCollectEntries',
        parameterRangeCollectEntriesParameters: subParameters,
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
   * Determine the parameter definition's range definition.
   * @param range The range of a parameter
   * @param context A parsed JSON-LD context.
   * @param externalContextsCallback Callback for external contexts.
   * @param fieldId The @id of the field.
   */
  public async constructParameterRange(
    range: ParameterRangeResolved,
    context: JsonLdContextNormalized,
    externalContextsCallback: ExternalContextCallback,
    fieldId: string,
  ): Promise<ParameterDefinitionRange> {
    let type: string;
    switch (range.type) {
      case 'raw':
      case 'override':
        return range.value === 'json' ? 'rdf:JSON' : `xsd:${range.value}`;
      case 'literal':
        return {
          '@type': 'ParameterRangeLiteral',
          parameterRangeValueLiteral: range.value,
        };
      case 'class':
        // eslint-disable-next-line no-case-declarations
        const componentId = await this.classNameToId(context, externalContextsCallback, range.value);
        if (range.genericTypeParameterInstances) {
          return {
            '@type': 'ParameterRangeGenericComponent',
            component: componentId,
            genericTypeInstances: await Promise.all(range.genericTypeParameterInstances
              .map(genericType => this.constructParameterRange(
                genericType,
                context,
                externalContextsCallback,
                fieldId,
              ))),
          };
        }
        return componentId;
      case 'nested':
        // TODO: Composition of nested fields is unsupported
        return {
          '@type': 'ParameterRangeWildcard',
        };
      case 'undefined':
        return {
          '@type': 'ParameterRangeUndefined',
        };
      case 'wildcard':
        return {
          '@type': 'ParameterRangeWildcard',
        };
      case 'union':
      case 'intersection':
      case 'tuple':
        switch (range.type) {
          case 'union':
            type = 'ParameterRangeUnion';
            break;
          case 'intersection':
            type = 'ParameterRangeIntersection';
            break;
          case 'tuple':
            type = 'ParameterRangeTuple';
            break;
        }
        return {
          '@type': <any> type,
          parameterRangeElements: await Promise.all(range.elements
            .map(child => this.constructParameterRange(child, context, externalContextsCallback, fieldId))),
        };
      case 'rest':
      case 'array':
      case 'keyof':
        switch (range.type) {
          case 'rest':
            type = 'ParameterRangeRest';
            break;
          case 'array':
            type = 'ParameterRangeArray';
            break;
          case 'keyof':
            type = 'ParameterRangeKeyof';
            break;
        }
        return {
          '@type': <any> type,
          parameterRangeValue: await this
            .constructParameterRange(range.value, context, externalContextsCallback, fieldId),
        };
      case 'genericTypeReference':
        return {
          '@type': 'ParameterRangeGenericTypeReference',
          parameterRangeGenericType: this.genericNameToId(context, range.origin, range.value),
        };
    }
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
  }
}

export interface ComponentConstructorArgs {
  packageMetadata: PackageMetadata;
  fileExtension: string;
  contextConstructor: ContextConstructor;
  pathDestination: PathDestinationDefinition;
  classAndInterfaceIndex: ClassIndex<ClassReferenceLoadedClassOrInterface>;
  classConstructors: ClassIndex<ConstructorData<ParameterRangeResolved>>;
  classGenerics: ClassIndex<GenericsData<ParameterRangeResolved>>;
  classExtensions: ClassIndex<ExtensionData<ParameterRangeResolved>[]>;
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
  /**
   * The nested default values on parameters.
   */
  defaultNested: DefaultNested[];
}

export type ExternalContextCallback = (contextUrl: string) => void;
