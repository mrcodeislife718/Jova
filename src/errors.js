export class ScoutSyntaxError extends SyntaxError {
  constructor(message, position) {
    const suffix = position ? ` at ${position.line}:${position.column}` : '';
    super(`${message}${suffix}`);
    this.name = 'ScoutSyntaxError';
    if (position) {
      this.position = { ...position };
      Object.assign(this, position);
    }
  }
}

// Backward-compatible name retained for the original JOVA-facing API and
// internal modules that still reference it while Scout naming is adopted.
export const JovaSyntaxError = ScoutSyntaxError;
