import { tokenize } from './tokenizer.js';

function posFromOffset(source, offset) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset; i++) {
    if (source[i] === '\n') { line++; column = 1; }
    else column++;
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
      result.push({ id: `t${tokenNumber++}`, type: 'trivia', kind: 'whitespace', raw, start: posFromOffset(source, cursor), end: token.start });
    }
    result.push({ ...token, id: `t${tokenNumber++}`, raw: source.slice(token.start.offset, token.end.offset) });
    cursor = token.end.offset;
  }

  if (cursor < source.length) {
    result.push({ id: `t${tokenNumber++}`, type: 'trivia', kind: 'whitespace', raw: source.slice(cursor), start: posFromOffset(source, cursor), end: posFromOffset(source, source.length) });
  }

  result.push({ id: `t${tokenNumber}`, type: 'eof', value: null, raw: '', start: posFromOffset(source, source.length), end: posFromOffset(source, source.length) });
  return result;
}

function nextTokenId(tokens) {
  let max = -1;
  for (const token of tokens || []) {
    const match = /^t(\d+)$/.exec(token.id || '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function shiftToken(token, source, offsetDelta, id) {
  const startOffset = token.start.offset + offsetDelta;
  const endOffset = token.end.offset + offsetDelta;
  return { ...token, id, start: posFromOffset(source, startOffset), end: posFromOffset(source, endOffset) };
}

export function relexRegion(document, oldStart, oldEnd, newFragment, newSource) {
  if (!document?.tokens || typeof document.source !== 'string') throw new TypeError('Expected lossless JOVA document');
  if (oldStart < 0 || oldEnd < oldStart || oldEnd > document.source.length) throw new RangeError('Invalid relex range');

  const prefix = document.tokens.filter((token) => token.type !== 'eof' && token.end.offset <= oldStart);
  const suffix = document.tokens.filter((token) => token.type !== 'eof' && token.start.offset >= oldEnd);
  const delta = newFragment.length - (oldEnd - oldStart);
  let idNumber = nextTokenId(document.tokens);

  const middle = tokenizeLossless(newFragment)
    .filter((token) => token.type !== 'eof')
    .map((token) => shiftToken(token, newSource, oldStart, `t${idNumber++}`));

  const shiftedSuffix = suffix.map((token) => ({
    ...token,
    start: posFromOffset(newSource, token.start.offset + delta),
    end: posFromOffset(newSource, token.end.offset + delta),
  }));

  const normalizedPrefix = prefix.map((token) => ({
    ...token,
    start: posFromOffset(newSource, token.start.offset),
    end: posFromOffset(newSource, token.end.offset),
  }));

  return [
    ...normalizedPrefix,
    ...middle,
    ...shiftedSuffix,
    { id: `t${idNumber}`, type: 'eof', value: null, raw: '', start: posFromOffset(newSource, newSource.length), end: posFromOffset(newSource, newSource.length) },
  ];
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
