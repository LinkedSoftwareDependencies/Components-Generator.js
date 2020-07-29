import { ResolutionContext } from '../../lib/resolution/ResolutionContext';

describe('ResolutionContext', () => {
  let resolutionContext: ResolutionContext;

  beforeEach(() => {
    resolutionContext = new ResolutionContext();
  });

  describe('getFileContent', () => {
    it('Should read file contents', async() => {
      expect(await resolutionContext.getFileContent(`${__dirname}/../data/file.d.ts`))
        .toEqual(`export class MyClass {}\n`);
    });

    it('Should error on a non-existing file', async() => {
      await expect(resolutionContext.getFileContent(`${__dirname}/../data/file-not-exist.d.ts`)).rejects.toThrow();
    });
  });

  describe('getTypeScriptFileContent', () => {
    it('Should read file contents', async() => {
      expect(await resolutionContext.getTypeScriptFileContent(`${__dirname}/../data/file`))
        .toEqual(`export class MyClass {}\n`);
    });
  });

  describe('parseTypescriptFile', () => {
    it('Should parse a valid class definition', async() => {
      expect(await resolutionContext.parseTypescriptFile(`${__dirname}/../data/file`))
        .toMatchObject({
          body: [
            {
              declaration: {
                body: {
                  body: [],
                  type: 'ClassBody',
                },
                id: {
                  name: 'MyClass',
                  type: 'Identifier',
                },
                superClass: null,
                type: 'ClassDeclaration',
              },
              source: null,
              specifiers: [],
              type: 'ExportNamedDeclaration',
            },
          ],
          comments: [],
          sourceType: 'module',
          type: 'Program',
        });
    });

    it('Should error on an invalid typescript file', async() => {
      await expect(resolutionContext.parseTypescriptFile(`${__dirname}/../data/file-invalid`)).rejects
        .toThrow();
    });
  });
});
