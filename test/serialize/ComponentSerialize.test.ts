import { ComponentSerializer } from '../../lib/serialize/ComponentSerializer';
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
        originalPath: 'src',
        replacementPath: 'components',
      },
      fileExtension: 'jsonld',
      indentation: '  ',
    });
  });

  describe('serializeComponents', () => {
    it('should not create files for no components', async() => {
      expect(await serializer.serializeComponents({})).toEqual([]);
      expect(resolutionContext.contentsOverrides).toEqual({});
    });

    it('should create files for components', async() => {
      expect(await serializer.serializeComponents({
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
      })).toEqual([
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
      expect(await serializer.serializeComponentsIndex({
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
      })).toEqual('/components/components.jsonld');
      expect(resolutionContext.contentsOverrides).toEqual({
        '/components/components.jsonld': `{
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
      expect(await serializer.serializeContext({
        '@context': [
          {
            a: 'b',
          },
        ],
      })).toEqual('/components/context.jsonld');
      expect(resolutionContext.contentsOverrides).toEqual({
        '/components/context.jsonld': `{
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
