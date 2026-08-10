import { parse } from './parser.js';
import { relexRegion } from './lossless.js';
import { reconcileSyntaxIdentity } from './identity.js';

function assertDocument(document) {
  if (!document || document.type !== 'Document' || typeof document.source !== 'string' || !document.ast) {
    throw new TypeError('Expected a parsed JOVA document');
  }
}

function replaceDocument(document, next) {
  for (const key of Object.keys(document)) delete document[key];
  Object.assign(document, next);
  return document;
}

function applyEdits(source, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let lastStart = source.length + 1;
  let next = source;
  for (const edit of sorted) {
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < 0 || edit.end < edit.start) throw new RangeError('Invalid edit range');
    if (typeof edit.text !== 'string') throw new TypeError('Edit text must be a string');
    if (edit.end > lastStart) throw new RangeError('Overlapping text edits are not allowed');
    if (edit.end > source.length) throw new RangeError('Edit range exceeds source length');
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
    lastStart = edit.start;
  }
  return next;
}

function containsRange(node, start, end) {
  return node?.start && node?.end && node.start.offset <= start && end <= node.end.offset;
}

function childValues(node) {
  if (node?.type === 'Object') return node.members.map((member) => ({ key: member.key, node: member.value }));
  if (node?.type === 'Array') return node.elements.map((element, index) => ({ key: index, node: element.value }));
  return [];
}

function findSmallestValueRegion(node, start, end, path = []) {
  if (!containsRange(node, start, end)) return undefined;
  for (const child of childValues(node)) {
    const found = findSmallestValueRegion(child.node, start, end, [...path, child.key]);
    if (found) return found;
  }
  return { node, path };
}

function offsetToPosition(source, offset) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset; i++) {
    if (source[i] === '\n') { line++; column = 1; }
    else column++;
  }
  return { offset, line, column };
}

function shiftPosition(position, absoluteSource, baseOffset) {
  if (!position) return position;
  return offsetToPosition(absoluteSource, baseOffset + position.offset);
}

function shiftComment(comment, absoluteSource, baseOffset) {
  return { ...comment, start: shiftPosition(comment.start, absoluteSource, baseOffset), end: shiftPosition(comment.end, absoluteSource, baseOffset) };
}

function shiftNode(node, absoluteSource, baseOffset) {
  if (!node || typeof node !== 'object') return node;
  const shifted = { ...node };
  if (node.start) shifted.start = shiftPosition(node.start, absoluteSource, baseOffset);
  if (node.end) shifted.end = shiftPosition(node.end, absoluteSource, baseOffset);
  if (node.keyStart) shifted.keyStart = shiftPosition(node.keyStart, absoluteSource, baseOffset);
  if (node.keyEnd) shifted.keyEnd = shiftPosition(node.keyEnd, absoluteSource, baseOffset);
  for (const key of ['leadingComments', 'trailingComments', 'beforeColonComments', 'beforeValueComments', 'danglingComments']) {
    if (node[key]) shifted[key] = node[key].map((comment) => shiftComment(comment, absoluteSource, baseOffset));
  }
  if (node.type === 'Object') shifted.members = node.members.map((member) => shiftNode(member, absoluteSource, baseOffset));
  else if (node.type === 'Array') shifted.elements = node.elements.map((element) => shiftNode(element, absoluteSource, baseOffset));
  else if (node.type === 'Member' || node.type === 'Element') shifted.value = shiftNode(node.value, absoluteSource, baseOffset);
  return shifted;
}

function setValueAtPath(root, path, value) {
  if (path.length === 0) return value;
  let parent = root;
  for (let i = 0; i < path.length - 1; i++) parent = parent[path[i]];
  parent[path[path.length - 1]] = value;
  return root;
}

function replaceAstAtPath(root, path, replacement) {
  if (path.length === 0) return replacement;
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (node.type === 'Object') node = node.members.find((member) => member.key === segment)?.value;
    else if (node.type === 'Array') node = node.elements[segment]?.value;
    else throw new Error('Invalid AST path');
  }
  const last = path[path.length - 1];
  if (node.type === 'Object') {
    const member = node.members.find((candidate) => candidate.key === last);
    if (!member) throw new Error('AST member disappeared during incremental edit');
    member.value = replacement;
    member.end = replacement.end;
  } else if (node.type === 'Array') {
    const element = node.elements[last];
    if (!element) throw new Error('AST element disappeared during incremental edit');
    element.value = replacement;
    element.start = replacement.start;
    element.end = replacement.end;
  } else throw new Error('Invalid AST parent');
  return root;
}

