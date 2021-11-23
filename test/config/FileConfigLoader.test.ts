import { FileConfigLoader } from '../../lib/config/FileConfigLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('FileConfigLoader', () => {
  let resolutionContext: ResolutionContextMocked;
  let loader: FileConfigLoader;

  beforeEach(() => {
    resolutionContext = new ResolutionContextMocked({});
    loader = new FileConfigLoader({ resolutionContext });
  });

  describe('getClosestConfigFile', () => {
    it('should be undefined when no config file exists', async() => {
      expect(await loader.getClosestConfigFile('/a/b/c')).toBeUndefined();
    });

    it('should be defined when a config file exists', async() => {
      resolutionContext.contentsOverrides['/a/b/c/.componentsjs-generator-config.json'] = '{ "a": true }';
      expect(await loader.getClosestConfigFile('/a/b/c/')).toEqual({ a: true });
    });

    it('should be defined when a config file exists in parent directory', async() => {
      resolutionContext.contentsOverrides['/a/b/.componentsjs-generator-config.json'] = '{ "a": true }';
      expect(await loader.getClosestConfigFile('/a/b/c/')).toEqual({ a: true });
    });

    it('should be defined when multiple config files exists directory chain', async() => {
      resolutionContext.contentsOverrides['/a/b/c/.componentsjs-generator-config.json'] = '{ "a": true }';
      resolutionContext.contentsOverrides['/a/b/.componentsjs-generator-config.json'] = '{ "b": true }';
      expect(await loader.getClosestConfigFile('/a/b/c/')).toEqual({ a: true });
    });
  });

  describe('getConsideredDirectories', () => {
    it('should return all parent directories', () => {
      expect(loader.getConsideredDirectories([ '', 'a', 'b', 'c', 'd' ].join('/'))).toEqual([
        [ '', 'a', 'b', 'c', 'd' ].join('/'),
        [ '', 'a', 'b', 'c' ].join('/'),
        [ '', 'a', 'b' ].join('/'),
        [ '', 'a' ].join('/'),
      ]);
    });
  });
});
