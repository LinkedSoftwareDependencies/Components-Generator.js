/* The following types are defined according to the Components.js documentation */
/* https://componentsjs.readthedocs.io/en/latest/ */

export type ComponentDefinitions = Record<string, {
  '@context': string[];
  '@id': string;
  components: ComponentDefinition[];
}>;

export interface ComponentDefinitionsIndex {
  '@context': string[];
  '@id': string;
  '@type': 'Module';
  requireName: string;
  import: string[];
}

export interface ComponentDefinition {
  '@id': string;
  '@type': string;
  requireElement: string;
  extends?: ExtensionDefinition[];
  comment?: string;
  genericTypeParameters?: GenericTypeParameterDefinition[];
  parameters: ParameterDefinition[];
  memberKeys: string[];
  constructorArguments: ConstructorArgumentDefinition[];
}

export type ExtensionDefinition = string | {
  '@type': 'GenericComponentExtension';
  component: string;
  genericTypeInstances: ParameterDefinitionRange[];
};

export interface GenericTypeParameterDefinition {
  '@id': string;
  range?: ParameterDefinitionRange;
}

export interface ParameterDefinition {
  '@id': string;
  comment?: string;
  range?: ParameterDefinitionRange;
  default?: DefaultValueDefinition | { '@list': DefaultValueDefinition[] };
  lazy?: boolean;
}

export type DefaultValueDefinition = string |
{ '@id'?: string; '@type'?: string } |
{ '@type': '@json'; '@value': any };

export type ParameterDefinitionRange = string | { '@id': string; parameters: ParameterDefinition[] } | {
  '@type': 'ParameterRangeUnion' | 'ParameterRangeIntersection' | 'ParameterRangeTuple';
  parameterRangeElements: ParameterDefinitionRange[];
} | {
  '@type': 'ParameterRangeRest' | 'ParameterRangeArray' | 'ParameterRangeKeyof';
  parameterRangeValue: ParameterDefinitionRange;
} | {
  '@type': 'ParameterRangeUndefined';
} | {
  '@type': 'ParameterRangeWildcard';
} | {
  '@type': 'ParameterRangeCollectEntries';
  'parameterRangeCollectEntriesParameters': ParameterDefinition[];
} | {
  '@type': 'ParameterRangeLiteral';
  parameterRangeValueLiteral: number | string | boolean;
} | {
  '@type': 'ParameterRangeGenericTypeReference';
  parameterRangeGenericType: string;
} | {
  '@type': 'ParameterRangeGenericComponent';
  component: string;
  genericTypeInstances: ParameterDefinitionRange[];
};

export type ConstructorArgumentDefinition = string | { '@id': string } | {
  '@id': string;
  extends?: string;
  fields?: ConstructorFieldDefinition[];
  elements?: ConstructorElementDefinition[];
};

export interface ConstructorFieldDefinition {
  collectEntries?: string;
  key?: string;
  keyRaw?: string;
  value: ConstructorArgumentDefinition;
}

export type ConstructorElementDefinition = string | {
  valueRaw: ConstructorArgumentDefinition;
};
