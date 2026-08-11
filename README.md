# Scout

**JSON you can actually write.**

Scout is a human-friendly, JSON-compatible structured-data format for configuration, manifests, tooling, and machine-readable documents. Scout keeps JSON's familiar value model while adding the two authoring features developers repeatedly need: **native comments** and **trailing commas**.

```scout
{
  // Application configuration
  "app": {
    "name": "My Application",
    "version": "1.0.0",
  },

  /* Production database settings */
  "database": {
    "host": "localhost",
    "port": 5432,
  },
}
```

Scout files use the **`.scout`** extension.

## What Scout is

Scout is a data format, not a programming language. A `.scout` document is never executable simply because it is Scout. Parsing Scout produces ordinary JSON-compatible values plus optional document metadata for comments, source positions, formatting, and editor tooling.

Scout is designed around six guarantees:

- Every valid JSON document is valid Scout syntax.
- Scout preserves the JSON value model: object, array, string, number, boolean, and null.
- `//` line comments and `/* ... */` block comments are native syntax.
- Objects and arrays may contain a trailing comma before their closing delimiter.
- Comments and trailing commas never change the resulting semantic data value.
- Parsing Scout never executes code.

## Comments

### Line comments

```scout
{
  // Public API endpoint
  "api": "https://example.com",
}
```

### Block comments

```scout
{
  /* Retry temporary network failures. */
  "retries": 3,
}
```

### Inline comments

```scout
{
  "timeout": 5000 // milliseconds
}
```

Comments are syntax metadata. They do not become application properties unless a consumer explicitly requests the lossless document representation.

## Trailing commas

Scout permits a single trailing comma after the final object member or array element:

```scout
{
  "name": "Scout",
  "version": 1,
}
```

```scout
[
  "web",
  "apps",
  "ai",
]
```

The semantic values are equivalent to the corresponding JSON documents without those trailing commas.

## Data model

Scout deliberately keeps JSON's small data model:

```text
object
array
string
number
boolean
null
```

Scout does not add executable expressions, functions, imports, environment-variable expansion, implicit references, or arbitrary type coercion to the core format.

## Scout vs JSON

| Capability | JSON | Scout |
|---|---:|---:|
| Objects | ✓ | ✓ |
| Arrays | ✓ | ✓ |
| Strings | ✓ | ✓ |
| Numbers | ✓ | ✓ |
| Booleans | ✓ | ✓ |
| Null | ✓ | ✓ |
| `//` comments | ✗ | ✓ |
| `/* ... */` comments | ✗ | ✓ |
| Inline comments | ✗ | ✓ |
| Trailing commas | ✗ | ✓ |
| JSON-compatible semantic values | ✓ | ✓ |
| Executable syntax | ✗ | ✗ |
| Lossless document tooling | Limited | ✓ |
| Recovery-aware editor parsing | Limited | ✓ |

## Why Scout exists

JSON is excellent for interchange. Humans also use JSON for configuration, manifests, project settings, deployment metadata, AI configuration, tooling, infrastructure, application settings, and machine-readable documents. Those files often need explanation and frequent editing.

Scout keeps the JSON mental model while making authoring safer and less frustrating.

## File extension

```text
.scout
```

Examples:

```text
app.scout
config.scout
package.scout
build.scout
model.scout
settings.scout
manifest.scout
```

## JSON interoperability

Scout is intended to move cleanly into ordinary JSON whenever a consumer does not understand Scout-specific syntax.

```bash
scout to-json config.scout
```

Comments and trailing commas are removed. Semantic values are preserved.

Ordinary JSON can also enter the Scout ecosystem directly because every valid JSON document is valid Scout.

```bash
scout from-json config.json
```

## CLI

The package exposes:

```text
scout
scout-lsp
```

Core data-format workflows:

```bash
scout parse config.scout
scout validate config.scout
scout format config.scout
scout to-json config.scout
scout from-json config.json
```

The language server can run with:

```bash
npm run lsp
```

or:

```bash
scout-lsp
```

## Architecture

```text
.scout source
     │
     ▼
Tokenizer + lossless lexer
     │
     ▼
Strict parser ───────── Recovery parser
     │                         │
     └────────────┬────────────┘
                  ▼
          Scout Document Model
                  │
       ┌──────────┼───────────┐
       ▼          ▼           ▼
 JSON value     AST       comments/trivia
       │          │           │
       └──────────┼───────────┘
                  ▼
       source-preserving edits
                  │
                  ▼
 formatter / serializer / LSP
```

## Lossless document model

Scout tooling can preserve more than the final data value. The document representation can retain:

- exact source text
- comments
- whitespace trivia
- raw scalar spellings
- raw quoted keys
- property order
- source ranges
- token identity
- syntax-node identity
- trailing-comma presence

This lets tools update one value without unnecessarily destroying surrounding human context or reformatting unrelated source.

## Editor recovery

Developers create temporarily invalid text while typing. Scout therefore keeps strict parsing separate from recovery-oriented parsing.

For example:

```scout
{
  "database": {
    "host":
  },
}
```

Strict parsing rejects this. Editor recovery can still retain useful structure, identify the missing value, provide diagnostics, and keep editor features stable until the document becomes valid again.

Invalid Scout never silently becomes valid application data.

## LSP and editor tooling

The Scout language service and LSP foundation support features such as:

- diagnostics
- completion candidates
- quick fixes
- hover information
- document symbols
- folding ranges
- selection ranges
- property rename edits
- incremental synchronization
- malformed-edit recovery

VS Code currently registers:

```text
Language ID: scout
Extension:   .scout
Scope:       source.scout
```

See [`VSCODE.md`](./VSCODE.md).

## Intended use cases

Scout is suitable anywhere structured JSON-like data benefits from human explanation and editing, including:

- application configuration
- project manifests
- package/build configuration
- web tooling
- server configuration
- AI and model configuration
- IoT device configuration
- embedded-system manifests
- robotics configuration
- automotive and simulation configuration
- infrastructure and deployment metadata
- developer tools
- machine-readable documents

Those domains may use Scout for data even when the software consuming the document is written in another language.

## Design laws

**JSON familiarity first.** If you know JSON, you already understand the Scout value model.

**Human context without execution.** Comments explain data; they do not execute.

**Minimal syntax.** Scout does not become a programming language disguised as configuration.

**Deterministic semantics.** The same valid Scout document has the same data meaning across conforming implementations.

**Interop, not lock-in.** Scout always has a clean path to ordinary JSON.

**Tooling is part of the format experience.** Lossless parsing, diagnostics, formatting, schemas, and editor support matter as much as grammar.

## What Scout is not

Scout is not:

- a scripting language
- a general-purpose programming language
- a template language
- an executable configuration runtime
- an environment-variable engine
- a shell
- a replacement for every serialization format
- a dumping ground for unrelated syntax extensions

Keeping that boundary protects Scout's predictability and portability.

## Specification

The current grammar and implementation contract live in [`SPEC.md`](./SPEC.md).

## Project status

Scout is under active pre-1.0 development. The implementation includes strict and recovery parsing, lossless syntax, source-oriented editing, incremental reparsing, diagnostics, editor intelligence, stdio LSP transport, VS Code support, native comments, and trailing-comma parsing.

The stable 1.0 specification should be frozen only after the grammar, implementation, conformance suite, formatter, and editor behavior agree.

## License

MIT

---

**Scout** — *Structured for machines. Documented for humans.*
