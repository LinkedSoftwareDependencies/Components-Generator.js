export class FixUtils {
    /**
     * Fixes the original object by adding all non-existing keys from other to original recursively
     *
     * @param original the original object
     * @param other the object to copy the entries from
     * @returns a fixed copy of the original
     */
    public static additiveFix(original: any, other: any): any {
        // Quick and dirty trick to copy the nested original
        let originalCopy = JSON.parse(JSON.stringify(original));
        FixUtils.fixRecursive(originalCopy, other);
        return originalCopy;
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
                FixUtils.fixRecursive(original[key], value);
            } else {
                original[key] = value;
            }
        }
    }

}
