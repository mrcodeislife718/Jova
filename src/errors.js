export class JovaSyntaxError extends SyntaxError {
  constructor(message, position) {
    const suffix = position ? ` at ${position.line}:${position.column}` : '';
    super(`${message}${suffix}`);
    this.name = 'JovaSyntaxError';
    if (position) Object.assign(this, position);
  }
}
