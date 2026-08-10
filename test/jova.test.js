import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  parse,
  parseValue,
  toJSON,
  fromJSON,
  stringify,
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

test('parser returns JSON semantics plus preserved comments', () => {
  const doc = parse(sample);
  assert.deepEqual(doc.value, {
    app: 'JOVA',
    timeout: 5000,
    features: [true, false, null],
  });
  assert.equal(doc.comments.length, 3);
  assert.equal(doc.source, sample);
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
