import {
  BaseNode,
  Comment,
  LineAndColumnData,
  TypeNode,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import commentParse = require('comment-parser');
import { logger } from './Core';
import { ParsedComment } from './Types';
import * as Utils from './Utils';

const rangeTag = 'range';
const defaultTag = 'default';
const ignoredTag = 'ignored';

/**
 * Utilities for getting information about comments
 */

/**
 * Gets comment from a declaration by checking if the comment ends just before the start of the declaration
 *
 * @param comments to comments to search through
 * @param start the place after which a comment should be matched
 * @param end the place before which a comment should be matched
 * @returns the matched comment as a string
 */
export function getInBetweenComment(comments: Comment[], start: LineAndColumnData, end: LineAndColumnData):
string | undefined {
  /**
   * @returns whether loc1 occurs after loc2
   */
  function isAfter(loc1: LineAndColumnData, loc2: LineAndColumnData): boolean {
    return loc2.line < loc1.line || (loc1.line === loc2.line && loc2.column <= loc1.column);
  }

  for (const comment of comments) {
    if (isAfter(comment.loc.start, start) && isAfter(end, comment.loc.end)) {
      return fixComment(comment);
    }
  }
}

/**
 * Fixes a comment so it can be parsed by the library that we're using
 *
 * @returns the comment with proper surrounding slashes
 */
export function fixComment(comment: Comment): string {
  // The TypeScript parser removes some parts of a comment, we add them back
  return `/*${comment.value}*/`;
}

/**
 * Gets comment from a declaration by checking if the comment ends on the line before the start of the declaration
 *
 * @param comments the comments to search through
 * @param declaration the declaration to match
 * @returns the matched comment as a string
 */
export function getComment(comments: Comment[], declaration: BaseNode): string | undefined {
  const line = declaration.loc.start.line;
  for (const comment of comments) {
    if (comment && comment.loc.end.line === line - 1) {
      return fixComment(comment);
    }
  }
}

/**
 * Parses a comment and its tags
 *
 * @param comment the comment as a string
 * @param fieldType the class of this field
 * @returns the parsed comment
 */
export function parseFieldComment(comment: string | undefined, fieldType?: TypeNode): ParsedComment {
  let range;
  let defaultValue;
  let commentDescription;
  let ignored = false;
  if (comment) {
    const parsedComment = commentParse(comment);
    const firstComment = parsedComment[0];
    if (firstComment !== undefined) {
      if (firstComment.description.length > 0) {
        commentDescription = firstComment.description;
      }
      for (const tag of firstComment.tags) {
        const type = tag.type.toLowerCase();
        switch (tag.tag.toLowerCase()) {
          case rangeTag:
            if (fieldType && Utils.isValidXsd(fieldType, type)) {
              range = `xsd:${type}`;
            } else {
              logger.error(`Found range type ${type} but could not match to ${fieldType ? fieldType.type : undefined}`);
            }
            break;
          case defaultTag:
            if (tag.type.length > 0) {
              defaultValue = tag.type;
            }
            break;
          case ignoredTag:
            ignored = true;
            break;
          default:
            logger.debug(`Could not understand tag ${tag.tag}`);
            break;
        }
      }
    }
  }
  return {
    range,
    defaultValue,
    ignored,
    description: commentDescription,
  };
}
