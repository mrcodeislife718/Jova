import { createDocumentStore } from './language-service.js';
import { completionCandidates, quickFixes, selectionRanges, foldingRanges, renameEdits } from './editor-intelligence.js';

export function createLanguageServer(options = {}) {
  const store = options.store || createDocumentStore();

  function uriFrom(params) {
    return params?.textDocument?.uri || params?.uri;
  }

  async function handle(method, params = {}) {
    switch (method) {
      case 'initialize':
        return {
          capabilities: {
            textDocumentSync: 2,
            hoverProvider: true,
            documentSymbolProvider: true,
            completionProvider: { triggerCharacters: [':', ',', '{', '['] },
            codeActionProvider: true,
            foldingRangeProvider: true,
            selectionRangeProvider: true,
            renameProvider: { prepareProvider: false },
            diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
          },
          serverInfo: { name: 'jova-language-server', version: '0.4.0' },
        };
      case 'initialized':
      case 'shutdown':
        return null;
      case 'textDocument/didOpen': {
        const item = params.textDocument;
        store.open(item.uri, item.text, item.version);
        return null;
      }
      case 'textDocument/didChange': {
        const item = params.textDocument;
        store.update(item.uri, params.contentChanges || [], item.version);
        return null;
      }
      case 'textDocument/didClose':
        store.close(uriFrom(params));
        return null;
      case 'textDocument/diagnostic': {
        const uri = uriFrom(params);
        return { kind: 'full', items: store.diagnostics(uri) };
      }
      case 'textDocument/documentSymbol':
        return store.symbols(uriFrom(params));
      case 'textDocument/hover':
        return store.hover(uriFrom(params), params.position) ?? null;
      case 'textDocument/completion': {
        const doc = store.get(uriFrom(params));
        return doc ? { isIncomplete: !!doc.incomplete, items: completionCandidates(doc, params.position) } : { isIncomplete: false, items: [] };
      }
      case 'textDocument/codeAction': {
        const doc = store.get(uriFrom(params));
        if (!doc) return [];
        return quickFixes(doc).map((fix) => ({
          title: fix.title,
          kind: fix.kind,
          edit: { changes: { [uriFrom(params)]: [fix.edit] } },
        }));
      }
      case 'textDocument/foldingRange': {
        const doc = store.get(uriFrom(params));
        return doc ? foldingRanges(doc) : [];
      }
      case 'textDocument/selectionRange': {
        const doc = store.get(uriFrom(params));
        return doc ? selectionRanges(doc, params.positions || []) : [];
      }
      case 'textDocument/rename': {
        const uri = uriFrom(params);
        const doc = store.get(uri);
        const edits = doc ? renameEdits(doc, params.position, params.newName) : undefined;
        return edits ? { changes: { [uri]: edits } } : null;
      }
      default:
        return undefined;
    }
  }

  async function dispatch(message) {
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      return { jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'Invalid Request' } };
    }
    try {
      const result = await handle(message.method, message.params);
      if (message.id === undefined) return null;
      if (result === undefined) return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } };
      return { jsonrpc: '2.0', id: message.id, result };
    } catch (error) {
      return { jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: error.message } };
    }
  }

  return { store, handle, dispatch };
}
