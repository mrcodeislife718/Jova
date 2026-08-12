# Scout Roadmap

Scout is the `.scout` structured-data and configuration format.

## Product contract

Scout keeps JSON's predictable data model while adding developer-friendly comments, trailing commas, lossless document editing, tolerant recovery, diagnostics, formatting, and editor/LSP intelligence. Scout is non-executable by design.

## Design direction

Scout takes JSON's universality, YAML's documentation friendliness, and TOML's configuration clarity while avoiding indentation-sensitive semantics, surprising implicit type coercion, and weak support for deeply nested structured data.

## Implementation order

1. Complete parser/tokenizer correctness for comments and trailing commas.
2. Lossless syntax tree and stable syntax identity.
3. Incremental reparsing and recovery synchronization.
4. Schema/validation layer without changing the core data model.
5. LSP completion, hover, diagnostics, rename, folding, formatting, and quick fixes.
6. Editor integrations and format conformance suite.
7. Cross-language parsers where demand justifies them.

## Proof gates

Every syntax feature requires parse/round-trip/recovery tests. Lossless edits must preserve unrelated formatting/comments. LSP features require protocol-level stdio tests as well as behavior tests.

## Commercial boundary

Scout should remain frictionless adoption infrastructure. Revenue is indirect through the larger Cannon platform, enterprise tooling, Cortex, Chronos, validation/governance tooling, and support rather than charging for the format itself.
