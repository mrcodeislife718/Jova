import { parse } from './parser.js';
import { getNode, getMember } from './document.js';
import { stringify } from './serializer.js';

function assertDocument(document) {
  if (!document || document.type !== 'Document' || typeof document.source !== 'string') {
    throw new TypeError('Expected a parsed JOVA document with source');
  }
}

function replaceDocument(document, next) {
  for (const key of Object.keys(document)) delete document[key];
  Object.assign(document, next);
  return document;
}

function applyEdit(document, start, end, text) {
  assertDocument(document);
  const source = document.source;
  const nextSource = source.slice(0, start) + text + source.slice(end);
  return replaceDocument(document, parse(nextSource));
}

function pathParent(document, path) {
  if (!Array.isArray(path) || path.length === 0) throw new TypeError('Path must identify a child node');
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = getNode(document, parentPath);
  if (!parent) throw new RangeError(`JOVA path not found: ${JSON.stringify(parentPath)}`);
  return { parent, key, parentPath };
}

function findStringEnd(source, start) {
  let i = start;
  if (source[i] !== '"') throw new Error('Expected quoted object key');
  i++;
  let escaped = false;
  while (i < source.length) {
    const ch = source[i++];
    if (!escaped && ch === '"') return i;
    if (!escaped && ch === '\\') escaped = true;
    else escaped = false;
  }
  throw new Error('Unterminated object key');
}

function valueText(value) {
  return stringify(value, { space: 2 });
}

export function replaceValue(document, path, value) {
  assertDocument(document);
  if (!Array.isArray(path)) throw new TypeError('Path must be an array');
  const node = getNode(document, path);
  if (!node || !node.start || !node.end) throw new RangeError(`JOVA path not found: ${JSON.stringify(path)}`);
  return applyEdit(document, node.start.offset, node.end.offset, valueText(value));
}

export function renameMember(document, path, newKey) {
  assertDocument(document);
  if (typeof newKey !== 'string') throw new TypeError('New key must be a string');
  const member = getMember(document, path);
  if (!member) throw new RangeError(`JOVA member not found: ${JSON.stringify(path)}`);
  const start = member.start.offset;
  const end = findStringEnd(document.source, start);
  return applyEdit(document, start, end, JSON.stringify(newKey));
}

function lineIndentBefore(source, offset) {
  const lineStart = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const prefix = source.slice(lineStart, offset);
  return prefix.match(/^[\t ]*/)?.[0] ?? '';
}

function childStart(item) {
  const comments = item.leadingComments || [];
  return comments.length ? comments[0].start.offset : item.start.offset;
}

export function removeValue(document, path) {
  assertDocument(document);
  const { parent, key } = pathParent(document, path);
  const source = document.source;

  if (parent.type === 'Object') {
    const index = parent.members.findIndex((member) => member.key === key);
    if (index < 0) throw new RangeError(`JOVA member not found: ${JSON.stringify(path)}`);
    const member = parent.members[index];
    let start = childStart(member);
    let end = member.end.offset;

    if (index < parent.members.length - 1) {
      const next = parent.members[index + 1];
      const comma = source.indexOf(',', member.end.offset);
      if (comma >= 0 && comma < next.start.offset) end = comma + 1;
      while (end < childStart(next) && /[ \t\r\n]/.test(source[end])) end++;
    } else if (index > 0) {
      const previous = parent.members[index - 1];
      const comma = source.indexOf(',', previous.end.offset);
      if (comma >= 0 && comma < start) start = comma;
    }

    return applyEdit(document, start, end, '');
  }

  if (parent.type === 'Array') {
    if (!Number.isInteger(key) || key < 0 || key >= parent.elements.length) {
      throw new RangeError(`JOVA array element not found: ${JSON.stringify(path)}`);
    }
    const element = parent.elements[key];
    let start = childStart(element);
    let end = element.end.offset;
    if (key < parent.elements.length - 1) {
      const next = parent.elements[key + 1];
      const comma = source.indexOf(',', element.end.offset);
      if (comma >= 0 && comma < next.start.offset) end = comma + 1;
      while (end < childStart(next) && /[ \t\r\n]/.test(source[end])) end++;
    } else if (key > 0) {
      const previous = parent.elements[key - 1];
      const comma = source.indexOf(',', previous.end.offset);
      if (comma >= 0 && comma < start) start = comma;
    }
    return applyEdit(document, start, end, '');
  }

  throw new TypeError('Parent must be an object or array');
}

