# Scout

**JSON with comments — designed for configuration, readable by humans, predictable for machines.**

Scout keeps JSON's familiar data model while adding native comments, lossless document editing, resilient parsing, and editor tooling.

```scout
{
  // Application configuration
  "app": {
    "name": "My Application",
    "version": "1.0.0"
  },

  // Production database settings
  "database": {
    "host": "localhost",
    "port": 5432
  }
}
```

> Keep the parts of JSON that made it universal while making configuration files easier to explain, maintain, and work with.

## Why Scout?

JSON is excellent for structured data, but configuration and machine-readable documents often need human context. Scout lets documentation live beside the values it explains without turning configuration into executable code.

## Core guarantees

- Every valid JSON document remains valid Scout syntax.
- Scout preserves the JSON value model: object, array, string, number, boolean, and null.
- `//` line comments and `/* ... */` block comments are native syntax.
- Comments never become ordinary application data unless a consumer explicitly inspects document metadata.
- Parsing never executes code.
- Scout can be converted to standard JSON by removing comment syntax while preserving semantic values.
- Strict parsing and recovery-oriented editor parsing remain separate.

## Comment syntax

```scout
{
  // Single-line comment
  "api": "https://example.com",

  /* Block comment */
  "retries": 3,

  "timeout": 5000 // Inline comment
}
```

## Design principles

**Familiar.** If you know JSON, you already understand basic Scout.

**Minimal.** Scout does not become a programming language disguised as configuration.

**Predictable.** The same document has the same semantic meaning across conforming implementations.

**Human-readable.** Comments and formatting can carry context beside structured values.

**Machine-friendly.** Scout preserves JSON-compatible semantic data.

**Tooling-first.** The document model preserves source ranges, comments, trivia, and syntax identity for editors and automated modification.

## Data model

```scout
{
  "name": "Scout",
  "active": true,
  "version": 1,
  "tags": ["data", "configuration", "developer-tools"],
  "metadata": null
}
```

## Scout vs JSON

| Capability | JSON | Scout |
|---|---:|---:|
| Objects | ✓ | ✓ |
| Arrays | ✓ | ✓ |
| Strings | ✓ | ✓ |
| Numbers | ✓ | ✓ |
| Booleans | ✓ | ✓ |
| Null | ✓ | ✓ |
| Single-line comments | ✗ | ✓ |
| Block comments | ✗ | ✓ |
| Inline comments | ✗ | ✓ |
| Lossless document tooling | Limited | ✓ |
| Recovery-aware editor parsing | Limited | ✓ |

Scout is not intended to replace JSON as a universal interchange format. Its focus is structured configuration and documents where humans, software, and development tools need to work with the same source.

## File extension

Scout documents use:

```text
.scout
```

Examples:

```text
app.scout
config.scout
settings.scout
manifest.scout
```

## CLI

The package exposes two binaries:

```text
scout
scout-lsp
```

Current CLI workflows:

```bash
scout parse config.scout
scout validate config.scout
scout format config.scout
scout to-json config.scout
scout from-json config.json
```

The language server can be started with:

```bash
npm run lsp
```

or:

```bash
scout-lsp
```

## Architecture

```text
Scout Source (.scout)
      │
      ▼
Tokenizer + Lossless Lexer
      │
      ▼
Strict Parser / Recovery Parser
      │
      ▼
Scout Document Model
      │
      ├── JSON-equivalent semantic value
      ├── AST
      ├── comments
      ├── lossless tokens
      ├── source ranges
      └── persistent syntax identity
      │
      ▼
Transactions + Incremental Reparse
      │
      ▼
Formatter / Serializer / Editor Intelligence / LSP
```

## Current implementation

Scout 0.4.2 includes:

- strict parsing of JSON-compatible values plus native comments
- lossless tokens and source preservation
- comment attachment metadata
- source-oriented editing
- edit transactions, undo, and redo
- persistent syntax identity reconciliation
- regional incremental reparsing and regional token reuse
- tolerant recovery parsing for malformed intermediate editing states
- mixed valid/recovery syntax trees
- diagnostics and expected-token/value information
- completion candidates and quick fixes
- hover, document symbols, folding, selection ranges, and property rename edits
- recovery-aware document synchronization
- runnable stdio JSON-RPC Language Server Protocol transport
- VS Code language support for `.scout`

## VS Code

The VS Code extension registers:

```text
Language ID: scout
Extension:   .scout
Scope:       source.scout
```

See [`VSCODE.md`](./VSCODE.md) for packaging and editor integration details.

## Specification

The current grammar and implementation contract live in [`SPEC.md`](./SPEC.md).

## What Scout is not

Scout is not intended to become:

- a scripting language
- a template engine
- an executable configuration system
- an environment-variable runtime
- a replacement for every serialization format
- JSON plus an unlimited collection of unrelated syntax extensions

Scout's value depends on staying understandable and deterministic.

## Project status

**Active development — version 0.4.2.**

The parser, lossless document model, incremental editing system, recovery architecture, LSP transport, and VS Code integration are implemented. The format is still pre-1.0, so compatibility guarantees may continue to evolve until the stable specification is frozen.

## License

MIT

---

**Scout**

*Structured for machines. Documented for humans.*
