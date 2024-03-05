import { GeneratorFactory } from '../../lib/config/GeneratorFactory';
import { Generator } from '../../lib/generate/Generator';
import { normalizeFilePath } from '../../lib/util/PathUtil';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('GeneratorFactory', () => {
  let resolutionContext: ResolutionContextMocked;
  let factory: GeneratorFactory;

  beforeEach(() => {
    resolutionContext = new ResolutionContextMocked({});
    factory = new GeneratorFactory({ resolutionContext });
  });

  describe('createGenerator', () => {
    it('should create a new generator without custom options', async() => {
      await expect(factory.createGenerator(
        normalizeFilePath('/root'),
        {},
        [ normalizeFilePath('/root') ],
      )).resolves.toBeInstanceOf(Generator);
    });

    it('should create a new generator with custom options', async() => {
      resolutionContext.contentsOverrides[normalizeFilePath('/root/.componentsjs-generator-config.json')] = `{ "source": "FILESRC/", "extension": "FILEEXT", "debugState": true }`;
      resolutionContext.contentsOverrides[normalizeFilePath('/root/.componentsignore')] = '[ "a", "b" ]';
      await expect(factory.createGenerator('/root', {
        c: 'COMPONENTS/',
        e: 'EXT',
        r: 'PRE',
        i: normalizeFilePath('/root/.componentsignore'),
      }, [ normalizeFilePath('/root') ])).resolves.toBeInstanceOf(Generator);
    });

    it('should create a new generator when ignoring certain packages', async() => {
      resolutionContext.contentsOverrides[normalizeFilePath('/root/.componentsjs-generator-config.json')] = `{ "ignorePackagePaths": [ "ignored1/", "ignored2/" ] }`;
      await expect(factory.createGenerator(normalizeFilePath('/root'), {
        c: 'COMPONENTS/',
        e: 'EXT',
        r: 'PRE',
      }, [ normalizeFilePath('/root'), normalizeFilePath('/ignored1'), normalizeFilePath('/ignored2') ])).resolves
        .toBeInstanceOf(Generator);
    });
  });

  describe('getConfig', () => {
    it('should handle no cli args and no config file', async() => {
      await expect(factory.getConfig('root', {})).resolves.toEqual({
        source: 'lib',
        destination: 'components',
        extension: 'jsonld',
        ignorePackagePaths: [],
        ignoreComponents: [],
        logLevel: 'info',
        modulePrefix: undefined,
        debugState: false,
        hardErrorUnsupported: true,
      });
    });

    it('should handle no cli args and config file', async() => {
      resolutionContext.contentsOverrides[normalizeFilePath('/root/.componentsjs-generator-config.json')] = `{ "source": "FILESRC/", "extension": "FILEEXT", "debugState": true }`;
      await expect(factory.getConfig(normalizeFilePath('/root'), {})).resolves.toEqual({
        source: 'FILESRC/',
        destination: 'components',
        extension: 'FILEEXT',
        ignorePackagePaths: [],
        ignoreComponents: [],
        logLevel: 'info',
        modulePrefix: undefined,
        debugState: true,
        hardErrorUnsupported: true,
      });
    });

    it('should handle cli args and no config file', async() => {
      await expect(factory.getConfig('root', {
        s: 'SOURCE/',
        c: 'COMPONENTS/',
        e: 'EXT',
        r: 'PRE',
      })).resolves.toEqual({
        source: 'SOURCE/',
        destination: 'COMPONENTS/',
        extension: 'EXT',
        ignorePackagePaths: [],
        ignoreComponents: [],
        logLevel: 'info',
        modulePrefix: 'PRE',
        debugState: false,
        hardErrorUnsupported: true,
      });
    });

    it('should handle cli args and config file', async() => {
      resolutionContext.contentsOverrides[normalizeFilePath('/root/.componentsjs-generator-config.json')] = `{ "source": "FILESRC/", "extension": "FILEEXT", "debugState": true }`;
      await expect(factory.getConfig(normalizeFilePath('/root'), {
        c: 'COMPONENTS/',
        e: 'EXT',
        r: 'PRE',
      })).resolves.toEqual({
        source: 'FILESRC/',
        destination: 'COMPONENTS/',
        extension: 'EXT',
        ignorePackagePaths: [],
        ignoreComponents: [],
        logLevel: 'info',
        modulePrefix: 'PRE',
        debugState: true,
        hardErrorUnsupported: true,
      });
    });
  });

  describe('getDefaultConfig', () => {
    it('should return the default config', () => {
      expect(factory.getDefaultConfig()).toEqual({
        source: 'lib',
        destination: 'components',
        extension: 'jsonld',
        ignorePackagePaths: [],
        ignoreComponents: [],
        logLevel: 'info',
        modulePrefix: undefined,
        debugState: false,
        hardErrorUnsupported: true,
      });
    });
  });

  describe('getCliConfig', () => {
    it('should handle empty CLI args', async() => {
      await expect(factory.getCliConfig({})).resolves.toEqual({});
    });

    it('should handle complete CLI args', async() => {
      resolutionContext.contentsOverrides['.componentsignore'] = '[ "a", "b" ]';
      await expect(factory.getCliConfig({
        s: 'lib/',
        c: 'components/',
        e: 'jsonld',
        i: '.componentsignore',
        l: 'info',
        r: 'pre',
        debugState: true,
        lenient: true,
      })).resolves.toEqual({
        source: 'lib/',
        destination: 'components/',
        extension: 'jsonld',
        ignoreComponents: [ 'a', 'b' ],
        logLevel: 'info',
        modulePrefix: 'pre',
        debugState: true,
        hardErrorUnsupported: false,
      });
    });
  });
});
