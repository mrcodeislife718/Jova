function children(node) {
  if (!node) return [];
  if (node.type === 'Object') return node.members.flatMap((member) => [member, member.value]);
  if (node.type === 'Array') return node.elements.flatMap((element) => [element, element.value]);
  return [];
}

export function walkSyntax(node, visit) {
  if (!node) return;
  visit(node);
  for (const child of children(node)) walkSyntax(child, visit);
}

function fingerprint(node) {
  if (node.type === 'Member') return `Member:${node.key}`;
  if (node.type === 'Element') return `Element:${node.value?.type}`;
  if (node.type === 'String' || node.type === 'Number' || node.type === 'Boolean' || node.type === 'Null') {
    return `${node.type}:${JSON.stringify(node.value)}`;
  }
  return node.type;
}

export function reconcileSyntaxIdentity(previous, next) {
  if (!previous?.ast || !next?.ast) return next;
  const buckets = new Map();
  walkSyntax(previous.ast, (node) => {
    const key = fingerprint(node);
    const bucket = buckets.get(key) || [];
    bucket.push(node.id);
    buckets.set(key, bucket);
  });

  const used = new Set();
  walkSyntax(next.ast, (node) => {
    const bucket = buckets.get(fingerprint(node)) || [];
    const id = bucket.find((candidate) => candidate && !used.has(candidate));
    if (id) {
      node.id = id;
      used.add(id);
    }
  });
  return next;
}
