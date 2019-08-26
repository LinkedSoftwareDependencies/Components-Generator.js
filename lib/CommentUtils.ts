import {Comment, LineAndColumnData, Statement} from "@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree";


export class CommentUtils {
    /**
     * Gets comment from a declaration by checking if the comment ends just before the start of the declaration
     * @param comments to comments to search through
     * @param {{line:int,column:int}} start the place after which a comment should be matched
     * @param {{line:int,column:int}} end the place before which a comment should be matched
     * @returns {string|null} the matched comment as a string
     */
    public static getInBetweenComment(comments: Comment[], start: LineAndColumnData, end: LineAndColumnData) {
        /**
         * @returns whether loc1 occurs after loc2
         */
        function isAfter(loc1: LineAndColumnData, loc2: LineAndColumnData): boolean {
            return loc2.line < loc1.line || (loc1.line === loc2.line && loc2.column <= loc1.column);
        }

        for (let comment of comments) {
            if (isAfter(comment.loc.start, start) && isAfter(end, comment.loc.end)) {
                return CommentUtils.fixComment(comment);
            }
        }
    }

    /** Fixes a comment so it can be parsed by the library we're using
     * @returns the comment with proper surrounding slashes
     */
    public static fixComment(comment: Comment): string {
        // The TypeScript parser removes some parts of a comment, we add them back
        return `/*${comment.value}*/`;
    }
    /**
     * Gets comment from a declaration by checking if the comment ends on the line before the start of the declaration
     * @param comments to comments to search through
     * @param declaration the declaration to match
     * @returns the matched comment as a string
     */
    public static getComment(comments: Comment[], declaration: Statement): string {
        let line = declaration.loc.start.line;
        for (let comment of comments) {
            if (comment.loc.end.line === line - 1) {
                return CommentUtils.fixComment(comment);
            }
        }
    }
}

