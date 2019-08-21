import {Actor3Args as A} from "./../lib/../lib/Actor3";
import * as B from "./../lib/Actor3";

/**
 * This class is great and has some funky import names
 */
export class Actor2 extends B.Actor3 {

    constructor(argsTest: Actor2Args, /** @ignored */ size: number) {
        super(argsTest);
    }
}

export interface Actor2Args extends A {
    referenceTest: B.Actor3Args;
    crossReferenceTest: TestHere;
    uselessClass: UselessClass;
}
export interface TestHere extends B.Actor3Args {

}
export interface UselessClass {

}
