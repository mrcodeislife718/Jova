import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  parseTolerant,
  parseRecovering,
  createDocumentStore,
  completionCandidates,
  quickFixes,
  createLanguageServer,
} from '../src/index.js';

test('mixed recovery tree preserves valid siblings around a damaged value', () => {
  const source = `{
    "before": 1,
    "broken":,
    "after": 3
  }`;
  const doc = parseTolerant(source);
  assert.equal(doc.incomplete, true);
  assert.equal(doc.recoveryMode, 'mixed-tree');
  assert.equal(doc.value.before, 1);
  assert.equal(doc.value.after, 3);
  const broken = doc.ast.members.find((member) => member.key === 'broken');
  assert.equal(broken.value.type, 'Recovery');
  assert.ok(doc.diagnostics.length >= 1);
});

test('recovery parser reports multiple independent errors and resumes at synchronization points', () => {
  const source = `{
    "first":,
    nope,
    "last": true
  }`;
  const doc = parseRecovering(source);
  assert.equal(doc.incomplete, true);
  assert.ok(doc.diagnostics.length >= 2);
  assert.equal(doc.value.last, true);
  assert.ok(doc.recoveryNodes.length >= 2);
});

test('nested damaged object retains later valid members', () => {
  const source = `{
    "database": {
      "host":,
      "port": 5432,
      "ssl": true
    },
    "outside": "ok"
  }`;
  const doc = parseTolerant(source);
  const database = doc.ast.members.find((m) => m.key === 'database').value;
  assert.equal(database.type, 'Object');
  assert.equal(doc.value.database.port, 5432);
  assert.equal(doc.value.database.ssl, true);
  assert.equal(doc.value.outside, 'ok');
});

test('editor store survives malformed edits and restores strict parsing when repaired', () => {
  const store = createDocumentStore();
  const uri = 'file:///config.scout';
  store.open(uri, '{"host":"localhost","port":5432}', 1);
  store.update(uri, [{ range: { start: { line:0, character:8 }, end:{ line:0, character:19 } }, text:'' }], 2);
  const damaged = store.get(uri);
  assert.equal(damaged.incomplete, true);
  assert.ok(store.diagnostics(uri).length > 0);
  assert.ok(store.symbols(uri).some((symbol) => symbol.name === 'port'));
  store.update(uri, [{ range: { start:{ line:0, character:8 }, end:{ line:0, character:8 } }, text:'"localhost"' }], 3);
  assert.equal(store.get(uri).incomplete, false);
  assert.deepEqual(parse(store.get(uri).source).value, { host:'localhost', port:5432 });
});

test('recovery state drives completions and quick fixes', () => {
  const source = '{"host":}';
  const doc = parseTolerant(source);
  const completions = completionCandidates(doc, { line:0, character:8 });
  assert.ok(completions.some((item) => item.label === 'null'));
  assert.ok(quickFixes(doc).some((fix) => fix.title.includes('null')));
});

test('LSP dispatcher exposes diagnostics, symbols, completion and rename', async () => {
  const server = createLanguageServer();
  const init = await server.dispatch({ jsonrpc:'2.0', id:1, method:'initialize', params:{} });
  assert.equal(init.result.serverInfo.name, 'scout-language-server');
  await server.dispatch({ jsonrpc:'2.0', method:'textDocument/didOpen', params:{ textDocument:{ uri:'file:///x.scout', version:1, text:'{"host":,"port":1}' } } });
  const diagnostics = await server.dispatch({ jsonrpc:'2.0', id:2, method:'textDocument/diagnostic', params:{ textDocument:{ uri:'file:///x.scout' } } });
  assert.ok(diagnostics.result.items.length > 0);
  const symbols = await server.dispatch({ jsonrpc:'2.0', id:3, method:'textDocument/documentSymbol', params:{ textDocument:{ uri:'file:///x.scout' } } });
  assert.ok(symbols.result.some((symbol) => symbol.name === 'port'));
  const completion = await server.dispatch({ jsonrpc:'2.0', id:4, method:'textDocument/completion', params:{ textDocument:{ uri:'file:///x.scout' }, position:{ line:0, character:8 } } });
  assert.ok(completion.result.items.length > 0);
});
