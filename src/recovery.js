import { parse } from './parser.js';
import { JovaSyntaxError } from './errors.js';

function offsetPosition(source, offset) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < Math.min(offset, source.length); i++) {
    if (source[i] === '\n') { line++; column = 1; }
    else column++;
  }
  return { offset, line, column };
}

function diagnostic(source, message, offset, expected = []) {
  const start = offsetPosition(source, offset);
  return {
    severity: 1,
    source: 'jova',
    code: 'incomplete-syntax',
    message,
    expected,
    start,
    end: offsetPosition(source, Math.min(source.length, offset + 1)),
  };
}

function recoveryNode(source, start, end, expected, message) {
  return {
    id: `recovery:${start}:${end}`,
    type: 'Recovery',
    expected,
    message,
    raw: source.slice(start, end),
    start: offsetPosition(source, start),
    end: offsetPosition(source, end),
    leadingComments: [],
    trailingComments: [],
  };
}

function scanStructuralContext(source, offset) {
  const stack = [];
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < offset; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (inString) {
      if (!escaped && ch === '"') inString = false;
      if (!escaped && ch === '\\') escaped = true;
      else escaped = false;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === '"') { inString = true; escaped = false; continue; }
    if (ch === '{' || ch === '[') stack.push({ ch, offset: i });
    else if (ch === '}' && stack.at(-1)?.ch === '{') stack.pop();
    else if (ch === ']' && stack.at(-1)?.ch === '[') stack.pop();
  }
  return { stack, inString, lineComment, blockComment };
}

function inferRecovery(source, error) {
  const offset = Number.isInteger(error?.offset) ? error.offset : Number.isInteger(error?.position?.offset) ? error.position.offset : source.length;
  const context = scanStructuralContext(source, offset);
  const prefix = source.slice(0, offset);
  const trimmed = prefix.replace(/\s+$/g, '');
  let expected = ['value'];
  let message = 'Incomplete JOVA value';

  if (context.inString) {
    expected = ['"'];
    message = 'Unterminated string';
  } else if (context.blockComment) {
    expected = ['*/'];
    message = 'Unterminated block comment';
  } else if (/[:,]\s*$/.test(trimmed) || /\[\s*$/.test(trimmed)) {
    expected = ['object', 'array', 'string', 'number', 'true', 'false', 'null'];
    message = 'Expected a value';
  } else if (/"(?:[^"\\]|\\.)*"\s*$/.test(trimmed) && context.stack.at(-1)?.ch === '{') {
    expected = [':'];
    message = 'Expected colon after object key';
  } else if (context.stack.length) {
    const open = context.stack.at(-1).ch;
    expected = open === '{' ? ['}', ',', 'member'] : [']', ',', 'value'];
    message = `Incomplete ${open === '{' ? 'object' : 'array'}`;
  }

  return { offset, expected, message, context };
}

function cloneWithRecovery(previous, source, recovery) {
  const baseAst = previous?.ast ? structuredClone(previous.ast) : recoveryNode(source, 0, source.length, recovery.expected, recovery.message);
  const node = recoveryNode(source, recovery.offset, recovery.offset, recovery.expected, recovery.message);
  return {
    type: 'Document',
    version: '0.4',
    revision: previous?.revision ?? 0,
    source,
    value: previous?.value,
    ast: baseAst,
    comments: previous?.comments ? structuredClone(previous.comments) : [],
    tokens: previous?.tokens ? structuredClone(previous.tokens) : [],
    diagnostics: [diagnostic(source, recovery.message, recovery.offset, recovery.expected)],
    recoveryNodes: [node],
    incomplete: true,
    lastValidDocument: previous,
    lastChangeRanges: [],
  };
}

export function parseTolerant(source, previousDocument) {
  try {
    const document = parse(source);
    document.diagnostics = [];
    document.recoveryNodes = [];
    document.incomplete = false;
    return document;
  } catch (error) {
    if (!(error instanceof JovaSyntaxError)) throw error;
    const recovery = inferRecovery(source, error);
    return cloneWithRecovery(previousDocument, source, recovery);
  }
}

export function isRecoveryNode(node) {
  return node?.type === 'Recovery';
}
