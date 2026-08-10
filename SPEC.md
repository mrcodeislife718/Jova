# JOVA 0.3 Grammar and Lossless Document Model

JOVA preserves the JSON value model while adding native comments and a lossless syntax layer for editor tooling and safe automated edits.

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

Strings, escapes, Unicode escapes, and numbers follow RFC 8259 JSON syntax. Trailing commas are not part of JOVA 0.3.

## Document views

Parsing returns a `Document` with complementary representations:

- `value`: ordinary JavaScript data equivalent to JSON semantics.
- `ast`: structural Object, Member, Array, Element, String, Number, Boolean, and Null nodes.
- `comments`: all comments in source order with source positions.
- `tokens`: a lossless token stream containing syntax tokens, comments, whitespace trivia, raw text, source ranges, and token IDs.
- `source`: the exact original JOVA source text.

Comments and trivia never become application data unless a consumer explicitly inspects them.

## Lossless syntax model

JOVA 0.3 adds the information required for source-preserving tools:

- Token identity: every lossless token receives an `id`.
- Whitespace/trivia preservation: gaps between semantic tokens are represented as trivia tokens with exact raw text.
- Raw literals: scalar AST nodes retain their original raw literal text.
- Raw keys: object members retain their quoted key spelling and key source range.
- Node identity: AST nodes and structural Member/Element records receive document-local stable IDs.
- Property order: object property order is represented explicitly by `Object.members` rather than inferred from a map.
- Exact source ranges: syntax nodes retain start/end offsets, line, and column.

The original source can therefore be reconstructed byte-for-byte from the ordered lossless token stream.

## Comment attachment

Object members may contain `leadingComments`, `beforeColonComments`, `beforeValueComments`, and `trailingComments`. Array elements contain `leadingComments` and `trailingComments`. Empty objects and arrays may contain `danglingComments`.

A same-line comment after a comma belongs to the value before that comma. A comment beginning on a later line belongs to the next member or element.

```jova
{
  // belongs to timeout
  "timeout": 5000, // also belongs to timeout
  "retries": 3
}
```

## Lossless editing

JOVA 0.3 provides source-oriented edit operations:

- `replaceValue(document, path, value)` replaces only the selected value range.
- `renameMember(document, path, newKey)` replaces only the quoted key token.
- `removeValue(document, path)` removes one object member or array element with local comma repair.
- `insertMember(document, objectPath, key, value)` inserts a property into an object.
- `insertElement(document, arrayPath, index, value)` inserts an array element.
- `moveValue(document, fromPath, toParentPath, toKeyOrIndex)` moves semantic data between containers.

Edits are applied to source text and reparsed. This makes untouched text outside the edited range remain byte-for-byte unchanged. A one-value replacement does not canonicalize or reformat the rest of the document.

The canonical serializer remains available when normalized formatting is desired.

## Identity guarantees

Token and node IDs are stable within a parsed document instance and provide unambiguous identity for editor integrations. Source-oriented edits return the same `Document` object populated from the reparsed source. IDs may be reassigned after structural reparsing in JOVA 0.3; persistent cross-edit identity is reserved for a later identity-reconciliation layer.

This distinction is deliberate: JOVA 0.3 guarantees exact source preservation for untouched regions, while avoiding a stronger persistent-ID promise before it is proven.

## Compatibility

Every valid JSON document remains valid JOVA syntax. JOVA-specific comments and trivia require a JOVA-aware parser. Converting JOVA to JSON removes comments and preserves the semantic value.
