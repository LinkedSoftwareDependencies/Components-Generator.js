import { ClassFinder } from '../../lib/parse/ClassFinder';

import { ClassIndexer } from '../../lib/parse/ClassIndexer';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { GenericsLoader } from '../../lib/parse/GenericsLoader';
import { ParameterLoader } from '../../lib/parse/ParameterLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('GenericsLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let logger: any;
  let commentLoader: CommentLoader;
  let parser: GenericsLoader;
  let classLoader: ClassLoader;
  let classIndexer: ClassIndexer;

  beforeEach(() => {
    commentLoader = new CommentLoader();
    parser = new GenericsLoader({
      parameterLoader: new ParameterLoader({ commentLoader, hardErrorUnsupported: true, logger }),
    });
    logger = {
      debug: jest.fn(),
    };
    classLoader = new ClassLoader({ resolutionContext, logger, commentLoader });
    classIndexer = new ClassIndexer({
      classLoader,
      classFinder: new ClassFinder({ classLoader }),
      ignoreClasses: {},
      logger,
    });
  });

  describe('getGenerics', () => {
    it('should return for a single class without generics', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{}`,
      };
      const A = await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getGenerics({
        A,
      })).toEqual({
        A: {
          genericTypeParameters: [],
          classLoaded: A,
        },
      });
    });

    it('should ignore an enum', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export enum A{}`,
      };
      const A = await classLoader
        .loadClassDeclaration({
          packageName: 'p',
          localName: 'A',
          fileName: 'file',
          fileNameReferenced: 'fileReferenced',
        }, true, true);
      expect(parser.getGenerics({
        A,
      })).toEqual({ });
    });

    it('should return for a single class with generic types', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A<A, B extends number, C extends Class<B, string>>{
  constructor(){}
}`,
      };
      const A = await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getGenerics({
        A,
      })).toEqual({
        A: {
          genericTypeParameters: [
            {
              name: 'A',
            },
            {
              name: 'B',
              range: {
                type: 'raw',
                value: 'number',
              },
            },
            {
              name: 'C',
              range: {
                type: 'interface',
                value: 'Class',
                genericTypeParameterInstantiations: [
                  {
                    type: 'genericTypeReference',
                    value: 'B',
                  },
                  {
                    type: 'raw',
                    value: 'string',
                  },
                ],
                origin: expect.anything(),
              },
            },
          ],
          classLoaded: A,
        },
      });
    });
  });
});
