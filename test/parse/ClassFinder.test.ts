import { ClassFinder } from '../../lib/parse/ClassFinder';
import { ClassLoader } from '../../lib/parse/ClassLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ClassFinder', () => {
  const resolutionContext = new ResolutionContextMocked({
    'export-single-named.d.ts': `export {B as Class} from './lib/B'`,
    'export-single-all.d.ts': `export * from './lib/B'`,
    'export-classes.d.ts': `
export class A{}
export type B = string;
`,
    'export-mixed.d.ts': `
export {A as Class1} from './lib/A';
export {B as Class2} from './lib/B';
export {C as Class3} from './lib/C';
export * from './lib/D';
`,
    'export-single-default.d.ts': `export default class {}`,
    'export-single-invalid-noname.d.ts': `export class {}`,
    'export-single-const.d.ts': `export const foo = "a";`,
    'export-single-declare.d.ts': `
declare class A {}
export {A as B};
`,
    'export-single-declare-reverse.d.ts': `
export {A as B};
declare class A {}
`,
    'export-single-nodeclare.d.ts': `export {A as B};`,
    'export-single-import.d.ts': `
import {X as A} from './lib/A';
export {A};
`,
    'import-namespace.d.ts': `import polygons = Shapes.Polygons`,
    'export-single-import-default.d.ts': `
import A from './lib/A';
export {A};
`,

    'package-simple-named/index.d.ts': `export {A as B} from './lib/A';`,
    'package-simple-named/lib/A.d.ts': 'export class A {}',

    'package-simple-unnamed/index.d.ts': `export * from './lib/A';`,
    'package-simple-unnamed/lib/A.d.ts': 'export class A {}',

    'package-multiple/index.d.ts': `
export {A as B} from './lib/A';
export * from './lib/C';
`,
    'package-multiple/lib/A.d.ts': 'export class A {}',
    'package-multiple/lib/C.d.ts': 'export class C {}',

    'package-nested/index.d.ts': `export * from './lib/A';`,
    'package-nested/lib/A.d.ts': `
export * from './sub1/B'
export * from './sub2/C'
`,
    'package-nested/lib/sub1/B.d.ts': 'export class B {}',
    'package-nested/lib/sub2/C.d.ts': 'export class C {}',

    'class-single.d.ts': `class A{}`,
    'class-extended.d.ts': `
class A extends B{
  constructor() {}
}`,
    'class-extended-namespace.d.ts': `
class A extends x.B{
  constructor() {}
}`,
    'class-extended-anonymous.d.ts': `
class A extends class {} {}`,
  });
  let parser: ClassFinder;

  beforeEach(() => {
    parser = new ClassFinder({ classLoader: new ClassLoader({ resolutionContext }) });
  });

  describe('getFileExports', () => {
    it('for a single named export', async() => {
      expect(await parser.getFileExports('export-single-named'))
        .toEqual({
          named: {
            Class: {
              fileName: 'lib/B',
              localName: 'B',
            },
          },
          unnamed: [],
        });
    });

    it('for a single export all', async() => {
      expect(await parser.getFileExports('export-single-all'))
        .toEqual({
          named: {},
          unnamed: [
            'lib/B',
          ],
        });
    });

    it('for an export of classes', async() => {
      expect(await parser.getFileExports('export-classes'))
        .toEqual({
          named: {
            A: {
              fileName: 'export-classes',
              localName: 'A',
            },
          },
          unnamed: [],
        });
    });

    it('for multiple mixed exports', async() => {
      expect(await parser.getFileExports('export-mixed'))
        .toEqual({
          named: {
            Class1: {
              fileName: 'lib/A',
              localName: 'A',
            },
            Class2: {
              fileName: 'lib/B',
              localName: 'B',
            },
            Class3: {
              fileName: 'lib/C',
              localName: 'C',
            },
          },
          unnamed: [
            'lib/D',
          ],
        });
    });

    it('for a default export should be ignored', async() => {
      expect(await parser.getFileExports('export-single-default'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });

    it('for an invalid class with no name', async() => {
      await expect(parser.getFileExports('export-single-invalid-noname')).rejects
        .toThrow(new Error(`Export parsing failure: missing exported class name in export-single-invalid-noname on line 1 column 7`));
    });

    it('for a single constant should be ignored', async() => {
      expect(await parser.getFileExports('export-single-const'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });

    it('for a declared class with separate export', async() => {
      expect(await parser.getFileExports('export-single-declare'))
        .toEqual({
          named: {
            B: {
              fileName: 'export-single-declare',
              localName: 'A',
            },
          },
          unnamed: [],
        });
    });

    it('for a declared class with separate export in reverse order', async() => {
      expect(await parser.getFileExports('export-single-declare-reverse'))
        .toEqual({
          named: {
            B: {
              fileName: 'export-single-declare-reverse',
              localName: 'A',
            },
          },
          unnamed: [],
        });
    });

    it('for a separate export without a declared class', async() => {
      expect(await parser.getFileExports('export-single-nodeclare'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });

    it('for an imported class with separate export', async() => {
      expect(await parser.getFileExports('export-single-import'))
        .toEqual({
          named: {
            A: {
              fileName: 'lib/A',
              localName: 'X',
            },
          },
          unnamed: [],
        });
    });

    it('the namespace import syntax should be ignored', async() => {
      expect(await parser.getFileExports('import-namespace'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });

    it('the default import syntax should be ignored', async() => {
      expect(await parser.getFileExports('export-single-import-default'))
        .toEqual({
          named: {},
          unnamed: [],
        });
    });
  });

  describe('getSuperClass', () => {
    it('should return undefined on a class that is not extended', async() => {
      expect(parser.getSuperClass(<any>(await resolutionContext
        .parseTypescriptFile('class-single')).body[0], 'file'))
        .toBeUndefined();
    });

    it('should return on a class that is extended', async() => {
      expect(parser.getSuperClass(<any>(await resolutionContext
        .parseTypescriptFile('class-extended')).body[0], 'file'))
        .toEqual({ className: 'B' });
    });

    it('should return on a class that is extended via a namespace', async() => {
      expect(parser.getSuperClass(<any>(await resolutionContext
        .parseTypescriptFile('class-extended-namespace')).body[0], 'file'))
        .toEqual({ className: 'B', nameSpace: 'x' });
    });

    it('should error on a class that is extended anonymously', async() => {
      await expect(async() => parser.getSuperClass(<any>(await resolutionContext
        .parseTypescriptFile('class-extended-anonymous')).body[0], 'file'))
        .rejects.toThrow(new Error('Could not interpret type of superclass in file on line 2 column 16'));
    });
  });

  describe('getPackageExports', () => {
    it('for a single named export', async() => {
      expect(await parser.getPackageExports('package-simple-named'))
        .toEqual({
          B: {
            fileName: 'package-simple-named/lib/A',
            localName: 'A',
          },
        });
    });

    it('for a single unnamed export', async() => {
      expect(await parser.getPackageExports('package-simple-unnamed'))
        .toEqual({
          A: {
            fileName: 'package-simple-unnamed/lib/A',
            localName: 'A',
          },
        });
    });

    it('for a multiple exports', async() => {
      expect(await parser.getPackageExports('package-multiple'))
        .toEqual({
          B: {
            fileName: 'package-multiple/lib/A',
            localName: 'A',
          },
          C: {
            fileName: 'package-multiple/lib/C',
            localName: 'C',
          },
        });
    });

    it('for nested exports', async() => {
      expect(await parser.getPackageExports('package-nested'))
        .toEqual({
          B: {
            fileName: 'package-nested/lib/sub1/B',
            localName: 'B',
          },
          C: {
            fileName: 'package-nested/lib/sub2/C',
            localName: 'C',
          },
        });
    });
  });
});
