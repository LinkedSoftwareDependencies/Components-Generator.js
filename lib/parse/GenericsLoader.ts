import type { ClassIndex, ClassReferenceLoaded } from './ClassIndex';
import type {
  GenericTypeParameterData,
  ParameterLoader,
  ParameterRangeUnresolved,
} from './ParameterLoader';

/**
 * Loads the generics data of classes.
 */
export class GenericsLoader {
  private readonly parameterLoader: ParameterLoader;

  public constructor(args: GenericsLoaderArgs) {
    this.parameterLoader = args.parameterLoader;
  }

  /**
   * Create a class index containing all generics data from the classes in the given index.
   * @param classIndex An index of loaded classes.
   */
  public getGenerics(
    classIndex: ClassIndex<ClassReferenceLoaded>,
  ): ClassIndex<GenericsData<ParameterRangeUnresolved>> {
    const genericsDataIndex: ClassIndex<GenericsData<ParameterRangeUnresolved>> = {};
    for (const [ className, classLoadedRoot ] of Object.entries(classIndex)) {
      if (classLoadedRoot.type === 'class' || classLoadedRoot.type === 'interface') {
        genericsDataIndex[className] = this.parameterLoader.loadClassGenerics(classLoadedRoot);
      }
    }
    return genericsDataIndex;
  }
}

export interface GenericsLoaderArgs {
  parameterLoader: ParameterLoader;
}

/**
 * Generics parameter information
 */
export interface GenericsData<R> {
  genericTypeParameters: GenericTypeParameterData<R>[];
  classLoaded: ClassReferenceLoaded;
}
