import { parse } from './parser.js';
import { reconcileSyntaxIdentity } from './identity.js';
import { reparseRegion } from './incremental.js';

function assertDocument(document) {
  if (!document || document.type !== 'Document' || typeof document.source !== 'string') throw new TypeError('Expected a JOVA document');
}

function replaceDocument(document, next) {
  for (const key of Object.keys(document)) delete document[key];
  Object.assign(document, next);
  return document;
}

export function createEditSession(document) {
  assertDocument(document);
  return { document, undoStack: [], redoStack: [], revision: document.revision ?? 0 };
}

export function beginTransaction(session, label = 'edit') {
  if (!session?.document) throw new TypeError('Expected a JOVA edit session');
  return { session, label, baseSource: session.document.source, edits: [], closed: false };
}

export function addTextEdit(transaction, start, end, text) {
  if (!transaction || transaction.closed) throw new Error('Transaction is closed');
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) throw new RangeError('Invalid edit range');
  if (typeof text !== 'string') throw new TypeError('Edit text must be a string');
  transaction.edits.push({ start, end, text });
  return transaction;
}

function applyEdits(source, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let lastStart = source.length + 1;
  let next = source;
  for (const edit of sorted) {
    if (edit.end > lastStart) throw new RangeError('Overlapping text edits are not allowed');
    if (edit.end > source.length) throw new RangeError('Edit range exceeds source length');
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
    lastStart = edit.start;
  }
  return next;
}

export function commitTransaction(transaction, options = {}) {
  if (!transaction || transaction.closed) throw new Error('Transaction is closed');
  const { session } = transaction;
  const before = session.document.source;
  const after = applyEdits(before, transaction.edits);

  let parsed;
  if (options.incremental !== false && transaction.edits.length > 0) {
    try {
      parsed = reparseRegion(session.document, transaction.edits);
    } catch {
      parsed = undefined;
    }
  }
  if (!parsed) parsed = reconcileSyntaxIdentity(session.document, parse(after));

  session.undoStack.push({ label: transaction.label, before, after, edits: transaction.edits.map((edit) => ({ ...edit })) });
  session.redoStack.length = 0;
  session.revision++;
  if (parsed !== session.document) replaceDocument(session.document, parsed);
  session.document.revision = session.revision;
  session.document.lastChangeRanges = transaction.edits.map(({ start, end, text }) => ({ start, oldEnd: end, newEnd: start + text.length }));
  transaction.closed = true;
  return session.document;
}

export function rollbackTransaction(transaction) {
  if (!transaction || transaction.closed) throw new Error('Transaction is closed');
  transaction.closed = true;
  return transaction.session.document;
}

function restore(session, source) {
  const parsed = reconcileSyntaxIdentity(session.document, parse(source));
  session.revision++;
  replaceDocument(session.document, parsed);
  session.document.revision = session.revision;
  session.document.lastChangeRanges = [];
  session.document.incremental = { mode: 'history-restore', reparsedBytes: source.length, totalBytes: source.length };
  return session.document;
}

export function undo(session) {
  const entry = session?.undoStack?.pop();
  if (!entry) return session?.document;
  session.redoStack.push(entry);
  return restore(session, entry.before);
}

export function redo(session) {
  const entry = session?.redoStack?.pop();
  if (!entry) return session?.document;
  session.undoStack.push(entry);
  return restore(session, entry.after);
}

export function applyTextEdits(document, edits, options = {}) {
  const session = createEditSession(document);
  const transaction = beginTransaction(session, options.label ?? 'text edits');
  for (const edit of edits) addTextEdit(transaction, edit.start, edit.end, edit.text);
  return commitTransaction(transaction, options);
}

export function reparseIncremental(document, edits) {
  const result = reparseRegion(document, edits);
  if (result) {
    result.revision = (result.revision ?? 0) + 1;
    return result;
  }
  return applyTextEdits(document, edits, { incremental: false, label: 'incremental fallback' });
}
