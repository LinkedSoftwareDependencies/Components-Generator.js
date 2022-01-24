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
   * Paths to packages that should be excluded from generation.
   * This can be used in monorepos where not all packages require component generation.
   */
  ignorePackagePaths: string[];
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
   * If unsupported language features should cause a hard crash.
   * Otherwise they are emitted as warning instead of error.
   */
  hardErrorUnsupported: boolean;
}
