import * as fs from 'fs';
import * as Path from 'path';
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

  describe('writeFileContent', () => {
    it('Should write file contents in an existing directory', async() => {
      const path = `${__dirname}/../data/file-new.json`;
      await resolutionContext.writeFileContent(path, `{}`);
      expect(await resolutionContext.getFileContent(path)).toEqual(`{}`);

      // Remove created file again
      fs.unlinkSync(path);
    });

    it('Should write file contents in a non-existing directory', async() => {
      const path = `${__dirname}/../data/a/b/c/file-new.json`;
      await resolutionContext.writeFileContent(path, `{}`);
      expect(await resolutionContext.getFileContent(path)).toEqual(`{}`);

      // Remove created file and folders again
      fs.unlinkSync(path);
      fs.rmdirSync(`${__dirname}/../data/a/b/c`);
      fs.rmdirSync(`${__dirname}/../data/a/b`);
      fs.rmdirSync(`${__dirname}/../data/a`);
    });

    it('Should error when directory making failed', async() => {
      jest.spyOn(fs, 'mkdir')
        .mockImplementationOnce(<any> ((p: any, options: any, cb: any) => cb(new Error('FAIL'))));
      await expect(resolutionContext.writeFileContent(`${__dirname}/../data/a/file-new.json`, `{}`))
        .rejects.toThrow(new Error('FAIL'));
    });

    it('Should error when file making failed', async() => {
      jest.spyOn(fs, 'writeFile')
        .mockImplementationOnce(<any> ((p: any, content: any, options: any, cb: any) => cb(new Error('FAIL'))));
      await expect(resolutionContext.writeFileContent(`${__dirname}/../data/file-new.json`, `{}`))
        .rejects.toThrow(new Error('FAIL'));
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

    it('Should cache the same file', async() => {
      const parsedFile1 = await resolutionContext.parseTypescriptFile(`${__dirname}/../data/file`);
      const parsedFileB1 = await resolutionContext.parseTypescriptFile(`${__dirname}/../data/fileb`);
      const parsedFile2 = await resolutionContext.parseTypescriptFile(`${__dirname}/../data/file`);
      const parsedFileB2 = await resolutionContext.parseTypescriptFile(`${__dirname}/../data/fileb`);
      expect(parsedFile1).toBe(parsedFile2);
      expect(parsedFileB1).toBe(parsedFileB2);
      expect(parsedFile1).not.toBe(parsedFileB1);
    });
  });

  describe('resolvePackageIndex', () => {
    it('Should resolve from the currentFilePath for a package without separate typings', async() => {
      expect(resolutionContext.resolvePackageIndex('asynciterator', Path.join(__dirname, '../../')))
        .toEqual(Path.join(__dirname, '../../node_modules/asynciterator/dist/asynciterator.cjs'));
    });

    it('Should resolve from the currentFilePath for a package with separate typings', async() => {
      expect(resolutionContext.resolvePackageIndex('lru-cache', Path.join(__dirname, '../../')))
        .toEqual(Path.join(__dirname, '../../node_modules/@types/lru-cache/index'));
    });
  });
});
