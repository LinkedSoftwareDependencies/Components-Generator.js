import { Generator } from '../../lib/generate/Generator';
import { normalizeFilePath } from '../../lib/util/PathUtil';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('Generator', () => {
  let resolutionContext: ResolutionContextMocked;
  let generator: Generator;

  beforeEach(() => {
    resolutionContext = new ResolutionContextMocked({});
    generator = new Generator({
      resolutionContext,
      pathDestinations: [
        {
          packageRootDirectory: 'pckg1',
          originalPath: 'orig',
          replacementPath: 'repl',
        },
        {
          packageRootDirectory: 'pckg2',
          originalPath: 'orig',
          replacementPath: 'repl',
        },
      ],
      fileExtension: 'jsonld',
      ignoreClasses: {},
      logLevel: 'info',
      debugState: false,
      prefixes: 'pre',
      hardErrorUnsupported: true,
    });
  });

  describe('generateComponents', () => {
    it('should run for valid packages', async() => {
      resolutionContext.contentsOverrides[normalizeFilePath('pckg1/package.json')] = `{
  "name": "@solid/community-server",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`;
      resolutionContext.contentsOverrides[normalizeFilePath('pckg1/index.d.ts')] = ``;
      resolutionContext.contentsOverrides[normalizeFilePath('pckg2/package.json')] = `{
  "name": "@solid/community-server2",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`;
      resolutionContext.contentsOverrides[normalizeFilePath('pckg2/index.d.ts')] = ``;
      await generator.generateComponents();
    });

    it('should run for only a single valid package', async() => {
      resolutionContext.contentsOverrides[normalizeFilePath('pckg1/package.json')] = `{
  "name": "@solid/community-server",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`;
      resolutionContext.contentsOverrides[normalizeFilePath('pckg1/index.d.ts')] = ``;
      await generator.generateComponents();
    });
  });
});
