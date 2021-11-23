import * as Path from 'path';
import { Generator } from '../../lib/generate/Generator';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('Generator', () => {
  let resolutionContext: ResolutionContextMocked;
  let generator: Generator;

  beforeEach(() => {
    resolutionContext = new ResolutionContextMocked({});
    generator = new Generator({
      resolutionContext,
      pathDestination: {
        packageRootDirectory: 'root',
        originalPath: 'orig',
        replacementPath: 'repl',
      },
      fileExtension: 'jsonld',
      ignoreClasses: {},
      typeScopedContexts: true,
      logLevel: 'info',
      debugState: false,
      prefix: 'pre',
    });
  });

  describe('generateComponents', () => {
    it('should run', async() => {
      resolutionContext.contentsOverrides[Path.normalize('root/package.json')] = `{
  "name": "@solid/community-server",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`;
      resolutionContext.contentsOverrides[Path.normalize('root/index.d.ts')] = ``;
      await generator.generateComponents();
    });
  });
});
