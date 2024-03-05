import * as fs from 'node:fs';
import { ResolutionContext } from '../../lib/resolution/ResolutionContext';
import { joinFilePath, normalizeFilePath } from '../../lib/util/PathUtil';

describe('ResolutionContext', () => {
  let resolutionContext: ResolutionContext;

  beforeEach(() => {
    resolutionContext = new ResolutionContext();
  });

  describe('getFileContent', () => {
    it('Should read file contents', async() => {
      await expect(resolutionContext.getFileContent(`${__dirname}/../data/file.d.ts`)).resolves
        .toBe(`export class MyClass {}\n`);
    });

    it('Should error on a non-existing file', async() => {
      await expect(resolutionContext.getFileContent(`${__dirname}/../data/file-not-exist.d.ts`))
        .rejects.toThrow('no such file or directory');
    });
  });

  describe('writeFileContent', () => {
    it('Should write file contents in an existing directory', async() => {
      const path = `${__dirname}/../data/file-new.json`;
      await resolutionContext.writeFileContent(path, `{}`);
      await expect(resolutionContext.getFileContent(path)).resolves.toBe(`{}`);

      // Remove created file again
      fs.unlinkSync(path);
    });

    it('Should write file contents in a non-existing directory', async() => {
      const path = `${__dirname}/../data/a/b/c/file-new.json`;
      await resolutionContext.writeFileContent(path, `{}`);
      await expect(resolutionContext.getFileContent(path)).resolves.toBe(`{}`);

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
      await expect(resolutionContext.getTypeScriptFileContent(`${__dirname}/../data/file`)).resolves
        .toBe(`export class MyClass {}\n`);
    });
  });

  describe('parseTypescriptFile', () => {
    it('Should parse a valid class definition', async() => {
      await expect(resolutionContext.parseTypescriptFile(`${__dirname}/../data/file`)).resolves
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
      await expect(resolutionContext.parseTypescriptFile(`${__dirname}/../data/file-invalid`))
        .rejects.toThrow('Could not parse file');
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
      expect(resolutionContext.resolvePackageIndex('asynciterator', joinFilePath(__dirname, '../../')))
        .toEqual(joinFilePath(__dirname, '../../node_modules/asynciterator/dist/asynciterator.d.ts'));
    });

    it('Should resolve from the currentFilePath for a package with separate typings', async() => {
      expect(resolutionContext.resolvePackageIndex('lru-cache', joinFilePath(__dirname, '../../')))
        .toEqual(joinFilePath(__dirname, '../../node_modules/@types/lru-cache/index.d.ts'));
    });

    it('Should resolve from the currentFilePath for a package without separate typings without extension', async() => {
      expect(resolutionContext.resolvePackageIndex('@comunica/bus-rdf-parse', joinFilePath(__dirname, '../../')))
        .toEqual(joinFilePath(__dirname, '../../node_modules/@comunica/bus-rdf-parse/lib/index.d.ts'));
    });

    it('Should resolve from the currentFilePath for a built-in package', async() => {
      expect(resolutionContext.resolvePackageIndex('stream', joinFilePath(__dirname, '../../')))
        .toEqual(joinFilePath(__dirname, '../../node_modules/@types/node/stream.d.ts'));
    });
  });

  describe('resolvePackageIndexInner', () => {
    it('Should handle package.json with types field', async() => {
      const req: any = () => ({
        types: 'abc.d.ts',
      });
      req.resolve = () => '/root/a/';
      expect(resolutionContext.resolvePackageIndexInner(req, 'asynciterator', ''))
        .toEqual(normalizeFilePath('/root/abc.d.ts'));
    });

    it('Should handle package.json with typings field', async() => {
      const req: any = () => ({
        typings: 'abc.d.ts',
      });
      req.resolve = () => '/root/a/';
      expect(resolutionContext.resolvePackageIndexInner(req, 'asynciterator', ''))
        .toEqual(normalizeFilePath('/root/abc.d.ts'));
    });

    it('Should handle package.json with implicit types field', async() => {
      const req: any = () => ({
        main: 'abc.js',
      });
      req.resolve = () => '/root/a/';
      expect(resolutionContext.resolvePackageIndexInner(req, 'asynciterator', ''))
        .toEqual(normalizeFilePath('/root/abc.d.ts'));
    });

    it('Should handle package.json with types field without extension', async() => {
      const req: any = () => ({
        types: 'abc',
      });
      req.resolve = () => '/root/a/';
      expect(resolutionContext.resolvePackageIndexInner(req, 'asynciterator', ''))
        .toEqual(normalizeFilePath('/root/abc.d.ts'));
    });
  });

  describe('resolveTypesPath', () => {
    it('Should resolve a types path of a directory', async() => {
      await expect(resolutionContext.resolveTypesPath(`${__dirname}/../data/directory`)).resolves
        .toEqual(normalizeFilePath(`${__dirname}/../data/directory/index`));
    });

    it('Should resolve a types path of a file', async() => {
      await expect(resolutionContext.resolveTypesPath(`${__dirname}/../data/file`)).resolves
        .toBe(`${__dirname}/../data/file`);
    });
  });
});
