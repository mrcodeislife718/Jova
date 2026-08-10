function assertDocument(document) {
  if (!document || document.type !== 'Document' || !document.ast) {
    throw new TypeError('Expected a JOVA document');
  }
}

export function getNode(document, path = []) {
  assertDocument(document);
  if (!Array.isArray(path)) throw new TypeError('Path must be an array');

  let node = document.ast;
  for (const segment of path) {
    if (node.type === 'Object') {
      const member = node.members.find((candidate) => candidate.key === segment);
      if (!member) return undefined;
      node = member.value;
      continue;
    }

    if (node.type === 'Array') {
      if (!Number.isInteger(segment) || segment < 0) return undefined;
      const element = node.elements[segment];
      if (!element) return undefined;
      node = element.value;
      continue;
    }

    return undefined;
  }

  return node;
}

export function getMember(document, path = []) {
  assertDocument(document);
  if (!Array.isArray(path) || path.length === 0) return undefined;

  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1];
  const parent = getNode(document, parentPath);
  if (!parent || parent.type !== 'Object') return undefined;
  return parent.members.find((member) => member.key === key);
}

export function setValue(document, path, value) {
  assertDocument(document);
  if (!Array.isArray(path)) throw new TypeError('Path must be an array');

  if (path.length === 0) {
    document.value = value;
    return document;
  }

  let target = document.value;
  for (let i = 0; i < path.length - 1; i++) {
    if (target == null || typeof target !== 'object') {
      throw new TypeError(`Cannot traverse JOVA value at ${JSON.stringify(path.slice(0, i + 1))}`);
    }
    target = target[path[i]];
  }

  if (target == null || typeof target !== 'object') {
    throw new TypeError(`Cannot set JOVA value at ${JSON.stringify(path)}`);
  }

  target[path[path.length - 1]] = value;
  return document;
}

export function createValueNode(value) {
  if (value === null) return { type: 'Null', value: null, leadingComments: [], trailingComments: [] };
  if (Array.isArray(value)) {
    return {
      type: 'Array',
      elements: value.map((item, index) => ({
        type: 'Element',
        index,
        leadingComments: [],
        trailingComments: [],
        value: createValueNode(item),
      })),
      leadingComments: [],
      trailingComments: [],
      danglingComments: [],
    };
  }
  if (typeof value === 'object') {
    return {
      type: 'Object',
      members: Object.entries(value).map(([key, item]) => ({
        type: 'Member',
        key,
        leadingComments: [],
        beforeColonComments: [],
        beforeValueComments: [],
        trailingComments: [],
        value: createValueNode(item),
      })),
      leadingComments: [],
      trailingComments: [],
      danglingComments: [],
    };
  }
  if (typeof value === 'string') return { type: 'String', value, leadingComments: [], trailingComments: [] };
  if (typeof value === 'number') return { type: 'Number', value, leadingComments: [], trailingComments: [] };
  if (typeof value === 'boolean') return { type: 'Boolean', value, leadingComments: [], trailingComments: [] };
  throw new TypeError(`Value of type ${typeof value} is not representable as JOVA`);
}
