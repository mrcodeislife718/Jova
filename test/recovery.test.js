import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  parseTolerant,
  createDocumentStore,
  isRecoveryNode,
} from '../src/index.js';

test('parseTolerant returns an incomplete document with recovery metadata', () => {
  const source = '{\n  "database": {\n    "host":\n  }\n}';
  const doc = parseTolerant(source);
  assert.equal(doc.incomplete, true);
  assert.equal(doc.source, source);
  assert.ok(doc.recoveryNodes.length >= 1);
  assert.ok(isRecoveryNode(doc.recoveryNodes[0]));
  assert.ok(doc.diagnostics[0].expected.includes('string'));
});

test('parseTolerant keeps the last valid AST and value during an incomplete edit', () => {
  const valid = parse('{"database":{"host":"localhost"},"port":5432}');
  const hostId = valid.ast.members.find((member) => member.key === 'database').value.members.find((member) => member.key === 'host').id;
  const broken = parseTolerant('{"database":{"host":},"port":5432}', valid);
  assert.equal(broken.incomplete, true);
  assert.deepEqual(broken.value, valid.value);
  const retainedHostId = broken.ast.members.find((member) => member.key === 'database').value.members.find((member) => member.key === 'host').id;
  assert.equal(retainedHostId, hostId);
});

test('document store survives malformed intermediate typing and recovers when syntax becomes valid', () => {
  const store = createDocumentStore();
  const uri = 'file:///config.jova';
  store.open(uri, '{\n  "host": "localhost"\n}', 1);

  store.update(uri, [{
    range: { start: { line: 1, character: 10 }, end: { line: 1, character: 21 } },
    text: '',
  }], 2);

  const broken = store.get(uri);
  assert.equal(broken.incomplete, true);
  assert.ok(store.diagnostics(uri).length >= 1);
  assert.ok(store.symbols(uri).some((symbol) => symbol.name === 'host'));

  store.update(uri, [{
    range: { start: { line: 1, character: 10 }, end: { line: 1, character: 10 } },
    text: '"production"',
  }], 3);

  const recovered = store.get(uri);
  assert.equal(recovered.incomplete, false);
  assert.equal(recovered.value.host, 'production');
  assert.deepEqual(store.diagnostics(uri), []);
});

test('unterminated block comments expose a concrete expected token', () => {
  const doc = parseTolerant('{ /* still typing');
  assert.equal(doc.incomplete, true);
  assert.ok(doc.diagnostics[0].expected.includes('*/'));
});
