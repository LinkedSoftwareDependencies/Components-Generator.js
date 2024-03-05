import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import {
  TypeReferenceOverrideAliasRecord,
} from '../../../lib/parse/typereferenceoverride/TypeReferenceOverrideAliasRecord';

describe('TypeReferenceOverrideAliasRecord', () => {
  const handler: TypeReferenceOverrideAliasRecord = new TypeReferenceOverrideAliasRecord();

  describe('handle', () => {
    it('should ignore non-identifiers', () => {
      const typeNode: any = {
        typeName: {
          type: 'unknown',
        },
      };
      expect(handler.handle(typeNode)).toBeUndefined();
    });

    it('should ignore non-Record', () => {
      const typeNode: any = {
        typeName: {
          type: AST_NODE_TYPES.Identifier,
          name: 'NonRecord',
        },
      };
      expect(handler.handle(typeNode)).toBeUndefined();
    });

    it('should ignore Record without typeParameters', () => {
      const typeNode: any = {
        typeName: {
          type: AST_NODE_TYPES.Identifier,
          name: 'Record',
        },
      };
      expect(handler.handle(typeNode)).toBeUndefined();
    });

    it('should ignore Record with typeParameters of wrong length', () => {
      const typeNode: any = {
        typeName: {
          type: AST_NODE_TYPES.Identifier,
          name: 'Record',
        },
        typeParameters: {
          params: [],
        },
      };
      expect(handler.handle(typeNode)).toBeUndefined();
    });

    it('should handle Record with typeParameters of length 2', () => {
      const typeNode: any = {
        typeName: {
          type: AST_NODE_TYPES.Identifier,
          name: 'Record',
        },
        typeArguments: {
          params: [
            'TYPE0',
            'TYPE1',
          ],
        },
      };
      expect(handler.handle(typeNode)).toMatchObject({
        type: 'hash',
        value: {
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
                    typeAnnotation: 'TYPE0',
                  },
                },
              ],
              typeAnnotation: {
                type: AST_NODE_TYPES.TSTypeAnnotation,
                typeAnnotation: 'TYPE1',
              },
            },
          ],
        },
      });
    });
  });
});
