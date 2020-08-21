/* The following types are defined according to the Components.js documentation */
/* https://componentsjs.readthedocs.io/en/latest/ */

export interface ComponentDefinitions {
  [path: string]: {
    '@context': string[];
    '@id': string;
    components: ComponentDefinition[];
  };
}

export interface ComponentDefinition {
  '@id': string;
  '@type': string;
  requireElement: string;
  extends?: string;
  comment?: string;
  parameters: ParameterDefinition[];
  constructorArguments: ConstructorArgumentDefinition[];
}

export interface ParameterDefinition {
  '@id': string;
  comment?: string;
  unique?: boolean;
  required?: boolean;
  range?: string;
  lazy?: boolean;
}

export type ConstructorArgumentDefinition = string | {
  '@id'?: string;
  extends?: string;
  fields?: ConstructorFieldDefinition[];
  elements?: ConstructorElementDefinition[];
};

export interface ConstructorFieldDefinition {
  key?: string;
  keyRaw?: string;
  value: ConstructorArgumentDefinition;
}

export type ConstructorElementDefinition = string | {
  valueRaw: ConstructorArgumentDefinition;
};
