# JOVA 0.4 Grammar, Lossless Document Model, and Incremental Editing

JOVA preserves the JSON value model while adding native comments, lossless syntax, persistent syntax identity reconciliation, transactional editing, regional reparsing, and editor-facing document services.

## Lexical grammar

```ebnf
jova          = ws, value, ws, EOF ;
value         = object | array | string | number | "true" | "false" | "null" ;
object        = "{", ws, [ member, { ws, ",", ws, member } ], ws, "}" ;
member        = string, ws, ":", ws, value ;
array         = "[", ws, [ value, { ws, ",", ws, value } ], ws, "]" ;
ws            = { whitespace | line-comment | block-comment } ;
line-comment  = "//", { any-char-except-LF }, [ LF ] ;
block-comment = "/*", { any-char-until-*/ }, "*/" ;
```

Strings, escapes, Unicode escapes, and numbers follow RFC 8259 JSON syntax. Trailing commas are not part of JOVA 0.4.

## Document model

`parse(source)` returns a `Document` containing:

- `value`: JSON-equivalent semantic data.
- `ast`: Object, Member, Array, Element, String, Number, Boolean, and Null syntax nodes.
- `comments`: comments in source order with source ranges.
- `tokens`: lossless syntax/comment/whitespace tokens with raw text and IDs.
- `source`: exact source text.
- `revision`: document revision number used by editing infrastructure.
- `lastChangeRanges`: ranges changed by the most recent transaction.

Comments and trivia are syntax metadata and never become application data unless explicitly inspected.

## Lossless syntax

The lossless layer retains raw literals, raw quoted property keys, exact source positions, property order, comments, whitespace trivia, token IDs, and syntax-node IDs. Untouched source can therefore remain byte-for-byte unchanged during local edits.

## Comment attachment

Object members may carry `leadingComments`, `beforeColonComments`, `beforeValueComments`, and `trailingComments`. Array elements carry leading and trailing comments. Empty containers may carry dangling comments.

A same-line comment after a comma belongs to the preceding value. A comment beginning on a later line belongs to the following member or element.

## Source-oriented editing

JOVA provides local editing operations including:

- `replaceValue`
- `renameMember`
- `removeValue`
- `insertMember`
- `insertElement`
- `moveValue`

These operations modify source ranges rather than canonicalizing the complete document.

## Transactional editing

JOVA 0.4 introduces edit sessions and transactions:

```js
const session = createEditSession(document);
const tx = beginTransaction(session, 'change configuration');
addTextEdit(tx, start, end, replacement);
commitTransaction(tx);
undo(session);
redo(session);
```

A transaction contains one or more non-overlapping text edits. Commit applies them atomically, increments the document revision, records change ranges, and adds one undo-history entry. Rollback closes a transaction without changing source. A new commit clears redo history.

## Persistent syntax identity

`reconcileSyntaxIdentity(previous, next)` preserves syntax IDs where identity can be established across a reparse.

JOVA 0.4 uses two matching strategies:

1. structural-position matching for nodes that remain in the same structural role, which preserves identity across local value changes and property renames;
2. semantic fingerprints as a fallback for nodes that move while retaining recognizable structure or value.

Identity is document-local. It is intended for editor state, selections, diagnostics, symbols, and incremental tooling; it is not a globally persistent object identifier.

## Regional incremental reparsing

`smallestReparseRegion(document, edits)` identifies the smallest AST value subtree containing all edits.

`reparseIncremental(document, edits)` reparses that subtree rather than reparsing the complete semantic document when a safe region exists. The replacement subtree is shifted back into document coordinates, reconciled with prior syntax identity, and spliced into the existing AST and semantic value.

The document records incremental metadata including the selected path, old/new regional range, reparsed byte count, relexed byte count, and total document size.

Structural edits that cannot be represented safely by a contained value region use the correctness-first full-parser fallback exposed through the same public API.

## Regional lossless lexing

The lossless token layer is also updated regionally. Tokens before and after an edited value region are reused, retaining their token IDs. Only the replacement region is lexed again, and suffix positions are shifted by the source-length delta.

This means an ordinary scalar edit can preserve both AST identity and lossless token identity outside the changed region.

## Language-service foundation

JOVA 0.4 exposes editor-facing primitives that a VS Code extension or Language Server Protocol adapter can use:

- `createDocumentStore()` for open/update/close lifecycle.
- incremental text updates with document versions.
- `validateText()` for syntax diagnostics.
- `documentSymbols()` for hierarchical document symbols.
- `hoverAt()` for token-aware hover information.
- `positionToOffset()` and `offsetToLspPosition()` for editor coordinate conversion.

These APIs are transport-independent. They do not require VS Code and can be used by any editor integration.

## Compatibility

Every valid JSON document remains valid JOVA syntax. JOVA comments require a JOVA-aware parser. JOVA-to-JSON conversion removes comments while preserving the semantic value.

## Current boundary

JOVA 0.4 performs genuine subtree semantic reparsing and regional lossless lexing when edits are contained within a safe value region. Root-level or unsafe structural changes may still use a full parse. Future work can expand safe-region detection and add parser recovery so incomplete documents remain useful while a developer is actively typing.