export function insertMember(document, objectPath, key, value, options = {}) {
  assertDocument(document);
  if (typeof key !== 'string') throw new TypeError('Object key must be a string');
  const object = getNode(document, objectPath);
  if (!object || object.type !== 'Object') throw new TypeError('Target path must identify an object');
  if (object.members.some((member) => member.key === key)) throw new Error(`Object key already exists: ${key}`);

  const closeOffset = object.end.offset - 1;
  const closeIndent = lineIndentBefore(document.source, closeOffset);
  const unit = options.indent ?? '  ';
  const memberIndent = closeIndent + unit;
  const rendered = valueText(value).replace(/\n/g, `\n${memberIndent}`);
  const prefix = object.members.length ? ',' : '';
  const text = `${prefix}\n${memberIndent}${JSON.stringify(key)}: ${rendered}\n${closeIndent}`;
  return applyEdit(document, closeOffset, closeOffset, text);
}

export function insertElement(document, arrayPath, index, value, options = {}) {
  assertDocument(document);
  const array = getNode(document, arrayPath);
  if (!array || array.type !== 'Array') throw new TypeError('Target path must identify an array');
  if (!Number.isInteger(index) || index < 0 || index > array.elements.length) throw new RangeError('Array index out of range');

  if (index === array.elements.length) {
    const closeOffset = array.end.offset - 1;
    const closeIndent = lineIndentBefore(document.source, closeOffset);
    const unit = options.indent ?? '  ';
    const elementIndent = closeIndent + unit;
    const rendered = valueText(value).replace(/\n/g, `\n${elementIndent}`);
    const prefix = array.elements.length ? ',' : '';
    return applyEdit(document, closeOffset, closeOffset, `${prefix}\n${elementIndent}${rendered}\n${closeIndent}`);
  }

  const target = array.elements[index];
  const start = childStart(target);
  const elementIndent = lineIndentBefore(document.source, target.start.offset);
  const rendered = valueText(value).replace(/\n/g, `\n${elementIndent}`);
  return applyEdit(document, start, start, `${elementIndent}${rendered},\n`);
}

export function moveValue(document, fromPath, toParentPath, toKeyOrIndex) {
  assertDocument(document);
  if (!Array.isArray(fromPath) || !Array.isArray(toParentPath)) throw new TypeError('Paths must be arrays');

  let value = document.value;
  for (const segment of fromPath) value = value?.[segment];
  if (value === undefined && getNode(document, fromPath) === undefined) throw new RangeError('Source path not found');
  const cloned = structuredClone(value);

  const sourceParent = pathParent(document, fromPath).parent;
  if (sourceParent.type === 'Object') {
    const oldKey = fromPath[fromPath.length - 1];
    if (JSON.stringify(fromPath.slice(0, -1)) === JSON.stringify(toParentPath) && typeof toKeyOrIndex === 'string') {
      renameMember(document, fromPath, toKeyOrIndex);
      return replaceValue(document, [...toParentPath, toKeyOrIndex], cloned);
    }
    removeValue(document, fromPath);
  } else if (sourceParent.type === 'Array') {
    removeValue(document, fromPath);
  } else {
    throw new TypeError('Source parent must be an object or array');
  }

  const target = getNode(document, toParentPath);
  if (target?.type === 'Object') return insertMember(document, toParentPath, toKeyOrIndex, cloned);
  if (target?.type === 'Array') return insertElement(document, toParentPath, toKeyOrIndex, cloned);
  throw new TypeError('Target parent must be an object or array');
}
