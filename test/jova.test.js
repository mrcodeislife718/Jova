import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  parse,
  parseValue,
  toJSON,
  fromJSON,
  stringify,
  serializeDocument,
  getNode,
  getMember,
  setValue,
  JovaSyntaxError,
} from '../src/index.js';

const sample = `{
  // Application identity
  "app": "JOVA",
  /* request budget */
  "timeout": 5000, // milliseconds
  "features": [true, false, null]
}`;

test('tokenizer preserves line, block, and inline comments', () => {
  const comments = tokenize(sample).filter((token) => token.type === 'comment');
  assert.equal(comments.length, 3);
  assert.deepEqual(comments.map((comment) => comment.value.style), ['line', 'block', 'line']);
  assert.ok(comments.every((comment) => comment.start.line >= 1 && comment.start.column >= 1));
});

test('parser returns JSON semantics plus a structural document AST', () => {
  const doc = parse(sample);
  assert.equal(doc.type, 'Document');
  assert.equal(doc.version, '0.2');
  assert.equal(doc.ast.type, 'Object');
  assert.deepEqual(doc.value, {
    app: 'JOVA',
    timeout: 5000,
    features: [true, false, null],
  });
  assert.equal(doc.comments.length, 3);
  assert.equal(doc.source, sample);
});

test('comments attach to the members they describe', () => {
  const doc = parse(sample);
  const app = getMember(doc, ['app']);
  const timeout = getMember(doc, ['timeout']);

  assert.equal(app.leadingComments.length, 1);
  assert.equal(app.leadingComments[0].text.trim(), 'Application identity');
  assert.equal(timeout.leadingComments.length, 1);
  assert.equal(timeout.leadingComments[0].style, 'block');
  assert.equal(timeout.trailingComments.length, 1);
  assert.equal(timeout.trailingComments[0].text.trim(), 'milliseconds');
});

test('nested comments stay attached to nested members', () => {
  const doc = parse(`{
    "database": {
      // database host
      "host": "localhost"
    }
  }`);

  const host = getMember(doc, ['database', 'host']);
  assert.equal(host.leadingComments.length, 1);
  assert.equal(host.leadingComments[0].text.trim(), 'database host');
  assert.equal(getNode(doc, ['database', 'host']).type, 'String');
});

test('document values can change without losing attached comments', () => {
  const doc = parse(sample);
  setValue(doc, ['timeout'], 6000);
  const output = serializeDocument(doc);

  assert.match(output, /"timeout": 6000, \/\/ milliseconds/);
  assert.match(output, /\/\* request budget \*\//);
  assert.match(output, /\/\/ Application identity/);
  assert.deepEqual(parseValue(output), {
    app: 'JOVA',
    timeout: 6000,
    features: [true, false, null],
  });
});

test('new object keys serialize while existing comments stay with existing keys', () => {
  const doc = parse(`{
    // stable setting
    "stable": true
  }`);
  doc.value.added = 42;
  const output = serializeDocument(doc);

  assert.match(output, /\/\/ stable setting\n  "stable": true,/);
  assert.match(output, /"added": 42/);
  assert.deepEqual(parseValue(output), { stable: true, added: 42 });
});

test('preserveSource explicitly returns the untouched original source', () => {
  const doc = parse(sample);
  setValue(doc, ['timeout'], 6000);
  assert.equal(serializeDocument(doc, { preserveSource: true }), sample);
});

test('parseValue accepts ordinary JSON', () => {
  assert.deepEqual(parseValue('{"a":[1,2,3]}'), { a: [1, 2, 3] });
});

test('conversion strips comments when converting to JSON', () => {
  assert.equal(toJSON('{/*x*/"a":1}'), '{\n  "a": 1\n}');
});

test('JSON converts to valid JOVA', () => {
  assert.equal(fromJSON('{"a":1}'), '{\n  "a": 1\n}');
});

test('stringify serializes semantic data', () => {
  assert.equal(stringify({ a: 1 }), '{\n  "a": 1\n}');
});

test('trailing commas are rejected', () => {
  assert.throws(() => parse('{"a":1,}'), JovaSyntaxError);
});

test('unterminated block comments are rejected', () => {
  assert.throws(() => tokenize('{/* nope }'), JovaSyntaxError);
});

test('invalid JSON number forms are rejected', () => {
  assert.throws(() => parse('{"x":01}'), JovaSyntaxError);
});

test('comments inside strings are not treated as comments', () => {
  const doc = parse('{"url":"https://example.com/a/*b*/"}');
  assert.equal(doc.comments.length, 0);
  assert.equal(doc.value.url, 'https://example.com/a/*b*/');
});
