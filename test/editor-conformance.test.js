import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDocumentStore,
  parseTolerant,
  completionCandidates,
  quickFixes,
  foldingRanges,
  renameEdits,
  validate,
  runConformanceSuite,
  coreConformanceCases,
} from '../src/index.js';

test('large incremental edits preserve document identity and recover after malformed edits', () => {
  const store = createDocumentStore();
  const uri = 'file:///large.scout';
  const entries = Array.from({ length: 2000 }, (_, i) => `"key${i}":${i}`);
  const source = `{${entries.join(',')}}`;
  store.open(uri, source, 1);
  const before = store.get(uri);
  const preservedId = before.ast.members[1000].value.id;
  const marker = '"key1000":1000';
  const offset = source.indexOf(marker) + marker.lastIndexOf('1000');
  const prefix = source.slice(0, offset);
  const line = prefix.split('\n').length - 1;
  const character = prefix.length - prefix.lastIndexOf('\n') - 1;
  store.update(uri, [{ range: { start: { line, character }, end: { line, character: character + 4 } }, text: '9000' }], 2);
  const after = store.get(uri);
  assert.equal(after.value.key1000, 9000);
  assert.equal(after.ast.members[1000].value.id, preservedId);
  assert.match(after.incremental.mode, /subtree|region|incremental/i);

  const broken = parseTolerant('{"service":{"port":8080,');
  assert.ok(broken.recoveryNodes.length > 0);
  assert.ok(completionCandidates(broken, { line: 0, character: broken.source.length }).length > 0);
  assert.ok(quickFixes(broken).length > 0);
});

test('editor intelligence returns folding and rename edits through public document model', () => {
  const doc = parseTolerant('{\n  "service": {\n    "port": 8080\n  }\n}');
  assert.ok(foldingRanges(doc).length >= 2);
  const edits = renameEdits(doc, { line: 1, character: 4 }, 'backend');
  assert.equal(edits.length, 1);
  assert.equal(edits[0].newText, '"backend"');
});

test('schema diagnostics reject invalid configuration and format conformance remains green', () => {
  const schema = { type: 'object', required: ['target'], properties: { target: { enum: ['web','backend','native'] } }, additionalProperties: false };
  const invalid = validate({ target: 'unsupported', extra: true }, schema);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((issue) => issue.path === '$.target'));
  assert.ok(invalid.issues.some((issue) => issue.path === '$.extra'));
  const suite = runConformanceSuite(coreConformanceCases);
  assert.equal(suite.ok, true, JSON.stringify(suite.results, null, 2));
});
