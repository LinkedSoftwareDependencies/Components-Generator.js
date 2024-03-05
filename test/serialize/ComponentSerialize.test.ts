import { ComponentSerializer } from '../../lib/serialize/ComponentSerializer';
import { normalizeFilePath } from '../../lib/util/PathUtil';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ComponentSerializer', () => {
  let resolutionContext: ResolutionContextMocked;
  let serializer: ComponentSerializer;

  beforeEach(() => {
    resolutionContext = new ResolutionContextMocked({});
    serializer = new ComponentSerializer({
      resolutionContext,
      pathDestination: {
        packageRootDirectory: '/',
        originalPath: '/src',
        replacementPath: '/components',
      },
      fileExtension: 'jsonld',
      indentation: '  ',
    });
  });

  describe('serializeComponents', () => {
    it('should not create files for no components', async() => {
      await expect(serializer.serializeComponents({})).resolves.toEqual([]);
      expect(resolutionContext.contentsOverrides).toEqual({});
    });

    it('should create files for components', async() => {
      await expect(serializer.serializeComponents({
        'a/b/file1': {
          '@context': [],
          '@id': 'myfile',
          components: [],
        },
        'a/b/file2': {
          '@context': [],
          '@id': 'myfile',
          components: [],
        },
      })).resolves.toEqual([
        'a/b/file1.jsonld',
        'a/b/file2.jsonld',
      ]);
      expect(resolutionContext.contentsOverrides).toEqual({
        'a/b/file1.jsonld': `{
  "@context": [],
  "@id": "myfile",
  "components": []
}`,
        'a/b/file2.jsonld': `{
  "@context": [],
  "@id": "myfile",
  "components": []
}`,
      });
    });
  });

  describe('serializeComponentsIndex', () => {
    it('should handle a valid components index', async() => {
      await expect(serializer.serializeComponentsIndex({
        '@context': [
          'http://example.org/my-package/context.jsonld',
        ],
        '@id': 'ex:my-package',
        '@type': 'Module',
        requireName: 'my-package',
        import: [
          'ex:my-package/file1.jsonld',
          'ex:my-package/file2.jsonld',
          'ex:my-package/file/a/b/c.jsonld',
        ],
      })).resolves.toEqual(normalizeFilePath('/components/components.jsonld'));
      expect(resolutionContext.contentsOverrides).toEqual({
        [normalizeFilePath('/components/components.jsonld')]: `{
  "@context": [
    "http://example.org/my-package/context.jsonld"
  ],
  "@id": "ex:my-package",
  "@type": "Module",
  "requireName": "my-package",
  "import": [
    "ex:my-package/file1.jsonld",
    "ex:my-package/file2.jsonld",
    "ex:my-package/file/a/b/c.jsonld"
  ]
}`,
      });
    });
  });

  describe('serializeContext', () => {
    it('should handle a valid context', async() => {
      await expect(serializer.serializeContext({
        '@context': [
          {
            a: 'b',
          },
        ],
      })).resolves.toEqual(normalizeFilePath('/components/context.jsonld'));
      expect(resolutionContext.contentsOverrides).toEqual({
        [normalizeFilePath('/components/context.jsonld')]: `{
  "@context": [
    {
      "a": "b"
    }
  ]
}`,
      });
    });
  });
});
