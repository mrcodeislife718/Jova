const assert = require('node:assert/strict');
const vscode = require('vscode');

async function waitFor(predicate, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('timed out waiting for VS Code language-server result');
}

async function run() {
  const extension = vscode.extensions.getExtension('mrcodeislife718.scout-language-support');
  assert.ok(extension, 'Scout extension must be installed in the extension host');
  await extension.activate();
  assert.equal(extension.isActive, true);

  const document = await vscode.workspace.openTextDocument({
    language: 'scout',
    content: '{"service":{"port":8080}}',
  });
  await vscode.window.showTextDocument(document);

  const completions = await waitFor(async () => {
    const result = await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      document.uri,
      new vscode.Position(0, 25),
    );
    return result?.items?.length ? result : null;
  });
  assert.ok(completions.items.length > 0);

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(0, 0, 0, document.getText().length), '{"service":');
  await vscode.workspace.applyEdit(edit);

  const diagnostics = await waitFor(async () => {
    const items = vscode.languages.getDiagnostics(document.uri);
    return items.length ? items : null;
  });
  assert.ok(diagnostics.some((item) => item.severity === vscode.DiagnosticSeverity.Error));
}

module.exports = { run };
