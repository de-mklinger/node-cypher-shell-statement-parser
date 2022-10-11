import { ShellStatementParser } from "./index";
import {expect, test, beforeEach} from '@jest/globals';

/* eslint-disable capitalized-comments */

let parser: ShellStatementParser = new ShellStatementParser();

beforeEach(() => {
  parser = new ShellStatementParser();
});

function assertFalse(x: unknown) {
  expect(x).toBe(false);
}

function assertTrue(x: unknown) {
  expect(x).toBe(true);
}

function assertEquals(expected: unknown, actual: unknown) {
  expect(actual).toBe(expected);
}

test("parseEmptyLineDoesNothing", () => {
  // when
  parser.parseMoreText( "\n" );

  // then
  assertFalse( parser.containsText() );
  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
});

test("parseAShellCommand", () => {
  // when
  parser.parseMoreText( "  :help exit bob snob  " );

  // then
  assertFalse( parser.containsText() );
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "  :help exit bob snob  ", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
});

test("parseAShellCommandWithNewLine", () => {
  // when
  parser.parseMoreText( ":help exit bob snob\n" );

  // then
  assertFalse( parser.containsText() );
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( ":help exit bob snob\n", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
});

test("parseIncompleteCypher", () => {
  // when
  parser.parseMoreText( "CREATE ()\n" );

  // then
  assertTrue( parser.containsText() );
  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
});

test("parseCompleteCypher", () => {
  // when
  parser.parseMoreText( "CREATE (n)\n" );
  assertTrue( parser.containsText() );
  parser.parseMoreText( "CREATE ();" );
  assertFalse( parser.containsText() );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "CREATE (n)\nCREATE ();", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
});

test("parseMultipleCypherSingleLine", () => {
  // when
  parser.parseMoreText( "RETURN 1;RETURN 2;" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 2, statements.length );
  assertEquals( "RETURN 1;", statements[0] );
  assertEquals( "RETURN 2;", statements[1] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("parseMultipleCypherMultipleLine", () => {
  // when
  parser.parseMoreText( "RETURN 1;" );
  parser.parseMoreText( "RETURN 2;" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 2, statements.length );
  assertEquals( "RETURN 1;", statements[0] );
  assertEquals( "RETURN 2;", statements[1] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("singleQuotedSemicolon", () => {
  // when
  parser.parseMoreText( "hello '\n" );
  parser.parseMoreText( ";\n" );
  parser.parseMoreText( "'\n" );
  parser.parseMoreText( ";\n" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "hello '\n;\n'\n;", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("backtickQuotedSemicolon", () => {
  // when
  parser.parseMoreText( "hello `\n" );
  parser.parseMoreText( ";\n" );
  parser.parseMoreText( "`\n" );
  parser.parseMoreText( ";  \n" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "hello `\n;\n`\n;", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("doubleQuotedSemicolon", () => {
  // when
  parser.parseMoreText( "hello \"\n" );
  parser.parseMoreText( ";\n" );
  parser.parseMoreText( "\"\n" );
  parser.parseMoreText( ";   \n" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "hello \"\n;\n\"\n;", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("escapedChars", () => {
  // when
  parser.parseMoreText( "one \\;\n" );
  parser.parseMoreText( "\"two \\\"\n" );
  parser.parseMoreText( ";\n" );
  parser.parseMoreText( "\";\n" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "one \\;\n\"two \\\"\n;\n\";", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("nestedQuoting", () => {
  // when
  parser.parseMoreText( "go `tick;'single;\"double;\n" );
  parser.parseMoreText( "end`;\n" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "go `tick;'single;\"double;\nend`;", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("mixCommandAndCypherWithSpacingsAdded", () => {
  // when
  parser.parseMoreText( " :help me \n" );
  parser.parseMoreText( " cypher me up \n" );
  parser.parseMoreText( " :scotty \n" );
  parser.parseMoreText( " ; \n" );
  parser.parseMoreText( " :do it now! \n" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 3, statements.length );
  assertEquals( " :help me \n", statements[0] );
  assertEquals( " cypher me up \n :scotty \n ;", statements[1] );
  assertEquals( " :do it now! \n", statements[2] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("commentHandlingIfSemicolon", () => {
  // when
  parser.parseMoreText( " first // ;\n" );
  parser.parseMoreText( "// /* ;\n" );
  parser.parseMoreText( " third ; // actually a semicolon here\n" );

  // then
  assertTrue( parser.hasStatements() );
  assertFalse( parser.containsText() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( " first  third ;", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
});

test("backslashDeadInBlockQuote", () => {
  // when
  parser.parseMoreText( "/* block \\*/\nCREATE ();" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "\nCREATE ();", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("commentInQuote", () => {
  // when
  parser.parseMoreText( "` here // comment `;" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "` here // comment `;", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("blockCommentInQuote", () => {
  // when
  parser.parseMoreText( "` here /* comment `;" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "` here /* comment `;", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("quoteInComment", () => {
  // when
  parser.parseMoreText( "// `;\n;" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( ";", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("quoteInBlockomment", () => {
  // when
  parser.parseMoreText( "/* `;\n;*/\n;" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 1, statements.length );
  assertEquals( "\n;", statements[0] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});

test("testReset", () => {
  // given
  parser.parseMoreText( "/* `;\n;*/\n;" );
  parser.parseMoreText( "bob" );
  assertTrue( parser.hasStatements() );
  assertTrue( parser.containsText() );

  // when
  parser.reset();

  // then
  assertFalse( parser.hasStatements() );
  assertFalse( parser.containsText() );
});

test("commentsBeforeBegin", () => {
  // when
  parser.parseMoreText( "//comment \n" );
  parser.parseMoreText( ":begin\n" );
  parser.parseMoreText( "RETURN 42;\n" );
  parser.parseMoreText( ":end\n" );

  // then
  assertTrue( parser.hasStatements() );

  const statements = parser.consumeStatements();

  assertEquals( 3, statements.length );
  assertEquals( ":begin\n", statements[0] );
  assertEquals( "RETURN 42;", statements[1] );
  assertEquals( ":end\n", statements[2] );

  assertFalse( parser.hasStatements() );
  assertEquals( 0, parser.consumeStatements().length );
  assertFalse( parser.containsText() );
});
