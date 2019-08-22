import QQQ = require("./../lib/Actor2");
import ZZZ = require("./../lib/../lib/Actor2");
import EEE = require("./../lib/Actor2");

export class Actor1 extends QQQ.Actor2 {
    constructor(ownArgs: OwnArgs, oldArgs: EEE.Actor2Args, /** @range {int} */ optionalNumber?: number) {
        super(ownArgs, optionalNumber);
    }
}

export interface OwnArgs extends ZZZ.Actor2Args {
    /**
     * @ignored
     */
    ignoredField: Number,
    ownArgs?: string,
    /**
     * Testing arguments with similar names
     * @default {5.0}
     * @range {float}
     */
    optionalNumber: number;
}
