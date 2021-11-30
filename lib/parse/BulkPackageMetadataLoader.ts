import { PrefetchedDocumentLoader } from 'componentsjs';
import { ContextParser } from 'jsonld-context-parser';
import type { Logger } from 'winston';
import type { PackageMetadataScope } from '../resolution/ExternalModulesLoader';
import type { PathDestinationDefinition } from '../serialize/ComponentConstructor';
import { ContextConstructor } from '../serialize/ContextConstructor';
import type { PackageMetadata, PackageMetadataLoader } from './PackageMetadataLoader';

/**
 * Load metadata from multiple packages in bulk.
 */
export class BulkPackageMetadataLoader {
  private readonly packageMetadataLoader: PackageMetadataLoader;
  private readonly logger: Logger;

  public constructor(args: BulkPackageMetadataLoaderArgs) {
    this.packageMetadataLoader = args.packageMetadataLoader;
    this.logger = args.logger;
  }

  /**
   * Load the metadata from the given packages.
   * @param pathDestinations Package paths.
   */
  public async load(pathDestinations: PathDestinationDefinition[]): Promise<BulkPackageMetadataOutput> {
    const packageMetadatas: Record<string, PackageMetadataScope> = {};
    const pathMetadatas: Record<string, PackageMetadata> = {};
    const minimalContextParser = new ContextParser({
      documentLoader: new PrefetchedDocumentLoader({
        contexts: {},
        logger: this.logger,
      }),
      skipValidation: true,
    });

    for (const pathDestination of pathDestinations) {
      let packageMetadata: PackageMetadata;
      try {
        // Load package metadata
        packageMetadata = await this.packageMetadataLoader.load(pathDestination.packageRootDirectory);
        const contextConstructor = new ContextConstructor({ packageMetadata });

        // Save the metadata for later use
        packageMetadatas[packageMetadata.name] = {
          packageMetadata,
          pathDestination,
          minimalContext: await minimalContextParser.parse(contextConstructor.constructContext()),
        };
        pathMetadatas[pathDestination.packageRootDirectory] = packageMetadata;
      } catch (error: unknown) {
        // Skip invalid packages
        this.logger.warn(`Skipped generating invalid package at "${pathDestination.packageRootDirectory}": ${(<Error> error).message}`);
      }
    }

    return { packageMetadatas, pathMetadatas };
  }
}

export interface BulkPackageMetadataLoaderArgs {
  packageMetadataLoader: PackageMetadataLoader;
  logger: Logger;
}

export interface BulkPackageMetadataOutput {
  /**
   * Maps package name to scoped package metadata.
   */
  packageMetadatas: Record<string, PackageMetadataScope>;
  /**
   * Maps package root path to package metadata.
   */
  pathMetadatas: Record<string, PackageMetadata>;
}
