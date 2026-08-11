# JOVA for VS Code

JOVA files use the **`.jova`** extension.

The repository contains a VS Code extension under `vscode-extension/` and a runnable language server under `src/lsp-stdio.js`.

## Language registration

The extension registers:

- Language ID: `jova`
- File extension: `.jova`
- TextMate scope: `source.jova`
- Line comments: `//`
- Block comments: `/* ... */`

Opening any `*.jova` file activates JOVA language support.

## Editor features

The extension connects to the JOVA language server and exposes the current language-engine capabilities:

- resilient diagnostics while typing
- completion candidates
- quick fixes
- hover information
- document symbols
- folding ranges
- selection ranges
- property rename edits
- incremental document synchronization
- mixed valid/recovery syntax trees for malformed intermediate documents

## Language server

From the repository root:

```bash
npm run lsp
```

or, after installing the package binary:

```bash
jova-lsp
```

The server uses Language Server Protocol JSON-RPC framing over stdio with `Content-Length` headers.

## Prepare the VS Code extension

The extension package must contain its own copy of the server source. From `vscode-extension/`:

```bash
npm install
npm run prepare-server
```

`vscode:prepublish` runs the same preparation step automatically before VSIX packaging.

To package the extension:

```bash
npx vsce package
```

The resulting VSIX can be installed into VS Code and will activate for `.jova` files.

## Architecture

```text
.jova file
   ↓
VS Code language registration + TextMate grammar
   ↓
vscode-languageclient
   ↓
stdio JSON-RPC / LSP transport
   ↓
JOVA language server dispatcher
   ↓
recovery-aware document store
   ↓
incremental parser + lossless syntax + editor intelligence
```
