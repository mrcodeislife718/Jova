import { tokenize } from './tokenizer.js';
import { JovaSyntaxError } from './errors.js';

function toComment(token) {
  return { ...token.value, start: token.start, end: token.end };
}

function scalarType(value) {
  if (value === null) return 'Null';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'number') return 'Number';
  if (typeof value === 'boolean') return 'Boolean';
  throw new TypeError(`Unsupported scalar type: ${typeof value}`);
}

export function parse(source) {
  const tokens = tokenize(source);
  const comments = tokens.filter((token) => token.type === 'comment').map(toComment);
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
  const takeComments = () => {
    const found = [];
    while (current()?.type === 'comment') found.push(toComment(tokens[i++]));
    return found;
  };
  const splitAfterComma = (comma, found) => {
    const trailing = [];
    const leading = [];
    for (const comment of found) {
      if (comment.start.line === comma.end.line) trailing.push(comment);
      else leading.push(comment);
    }
    return { trailing, leading };
  };

  function parseValueNode(leadingComments = []) {
    const token = current();
    if (!token) fail('Unexpected end of input');

    if (token.type === 'string' || token.type === 'number' || token.type === 'literal') {
      i++;
      return {
        value: token.value,
        node: {
          type: scalarType(token.value),
          value: token.value,
          start: token.start,
          end: token.end,
          leadingComments,
          trailingComments: [],
        },
      };
    }
    if (token.type === '{') return parseObject(leadingComments);
    if (token.type === '[') return parseArray(leadingComments);

    fail(`Expected value, found ${token.type}`, token);
  }

  function parseObject(leadingComments = []) {
    const open = consume('{');
    const out = {};
    const members = [];
    let pending = takeComments();

    if (current()?.type === '}') {
      const close = consume('}');
      return {
        value: out,
        node: {
          type: 'Object',
          members,
          start: open.start,
          end: close.end,
          leadingComments,
          trailingComments: [],
          danglingComments: pending,
        },
      };
    }

    while (true) {
      const memberLeading = pending;
      const keyToken = consume('string');
      const beforeColonComments = takeComments();
      consume(':');
      const beforeValueComments = takeComments();
      const parsed = parseValueNode(beforeValueComments);
      const trailingComments = takeComments();

      Object.defineProperty(out, keyToken.value, {
        value: parsed.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });

      const member = {
        type: 'Member',
        key: keyToken.value,
        start: keyToken.start,
        end: parsed.node.end,
        leadingComments: memberLeading,
        beforeColonComments,
        beforeValueComments,
        trailingComments,
        value: parsed.node,
      };
      members.push(member);

      if (current()?.type === '}') {
        const close = consume('}');
        return {
          value: out,
          node: {
            type: 'Object',
            members,
            start: open.start,
            end: close.end,
            leadingComments,
            trailingComments: [],
            danglingComments: [],
          },
        };
      }

      const comma = consume(',');
      const postComma = splitAfterComma(comma, takeComments());
      member.trailingComments.push(...postComma.trailing);
      pending = postComma.leading;
      if (current()?.type === '}') fail('Trailing commas are not allowed');
    }
  }

  function parseArray(leadingComments = []) {
    const open = consume('[');
    const out = [];
    const elements = [];
    let pending = takeComments();

    if (current()?.type === ']') {
      const close = consume(']');
      return {
        value: out,
        node: {
          type: 'Array',
          elements,
          start: open.start,
          end: close.end,
          leadingComments,
          trailingComments: [],
          danglingComments: pending,
        },
      };
    }

    while (true) {
      const elementLeading = pending;
      const parsed = parseValueNode(elementLeading);
      const trailingComments = takeComments();
      const index = out.length;
      out.push(parsed.value);
      const element = {
        type: 'Element',
        index,
        start: parsed.node.start,
        end: parsed.node.end,
        leadingComments: elementLeading,
        trailingComments,
        value: parsed.node,
      };
      elements.push(element);

      if (current()?.type === ']') {
        const close = consume(']');
        return {
          value: out,
          node: {
            type: 'Array',
            elements,
            start: open.start,
            end: close.end,
            leadingComments,
            trailingComments: [],
            danglingComments: [],
          },
        };
      }

      const comma = consume(',');
      const postComma = splitAfterComma(comma, takeComments());
      element.trailingComments.push(...postComma.trailing);
      pending = postComma.leading;
      if (current()?.type === ']') fail('Trailing commas are not allowed');
    }
  }

  const leadingComments = takeComments();
  const parsed = parseValueNode(leadingComments);
  const trailingComments = takeComments();
  parsed.node.trailingComments = [...(parsed.node.trailingComments || []), ...trailingComments];
  consume('eof');

  return {
    type: 'Document',
    version: '0.2',
    value: parsed.value,
    ast: parsed.node,
    comments,
    source,
  };
}

export function parseValue(source) {
  return parse(source).value;
}
