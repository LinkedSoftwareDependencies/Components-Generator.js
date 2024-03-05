import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ParameterRangeUnresolved } from '../ParameterLoader';
import type { TypeReferenceOverride } from './TypeReferenceOverride';

/**
 * Converts type aliases of the form `Record<K, V>` into `{[k: K]: V}`.
 */
export class TypeReferenceOverrideAliasRecord implements TypeReferenceOverride {
  public handle(typeNode: TSESTree.TSTypeReference): ParameterRangeUnresolved | undefined {
    if (typeNode.typeName.type === AST_NODE_TYPES.Identifier &&
      typeNode.typeName.name === 'Record' &&
      typeNode.typeArguments &&
      typeNode.typeArguments.params.length === 2) {
      const loc: TSESTree.SourceLocation = { start: { line: 0, column: 0 }, end: { line: 0, column: 7 }};
      const range: TSESTree.Range = [ 0, 0 ];
      const typeLiteral: TSESTree.TSTypeLiteral = <any> {
        type: AST_NODE_TYPES.TSTypeLiteral,
        members: [
          {
            type: AST_NODE_TYPES.TSIndexSignature,
            parameters: [
              {
                type: AST_NODE_TYPES.Identifier,
                name: 'key',
                typeAnnotation: {
                  type: AST_NODE_TYPES.TSTypeAnnotation,
                  typeAnnotation: typeNode.typeArguments.params[0],
                  loc,
                  range,
                },
                loc,
                range,
              },
            ],
            typeAnnotation: {
              type: AST_NODE_TYPES.TSTypeAnnotation,
              typeAnnotation: typeNode.typeArguments.params[1],
              loc,
              range,
            },
            loc,
            range,
          },
        ],
        loc,
        range,
      };
      return { type: 'hash', value: typeLiteral };
    }
  }
}
