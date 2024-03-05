import { ClassFinder } from '../../lib/parse/ClassFinder';
import type { ClassReferenceLoadedClassOrInterface } from '../../lib/parse/ClassIndex';
import { ClassIndexer } from '../../lib/parse/ClassIndexer';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { CommentLoader } from '../../lib/parse/CommentLoader';
import { MemberLoader } from '../../lib/parse/MemberLoader';
import { ParameterLoader } from '../../lib/parse/ParameterLoader';
import { normalizeFilePath } from '../../lib/util/PathUtil';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('MemberLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let logger: any;
  let commentLoader: CommentLoader;
  let parser: MemberLoader;
  let classLoader: ClassLoader;
  let classIndexer: ClassIndexer;

  beforeEach(() => {
    commentLoader = new CommentLoader();
    parser = new MemberLoader({
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

  describe('getMembers', () => {
    it('should return for a single class without members', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{}`,
      };
      const A = await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getMembers({
        A,
      })).toEqual({
        A: {
          members: [],
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
      expect(parser.getMembers({
        A,
      })).toEqual({});
    });

    it('should return for a single class with members', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class A{
  fieldA: string;
  fieldB: number;
}`,
      };
      const A = await classIndexer.loadClassChain({
        packageName: 'p',
        localName: 'A',
        fileName: 'file',
        fileNameReferenced: 'fileReferenced',
      });
      expect(parser.getMembers({
        A,
      })).toEqual({
        A: {
          members: [
            {
              name: 'fieldA',
              range: {
                type: 'raw',
                value: 'string',
              },
            },
            {
              name: 'fieldB',
              range: {
                type: 'raw',
                value: 'number',
              },
            },
          ],
          classLoaded: A,
        },
      });
    });
  });

  describe('collectClassFields', () => {
    const fileName = normalizeFilePath('dir/file');

    function getClassBody(contents: string): ClassReferenceLoadedClassOrInterface {
      const body = classLoader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`declare class A{${contents}}`)).declaredClasses.A.body;
      return <any> {
        generics: {},
        declaration: { body },
      };
    }

    function getInterfaceBody(contents: string): ClassReferenceLoadedClassOrInterface {
      const body = classLoader.getClassElements('package', fileName, resolutionContext.parseTypescriptContents(`declare interface A{${contents}}`)).declaredInterfaces.A.body;
      return <any> {
        generics: {},
        declaration: { body },
      };
    }

    describe('for classes', () => {
      it('for an empty class', async() => {
        expect(parser.collectClassFields(getClassBody(``))).toEqual([]);
      });

      it('for simple fields', async() => {
        expect(parser.collectClassFields(getClassBody(`
fieldA: string;
fieldB: MyClass;
`))).toMatchObject([
          {
            name: 'fieldA',
            range: {
              type: 'raw',
              value: 'string',
            },
          },
          {
            name: 'fieldB',
            range: {
              type: 'interface',
              value: 'MyClass',
            },
          },
        ]);
      });

      it('for computed fields', async() => {
        expect(parser.collectClassFields(getClassBody(`
[A.fieldA]: string;
fieldB: MyClass;
`))).toMatchObject([
          {
            name: 'fieldB',
            range: {
              type: 'interface',
              value: 'MyClass',
            },
          },
        ]);
      });

      it('for simple methods', async() => {
        expect(parser.collectClassFields(getClassBody(`
public functionA(): string{}
private functionB(): string{}
`))).toMatchObject([
          {
            name: 'functionA',
          },
          {
            name: 'functionB',
          },
        ]);
      });

      it('for simple fields without type annotation', async() => {
        expect(parser.collectClassFields(getClassBody(`
fieldA;
fieldB;
`))).toMatchObject([
          {
            name: 'fieldA',
          },
          {
            name: 'fieldB',
          },
        ]);
      });
    });

    describe('for interfaces', () => {
      it('for an empty interface', async() => {
        expect(parser.collectClassFields(getInterfaceBody(``))).toEqual([]);
      });

      it('for simple fields', async() => {
        expect(parser.collectClassFields(getInterfaceBody(`
fieldA: string;
fieldB: MyClass;
`))).toMatchObject([
          {
            name: 'fieldA',
          },
          {
            name: 'fieldB',
          },
        ]);
      });
    });
  });
});
