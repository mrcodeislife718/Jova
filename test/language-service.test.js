import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocumentStore,
  validateText,
  documentSymbols,
  hoverAt,
  parse,
} from '../src/index.js';

test('language service store opens and updates Scout documents incrementally', () => {
  const store = createDocumentStore();
  const uri = 'file:///config.scout';
  store.open(uri, '{"timeout":5000,"mode":"dev"}', 1);
  const before = store.get(uri);
  const timeoutId = before.ast.members[0].value.id;

  store.update(uri, [{
    range: { start: { line: 0, character: 11 }, end: { line: 0, character: 15 } },
    text: '6000',
  }], 2);

  const after = store.get(uri);
  assert.equal(after.value.timeout, 6000);
  assert.equal(store.version(uri), 2);
  assert.equal(after.ast.members[0].value.id, timeoutId);
  assert.equal(after.incremental.mode, 'subtree-region');
});

test('language service exposes document symbols', () => {
  const doc = parse('{"database":{"host":"localhost"},"debug":true}');
  const symbols = documentSymbols(doc);
  assert.equal(symbols.length, 2);
  assert.equal(symbols[0].name, 'database');
  assert.equal(symbols[0].children[0].name, 'host');
  assert.ok(symbols[0].jovaNodeId);
});

test('language service hover identifies Scout tokens', () => {
  const doc = parse('{"enabled":true}');
  const hover = hoverAt(doc, { line: 0, character: 11 });
  assert.match(hover.contents.value, /JOVA boolean/);
});

test('validateText accepts Scout 0.4 trailing commas and diagnoses malformed values', () => {
  assert.deepEqual(validateText('{"a":1,}'), []);
  const diagnostics = validateText('{"a":}');
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].source, 'jova');
  assert.equal(diagnostics[0].severity, 1);
});

test('document store closes documents', () => {
  const store = createDocumentStore();
  store.open('file:///x.scout', '{"x":1}');
  assert.equal(store.close('file:///x.scout'), true);
  assert.equal(store.get('file:///x.scout'), undefined);
});
