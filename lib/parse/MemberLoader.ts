import { AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { ClassReferenceLoaded, ClassReferenceLoadedClassOrInterface, ClassIndex } from './ClassIndex';

import type { MemberParameterData, ParameterLoader, ParameterRangeUnresolved } from './ParameterLoader';

/**
 * Loads the member data of classes.
 */
export class MemberLoader {
  private readonly parameterLoader: ParameterLoader;

  public constructor(args: MemberLoaderArgs) {
    this.parameterLoader = args.parameterLoader;
  }

  /**
   * Create a class index containing all member data from the classes in the given index.
   * @param classIndex An index of loaded classes.
   */
  public getMembers(
    classIndex: ClassIndex<ClassReferenceLoaded>,
  ): ClassIndex<MemberData<ParameterRangeUnresolved>> {
    const membersIndex: ClassIndex<MemberData<ParameterRangeUnresolved>> = {};
    for (const [ className, classLoadedRoot ] of Object.entries(classIndex)) {
      if (classLoadedRoot.type === 'class' || classLoadedRoot.type === 'interface') {
        membersIndex[className] = {
          members: this.collectClassFields(classLoadedRoot),
          classLoaded: classLoadedRoot,
        };
      }
    }
    return membersIndex;
  }

  /**
   * Obtain the class member fields.
   * This should correspond to the keys that are available within the `keyof` range of this class
   * @param classLoaded A class or interface
   */
  public collectClassFields(
    classLoaded: ClassReferenceLoadedClassOrInterface,
  ): MemberParameterData<ParameterRangeUnresolved>[] {
    const members: MemberParameterData<ParameterRangeUnresolved>[] = [];
    for (const element of classLoaded.declaration.body.body) {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
      switch (element.type) {
        case AST_NODE_TYPES.ClassProperty:
        case AST_NODE_TYPES.TSAbstractClassProperty:
        case AST_NODE_TYPES.MethodDefinition:
        case AST_NODE_TYPES.TSAbstractMethodDefinition:
        case AST_NODE_TYPES.TSPropertySignature:
        case AST_NODE_TYPES.TSMethodSignature:
          if (element.key.type === 'Identifier') {
            const typeNode = 'typeAnnotation' in element ? element.typeAnnotation!.typeAnnotation : undefined;
            members.push({
              name: element.key.name,
              range: typeNode ?
                this.parameterLoader.getRangeFromTypeNode(classLoaded, typeNode, `field ${element.key.name}`) :
                undefined,
            });
          }
          break;
      }
    }
    return members;
  }
}

/**
 * Member parameter information
 */
export interface MemberData<R> {
  members: MemberParameterData<R>[];
  classLoaded: ClassReferenceLoaded;
}

export interface MemberLoaderArgs {
  parameterLoader: ParameterLoader;
}
