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
   * May also be a mapping from package name to prefix.
   */
  modulePrefix: string | undefined | Record<string, string>;
  /**
   * If a 'componentsjs-generator-debug-state.json' file should be created with debug information.
   */
  debugState: boolean;
  /**
   * If a type-scoped context for each component is to be generated with parameter name aliases.
   */
  typeScopedContexts: boolean;
}
