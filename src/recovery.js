import { parse } from './parser.js';
import { parseRecovering } from './recovery-parser.js';
import { reconcileSyntaxIdentity } from './identity.js';
import { ScoutSyntaxError } from './errors.js';

function preservePreviousIdentity(previousDocument, recovered) {
  if (!previousDocument?.ast || !recovered?.ast) return recovered;
  reconcileSyntaxIdentity(previousDocument, recovered);
  const lastValid = previousDocument.incomplete ? previousDocument.lastValidDocument : previousDocument;
  recovered.lastValidDocument = lastValid;
  recovered.revision = previousDocument.revision ?? 0;
  if (lastValid?.value !== undefined) recovered.value = structuredClone(lastValid.value);
  return recovered;
}

export function parseTolerant(source, previousDocument) {
  try {
    const document = parse(source);
    document.diagnostics = [];
    document.recoveryNodes = [];
    document.incomplete = false;
    document.recoveryMode = 'strict';
    if (previousDocument?.ast) reconcileSyntaxIdentity(previousDocument, document);
    return document;
  } catch (error) {
    if (!(error instanceof ScoutSyntaxError)) throw error;
    const recovered = parseRecovering(source);
    return preservePreviousIdentity(previousDocument, recovered);
  }
}

export function isRecoveryNode(node) {
  return node?.type === 'Recovery';
}
