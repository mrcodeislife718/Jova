import { createValueNode } from './document.js';

export function stringify(value, options = {}) {
  const { space = 2 } = options;
  const json = JSON.stringify(value, null, space);
  if (json === undefined) throw new TypeError('Value is not representable as JOVA/JSON');
  return json;
}

function indent(level, space) {
  return ' '.repeat(level * space);
}

function commentText(comment) {
  return comment.style === 'block' ? `/*${comment.text}*/` : `//${comment.text}`;
}

function renderCommentLines(comments, level, space) {
  const pad = indent(level, space);
  const lines = [];
  for (const comment of comments || []) {
    const rendered = commentText(comment).split('\n');
    for (const line of rendered) lines.push(`${pad}${line}`);
  }
  return lines;
}

function renderScalar(value) {
  const rendered = JSON.stringify(value);
  if (rendered === undefined) throw new TypeError('Value is not representable as JOVA/JSON');
  return rendered;
}

function attachTrailing(lines, comments, level, space) {
  if (!comments?.length) return lines;

  const [first, ...rest] = comments;
  if (lines.length > 0 && !commentText(first).includes('\n')) {
    lines[lines.length - 1] += ` ${commentText(first)}`;
  } else {
    lines.push(...renderCommentLines([first], level, space));
  }
  lines.push(...renderCommentLines(rest, level, space));
  return lines;
}

function nodeForObjectMember(node, key, value) {
  return node?.type === 'Object'
    ? node.members.find((member) => member.key === key) || {
        type: 'Member',
        key,
        leadingComments: [],
        beforeColonComments: [],
        beforeValueComments: [],
        trailingComments: [],
        value: createValueNode(value),
      }
    : {
        type: 'Member',
        key,
        leadingComments: [],
        beforeColonComments: [],
        beforeValueComments: [],
        trailingComments: [],
        value: createValueNode(value),
      };
}

function renderValue(value, node, level, space) {
  if (value === null || typeof value !== 'object') {
    return [renderScalar(value)];
  }

  if (Array.isArray(value)) {
    const lines = ['['];
    for (let index = 0; index < value.length; index++) {
      const existing = node?.type === 'Array' ? node.elements[index] : undefined;
      const element = existing || {
        type: 'Element',
        index,
        leadingComments: [],
        trailingComments: [],
        value: createValueNode(value[index]),
      };

      lines.push(...renderCommentLines(element.leadingComments, level + 1, space));
      const valueLines = renderValue(value[index], element.value, level + 1, space);
      const pad = indent(level + 1, space);
      valueLines[0] = `${pad}${valueLines[0]}`;
      for (let i = 1; i < valueLines.length; i++) {
        if (!valueLines[i].startsWith(indent(level + 1, space))) valueLines[i] = `${pad}${valueLines[i]}`;
      }

      if (index < value.length - 1) valueLines[valueLines.length - 1] += ',';
      attachTrailing(valueLines, element.trailingComments, level + 1, space);
      lines.push(...valueLines);
    }

    if (value.length === 0 && node?.danglingComments?.length) {
      lines.push(...renderCommentLines(node.danglingComments, level + 1, space));
    }
    lines.push(`${indent(level, space)}]`);
    return lines;
  }

  const lines = ['{'];
  const entries = Object.entries(value);
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const [key, item] = entries[entryIndex];
    const member = nodeForObjectMember(node, key, item);
    const leading = [
      ...(member.leadingComments || []),
      ...(member.beforeColonComments || []),
      ...(member.beforeValueComments || []),
    ];
    lines.push(...renderCommentLines(leading, level + 1, space));

    const valueLines = renderValue(item, member.value, level + 1, space);
    const memberPad = indent(level + 1, space);
    const prefix = `${memberPad}${JSON.stringify(key)}: `;
    valueLines[0] = `${prefix}${valueLines[0]}`;

    if (entryIndex < entries.length - 1) valueLines[valueLines.length - 1] += ',';
    attachTrailing(valueLines, member.trailingComments, level + 1, space);
    lines.push(...valueLines);
  }

  if (entries.length === 0 && node?.danglingComments?.length) {
    lines.push(...renderCommentLines(node.danglingComments, level + 1, space));
  }
  lines.push(`${indent(level, space)}}`);
  return lines;
}

export function serializeDocument(document, options = {}) {
  if (!document || document.type !== 'Document' || !Object.prototype.hasOwnProperty.call(document, 'value')) {
    throw new TypeError('Expected a JOVA document');
  }

  if (options.preserveSource === true && typeof document.source === 'string') {
    return document.source;
  }

  const space = Number.isInteger(options.space) && options.space >= 0 ? options.space : 2;
  const ast = document.ast || createValueNode(document.value);
  const lines = [];
  lines.push(...renderCommentLines(ast.leadingComments, 0, space));
  lines.push(...renderValue(document.value, ast, 0, space));
  attachTrailing(lines, ast.trailingComments, 0, space);
  return lines.join('\n');
}
