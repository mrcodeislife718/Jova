# JOVA 0.1 Grammar

JOVA preserves the JSON value model and adds comments as document trivia.

## Lexical grammar

```ebnf
jova         = ws, value, ws, EOF ;
value        = object | array | string | number | "true" | "false" | "null" ;
object       = "{", ws, [ member, { ws, ",", ws, member } ], ws, "}" ;
member       = string, ws, ":", ws, value ;
array        = "[", ws, [ value, { ws, ",", ws, value } ], ws, "]" ;
ws           = { whitespace | line-comment | block-comment } ;
line-comment = "//", { any-char-except-LF }, [ LF ] ;
block-comment = "/*", { any-char-until-*/ }, "*/" ;
```

Strings, escapes, Unicode escapes, and numbers follow RFC 8259 JSON syntax. Trailing commas are not part of JOVA 0.1.

## Comments

Comments are preserved by the tokenizer with source offsets, line, and column. Parsing ignores comments for semantic value construction while retaining every comment in document order on the returned document object.

A JOVA document therefore has two views:

- `value`: ordinary JavaScript data equivalent to JSON semantics.
- `comments`: preserved comment records for tooling and round-trip-aware consumers.

Comments never become application data unless a consumer explicitly chooses to inspect them.
