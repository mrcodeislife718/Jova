import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, reparseIncremental } from '../src/index.js';

test('incremental lexing preserves token IDs outside edited region', () => {
  const source = '{"a":1,"b":222,"c":3}';
  const doc = parse(source);
  const beforeA = doc.tokens.find((token) => token.raw === '1').id;
  const beforeC = doc.tokens.find((token) => token.raw === '3').id;
  const start = source.indexOf('222');

  reparseIncremental(doc, [{ start, end: start + 3, text: '9999' }]);

  assert.equal(doc.tokens.find((token) => token.raw === '1').id, beforeA);
  assert.equal(doc.tokens.find((token) => token.raw === '3').id, beforeC);
  assert.equal(doc.value.b, 9999);
  assert.equal(doc.incremental.relexedBytes, 4);
  assert.ok(doc.incremental.relexedBytes < doc.incremental.totalBytes);
});

test('incremental token stream still reconstructs exact source', () => {
  const source = '{  "a": 1,\n  // keep\n  "b": 2\n}';
  const doc = parse(source);
  const start = source.lastIndexOf('2');
  reparseIncremental(doc, [{ start, end: start + 1, text: '200' }]);
  const rebuilt = doc.tokens.filter((token) => token.type !== 'eof').map((token) => token.raw).join('');
  assert.equal(rebuilt, doc.source);
  assert.match(rebuilt, /\/\/ keep/);
});
