# Scout 0.4 Grammar, Lossless Document Model, Incremental Editing, and Recovery

Scout preserves the JSON value model while adding native comments, lossless syntax, persistent syntax identity reconciliation, transactional editing, regional reparsing, editor-facing document services, and error-tolerant editing states.

## Lexical grammar

```ebnf
scout         = ws, value, ws, EOF ;
value         = object | array | string | number | "true" | "false" | "null" ;
object        = "{", ws, [ member, { ws, ",", ws, member } ], ws, "}" ;
member        = string, ws, ":", ws, value ;
array         = "[", ws, [ value, { ws, ",", ws, value } ], ws, "]" ;
ws            = { whitespace | line-comment | block-comment } ;
line-comment  = "//", { any-char-except-LF }, [ LF ] ;
block-comment = "/*", { any-char-until-*/ }, "*/" ;
```

Strings, escapes, Unicode escapes, and numbers follow RFC 8259 JSON syntax. Trailing commas are not part of Scout 0.4.

## Document model

`parse(source)` returns a strict `Document` containing:

- `value`: JSON-equivalent semantic data.
- `ast`: Object, Member, Array, Element, String, Number, Boolean, and Null syntax nodes.
- `comments`: comments in source order with source ranges.
- `tokens`: lossless syntax/comment/whitespace tokens with raw text and IDs.
- `source`: exact source text.
- `revision`: document revision number used by editing infrastructure.
- `lastChangeRanges`: ranges changed by the most recent transaction.

Comments and trivia are syntax metadata and never become application data unless explicitly inspected.

`parseTolerant(source, previousDocument)` is the editor-oriented counterpart. When source is temporarily invalid, it returns an incomplete document instead of throwing away the last useful syntax model.

## Lossless syntax

The lossless layer retains raw literals, raw quoted property keys, exact source positions, property order, comments, whitespace trivia, token IDs, and syntax-node IDs. Untouched source can therefore remain byte-for-byte unchanged during local edits.

## Comment attachment

Object members may carry `leadingComments`, `beforeColonComments`, `beforeValueComments`, and `trailingComments`. Array elements carry leading and trailing comments. Empty containers may carry dangling comments.

A same-line comment after a comma belongs to the preceding value. A comment beginning on a later line belongs to the following member or element.

## Source-oriented editing

Scout provides local editing operations including `replaceValue`, `renameMember`, `removeValue`, `insertMember`, `insertElement`, and `moveValue`. These operations modify source ranges rather than canonicalizing the complete document.

## Transactional editing

Scout 0.4 provides edit sessions and transactions:

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

`reconcileSyntaxIdentity(previous, next)` preserves syntax IDs where identity can be established across a reparse. Scout 0.4 uses structural-position matching for nodes that remain in the same structural role and semantic fingerprints as a fallback for recognizable moved nodes.

Identity is document-local. It is intended for editor state, selections, diagnostics, symbols, and incremental tooling; it is not a globally persistent object identifier.

## Regional incremental reparsing

`smallestReparseRegion(document, edits)` identifies the smallest AST value subtree containing all edits.

`reparseIncremental(document, edits)` reparses that subtree rather than reparsing the complete semantic document when a safe region exists. The replacement subtree is shifted back into document coordinates, reconciled with prior syntax identity, and spliced into the existing AST and semantic value.

The document records incremental metadata including the selected path, old/new regional range, reparsed byte count, relexed byte count, and total document size.

Structural edits that cannot be represented safely by a contained value region use the correctness-first full-parser fallback exposed through the same public API.

## Regional lossless lexing

The lossless token layer is also updated regionally. Tokens before and after an edited value region are reused, retaining their token IDs. Only the replacement region is lexed again, and suffix positions are shifted by the source-length delta.

This means an ordinary scalar edit can preserve both AST identity and lossless token identity outside the changed region.

## Error-tolerant editing and recovery

Editors routinely produce temporarily invalid source while a developer is typing. Scout 0.4 therefore provides `parseTolerant()` and recovery-aware document-store behavior.

Example intermediate state:

```scout
{
  "database": {
    "host":
  }
}
```

Instead of discarding the previous AST, the tolerant parser returns a document with:

- `incomplete: true`;
- `diagnostics` describing the damaged region;
- `recoveryNodes` representing missing or incomplete syntax;
- `expected` token/value categories where they can be inferred;
- the last valid semantic value and syntax tree when a previous document is supplied;
- preserved syntax-node identity for retained nodes.

Recovery nodes use `type: "Recovery"` and carry their source range, raw damaged text, expected syntax, and diagnostic message. Recovery nodes are syntax-only and never become application data.

The recovery layer recognizes important active-edit cases including missing values, missing colons, unterminated strings, unterminated block comments, and unfinished object/array structures. This is recovery-oriented rather than permissive parsing: invalid Scout remains invalid for strict parsing and validation.

When source becomes valid again, the document store automatically returns to the strict document model and clears recovery diagnostics.

## AST continuity through malformed source

`createDocumentStore()` retains the last valid document while an open file enters an incomplete state. Symbols and other structural editor features can therefore continue using the prior valid AST instead of disappearing after every incomplete keystroke.

This continuity model distinguishes:

1. current source text, including malformed intermediate text;
2. current diagnostics and recovery nodes;
3. last valid semantic and structural state.

Scout does not silently treat malformed source as valid configuration data.

## Language-service foundation

Scout exposes editor-facing primitives including:

- `createDocumentStore()` for open/update/close lifecycle;
- incremental text updates with document versions;
- recovery-aware diagnostics;
- `documentSymbols()`;
- `hoverAt()`;
- `positionToOffset()` and `offsetToLspPosition()`;
- `parseTolerant()` and `isRecoveryNode()`;
- completion, quick-fix, folding, selection-range, and rename helpers;
- a JSON-RPC/LSP dispatcher and runnable stdio transport.

These APIs are transport-independent and can be used by editor integrations beyond VS Code.

## Compatibility

Every valid JSON document remains valid Scout syntax. Scout comments require a Scout-aware parser. Scout-to-JSON conversion removes comments while preserving the semantic value.

## Current boundary

Scout 0.4.2 supports subtree semantic reparsing, regional lossless lexing, transactional editing, persistent identity reconciliation, error-tolerant editor states, mixed valid/recovery trees, editor intelligence, and a runnable Language Server Protocol transport.

The format remains pre-1.0. Grammar and compatibility guarantees should be frozen only after the conformance suite and ecosystem contract are ready for a stable release.
