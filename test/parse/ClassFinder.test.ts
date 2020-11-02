import * as Path from 'path';
import { ClassFinder } from '../../lib/parse/ClassFinder';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ClassFinder', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let parser: ClassFinder;

  beforeEach(() => {
    parser = new ClassFinder({ classLoader: new ClassLoader({ resolutionContext }) });
  });

  describe('getFileExports', () => {
    it('for a single named export', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export {B as Class} from './lib/B'`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {
            Class: {
              fileName: Path.normalize('lib/B'),
              localName: 'B',
            },
          },
          unnamed: [],
        });
    });

    it('for a single export all', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export * from './lib/B'`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {},
          unnamed: [
            Path.normalize('lib/B'),
          ],
        });
    });

    it('for an export of classes', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export class A{}
export type B = string;
`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {
            A: {
              fileName: 'file',
              localName: 'A',
            },
          },
          unnamed: [],
        });
    });

    it('for multiple mixed exports', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export {A as Class1} from './lib/A';
export {B as Class2} from './lib/B';
export {C as Class3} from './lib/C';
export * from './lib/D';
`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {
            Class1: {
              fileName: Path.normalize('lib/A'),
              localName: 'A',
            },
            Class2: {
              fileName: Path.normalize('lib/B'),
              localName: 'B',
            },
            Class3: {
              fileName: Path.normalize('lib/C'),
              localName: 'C',
            },
          },
          unnamed: [
            Path.normalize('lib/D'),
          ],
        });
    });

    it('for a default export should be ignored', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export default class {}`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });

    it('for an invalid class with no name', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export class {}`,
      };
      await expect(parser.getFileExports('file')).rejects
        .toThrow(new Error(`Export parsing failure: missing exported class name in file on line 1 column 7`));
    });

    it('for a single constant should be ignored', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export const foo = "a";`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });

    it('for a declared class with separate export', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
declare class A {}
export {A as B};
`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {
            B: {
              fileName: 'file',
              localName: 'A',
            },
          },
          unnamed: [],
        });
    });

    it('for a declared class with separate export in reverse order', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
export {A as B};
declare class A {}
`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {
            B: {
              fileName: 'file',
              localName: 'A',
            },
          },
          unnamed: [],
        });
    });

    it('for a separate export without a declared class', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `export {A as B};`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });

    it('for an imported class with separate export', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
import {X as A} from './lib/A';
export {A};
`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {
            A: {
              fileName: Path.normalize('lib/A'),
              localName: 'X',
            },
          },
          unnamed: [],
        });
    });

    it('the namespace import syntax should be ignored', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `import polygons = Shapes.Polygons`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });

    it('the default import syntax should be ignored', async() => {
      resolutionContext.contentsOverrides = {
        'file.d.ts': `
import A from './lib/A';
export {A};
`,
      };
      expect(await parser.getFileExports('file'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });
  });

  describe('getPackageExports', () => {
    it('for a single named export', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('package-simple-named/index.d.ts')]: `export {A as B} from './lib/A';`,
        [Path.normalize('package-simple-named/lib/A.d.ts')]: 'export class A {}',
      };
      expect(await parser.getPackageExports('package-simple-named/index'))
        .toEqual({
          B: {
            fileName: Path.normalize('package-simple-named/lib/A'),
            localName: 'A',
          },
        });
    });

    it('for a single unnamed export', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('package-simple-unnamed/index.d.ts')]: `export * from './lib/A';`,
        [Path.normalize('package-simple-unnamed/lib/A.d.ts')]: 'export class A {}',
      };
      expect(await parser.getPackageExports('package-simple-unnamed/index'))
        .toEqual({
          A: {
            fileName: Path.normalize('package-simple-unnamed/lib/A'),
            localName: 'A',
          },
        });
    });

    it('for a multiple exports', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('package-multiple/index.d.ts')]: `
export {A as B} from './lib/A';
export * from './lib/C';
`,
        [Path.normalize('package-multiple/lib/A.d.ts')]: 'export class A {}',
        [Path.normalize('package-multiple/lib/C.d.ts')]: 'export class C {}',
      };
      expect(await parser.getPackageExports('package-multiple/index'))
        .toEqual({
          B: {
            fileName: Path.normalize('package-multiple/lib/A'),
            localName: 'A',
          },
          C: {
            fileName: Path.normalize('package-multiple/lib/C'),
            localName: 'C',
          },
        });
    });

    it('for nested exports', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('package-nested/index.d.ts')]: `export * from './lib/A';`,
        [Path.normalize('package-nested/lib/A.d.ts')]: `
export * from './sub1/B'
export * from './sub2/C'
`,
        [Path.normalize('package-nested/lib/sub1/B.d.ts')]: 'export class B {}',
        [Path.normalize('package-nested/lib/sub2/C.d.ts')]: 'export class C {}',
      };
      expect(await parser.getPackageExports('package-nested/index'))
        .toEqual({
          B: {
            fileName: Path.normalize('package-nested/lib/sub1/B'),
            localName: 'B',
          },
          C: {
            fileName: Path.normalize('package-nested/lib/sub2/C'),
            localName: 'C',
          },
        });
    });
  });
});
