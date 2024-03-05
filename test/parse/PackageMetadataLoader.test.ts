import { PackageMetadataLoader } from '../../lib/parse/PackageMetadataLoader';
import { normalizeFilePath } from '../../lib/util/PathUtil';
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
        .toThrow(new Error(`Could not find mocked path for ${normalizeFilePath('/package.json')}`));
    });

    it('should return with all required entries', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
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
      await expect(loader.load('/')).resolves.toEqual({
        componentsPath: normalizeFilePath('/components/components.jsonld'),
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
        typesPath: normalizeFilePath('/index'),
      });
    });

    it('should return with all required entries, but using typings', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
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
      await expect(loader.load('/')).resolves.toEqual({
        componentsPath: normalizeFilePath('/components/components.jsonld'),
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
        typesPath: normalizeFilePath('/index'),
      });
    });

    it('should return with all required entries, but using typings without extension', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
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
      await expect(loader.load('/')).resolves.toEqual({
        componentsPath: normalizeFilePath('/components/components.jsonld'),
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
        typesPath: normalizeFilePath('/index'),
      });
    });

    it('should return with all required entries with lsd:module true', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
  "name": "@solid/community-server",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`,
      };
      await expect(loader.load('/')).resolves.toEqual({
        componentsPath: normalizeFilePath('/components/components.jsonld'),
        contexts: {
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld':
            'components/context.jsonld',
        },
        importPaths: {
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/':
            'components/',
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/config/': 'config/',
        },
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server',
        name: '@solid/community-server',
        version: '1.2.3',
        typesPath: normalizeFilePath('/index'),
      });
    });

    it('should return with all required entries with lsd:module true and lsd:basePath', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
  "name": "@solid/community-server",
  "version": "1.2.3",
  "lsd:module": true,
  "lsd:basePath": "dist/",
  "types": "./index.d.ts"
}`,
      };
      await expect(loader.load('/')).resolves.toEqual({
        componentsPath: normalizeFilePath('/dist/components/components.jsonld'),
        contexts: {
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld':
            'dist/components/context.jsonld',
        },
        importPaths: {
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/':
            'dist/components/',
          'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/config/': 'dist/config/',
        },
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server',
        name: '@solid/community-server',
        version: '1.2.3',
        typesPath: normalizeFilePath('/index'),
      });
    });

    it('should error on invalid JSON', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{`,
      };
      await expect(loader.load('/')).rejects.toMatchObject({
        name: 'Error',
        message: expect.stringMatching(
          /* eslint-disable max-len */
          /Invalid package: Syntax error in .*\/package.json: (Unexpected end of JSON input|Expected property name or '\}')/u,
        ),
      });
    });

    it('should error when lsd:module is missing', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
  "name": "@solid/community-server",
  "lsd:components": "components/components.jsonld",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  }
}`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Missing 'lsd:module' IRI in ${normalizeFilePath('/package.json')}`));
    });

    it('should error when lsd:components is missing', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
  "name": "@solid/community-server",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:contexts": {
    "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld": "components/context.jsonld"
  }
}`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Missing 'lsd:components' in ${normalizeFilePath('/package.json')}`));
    });

    it('should error when lsd:contexts is missing', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
  "name": "@solid/community-server",
  "lsd:module": "https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server",
  "lsd:components": "components/components.jsonld"
}`,
      };
      await expect(loader.load('/')).rejects
        .toThrow(new Error(`Invalid package: Missing 'lsd:contexts' in ${normalizeFilePath('/package.json')}`));
    });

    it('should error when lsd:importPaths is missing', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
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
        .toThrow(new Error(`Invalid package: Missing 'lsd:importPaths' in ${normalizeFilePath('/package.json')}`));
    });

    it('should error when types and typings is missing', async() => {
      resolutionContext.contentsOverrides = {
        [normalizeFilePath('/package.json')]: `{
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
        .toThrow(new Error(`Invalid package: Missing 'types' or 'typings' in ${normalizeFilePath('/package.json')}`));
    });

    describe('for a given prefix', () => {
      beforeEach(() => {
        loader = new PackageMetadataLoader({ resolutionContext, prefixes: 'PRE' });
      });

      it('should return with all required entries', async() => {
        resolutionContext.contentsOverrides = {
          [normalizeFilePath('/package.json')]: `{
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
        await expect(loader.load('/')).resolves.toEqual({
          componentsPath: normalizeFilePath('/components/components.jsonld'),
          contexts: {
            [`https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld`]:
              'components/context.jsonld',
          },
          importPaths: {
            'https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/': 'components/',
            'https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/': 'config/',
          },
          moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server',
          name: '@solid/community-server',
          version: '1.2.3',
          typesPath: normalizeFilePath('/index'),
          prefix: 'PRE',
        });
      });
    });

    describe('for a given prefixes', () => {
      beforeEach(() => {
        loader = new PackageMetadataLoader({
          resolutionContext,
          prefixes: {
            '@solid/community-server': 'css',
            '@comunica/actor-init-sparql': 'cais',
          },
        });
      });

      it('should return with all required entries', async() => {
        resolutionContext.contentsOverrides = {
          [normalizeFilePath('/package.json')]: `{
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
        await expect(loader.load('/')).resolves.toEqual({
          componentsPath: normalizeFilePath('/components/components.jsonld'),
          contexts: {
            [`https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server/^1.0.0/components/context.jsonld`]:
              'components/context.jsonld',
          },
          importPaths: {
            'https://example.org/bundles/npm/@solid/community-server/^1.0.0/components/': 'components/',
            'https://example.org/bundles/npm/@solid/community-server/^1.0.0/config/': 'config/',
          },
          moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/@solid/community-server',
          name: '@solid/community-server',
          version: '1.2.3',
          typesPath: normalizeFilePath('/index'),
          prefix: 'css',
        });
      });
    });
  });
});
