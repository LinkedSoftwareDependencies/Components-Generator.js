import { Range, SourceLocation, TSTypeLiteral, TSTypeReference } from '@typescript-eslint/types/dist/ts-estree';
import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import { ParameterRangeUnresolved } from '../ParameterLoader';
import { TypeReferenceOverride } from './TypeReferenceOverride';

/**
 * Converts type aliases of the form `Record<K, V>` into `{[k: K]: V}`.
 */
export class TypeReferenceOverrideAliasRecord implements TypeReferenceOverride {
  public handle(typeNode: TSTypeReference): ParameterRangeUnresolved | undefined {
    if (typeNode.typeName.type === AST_NODE_TYPES.Identifier &&
      typeNode.typeName.name === 'Record' &&
      typeNode.typeParameters &&
      typeNode.typeParameters.params.length === 2) {
      const loc: SourceLocation = { start: { line: 0, column: 0 }, end: { line: 0, column: 7 }};
      const range: Range = [ 0, 0 ];
      const typeLiteral: TSTypeLiteral = {
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
                  typeAnnotation: typeNode.typeParameters.params[0],
                  loc,
                  range,
                },
                loc,
                range,
              },
            ],
            typeAnnotation: {
              type: AST_NODE_TYPES.TSTypeAnnotation,
              typeAnnotation: typeNode.typeParameters.params[1],
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
