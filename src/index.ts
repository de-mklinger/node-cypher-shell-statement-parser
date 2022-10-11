/*
 * A port of Neo4j Shell Statement Parser,
 * https://github.com/neo4j/cypher-shell/blob/neo4j-4.2.1/cypher-shell/src/main/java/org/neo4j/shell/parser/ShellStatementParser.java
 */

/* eslint-disable capitalized-comments */
/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/class-literal-property-style */
/* eslint-disable no-else-return */
/* eslint-disable @typescript-eslint/member-ordering */

/**
 * An object capable of parsing a piece of text and returning a List statements contained within.
 */
export interface StatementParser {

  /**
   * Parse the next line of text
   *
   * @param line to parse
   */
  parseMoreText: (line: string) => void;

  /**
   * @return true if any statements have been parsed yet, false otherwise
   */
  hasStatements: () => boolean;

  /**
   * Once this method has been called, the method will return the empty list (unless more text is parsed). If nothing has been parsed yet, then the empty list
   * is returned.
   *
   * @return statements which have been parsed so far and remove them from internal state
   */
  consumeStatements: () => string[];

  /**
   * @return false if no text (except whitespace) has been seen since last parsed statement, true otherwise.
   */
  containsText: () => boolean;

  /**
   * Reset the state of the Parser, removing any and all state it has.
   */
  reset: () => void;
}

/**
 * A cypher aware parser which can detect shell commands (:prefixed) or cypher.
 */
export class ShellStatementParser implements StatementParser {
  private static readonly shellCmdRegExp = /^\s*:.+\s*$/;
  private static readonly semicolon = ";";
  private static readonly backslash = "\\";
  private static readonly lineCommentStart = "//";
  private static readonly lineCommentEnd = "\n";
  private static readonly blockCommentStart = "/*";
  private static readonly blockCommentEnd = "*/";
  private static readonly backtick = "`";
  private static readonly doubleQuote = "\"";
  private static readonly singleQuote = "'";
  private static readonly noComment = -1;
  private awaitedRightDelimiter: string | undefined;
  private statement: string;
  private parsedStatements: string[];
  private commentStart = ShellStatementParser.noComment;

  constructor() {
    this.parsedStatements = [];
    this.statement = "";
    this.awaitedRightDelimiter = undefined;
  }

  /**
   * Parses text and adds to the list of parsed statements if a statement is found to be completed. Note that it is expected that lines include newlines.
   *
   * @param line to parse (including ending newline)
   */
  parseMoreText(line: string): void {
    // See if it could possibly be a shell command, only valid if not in a current statement
    if (this.statementNotStarted() && ShellStatementParser.shellCmdRegExp.test(line)) {
      this.parsedStatements.push(line);
      return;
    }

    // We will guess it is cypher then
    let skipNext = false;
    let prev = "";
    let current = ""; // (char) 0;
    for (const c of line) {
      // append current
      this.statement += c;
      // last char shuffling
      prev = current;
      current = c;

      if (skipNext) {
        // This char is escaped so gets no special treatment
        skipNext = false;
        continue;
      }

      if (this.handleComments(prev, current)) {
        continue;
      }

      if (current === ShellStatementParser.backslash) {
        // backslash can escape stuff outside of comments (but inside quotes too!)
        skipNext = true;
        continue;
      }

      if (this.handleQuotes(prev, current)) {
        continue;
      }

      // Not escaped, not in a quote, not in a comment
      if (this.handleSemicolon(current)) {
        continue;
      }

      // If it's the start of a quote or comment
      this.awaitedRightDelimiter = this.getRightDelimiter(prev, current);
    }
  }

  /**
   * @param current character
   * @return true if parsing should go immediately to the next character, false otherwise
   */
  private handleSemicolon(current: string): boolean {
    if (current === ShellStatementParser.semicolon) {
      // end current statement
      this.parsedStatements.push(this.statement);
      // start a new statement
      this.statement = "";
      return true;
    }

    return false;
  }

  /**
   * @param prev    character
   * @param current character
   * @return true if parsing should go immediately to the next character, false otherwise
   */
  private handleQuotes(prev: string, current: string): boolean {
    if (this.inQuote()) {
      if (this.isRightDelimiter(prev, current)) {
        // Then end it
        this.awaitedRightDelimiter = undefined;
        return true;
      }

      // Didn't end the quote, continue
      return true;
    }

    return false;
  }

  /**
   * @param prev    character
   * @param current character
   * @return true if parsing should go immediately to the next character, false otherwise
   */
  private handleComments(prev: string, current: string): boolean {
    if (this.inComment()) {
      if (this.commentStart === ShellStatementParser.noComment) {
        // find the position of //.. or /*...
        // i.e. currentPos - 1 - 2
        this.commentStart = this.statement.length - 3;
      }

      if (this.isRightDelimiter(prev, current)) {
        // Then end it
        this.awaitedRightDelimiter = undefined;
        this.statement = this.statement.substring(0, this.commentStart);
        this.commentStart = ShellStatementParser.noComment;
        return true;
      }

      // Didn't end the comment, continue
      return true;
    }

    return false;
  }

  /**
   * @return true if inside a quote, false otherwise
   */
  private inQuote(): boolean {
    return this.awaitedRightDelimiter !== undefined && !this.inComment();
  }

  /**
   * @param first character
   * @param last  character
   * @return true if the last two chars ends the current comment, false otherwise
   */
  private isRightDelimiter(first: string, last: string): boolean {
    if (this.awaitedRightDelimiter === undefined) {
      return false;
    }

    const expectedEnd = this.awaitedRightDelimiter;

    if (expectedEnd.length === 1) {
      return expectedEnd === last;
    } else {
      return expectedEnd === first + last;
    }
  }

  /**
   * @return true if we are currently inside a comment, false otherwise
   */
  private inComment(): boolean {
    return this.awaitedRightDelimiter !== undefined &&
      (this.awaitedRightDelimiter === ShellStatementParser.lineCommentEnd ||
        this.awaitedRightDelimiter === ShellStatementParser.blockCommentEnd);
  }

  /**
   * If the last characters start a quote or a comment, this returns the piece of text which will end said quote or comment.
   *
   * @param first character
   * @param last  character
   * @return the matching right delimiter or something empty if not the start of a quote/comment
   */
  private getRightDelimiter(first: string, last: string): string | undefined {
    // double characters
    const lastTwoChars = first + last;
    switch (lastTwoChars) {
      case ShellStatementParser.lineCommentStart:
        return ShellStatementParser.lineCommentEnd;
      case ShellStatementParser.blockCommentStart:
        return ShellStatementParser.blockCommentEnd;
      default:
      // Do nothing
    }

    // single characters
    switch (last) {
      case ShellStatementParser.backtick:
      case ShellStatementParser.doubleQuote:
      case ShellStatementParser.singleQuote:
        return last;
      default:
        return undefined;
    }
  }

  /**
   * @return false if a statement has not begun (non whitespace has been seen) else true
   */
  private statementNotStarted(): boolean {
    return this.statement.trim().length === 0;
  }

  public hasStatements(): boolean {
    return this.parsedStatements.length > 0;
  }

  public consumeStatements(): string[] {
    const result = this.parsedStatements;
    this.parsedStatements = [];
    return result;
  }

  public containsText(): boolean {
    return this.statement.trim().length > 0;
  }

  public reset(): void {
    this.statement = "";
    this.parsedStatements = [];
    this.awaitedRightDelimiter = undefined;
  }
}
