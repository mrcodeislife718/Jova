import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { encodeMessage, MessageReader, createLanguageServer } from '../src/index.js';

test('stdio JSON-RPC framing round-trips messages across fragmented chunks', () => {
  const messages = [];
  const reader = new MessageReader((message) => messages.push(message));
  const encoded = encodeMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  reader.push(encoded.subarray(0, 11));
  reader.push(encoded.subarray(11, 29));
  reader.push(encoded.subarray(29));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].method, 'initialize');
  assert.equal(messages[0].id, 1);
});

test('language server advertises editor capabilities', async () => {
  const server = createLanguageServer();
  const response = await server.dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(response.result.capabilities.textDocumentSync, 2);
  assert.equal(response.result.capabilities.hoverProvider, true);
  assert.equal(response.result.capabilities.renameProvider.prepareProvider, false);
  assert.ok(response.result.capabilities.completionProvider);
  assert.equal(response.result.serverInfo.name, 'scout-language-server');
});

test('VS Code extension registers the .scout file extension', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../vscode-extension/package.json', import.meta.url), 'utf8'));
  const language = manifest.contributes.languages.find((item) => item.id === 'scout');
  assert.ok(language);
  assert.ok(language.extensions.includes('.scout'));
  assert.equal(manifest.activationEvents.includes('onLanguage:scout'), true);
});

test('VS Code grammar is bound to the Scout language', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../vscode-extension/package.json', import.meta.url), 'utf8'));
  const grammar = manifest.contributes.grammars.find((item) => item.language === 'scout');
  assert.equal(grammar.scopeName, 'source.scout');
  assert.equal(grammar.path, './syntaxes/scout.tmLanguage.json');
});
