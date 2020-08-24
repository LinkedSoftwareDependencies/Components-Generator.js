import { ContextConstructor } from '../../lib/serialize/ContextConstructor';

describe('ContextConstructor', () => {
  let ctor: ContextConstructor;

  beforeEach(async() => {
    ctor = new ContextConstructor({
      packageMetadata: {
        name: 'my-package',
        version: '1.2.3',
        moduleIri: 'https://linkedsoftwaredependencies.org/bundles/npm/my-package/',
        componentsPath: 'components',
        contexts: {},
        importPaths: {},
      },
    });
  });

  describe('getPackageNamePrefix', () => {
    it('should handle a name with one component', () => {
      expect(ContextConstructor.getPackageNamePrefix('package')).toEqual('p');
    });

    it('should handle a name with two components', () => {
      expect(ContextConstructor.getPackageNamePrefix('my-package')).toEqual('mp');
    });

    it('should handle a name with three components', () => {
      expect(ContextConstructor.getPackageNamePrefix('my-package-stuff')).toEqual('mps');
    });

    it('should handle a scoped name with three components', () => {
      expect(ContextConstructor.getPackageNamePrefix('@personal/my-package-stuff')).toEqual('pmps');
    });
  });

  describe('constructContext', () => {
    it('should handle undefined component definitions', () => {
      expect(ctor.constructContext()).toEqual({
        '@context': [
          'https://linkedsoftwaredependencies.org/bundles/npm/componentsjs/^3.0.0/components/context.jsonld',
          {
            npmd: 'https://linkedsoftwaredependencies.org/bundles/npm/',
            mp: 'npmd:my-package/',
            'files-mp': 'mp:^1.0.0/',
          },
        ],
      });
    });

    it('should handle defined component definitions', () => {
      expect(ctor.constructContext({
        '/docs/package/file1': {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass1',
            },
          ],
        },
        '/docs/package/file2': {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [],
              parameters: [],
            },
          ],
        },
      })).toEqual({
        '@context': [
          'https://linkedsoftwaredependencies.org/bundles/npm/componentsjs/^3.0.0/components/context.jsonld',
          {
            npmd: 'https://linkedsoftwaredependencies.org/bundles/npm/',
            mp: 'npmd:my-package/',
            'files-mp': 'mp:^1.0.0/',

            MyClass1: 'mp:MyClass1',
            MyClass2: 'mp:MyClass2',
          },
        ],
      });
    });
  });

  describe('constructComponentShortcuts', () => {
    it('should handle empty component definitions', () => {
      expect(ctor.constructComponentShortcuts({})).toEqual({});
    });

    it('should handle non-empty component definitions', () => {
      expect(ctor.constructComponentShortcuts({
        '/docs/package/file1': {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:MyClass1',
              '@type': 'Class',
              constructorArguments: [],
              parameters: [],
              requireElement: 'MyClass1',
            },
          ],
        },
        '/docs/package/file2': {
          '@context': [
            'https://linkedsoftwaredependencies.org/bundles/npm/my-package/context.jsonld',
          ],
          '@id': 'npmd:my-package',
          components: [
            {
              '@id': 'mp:MyClass2',
              '@type': 'Class',
              requireElement: 'MyClass2',
              constructorArguments: [],
              parameters: [],
            },
          ],
        },
      })).toEqual({
        MyClass1: 'mp:MyClass1',
        MyClass2: 'mp:MyClass2',
      });
    });
  });
});
