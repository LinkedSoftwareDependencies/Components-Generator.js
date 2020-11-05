import * as Path from 'path';
import { PackageMetadataLoader } from '../../lib/parse/PackageMetadataLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('PackageMetadataLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let loader: PackageMetadataLoader;

  beforeEach(() => {
    loader = new PackageMetadataLoader({ resolutionContext });
  });

  describe('load', () => {
    it('should error on a non-existing package.json', async() => {
      resolutionContext.contentsOverrides = {};
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Could not find mocked path for ${Path.normalize('/package.json')}`));
    });

    it('should return with all required entries', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "version": "1.2.3",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:components": "components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  },
  "lsd:importPaths": {
    "https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/": "components/",
    "https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/": "config/"
  },
  "types": "./index.d.ts"
}`,
      };
      expect(await loader.load('/')).toEqual({
        componentsPath: Path.normalize('/components/components.jsonld'),
        contexts: {
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld':
            'components/context.jsonld',
        },
        importPaths: {
          'https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/': 'components/',
          'https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/': 'config/',
        },
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server',
        name: '@solid/community-server',
        version: '1.2.3',
        typesPath: Path.normalize('/index'),
      });
    });

    it('should return with all required entries, but using typings', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "version": "1.2.3",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:components": "components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  },
  "lsd:importPaths": {
    "https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/": "components/",
    "https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/": "config/"
  },
  "typings": "./index.d.ts"
}`,
      };
      expect(await loader.load('/')).toEqual({
        componentsPath: Path.normalize('/components/components.jsonld'),
        contexts: {
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld':
            'components/context.jsonld',
        },
        importPaths: {
          'https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/': 'components/',
          'https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/': 'config/',
        },
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server',
        name: '@solid/community-server',
        version: '1.2.3',
        typesPath: Path.normalize('/index'),
      });
    });

    it('should return with all required entries, but using typings without extension', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "version": "1.2.3",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:components": "components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  },
  "lsd:importPaths": {
    "https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/": "components/",
    "https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/": "config/"
  },
  "typings": "./index"
}`,
      };
      expect(await loader.load('/')).toEqual({
        componentsPath: Path.normalize('/components/components.jsonld'),
        contexts: {
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld':
            'components/context.jsonld',
        },
        importPaths: {
          'https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/': 'components/',
          'https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/': 'config/',
        },
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server',
        name: '@solid/community-server',
        version: '1.2.3',
        typesPath: Path.normalize('/index'),
      });
    });

    it('should error on invalid JSON', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Syntax error in ${Path.normalize('/package.json')}: Unexpected end of JSON input`));
    });

    it('should error when lsd:module is missing', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "lsd:components": "components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  }
}`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Missing 'lsd:module' IRI in ${Path.normalize('/package.json')}`));
    });

    it('should error when lsd:components is missing', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  }
}`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Missing 'lsd:components' in ${Path.normalize('/package.json')}`));
    });

    it('should error when lsd:contexts is missing', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:components": "components/components.jsonld"
}`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Missing 'lsd:contexts' in ${Path.normalize('/package.json')}`));
    });

    it('should error when lsd:importPaths is missing', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:components": "components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  }
}`,
        '/components/context.jsonld': `{
  "a": "b"
}`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Missing 'lsd:importPaths' in ${Path.normalize('/package.json')}`));
    });

    it('should error when types and typings is missing', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:components": "components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  },
  "lsd:importPaths": {
    "https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/": "components/",
    "https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/": "config/"
  }
}`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Missing 'types' or 'typings' in ${Path.normalize('/package.json')}`));
    });
  });
});