function shiftOffsetsAfter(node, threshold, delta, source) {
  if (!node || delta === 0) return;
  const shift = (position) => position && position.offset >= threshold ? offsetToPosition(source, position.offset + delta) : position;
  if (node.start) node.start = shift(node.start);
  if (node.end) node.end = shift(node.end);
  if (node.keyStart) node.keyStart = shift(node.keyStart);
  if (node.keyEnd) node.keyEnd = shift(node.keyEnd);
  for (const key of ['leadingComments', 'trailingComments', 'beforeColonComments', 'beforeValueComments', 'danglingComments']) {
    for (const comment of node[key] || []) { comment.start = shift(comment.start); comment.end = shift(comment.end); }
  }
  if (node.type === 'Object') for (const member of node.members) shiftOffsetsAfter(member, threshold, delta, source);
  else if (node.type === 'Array') for (const element of node.elements) shiftOffsetsAfter(element, threshold, delta, source);
  else if (node.type === 'Member' || node.type === 'Element') shiftOffsetsAfter(node.value, threshold, delta, source);
}

function commentsFromTokens(tokens) {
  return tokens
    .filter((token) => token.type === 'comment')
    .map((token) => ({ ...token.value, start: token.start, end: token.end }));
}

export function reparseRegion(document, edits) {
  assertDocument(document);
  if (!Array.isArray(edits) || edits.length === 0) return document;

  const minStart = Math.min(...edits.map((edit) => edit.start));
  const maxEnd = Math.max(...edits.map((edit) => edit.end));
  const region = findSmallestValueRegion(document.ast, minStart, maxEnd);
  if (!region) throw new RangeError('Edit range is outside the JOVA document');

  const oldRegionStart = region.node.start.offset;
  const oldRegionEnd = region.node.end.offset;
  const localEdits = edits.map((edit) => ({ start: edit.start - oldRegionStart, end: edit.end - oldRegionStart, text: edit.text }));
  if (localEdits.some((edit) => edit.start < 0 || edit.end > oldRegionEnd - oldRegionStart)) return undefined;

  const oldFragment = document.source.slice(oldRegionStart, oldRegionEnd);
  const newFragment = applyEdits(oldFragment, localEdits);
  const newSource = applyEdits(document.source, edits);

  // Semantic parsing and lexing are both confined to the smallest safe value region.
  const parsedFragment = parse(newFragment);
  const shiftedSubtree = shiftNode(parsedFragment.ast, newSource, oldRegionStart);
  reconcileSyntaxIdentity({ ast: region.node }, { ast: shiftedSubtree });
  const tokens = relexRegion(document, oldRegionStart, oldRegionEnd, newFragment, newSource);

  const delta = newFragment.length - oldFragment.length;
  const nextAst = document.ast;
  if (delta !== 0) shiftOffsetsAfter(nextAst, oldRegionEnd, delta, newSource);
  const ast = replaceAstAtPath(nextAst, region.path, shiftedSubtree);
  const value = setValueAtPath(document.value, region.path, structuredClone(parsedFragment.value));

  const next = {
    ...document,
    version: '0.4',
    source: newSource,
    ast,
    value,
    comments: commentsFromTokens(tokens),
    tokens,
    lastChangeRanges: edits.map(({ start, end, text }) => ({ start, oldEnd: end, newEnd: start + text.length })),
    incremental: {
      mode: region.path.length === 0 ? 'root-region' : 'subtree-region',
      path: region.path,
      oldRange: { start: oldRegionStart, end: oldRegionEnd },
      newRange: { start: oldRegionStart, end: oldRegionStart + newFragment.length },
      reparsedBytes: newFragment.length,
      relexedBytes: newFragment.length,
      totalBytes: newSource.length,
    },
  };
  return replaceDocument(document, next);
}

export function smallestReparseRegion(document, edits) {
  assertDocument(document);
  if (!Array.isArray(edits) || edits.length === 0) return undefined;
  const start = Math.min(...edits.map((edit) => edit.start));
  const end = Math.max(...edits.map((edit) => edit.end));
  const found = findSmallestValueRegion(document.ast, start, end);
  if (!found) return undefined;
  return { path: found.path, start: found.node.start.offset, end: found.node.end.offset, type: found.node.type };
}
