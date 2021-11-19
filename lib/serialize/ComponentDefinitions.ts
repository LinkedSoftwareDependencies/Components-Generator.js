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
  extends?: string[];
  comment?: string;
  parameters: ParameterDefinition[];
  constructorArguments: ConstructorArgumentDefinition[];
}

export interface ParameterDefinition {
  '@id': string;
  comment?: string;
  unique?: boolean;
  required?: boolean;
  range?: ParameterDefinitionRange;
  default?: DefaultValueDefinition[];
  lazy?: boolean;
}

export type DefaultValueDefinition = string |
{ '@id'?: string; '@type'?: string } |
{ '@type': '@json'; '@value': any };

export type ParameterDefinitionRange = string | { '@id': string; parameters: ParameterDefinition[] } | {
  '@type': 'ParameterRangeUnion' | 'ParameterRangeIntersection' | 'ParameterRangeTuple';
  parameterRangeElements: ParameterDefinitionRange[];
} | {
  '@type': 'ParameterRangeRest';
  parameterRangeValue: ParameterDefinitionRange;
} | undefined;

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
