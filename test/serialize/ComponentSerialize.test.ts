import { ComponentSerializer } from '../../lib/serialize/ComponentSerializer';
import { ResolutionContextMocked } from '../ResolutionContextMocked';

describe('ComponentSerializer', () => {
  let resolutionContext: ResolutionContextMocked;
  let serializer: ComponentSerializer;

  beforeEach(() => {
    resolutionContext = new ResolutionContextMocked({});
    serializer = new ComponentSerializer({
      resolutionContext,
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
          components: [],
        },
        'a/b/file2': {
          '@context': [],
          components: [],
        },
      })).toEqual([
        'a/b/file1.jsonld',
        'a/b/file2.jsonld',
      ]);
      expect(resolutionContext.contentsOverrides).toEqual({
        'a/b/file1.jsonld': `{
  "@context": [],
  "components": []
}`,
        'a/b/file2.jsonld': `{
  "@context": [],
  "components": []
}`,
      });
    });
  });
});
