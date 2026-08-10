# JOVA

**JSON with comments — designed for configuration, readable by humans, predictable for machines.**

JOVA is a data format built from the simplicity and familiarity of JSON while adding something developers routinely need:

**native comments.**

```jova
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

The goal is simple:

> Keep the parts of JSON that made it universal while making configuration files easier to explain, maintain, and work with.

---

## Why JOVA?

JSON is excellent for exchanging structured data.

But developers also use JSON for:

- configuration
- manifests
- project settings
- application metadata
- infrastructure configuration
- tooling
- development environments
- machine-readable documents

Those files often need something ordinary JSON deliberately does not provide:

**comments.**

Developers should be able to explain *why* a value exists without maintaining a separate document or inventing metadata fields purely to hold human notes.

JOVA is being built around that problem.

---

## The Core Idea

Valid JSON:

```json
{
  "environment": "production",
  "port": 3000
}
```

JOVA:

```jova
{
  // Runtime environment
  "environment": "production",

  // HTTP server port
  "port": 3000
}
```

The data remains structurally familiar.

The document becomes easier for humans to understand.

---

## Comment Syntax

JOVA is designed to support familiar comment syntax.

### Single-line comments

```jova
{
  // Public API endpoint
  "api": "https://example.com"
}
```

### Block comments

```jova
{
  /*
   * Retry requests when a temporary
   * network failure occurs.
   */
  "retries": 3
}
```

### Inline comments

```jova
{
  "timeout": 5000 // milliseconds
}
```

---

## Design Principles

JOVA development follows several core principles.

### Familiar

A developer who understands JSON should be able to understand a basic JOVA document immediately.

### Minimal

JOVA should not become a programming language disguised as a configuration format.

New syntax must justify its existence.

### Predictable

The same document should have the same meaning regardless of the implementation reading it.

### Human-readable

Documentation can live beside the values it explains.

### Machine-friendly

Comments should not make the underlying structured data ambiguous.

### Portable

The format should eventually be practical to implement across programming languages and development environments.

---

## Data Model

JOVA begins with the familiar JSON data model:

- Object
- Array
- String
- Number
- Boolean
- Null

Example:

```jova
{
  "name": "JOVA",
  "active": true,
  "version": 1,
  "tags": [
    "data",
    "configuration",
    "developer-tools"
  ],
  "metadata": null
}
```

Comments provide human context without becoming ordinary application data.

---

## Example

```jova
{
  // Application identity
  "application": {
    "name": "Example",
    "environment": "production"
  },

  /*
   * Server configuration.
   *
   * Keep this section synchronized with
   * the deployment environment.
   */
  "server": {
    "host": "0.0.0.0",
    "port": 8080,

    // Request timeout in milliseconds
    "timeout": 5000
  },

  // Feature controls
  "features": {
    "logging": true,
    "analytics": false
  }
}
```

---

## JOVA vs JSON

| Capability | JSON | JOVA |
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
| Human annotations | Limited | ✓ |

JOVA is not intended to replace JSON as a universal interchange format.

Its initial focus is the places where developers need **structured data and human explanation in the same document**.

---

## Intended Uses

JOVA is being designed for use cases such as:

```text
app.jova
config.jova
settings.jova
manifest.jova
environment.jova
project.jova
```

Potential applications include:

- application configuration
- development tooling
- project manifests
- infrastructure configuration
- local development settings
- AI/automation configuration
- documented structured data

---

## What JOVA Is Not

JOVA is not intended to become:

- a scripting language
- a template engine
- an executable configuration system
- a replacement for every serialization format
- JSON with an unlimited collection of unrelated syntax extensions

The value of the format depends on keeping it understandable.

---

## Architecture

The project will be developed in layers:

```text
JOVA Source
    │
    ▼
Tokenizer
    │
    ▼
Parser
    │
    ▼
JOVA Document Model
    │
    ├── Structured Values
    │
    └── Comments
    │
    ▼
Serializer / Formatter
```

This separation is important.

Applications may only care about the resulting values.

Developer tools may also need access to comments, source positions, formatting information, or the document structure.

The implementation should support both use cases without confusing comments with application data.

---

## Planned Tooling

JOVA's ecosystem can eventually include:

- reference parser
- serializer
- formatter
- validator
- CLI
- syntax highlighting
- editor integration
- JSON → JOVA conversion
- JOVA → JSON conversion
- language implementations
- conformance tests

These are development targets, not claims about the current implementation.

---

## Example CLI Direction

Future tooling may support workflows such as:

```bash
jova parse config.jova
jova validate config.jova
jova format config.jova
jova to-json config.jova
```

The CLI interface will be finalized as the implementation develops.

---

## File Extension

JOVA documents use:

```text
.jova
```

Example:

```text
package.jova
config.jova
settings.jova
```

---

## Project Status

**Early development.**

The syntax, parser behavior, document model, compatibility guarantees, and specification are being developed and may change before the first stable release.

Do not treat the current repository as a finalized standard.

---

## Roadmap

### Phase 1 — Language Core

- [ ] Define lexical grammar
- [ ] Define comment grammar
- [ ] Implement tokenizer
- [ ] Implement parser
- [ ] Parse standard JSON values
- [ ] Parse single-line comments
- [ ] Parse block comments
- [ ] Handle inline comments
- [ ] Define error behavior

### Phase 2 — Document Model

- [ ] Preserve comments
- [ ] Preserve source locations
- [ ] Define comment attachment behavior
- [ ] Separate semantic values from document metadata
- [ ] Build serialization model

### Phase 3 — Developer Tooling

- [ ] CLI
- [ ] Validator
- [ ] Formatter
- [ ] JSON → JOVA converter
- [ ] JOVA → JSON converter
- [ ] Useful parser diagnostics

### Phase 4 — Ecosystem

- [ ] Syntax highlighting
- [ ] VS Code support
- [ ] Language integrations
- [ ] Conformance test suite
- [ ] Formal specification
- [ ] Stable compatibility rules

---

## Compatibility

One of JOVA's important design questions is the relationship between JOVA and JSON.

The intended direction is straightforward:

> JSON should remain familiar inside JOVA, while JOVA-aware tooling handles JOVA-specific syntax such as comments.

Exact compatibility guarantees will be defined by the specification and proven by the reference implementation and conformance tests.

---

## Philosophy

Configuration is both **data** and **communication**.

Machines need structure.

Humans need context.

JOVA is being built to give both a place in the same document without sacrificing the simplicity that makes JSON useful.

---

## Contributing

JOVA is currently in early development.

Issues, implementation feedback, parser edge cases, interoperability concerns, and specification discussions will become increasingly useful as the core implementation stabilizes.

---

## License

MIT

---

**JOVA**

*Structured for machines. Documented for humans.*
