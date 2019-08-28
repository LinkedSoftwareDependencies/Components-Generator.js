import {logger} from "./Core";
import {Fix} from "./Fix";

export class FixUtils {
    /**
     * Fixes the original object by adding all non-existing keys from other to original recursively
     *
     * @param original the original object
     * @param other the object to copy the entries from
     * @returns a fixed copy of the original
     */
    public static additiveComponentFix(original: any, other: any): any {
        // Quick and dirty trick to copy the nested original
        let originalCopy = JSON.parse(JSON.stringify(original));
        let originalParameters = originalCopy["parameters"];
        delete originalCopy["parameters"];
        FixUtils.fixRecursive(originalCopy, other);
        FixUtils.fixParameters(originalParameters, other["parameters"]);
        originalCopy["parameters"] = originalParameters;
        return originalCopy;
    }

    private static fixParameters(originalParameters: any, otherParameters: any) {
        // Just saving the indices of the already matched parameters is easier than deleting complex objects from lists,
        // which may require deep equality checks etc.
        let unmatchedOriginalParametersIndices = Object.keys(originalParameters);
        let unmatchedOtherParameters = Object.keys(otherParameters);
        let unmatchedOriginalParameters: any[] = [];
        parameterLoop: while(unmatchedOriginalParametersIndices.length !== 0 && unmatchedOtherParameters.length !== 0) {
            let originalParameterIndex = +unmatchedOriginalParametersIndices.pop();
            let originalParameter = originalParameters[originalParameterIndex];
            for(let i = 0; i < unmatchedOtherParameters.length; i++) {
                let otherParameterIndex = unmatchedOtherParameters[i];
                let otherParameter = otherParameters[otherParameterIndex];
                if(originalParameter["@id"] === otherParameter["@id"]) {
                    logger.debug(`Matched parameters with @id ${originalParameter["@id"]}`);
                    unmatchedOtherParameters.splice(i, 1);
                    FixUtils.fixRecursive(originalParameter, otherParameter);
                    continue parameterLoop;
                }
            }
            unmatchedOriginalParameters.push(originalParameter);

        }
        for(let originalParameter of unmatchedOriginalParameters) {
            if(unmatchedOtherParameters.length === 0) {
                logger.info(`Could not match the parameter ${originalParameter["@id"]} to any of the parameters that our tool generated. Perhaps you should delete this parameter?`);
            } else {
                logger.info(`Could not match the parameter ${originalParameter["@id"]} to any of the parameters that our tool generated. Perhaps the @id is different?`);
            }
        }
        for(let otherParameterIndex of unmatchedOtherParameters) {
            let otherParameter = otherParameters[otherParameterIndex];
            if(unmatchedOriginalParameters.length === 0) {
                logger.info(`Could not match the generated parameter ${otherParameter["@id"]} to any of the parameters you already have. Perhaps you should add this parameter?`);
            } else {
                logger.info(`Could not match the generated parameter ${otherParameter["@id"]} to any of the parameters you already have. Perhaps the @id is different or you should add it?`);
            }
            logger.info(`Suggested parameter:\n${JSON.stringify(otherParameter, null, 4)}`);
        }
    }

    /**
     * Fixes the original object by adding all non-existing keys from other to original recursively
     * The original object will be modified
     *
     * @param original the original object
     * @param other the object to copy the entries from
     */
    private static fixRecursive(original: any, other: any) {
        if(typeof other === "string") return;
        for(let [key, value] of Object.entries(other)) {
            if(key in original) {
                let newOriginalValue = original[key];
                // We consider the edge case where our existing content has something like {"a": "my-id"}
                // and our generated version has something like {"a": { "@id": "my-id", "xyz": "abc"}}
                if(typeof newOriginalValue === "string") {
                    // Our original value is a string, possibly an IRI
                    if(typeof value !== "string") {
                        // Our generated value is not a string, if it contains more information than just @id, we will
                        // copy over its attributes to the original value
                        if(!(Object.keys(value).length === 1 && Object.keys(value)[0] === "@id")) {
                            logger.debug("Edge case with @id and additional attributes detected");
                            // We will convert newOriginalValue to an object now so we can add additional attributes
                            original[key] = {
                                "@id": newOriginalValue
                            };
                        } else {
                            continue;
                        }
                    }
                }
                FixUtils.fixRecursive(original[key], value);
            } else {
                original[key] = value;
            }
        }
    }

}
