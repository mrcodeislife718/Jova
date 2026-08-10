import { parseValue } from './parser.js';
import { stringify } from './serializer.js';

export function toJSON(source, options = {}) {
  return stringify(parseValue(source), options);
}

export function fromJSON(source, options = {}) {
  const value = JSON.parse(source);
  return stringify(value, options);
}
