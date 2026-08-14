import { ScoutSyntaxError } from './errors.js';

const punctuation = new Set(['{', '}', '[', ']', ':', ',']);
const whitespace = /[\u0020\u000A\u000D\u0009]/;

export function tokenize(source) {
  if (typeof source !== 'string') throw new TypeError('JOVA source must be a string');

  const tokens = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const pos = () => ({ offset: i, line, column });
  const advance = () => {
    const ch = source[i++];
    if (ch === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    return ch;
  };
  const push = (type, value, start) => tokens.push({ type, value, start, end: pos() });
  const fail = (message, at = pos()) => {
    throw new ScoutSyntaxError(message, at);
  };

  while (i < source.length) {
    const ch = source[i];

    if (whitespace.test(ch)) {
      advance();
      continue;
    }

    const start = pos();

    if (ch === '/' && source[i + 1] === '/') {
      advance();
      advance();
      let text = '';
      while (i < source.length && source[i] !== '\n') text += advance();
      push('comment', { style: 'line', text }, start);
      continue;
    }

    if (ch === '/' && source[i + 1] === '*') {
      advance();
      advance();
      let text = '';
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) text += advance();
      if (i >= source.length) fail('Unterminated block comment', start);
      advance();
      advance();
      push('comment', { style: 'block', text }, start);
      continue;
    }

    if (ch === '"') {
      advance();
      let value = '';
      let escaped = false;
      while (i < source.length) {
        const current = advance();
        if (escaped) {
          value += `\\${current}`;
          escaped = false;
          continue;
        }
        if (current === '\\') {
          escaped = true;
          continue;
        }
        if (current === '"') {
          try { push('string', JSON.parse(`"${value}"`), start); }
          catch { fail('Invalid string escape', start); }
          break;
        }
        value += current;
      }
      if (tokens.at(-1)?.start !== start) fail('Unterminated string', start);
      continue;
    }

    if (punctuation.has(ch)) {
      advance();
      push(ch, ch, start);
      continue;
    }

    const rest = source.slice(i);
    const literal = rest.match(/^(true|false|null)\b/);
    if (literal) {
      for (let n = 0; n < literal[0].length; n++) advance();
      push('literal', literal[0] === 'true' ? true : literal[0] === 'false' ? false : null, start);
      continue;
    }

    const number = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) {
      for (let n = 0; n < number[0].length; n++) advance();
      push('number', Number(number[0]), start);
      continue;
    }

    fail(`Unexpected character ${JSON.stringify(ch)}`, start);
  }

  return tokens;
}
