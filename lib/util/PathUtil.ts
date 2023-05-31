import * as Path from 'path';

/**
 * Changes a potential Windows path into a POSIX path.
 *
 * @param path - Path to check (POSIX or Windows).
 *
 * @returns The potentially changed path (POSIX).
 */
function windowsToPosixPath(path: string): string {
  return path.replace(/\\+/gu, '/');
}

/**
 * Resolves relative segments in the path.
 *
 * @param path - Path to check (POSIX or Windows).
 *
 * @returns The potentially changed path (POSIX).
 */
export function normalizeFilePath(path: string): string {
  return Path.posix.normalize(windowsToPosixPath(path));
}

/**
 * Adds the paths to the base path.
 *
 * @param basePath - The base path (POSIX or Windows).
 * @param paths - Subpaths to attach (POSIX).
 *
 * @returns The potentially changed path (POSIX).
 */
export function joinFilePath(basePath: string, ...paths: string[]): string {
  return Path.posix.join(windowsToPosixPath(basePath), ...paths);
}

/**
 * Returns the directory name of a path.
 *
 * @param path - Path to find directory of.
 *
 * @returns The directory path.
 */
export function filePathDirName(path: string): string {
  return Path.posix.dirname(windowsToPosixPath(path));
}
