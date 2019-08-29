/**
 * This class serves as a base-class
 */
import {Logger} from "@comunica/core";

export const xyz = "abc";

export abstract class Actor3 {

    constructor(args: Actor3Args) {

    }

}
export interface Actor3Args {
    /**
     * This field should be ignored
     * @ignored
     */
    ignoredTest: string;
    /**
     * Boolean field comment
     */
    booleanTest: boolean;
    javascriptBooleanTest: Boolean;
    stringTest: string;
    javascriptStringTest: String;
    numberTest: number;
    javascriptNumberTest: Number;
    /**
     * We test some tags here
     * @invalid-tag
     * @default {1}
     * @range {byte}
     */
    tagTest: Number;
    arrayTest: Number[];
    /**
     * We test the range tag on an array
     * @range {byte}
     */
    arrayTagTest: Number[];
    /**
     * This is a component from another package
     */
    componentTest: Logger

    nestTest: NestTest
}
export interface NestTest {
    nestedField: number;
    nestedDouble: DoubleNest;
    nestedDoubleArray: DoubleNest[];
}
export class DoubleNest {
    nestedField: number;
}
