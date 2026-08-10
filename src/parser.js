import { tokenize } from './tokenizer.js';
import { JovaSyntaxError } from './errors.js';

export function parse(source) {
  const allTokens = tokenize(source);
  const comments = allTokens
    .filter((token) => token.type === 'comment')
    .map((token) => ({ ...token.value, start: token.start, end: token.end }));
  const tokens = allTokens.filter((token) => token.type !== 'comment');
  let i = 0;

  const current = () => tokens[i];
  const fail = (message, token = current()) => {
    throw new JovaSyntaxError(message, token?.start);
  };
  const consume = (type) => {
    const token = current();
    if (!token || token.type !== type) {
      fail(`Expected ${type}${token ? `, found ${token.type}` : ''}`, token);
    }
    i++;
    return token;
  };

  function parseValueNode() {
    const token = current();
    if (!token) fail('Unexpected end of input');

    if (token.type === 'string' || token.type === 'number' || token.type === 'literal') {
      i++;
      return token.value;
    }
    if (token.type === '{') return parseObject();
    if (token.type === '[') return parseArray();

    fail(`Expected value, found ${token.type}`, token);
  }

  function parseObject() {
    consume('{');
    const out = {};

    if (current().type === '}') {
      consume('}');
      return out;
    }

    while (true) {
      const key = consume('string').value;
      consume(':');
      const value = parseValueNode();
      Object.defineProperty(out, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });

      if (current().type === '}') {
        consume('}');
        return out;
      }

      consume(',');
      if (current().type === '}') fail('Trailing commas are not allowed');
    }
  }

  function parseArray() {
    consume('[');
    const out = [];

    if (current().type === ']') {
      consume(']');
      return out;
    }

    while (true) {
      out.push(parseValueNode());
      if (current().type === ']') {
        consume(']');
        return out;
      }

      consume(',');
      if (current().type === ']') fail('Trailing commas are not allowed');
    }
  }

  const value = parseValueNode();
  consume('eof');

  return { value, comments, source };
}

export function parseValue(source) {
  return parse(source).value;
}
