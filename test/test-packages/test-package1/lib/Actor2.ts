import {Actor3Args as A} from "./../lib/../lib/Actor3";
import * as B from "./../lib/Actor3";

// A quick test to see if special import cases don't cause errors
import {xyz} from "./Actor3";
const GGG = require("./../lib/Actor2").Actor2;
let POI = require("./../lib/Actor2");
require("./../lib/Actor2");
import "./../lib/Actor2";
import("./../lib/Actor2");


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
