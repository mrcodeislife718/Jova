function childEntries(node) {
  if (!node) return [];
  if (node.type === 'Object') {
    return node.members.flatMap((member, index) => [
      { node: member, segment: `member:${index}` },
      { node: member.value, segment: `member-value:${index}` },
    ]);
  }
  if (node.type === 'Array') {
    return node.elements.flatMap((element, index) => [
      { node: element, segment: `element:${index}` },
      { node: element.value, segment: `element-value:${index}` },
    ]);
  }
  return [];
}

export function walkSyntax(node, visit, path = '$') {
  if (!node) return;
  visit(node, path);
  for (const child of childEntries(node)) walkSyntax(child.node, visit, `${path}/${child.segment}`);
}

function fingerprint(node) {
  if (node.type === 'Member') return `Member:${node.key}`;
  if (node.type === 'Element') return `Element:${node.value?.type}:${JSON.stringify(node.value?.value)}`;
  if (node.type === 'String' || node.type === 'Number' || node.type === 'Boolean' || node.type === 'Null') {
    return `${node.type}:${JSON.stringify(node.value)}`;
  }
  if (node.type === 'Object') return `Object:${node.members?.map((member) => member.key).join('|')}`;
  if (node.type === 'Array') return `Array:${node.elements?.length ?? 0}`;
  return node.type;
}

export function reconcileSyntaxIdentity(previous, next) {
  if (!previous?.ast || !next?.ast) return next;

  const byPath = new Map();
  const byFingerprint = new Map();
  walkSyntax(previous.ast, (node, path) => {
    byPath.set(path, node);
    const key = fingerprint(node);
    const bucket = byFingerprint.get(key) || [];
    bucket.push(node);
    byFingerprint.set(key, bucket);
  });

  const used = new Set();
  walkSyntax(next.ast, (node, path) => {
    const positional = byPath.get(path);
    if (positional?.id && positional.type === node.type && !used.has(positional.id)) {
      node.id = positional.id;
      used.add(positional.id);
      return;
    }

    const candidates = byFingerprint.get(fingerprint(node)) || [];
    const candidate = candidates.find((item) => item.id && !used.has(item.id));
    if (candidate) {
      node.id = candidate.id;
      used.add(candidate.id);
    }
  });

  return next;
}
