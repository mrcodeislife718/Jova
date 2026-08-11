import { parseTolerant } from './recovery.js';
import { positionToOffset, offsetToLspPosition } from './language-service.js';

function range(source, start, end) {
  return { start: offsetToLspPosition(source, start), end: offsetToLspPosition(source, end) };
}

function walk(node, visit, parent) {
  if (!node) return;
  visit(node, parent);
  if (node.type === 'Object') for (const member of node.members || []) { visit(member, node); walk(member.value, visit, member); }
  if (node.type === 'Array') for (const element of node.elements || []) { visit(element, node); walk(element.value, visit, element); }
}

function nodeAtOffset(document, offset) {
  let best;
  walk(document.ast, (node) => {
    if (!node.start || !node.end) return;
    if (node.start.offset <= offset && offset <= node.end.offset) {
      if (!best || node.end.offset - node.start.offset <= best.end.offset - best.start.offset) best = node;
    }
  });
  return best;
}

export function completionCandidates(document, position) {
  const offset = positionToOffset(document.source, position);
  const recovery = (document.recoveryNodes || []).find((node) => node.start.offset <= offset + 1 && offset - 1 <= node.end.offset) || document.recoveryNodes?.[0];
  const expected = recovery?.expected || [];
  const candidates = [];
  const add = (label, insertText, kind = 12) => candidates.push({ label, insertText, kind });
  if (expected.includes(':')) add(':', ': ', 14);
  if (expected.includes('}')) add('}', '}', 14);
  if (expected.includes(']')) add(']', ']', 14);
  if (expected.includes(',')) add(',', ', ', 14);
  if (expected.includes('member')) add('property', '"key": null', 10);
  if (expected.some((item) => ['value','object','array','string','number','true','false','null'].includes(item))) {
    add('object', '{}', 10); add('array', '[]', 10); add('string', '""', 12); add('number', '0', 12); add('true', 'true', 12); add('false', 'false', 12); add('null', 'null', 12);
  }
  return candidates;
}

export function quickFixes(document) {
  const fixes = [];
  for (const node of document.recoveryNodes || []) {
    const expected = node.expected || [];
    const at = node.start.offset;
    const add = (title, text) => fixes.push({ title, kind: 'quickfix', edit: { range: range(document.source, at, at), newText: text } });
    if (expected.includes(':')) add('Insert missing colon', ': ');
    if (expected.includes('}')) add('Close object', '}');
    if (expected.includes(']')) add('Close array', ']');
    if (expected.includes('*/')) add('Close block comment', '*/');
    if (expected.includes('value') || expected.includes('null')) add('Insert null value', 'null');
  }
  return fixes;
}

export function selectionRanges(document, positions) {
  return positions.map((position) => {
    const offset = positionToOffset(document.source, position);
    const nodes = [];
    walk(document.ast, (node) => {
      if (node.start?.offset <= offset && offset <= node.end?.offset) nodes.push(node);
    });
    nodes.sort((a,b) => (a.end.offset-a.start.offset) - (b.end.offset-b.start.offset));
    let parent;
    for (const node of nodes.reverse()) parent = { range: range(document.source, node.start.offset, node.end.offset), parent };
    return parent;
  });
}

export function foldingRanges(document) {
  const folds = [];
  walk(document.ast, (node) => {
    if ((node.type === 'Object' || node.type === 'Array') && node.start.line < node.end.line) {
      folds.push({ startLine: node.start.line - 1, startCharacter: node.start.column - 1, endLine: node.end.line - 1, endCharacter: node.end.column - 1, kind: 'region' });
    }
  });
  return folds;
}

export function renameEdits(document, position, newName) {
  if (typeof newName !== 'string' || !newName.length) throw new TypeError('newName is required');
  const offset = positionToOffset(document.source, position);
  let member;
  walk(document.ast, (node) => {
    if (node.type === 'Member' && node.keyStart?.offset <= offset && offset <= node.keyEnd?.offset) member = node;
  });
  if (!member) return undefined;
  return [{ range: range(document.source, member.keyStart.offset, member.keyEnd.offset), newText: JSON.stringify(newName) }];
}

export function recoverEditorDocument(source, previous) {
  return parseTolerant(source, previous);
}
