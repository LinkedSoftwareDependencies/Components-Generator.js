/**
 * Creates an index of classes in a certain package.
 */
import type { Logger } from 'winston';
import type { ClassFinder } from './ClassFinder';
import type {
  ClassIndex,
  ClassReference,
  ClassReferenceLoaded,
  ClassReferenceLoadedClassOrInterface,
  InterfaceLoaded,
  GenericallyTyped,
} from './ClassIndex';

import type { ClassLoader } from './ClassLoader';

export class ClassIndexer {
  private readonly classLoader: ClassLoader;
  private readonly classFinder: ClassFinder;
  private readonly ignoreClasses: Record<string, boolean>;
  private readonly logger: Logger;

  public constructor(args: ClassIndexerArgs) {
    this.classLoader = args.classLoader;
    this.classFinder = args.classFinder;
    this.ignoreClasses = args.ignoreClasses;
    this.logger = args.logger;
  }

  /**
   * Load all class references in the given class index.
   * @param classReferences An index of class references.
   */
  public async createIndex(
    classReferences: ClassIndex<ClassReference>,
  ): Promise<ClassIndex<ClassReferenceLoadedClassOrInterface>> {
    const classIndex: ClassIndex<ClassReferenceLoadedClassOrInterface> = {};

    for (const [ className, classReference ] of Object.entries(classReferences)) {
      if (!(className in this.ignoreClasses)) {
        classIndex[className] = await this.loadClassChain(classReference);
      }
    }

    return classIndex;
  }

  /**
   * Load the referenced class, and obtain all required information,
   * such as its declaration and loaded super class referenced.
   * @param classReference The reference to a class or interface.
   */
  public async loadClassChain(classReference: ClassReference): Promise<ClassReferenceLoadedClassOrInterface> {
    // Load the class declaration
    const classReferenceLoaded: ClassReferenceLoaded = await this.classLoader
      .loadClassDeclaration(classReference, true, false);

    if (classReferenceLoaded.type === 'class') {
      // If the class has a super class, load it recursively
      const superClassName = this.classLoader
        .getSuperClassName(classReferenceLoaded.declaration, classReferenceLoaded.fileName);
      if (superClassName && !(superClassName.value in this.ignoreClasses)) {
        let superClassLoaded;
        try {
          superClassLoaded = await this.loadClassChain({
            packageName: classReferenceLoaded.packageName,
            localName: superClassName.value,
            qualifiedPath: classReferenceLoaded.qualifiedPath,
            fileName: classReferenceLoaded.fileName,
            fileNameReferenced: classReferenceLoaded.fileNameReferenced,
          });
        } catch (error: unknown) {
          throw new Error(`Failed to load super class ${superClassName.value} of ${classReference.localName} in ${classReference.fileName}:\n${(<Error>error).message}`);
        }
        if (superClassLoaded.type !== 'class') {
          throw new Error(`Detected non-class ${superClassName.value} extending from a class ${classReference.localName} in ${classReference.fileName}`);
        }
        classReferenceLoaded.superClass = {
          value: superClassLoaded,
          genericTypeInstantiations: superClassName.genericTypeInstantiations,
        };
      }

      // If the class implements interfaces, load them
      const interfaceNames = this.classLoader
        .getClassInterfaceNames(classReferenceLoaded.declaration, classReferenceLoaded.fileName);
      classReferenceLoaded.implementsInterfaces = <GenericallyTyped<ClassReferenceLoadedClassOrInterface>[]> (
        await Promise
          .all(interfaceNames
            .filter(interfaceName => !(interfaceName.value in this.ignoreClasses))
            .map(async(interfaceName) => {
              let interfaceOrClassLoaded;
              try {
                interfaceOrClassLoaded = await this.classLoader.loadClassDeclaration({
                  packageName: classReferenceLoaded.packageName,
                  localName: interfaceName.value,
                  qualifiedPath: classReferenceLoaded.qualifiedPath,
                  fileName: classReferenceLoaded.fileName,
                  fileNameReferenced: classReferenceLoaded.fileNameReferenced,
                }, true, false);
              } catch (error: unknown) {
                // Ignore interfaces that we don't understand
                this.logger.debug(`Ignored interface ${interfaceName.value} implemented by ${classReference.localName} in ${classReference.fileName}:\n${(<Error> error).message}`);
                return;
              }
              return {
                value: interfaceOrClassLoaded,
                genericTypeInstantiations: interfaceName.genericTypeInstantiations,
              };
            })))
        .filter(Boolean);
    } else {
      const superInterfaceNames = this.classLoader
        .getSuperInterfaceNames(classReferenceLoaded.declaration, classReferenceLoaded.fileName);
      classReferenceLoaded.superInterfaces = <GenericallyTyped<InterfaceLoaded>[]> (await Promise
        .all(superInterfaceNames
          .filter(interfaceName => !(interfaceName.value in this.ignoreClasses))
          .map(async(interfaceName) => {
            let superInterface;
            try {
              superInterface = await this.loadClassChain({
                packageName: classReferenceLoaded.packageName,
                localName: interfaceName.value,
                qualifiedPath: classReferenceLoaded.qualifiedPath,
                fileName: classReferenceLoaded.fileName,
                fileNameReferenced: classReferenceLoaded.fileNameReferenced,
              });
            } catch (error: unknown) {
            // Ignore interfaces that we don't understand
              this.logger.debug(`Ignored interface ${interfaceName.value} extended by ${classReference.localName} in ${classReference.fileName}:\n${(<Error> error).message}`);
              return;
            }
            if (superInterface.type !== 'interface') {
              throw new Error(`Detected non-interface ${classReferenceLoaded.localName} extending from a class ${interfaceName.value} in ${classReference.fileName}`);
            }
            return {
              value: superInterface,
              genericTypeInstantiations: interfaceName.genericTypeInstantiations,
            };
          })))
        .filter(Boolean);
    }

    return classReferenceLoaded;
  }
}

export interface ClassIndexerArgs {
  classLoader: ClassLoader;
  classFinder: ClassFinder;
  ignoreClasses: Record<string, boolean>;
  logger: Logger;
}
