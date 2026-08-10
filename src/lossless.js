import { tokenize } from './tokenizer.js';

function posFromOffset(source, offset) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset; i++) {
    if (source[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { offset, line, column };
}

export function tokenizeLossless(source) {
  const semantic = tokenize(source);
  const result = [];
  let cursor = 0;
  let tokenNumber = 0;

  for (const token of semantic) {
    if (token.type === 'eof') break;
    if (cursor < token.start.offset) {
      const raw = source.slice(cursor, token.start.offset);
      result.push({
        id: `t${tokenNumber++}`,
        type: 'trivia',
        kind: 'whitespace',
        raw,
        start: posFromOffset(source, cursor),
        end: token.start,
      });
    }

    result.push({
      ...token,
      id: `t${tokenNumber++}`,
      raw: source.slice(token.start.offset, token.end.offset),
    });
    cursor = token.end.offset;
  }

  if (cursor < source.length) {
    result.push({
      id: `t${tokenNumber++}`,
      type: 'trivia',
      kind: 'whitespace',
      raw: source.slice(cursor),
      start: posFromOffset(source, cursor),
      end: posFromOffset(source, source.length),
    });
  }

  result.push({
    id: `t${tokenNumber}`,
    type: 'eof',
    value: null,
    raw: '',
    start: posFromOffset(source, source.length),
    end: posFromOffset(source, source.length),
  });
  return result;
}

export function rawSlice(document, node) {
  if (!document || typeof document.source !== 'string') throw new TypeError('Expected JOVA document source');
  if (!node?.start || !node?.end) throw new TypeError('Expected syntax node with source range');
  return document.source.slice(node.start.offset, node.end.offset);
}

export function tokenAt(document, offset) {
  if (!document?.tokens) return undefined;
  return document.tokens.find((token) => token.start.offset <= offset && offset < token.end.offset);
}
