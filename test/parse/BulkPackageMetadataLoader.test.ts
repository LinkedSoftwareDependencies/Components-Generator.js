import * as Path from 'path';
import { JsonLdContextNormalized } from 'jsonld-context-parser';
import { BulkPackageMetadataLoader } from '../../lib/parse/BulkPackageMetadataLoader';
import { PackageMetadataLoader } from '../../lib/parse/PackageMetadataLoader';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('BulkPackageMetadataLoader', () => {
  const resolutionContext = new ResolutionContextMocked({});
  let packageMetadataLoader: PackageMetadataLoader;
  let logger: any;
  let loader: BulkPackageMetadataLoader;

  beforeEach(() => {
    packageMetadataLoader = new PackageMetadataLoader({ resolutionContext });
    logger = {
      warn: jest.fn(),
    };
    loader = new BulkPackageMetadataLoader({
      packageMetadataLoader,
      logger,
    });
  });

  describe('load', () => {
    it('should handle empty paths', async() => {
      expect(await loader.load([])).toEqual({
        packageMetadatas: {},
        pathMetadatas: {},
      });
    });

    it('should skip a package that does not exist', async() => {
      expect(await loader.load([
        {
          packageRootDirectory: '/',
          originalPath: 'src',
          replacementPath: 'components',
        },
      ])).toEqual({
        packageMetadatas: {},
        pathMetadatas: {},
      });
      expect(logger.warn).toHaveBeenCalledWith(`Skipped generating invalid package at "/": Could not find mocked path for /package.json`);
    });

    it('should skip an invalid package that does not exist', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/package.json')]: `{
  "name": "@solid/community-server",
  "version": "1.2.3"
}`,
      };

      expect(await loader.load([
        {
          packageRootDirectory: '/',
          originalPath: 'src',
          replacementPath: 'components',
        },
      ])).toEqual({
        packageMetadatas: {},
        pathMetadatas: {},
      });
      expect(logger.warn).toHaveBeenCalledWith(`Skipped generating invalid package at "/": Invalid package: Missing 'lsd:module' IRI in /package.json`);
    });

    it('should a single valid paths', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/packages/pckg1/package.json')]: `{
  "name": "pckg1",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`,
      };

      expect(await loader.load([
        {
          packageRootDirectory: '/packages/pckg1',
          originalPath: 'src',
          replacementPath: 'components',
        },
      ])).toEqual({
        packageMetadatas: {
          pckg1: {
            minimalContext: expect.any(JsonLdContextNormalized),
            packageMetadata: {
              componentsPath: '/packages/pckg1/components/components.jsonld',
              contexts: {
                'https://linkedsoftwaredependencies.org/bundles/npm/pckg1/^1.0.0/components/context.jsonld':
                  'components/context.jsonld',
              },
              importPaths: {
                'https://linkedsoftwaredependencies.org/bundles/npm/pckg1/^1.0.0/components/': 'components/',
                'https://linkedsoftwaredependencies.org/bundles/npm/pckg1/^1.0.0/config/': 'config/',
              },
              moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/pckg1',
              name: 'pckg1',
              prefix: undefined,
              typesPath: '/packages/pckg1/index',
              version: '1.2.3',
            },
            pathDestination: {
              packageRootDirectory: '/packages/pckg1',
              originalPath: 'src',
              replacementPath: 'components',
            },
          },
        },
        pathMetadatas: {
          '/packages/pckg1': {
            componentsPath: '/packages/pckg1/components/components.jsonld',
            contexts: {
              'https://linkedsoftwaredependencies.org/bundles/npm/pckg1/^1.0.0/components/context.jsonld':
                'components/context.jsonld',
            },
            importPaths: {
              'https://linkedsoftwaredependencies.org/bundles/npm/pckg1/^1.0.0/components/': 'components/',
              'https://linkedsoftwaredependencies.org/bundles/npm/pckg1/^1.0.0/config/': 'config/',
            },
            moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/pckg1',
            name: 'pckg1',
            prefix: undefined,
            typesPath: '/packages/pckg1/index',
            version: '1.2.3',
          },
        },
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should multiple valid paths', async() => {
      resolutionContext.contentsOverrides = {
        [Path.normalize('/packages/pckg1/package.json')]: `{
  "name": "pckg1",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`,
        [Path.normalize('/packages/pckg2/package.json')]: `{
  "name": "pckg2",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`,
        [Path.normalize('/packages/pckg3/package.json')]: `{
  "name": "pckg3",
  "version": "1.2.3",
  "lsd:module": true,
  "types": "./index.d.ts"
}`,
      };

      expect(await loader.load([
        {
          packageRootDirectory: '/packages/pckg1',
          originalPath: 'src',
          replacementPath: 'components',
        },
        {
          packageRootDirectory: '/packages/pckg2',
          originalPath: 'src',
          replacementPath: 'components',
        },
        {
          packageRootDirectory: '/packages/pckg3',
          originalPath: 'src',
          replacementPath: 'components',
        },
      ])).toEqual({
        packageMetadatas: {
          pckg1: {
            minimalContext: expect.any(JsonLdContextNormalized),
            packageMetadata: expect.anything(),
            pathDestination: {
              packageRootDirectory: '/packages/pckg1',
              originalPath: 'src',
              replacementPath: 'components',
            },
          },
          pckg2: {
            minimalContext: expect.any(JsonLdContextNormalized),
            packageMetadata: expect.anything(),
            pathDestination: {
              packageRootDirectory: '/packages/pckg2',
              originalPath: 'src',
              replacementPath: 'components',
            },
          },
          pckg3: {
            minimalContext: expect.any(JsonLdContextNormalized),
            packageMetadata: expect.anything(),
            pathDestination: {
              packageRootDirectory: '/packages/pckg3',
              originalPath: 'src',
              replacementPath: 'components',
            },
          },
        },
        pathMetadatas: {
          '/packages/pckg1': expect.anything(),
          '/packages/pckg2': expect.anything(),
          '/packages/pckg3': expect.anything(),
        },
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
