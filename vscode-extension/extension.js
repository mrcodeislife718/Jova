const path = require('node:path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(path.join('..', 'src', 'lsp-stdio.js'));
  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };
  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'jova' }, { scheme: 'untitled', language: 'jova' }],
    synchronize: { fileEvents: [] },
  };
  client = new LanguageClient('jovaLanguageServer', 'JOVA Language Server', serverOptions, clientOptions);
  context.subscriptions.push(client.start());
}

async function deactivate() {
  if (client) await client.stop();
}

module.exports = { activate, deactivate };
