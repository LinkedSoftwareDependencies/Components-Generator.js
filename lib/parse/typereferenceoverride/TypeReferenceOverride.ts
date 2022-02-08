import type { TSESTree } from '@typescript-eslint/typescript-estree';
import type { ParameterRangeUnresolved } from '../ParameterLoader';

/**
 * Overrides how types should be converted to parameter ranges.
 */
export interface TypeReferenceOverride {
  /**
   * Convert a type node.
   * Returns undefined if this handler is not applicable.
   * @param typeNode A type node.
   */
  handle: (typeNode: TSESTree.TSTypeReference) => ParameterRangeUnresolved | undefined;
}
