import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  tokenizeLossless,
  parse,
  parseValue,
  toJSON,
  fromJSON,
  stringify,
  serializeDocument,
  getNode,
  getMember,
  setValue,
  rawSlice,
  replaceValue,
  renameMember,
  removeValue,
  insertMember,
  insertElement,
  createEditSession,
  beginTransaction,
  addTextEdit,
  commitTransaction,
  rollbackTransaction,
  undo,
  redo,
  reparseIncremental,
  smallestReparseRegion,
  reconcileSyntaxIdentity,
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
});

test('parser returns JOVA 0.4 document with lossless AST', () => {
  const doc = parse(sample);
  assert.equal(doc.type, 'Document');
  assert.equal(doc.version, '0.4');
  assert.equal(doc.revision, 0);
  assert.equal(doc.ast.type, 'Object');
  assert.ok(doc.ast.id);
  assert.ok(doc.tokens.length > 0);
  assert.deepEqual(doc.value, { app: 'JOVA', timeout: 5000, features: [true, false, null] });
});

test('lossless tokens reconstruct source byte for byte', () => {
  const tokens = tokenizeLossless(sample);
  assert.equal(tokens.filter((token) => token.type !== 'eof').map((token) => token.raw).join(''), sample);
  assert.equal(new Set(tokens.map((token) => token.id)).size, tokens.length);
});

test('raw literals and property order are retained', () => {
  const doc = parse('{"z":1e2,"a":"x\\n"}');
  assert.deepEqual(doc.ast.members.map((member) => member.key), ['z', 'a']);
  assert.equal(getNode(doc, ['z']).raw, '1e2');
  assert.equal(rawSlice(doc, getNode(doc, ['a'])), '"x\\n"');
});

test('comments attach to members they describe', () => {
  const doc = parse(sample);
  const app = getMember(doc, ['app']);
  const timeout = getMember(doc, ['timeout']);
  assert.equal(app.leadingComments[0].text.trim(), 'Application identity');
  assert.equal(timeout.leadingComments[0].style, 'block');
  assert.equal(timeout.trailingComments[0].text.trim(), 'milliseconds');
});

test('nested comments stay attached to nested members', () => {
  const doc = parse('{"database":{// host\n"host":"localhost"}}');
  const host = getMember(doc, ['database', 'host']);
  assert.equal(host.leadingComments[0].text.trim(), 'host');
});

test('lossless replace changes only selected value bytes', () => {
  const doc = parse('{  "a" : 1, // keep\n\t"b":2 }');
  replaceValue(doc, ['b'], 300);
  assert.equal(doc.source, '{  "a" : 1, // keep\n\t"b":300 }');
  assert.deepEqual(doc.value, { a: 1, b: 300 });
});

test('lossless rename changes only quoted key token', () => {
  const doc = parse('{ "old"  : 1 }');
  renameMember(doc, ['old'], 'new');
  assert.equal(doc.source, '{ "new"  : 1 }');
  assert.deepEqual(doc.value, { new: 1 });
});

test('insert and remove object members produce valid JOVA', () => {
  const doc = parse('{\n  "a": 1\n}');
  insertMember(doc, [], 'b', 2);
  removeValue(doc, ['a']);
  assert.deepEqual(doc.value, { b: 2 });
  assert.deepEqual(parseValue(doc.source), { b: 2 });
});

test('array insertion preserves semantics', () => {
  const doc = parse('[1, 3]');
  insertElement(doc, [], 1, 2);
  assert.deepEqual(doc.value, [1, 2, 3]);
});

test('canonical serializer retains attached comments after semantic edit', () => {
  const doc = parse(sample);
  setValue(doc, ['timeout'], 6000);
  const output = serializeDocument(doc);
  assert.match(output, /"timeout": 6000, \/\/ milliseconds/);
  assert.match(output, /\/\* request budget \*\//);
});

test('smallest reparse region selects a scalar when edit is inside scalar', () => {
  const source = '{"outer":{"value":12345,"other":true}}';
  const doc = parse(source);
  const start = source.indexOf('12345');
  const region = smallestReparseRegion(doc, [{ start, end: start + 5, text: '9' }]);
  assert.deepEqual(region.path, ['outer', 'value']);
  assert.equal(region.type, 'Number');
});

test('incremental reparse updates only smallest semantic subtree', () => {
  const source = '{"outer":{"value":12345,"other":true},"stable":"yes"}';
  const doc = parse(source);
  const stableId = getNode(doc, ['stable']).id;
  const valueId = getNode(doc, ['outer', 'value']).id;
  const start = source.indexOf('12345');
  reparseIncremental(doc, [{ start, end: start + 5, text: '9' }]);
  assert.equal(doc.value.outer.value, 9);
  assert.equal(getNode(doc, ['outer', 'value']).id, valueId);
  assert.equal(getNode(doc, ['stable']).id, stableId);
  assert.equal(doc.incremental.mode, 'subtree-region');
  assert.deepEqual(doc.incremental.path, ['outer', 'value']);
  assert.ok(doc.incremental.reparsedBytes < doc.incremental.totalBytes);
});

test('transaction commits atomically and records change ranges', () => {
  const source = '{"a":1,"b":2}';
  const doc = parse(source);
  const session = createEditSession(doc);
  const tx = beginTransaction(session, 'change both values');
  addTextEdit(tx, source.indexOf('1'), source.indexOf('1') + 1, '10');
  addTextEdit(tx, source.lastIndexOf('2'), source.lastIndexOf('2') + 1, '20');
  commitTransaction(tx);
  assert.deepEqual(doc.value, { a: 10, b: 20 });
  assert.equal(doc.revision, 1);
  assert.equal(doc.lastChangeRanges.length, 2);
  assert.equal(session.undoStack.length, 1);
});

test('rollback leaves document untouched', () => {
  const doc = parse('{"a":1}');
  const session = createEditSession(doc);
  const tx = beginTransaction(session);
  addTextEdit(tx, 5, 6, '2');
  rollbackTransaction(tx);
  assert.deepEqual(doc.value, { a: 1 });
  assert.equal(doc.source, '{"a":1}');
});

test('undo and redo restore transactional document states', () => {
  const doc = parse('{"a":1}');
  const session = createEditSession(doc);
  const tx = beginTransaction(session);
  addTextEdit(tx, 5, 6, '2');
  commitTransaction(tx);
  assert.deepEqual(doc.value, { a: 2 });
  undo(session);
  assert.deepEqual(doc.value, { a: 1 });
  redo(session);
  assert.deepEqual(doc.value, { a: 2 });
});

test('identity reconciliation preserves IDs across rename and scalar changes', () => {
  const before = parse('{"old":1,"stable":true}');
  const memberId = getMember(before, ['old']).id;
  const valueId = getNode(before, ['old']).id;
  const next = parse('{"new":2,"stable":true}');
  reconcileSyntaxIdentity(before, next);
  assert.equal(getMember(next, ['new']).id, memberId);
  assert.equal(getNode(next, ['new']).id, valueId);
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

test('Scout 0.4 accepts object and array trailing commas', () => {
  assert.deepEqual(parseValue('{"a":1,}'), { a: 1 });
  assert.deepEqual(parseValue('[1,2,]'), [1, 2]);
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
});
