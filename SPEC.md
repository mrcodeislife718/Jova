# JOVA 0.2 Grammar and Document Model

JOVA preserves the JSON value model and adds comments as document trivia with structural attachment for tooling, editing, and serialization.

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

Strings, escapes, Unicode escapes, and numbers follow RFC 8259 JSON syntax. Trailing commas are not part of JOVA 0.2.

## Document model

Parsing returns a `Document` with four primary views:

- `value`: ordinary JavaScript data equivalent to JSON semantics.
- `ast`: a structural syntax tree containing Object, Member, Array, Element, String, Number, Boolean, and Null nodes.
- `comments`: every comment in source order with source positions.
- `source`: the original JOVA source text.

Comments never become application data unless a consumer explicitly inspects them.

## Comment attachment

JOVA 0.2 attaches comments to structural nodes instead of preserving them only in a global list.

Object members may contain:

- `leadingComments`: comments immediately preceding the member.
- `beforeColonComments`: comments between the key and colon.
- `beforeValueComments`: comments between the colon and value.
- `trailingComments`: comments following the value, including same-line comments that occur after its comma.

Array elements contain `leadingComments` and `trailingComments`. Empty objects and arrays may contain `danglingComments`.

A same-line comment after a comma belongs to the value before that comma. A comment beginning on a later line belongs to the next member or element. This rule makes common configuration syntax deterministic:

```jova
{
  // leading comment belongs to timeout
  "timeout": 5000, // trailing comment also belongs to timeout
  "retries": 3
}
```

## Editing and serialization

The semantic `Document.value` may be edited directly or through `setValue(document, path, value)`. `serializeDocument(document)` renders the current semantic value using the AST to retain comments attached to existing members and elements.

New values receive comment-free generated nodes. Existing object-member comments remain associated by property name. Existing array-element comments remain associated by index.

`serializeDocument(document, { preserveSource: true })` explicitly returns the untouched original source instead of rendering the edited semantic value.

The serializer is canonical rather than byte-for-byte round-tripping: whitespace may change, but structurally attached comments are retained with the values they describe.
