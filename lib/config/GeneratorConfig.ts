/**
 * Represents a generator config
 */
export interface GeneratorConfig {
  /**
   * Relative path to directory containing source files, defaults to 'lib'.
   */
  source: string;
  /**
   * Relative path to directory that will contain components files, defaults to 'components'.
   */
  destination: string;
  /**
   * Extension for components files (without .), defaults to 'jsonld'.
   */
  extension: string;
  /**
   * Relative path to an optional file with class names to ignore.
   */
  ignoreComponents: string[];
  /**
   * The logger level, defaults to 'info'.
   */
  logLevel: string;
  /**
   * Optional custom JSON-LD module prefix, defaults to an auto-generated value.
   */
  modulePrefix: string | undefined;
  /**
   * If a 'componentsjs-generator-debug-state.json' file should be created with debug information.
   */
  debugState: boolean;
  /**
   * If a type-scoped context for each component is to be generated with parameter name aliases.
   */
  typeScopedContexts: boolean;
}
