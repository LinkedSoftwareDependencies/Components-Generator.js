/**
 * Creates an index of classes in a certain package.
 */
import type { ClassFinder } from './ClassFinder';
import type { ClassIndex, ClassLoaded, ClassReference } from './ClassIndex';
import type { ClassLoader } from './ClassLoader';

export class ClassIndexer {
  /**
   * Errors that do not require an import, and are assumed to be known globally.
   */
  private static readonly SUPERCLASS_BLACKLIST: Record<string, boolean> = {
    Error: true,
  };

  private readonly classLoader: ClassLoader;
  private readonly classFinder: ClassFinder;

  public constructor(args: ClassIndexerArgs) {
    this.classLoader = args.classLoader;
    this.classFinder = args.classFinder;
  }

  /**
   * Load all class references in the given class index.
   * @param classReferences An index of class references.
   */
  public async createIndex(classReferences: ClassIndex<ClassReference>): Promise<ClassIndex<ClassLoaded>> {
    const classIndex: ClassIndex<ClassLoaded> = {};

    for (const [ className, classReference ] of Object.entries(classReferences)) {
      classIndex[className] = await this.loadClassChain(classReference);
    }

    return classIndex;
  }

  /**
   * Load the referenced class, and obtain all required information,
   * such as its declaration and loaded super class referenced.
   * @param classReference The reference to a class.
   */
  public async loadClassChain(classReference: ClassReference): Promise<ClassLoaded> {
    // Load the class declaration
    const classReferenceLoaded: ClassLoaded = await this.classLoader.loadClassDeclaration(classReference, false);

    // If the class has a super class, load it recursively
    const superClassName = this.classLoader.getSuperClassName(classReferenceLoaded.declaration,
      classReferenceLoaded.fileName);
    if (superClassName && !(superClassName in ClassIndexer.SUPERCLASS_BLACKLIST)) {
      classReferenceLoaded.superClass = await this.loadClassChain({
        localName: superClassName,
        fileName: classReferenceLoaded.fileName,
      });
    }

    return classReferenceLoaded;
  }
}

export interface ClassIndexerArgs {
  classLoader: ClassLoader;
  classFinder: ClassFinder;
}
