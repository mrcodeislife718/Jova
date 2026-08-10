export function stringify(value, options = {}) {
  const { space = 2 } = options;
  const json = JSON.stringify(value, null, space);
  if (json === undefined) throw new TypeError('Value is not representable as JOVA/JSON');
  return json;
}

export function serializeDocument(document, options = {}) {
  if (!document || !Object.prototype.hasOwnProperty.call(document, 'value')) {
    throw new TypeError('Expected a JOVA document');
  }

  if (options.preserveSource !== false && typeof document.source === 'string') {
    return document.source;
  }

  return stringify(document.value, options);
}
