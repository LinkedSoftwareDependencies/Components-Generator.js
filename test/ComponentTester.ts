import * as Path from 'path';
import * as Utils from '../lib/Utils';

export const testDirectory = 'test';
const outputPath = 'expected-output';

/**
 * Tests whether a generated component matches the expected output
 *
 * @param generatedComponentsContent the content of the generated component file
 * @param expectedOutputFile the filepath to the expected output
 * @param packageName the name of the package of the component
 */
export function testComponents(generatedComponentsContent: any, expectedOutputFile: string, packageName: string) {
  expect(generatedComponentsContent).not.toBeNull();
  expect(generatedComponentsContent).not.toBeUndefined();
  const expectedComponents = Utils.getJSON(Path.join(testDirectory, outputPath, packageName, expectedOutputFile));
  expect(generatedComponentsContent['@id']).toBe(expectedComponents['@id']);
  // @ts-ignore
  expect(generatedComponentsContent['@context']).toIncludeSameMembers(expectedComponents['@context']);
  expect(generatedComponentsContent).toHaveProperty('components');
  expect(generatedComponentsContent.components).toHaveLength(1);
  const generatedComponent = generatedComponentsContent.components[0];
  const expectedComponent = expectedComponents.components[0];
  // We can enforce that the constructorArguments property needs to have the same order for its values
  for (const property of [ '@id', '@type', 'comment', 'constructorArguments', 'requireElement' ]) {
    expect(generatedComponent[property]).toEqual(expectedComponent[property]);
  }
  // We can't enforce the same order on the parameters
  // @ts-ignore
  expect(generatedComponent.parameters).toIncludeSameMembers(expectedComponent.parameters);
}
