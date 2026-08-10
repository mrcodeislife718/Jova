import { parse } from './parser.js';
import { reparseIncremental } from './transaction.js';
import { tokenAt } from './lossless.js';
import { JovaSyntaxError } from './errors.js';

function positionToOffset(source, position) {
  if (!position || !Number.isInteger(position.line) || !Number.isInteger(position.character)) {
    throw new TypeError('Position must contain zero-based line and character');
  }
  const lines = source.split('\n');
  if (position.line < 0 || position.line >= lines.length) return source.length;
  let offset = 0;
  for (let i = 0; i < position.line; i++) offset += lines[i].length + 1;
  return Math.min(offset + Math.max(0, position.character), offset + lines[position.line].length);
}

function offsetToLspPosition(source, offset) {
  let line = 0;
  let character = 0;
  for (let i = 0; i < Math.min(offset, source.length); i++) {
    if (source[i] === '\n') { line++; character = 0; }
    else character++;
  }
  return { line, character };
}

function nodeRange(source, node) {
  return {
    start: offsetToLspPosition(source, node.start.offset),
    end: offsetToLspPosition(source, node.end.offset),
  };
}

function syntaxErrorDiagnostic(source, error) {
  const offset = error?.position?.offset ?? 0;
  const start = offsetToLspPosition(source, offset);
  const end = offsetToLspPosition(source, Math.min(source.length, offset + 1));
  return { severity: 1, source: 'jova', code: 'syntax', message: error.message, range: { start, end } };
}

export function validateText(source) {
  try {
    parse(source);
    return [];
  } catch (error) {
    if (error instanceof JovaSyntaxError) return [syntaxErrorDiagnostic(source, error)];
    throw error;
  }
}

function symbolChildren(source, node) {
  if (node.type === 'Object') {
    return node.members.map((member) => ({
      name: member.key,
      kind: member.value.type === 'Object' ? 19 : member.value.type === 'Array' ? 18 : 13,
      range: nodeRange(source, member),
      selectionRange: {
        start: offsetToLspPosition(source, member.keyStart.offset),
        end: offsetToLspPosition(source, member.keyEnd.offset),
      },
      children: symbolChildren(source, member.value),
      jovaNodeId: member.id,
    }));
  }
  if (node.type === 'Array') {
    return node.elements.map((element, index) => ({
      name: `[${index}]`,
      kind: element.value.type === 'Object' ? 19 : element.value.type === 'Array' ? 18 : 13,
      range: nodeRange(source, element),
      selectionRange: nodeRange(source, element.value),
      children: symbolChildren(source, element.value),
      jovaNodeId: element.id,
    }));
  }
  return [];
}

export function documentSymbols(document) {
  if (!document?.ast) throw new TypeError('Expected a JOVA document');
  return symbolChildren(document.source, document.ast);
}

export function hoverAt(document, position) {
  if (!document?.source) throw new TypeError('Expected a JOVA document');
  const offset = positionToOffset(document.source, position);
  const token = tokenAt(document, offset);
  if (!token || token.type === 'trivia' || token.type === 'eof') return undefined;
  let label = token.type;
  if (token.type === 'comment') label = `${token.value.style} comment`;
  else if (token.type === 'literal') label = typeof token.value;
  return {
    contents: { kind: 'markdown', value: `**JOVA ${label}**\n\n\`${token.raw}\`` },
    range: { start: offsetToLspPosition(document.source, token.start.offset), end: offsetToLspPosition(document.source, token.end.offset) },
  };
}

export function createDocumentStore() {
  const documents = new Map();

  return {
    open(uri, text, version = 1) {
      if (typeof uri !== 'string' || typeof text !== 'string') throw new TypeError('uri and text are required');
      const document = parse(text);
      documents.set(uri, { uri, version, document });
      return document;
    },

    get(uri) {
      return documents.get(uri)?.document;
    },

    version(uri) {
      return documents.get(uri)?.version;
    },

    update(uri, changes, version) {
      const entry = documents.get(uri);
      if (!entry) throw new RangeError(`JOVA document is not open: ${uri}`);
      if (!Array.isArray(changes)) throw new TypeError('changes must be an array');
      const edits = changes.map((change) => {
        if (!change.range) return { start: 0, end: entry.document.source.length, text: change.text };
        return {
          start: positionToOffset(entry.document.source, change.range.start),
          end: positionToOffset(entry.document.source, change.range.end),
          text: change.text,
        };
      });
      reparseIncremental(entry.document, edits);
      entry.version = version ?? entry.version + 1;
      return entry.document;
    },

    close(uri) {
      return documents.delete(uri);
    },

    diagnostics(uri) {
      const entry = documents.get(uri);
      if (!entry) return [];
      return validateText(entry.document.source);
    },

    symbols(uri) {
      const entry = documents.get(uri);
      return entry ? documentSymbols(entry.document) : [];
    },

    hover(uri, position) {
      const entry = documents.get(uri);
      return entry ? hoverAt(entry.document, position) : undefined;
    },
  };
}

export { positionToOffset, offsetToLspPosition };
