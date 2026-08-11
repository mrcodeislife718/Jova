function position(source, offset) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < Math.min(offset, source.length); i++) {
    if (source[i] === '\n') { line++; column = 1; }
    else column++;
  }
  return { offset, line, column };
}

function diag(source, message, start, end = start, expected = [], code = 'syntax-recovery') {
  return { severity: 1, source: 'jova', code, message, expected, start: position(source, start), end: position(source, end) };
}

function recovery(source, start, end, message, expected = []) {
  return {
    id: `recovery:${start}:${end}`,
    type: 'Recovery',
    message,
    expected,
    raw: source.slice(start, end),
    start: position(source, start),
    end: position(source, end),
    leadingComments: [],
    trailingComments: [],
  };
}

function scanner(source) {
  let i = 0;
  const tokens = [];
  const diagnostics = [];
  const punct = new Set(['{','}','[',']',':',',']);
  const push = (type, value, start, end = i, extra = {}) => tokens.push({ type, value, start: position(source,start), end: position(source,end), raw: source.slice(start,end), ...extra });
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    const start = i;
    if (ch === '/' && source[i+1] === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i++;
      push('comment', { style:'line', text: source.slice(start+2,i) }, start);
      continue;
    }
    if (ch === '/' && source[i+1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i+1] === '/')) i++;
      if (i >= source.length) {
        diagnostics.push(diag(source,'Unterminated block comment',start,source.length,['*/'],'unterminated-comment'));
        push('comment', { style:'block', text: source.slice(start+2) }, start, source.length, { incomplete:true });
        break;
      }
      i += 2;
      push('comment', { style:'block', text: source.slice(start+2,i-2) }, start);
      continue;
    }
    if (punct.has(ch)) { i++; push(ch,ch,start); continue; }
    if (ch === '"') {
      i++;
      let escaped = false;
      let closed = false;
      while (i < source.length) {
        const c = source[i++];
        if (!escaped && c === '"') { closed = true; break; }
        if (!escaped && c === '\\') escaped = true; else escaped = false;
      }
      if (!closed) {
        diagnostics.push(diag(source,'Unterminated string',start,source.length,['"'],'unterminated-string'));
        push('invalid-string', source.slice(start+1), start, source.length, { incomplete:true });
        break;
      }
      const raw = source.slice(start,i);
      let value;
      try { value = JSON.parse(raw); }
      catch { value = raw.slice(1,-1); diagnostics.push(diag(source,'Invalid string escape',start,i,['valid string escape'])); }
      push('string',value,start);
      continue;
    }
    const rest = source.slice(i);
    const number = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) { i += number[0].length; push('number',Number(number[0]),start); continue; }
    const literal = [['true',true],['false',false],['null',null]].find(([word]) => rest.startsWith(word));
    if (literal) { i += literal[0].length; push('literal',literal[1],start); continue; }
    i++;
    diagnostics.push(diag(source,`Unexpected character ${JSON.stringify(ch)}`,start,i,['value','member','}',']',',']));
    push('invalid',ch,start);
  }
  tokens.push({ type:'eof', value:null, start:position(source,source.length), end:position(source,source.length), raw:'' });
  return { tokens, diagnostics };
}

function scalarNode(token) {
  const type = token.value === null ? 'Null' : typeof token.value === 'string' ? 'String' : typeof token.value === 'number' ? 'Number' : 'Boolean';
  return { id:`recover:${token.start.offset}`, type, value:token.value, raw:token.raw, start:token.start, end:token.end, leadingComments:[], trailingComments:[] };
}

export function parseRecovering(source) {
  const scanned = scanner(source);
  const { tokens } = scanned;
  const diagnostics = [...scanned.diagnostics];
  const recoveryNodes = [];
  let i = 0;
  const current = () => tokens[i];
  const consume = () => tokens[i++];
  const skipComments = () => { while (current()?.type === 'comment') i++; };
  const sync = (types) => { while (current() && current().type !== 'eof' && !types.includes(current().type)) i++; };

  function valueNode() {
    skipComments();
    const token = current();
    if (!token || token.type === 'eof' || token.type === '}' || token.type === ']' || token.type === ',') {
      const at = token?.start.offset ?? source.length;
      const node = recovery(source,at,at,'Expected a value',['object','array','string','number','true','false','null']);
      diagnostics.push(diag(source,node.message,at,at,node.expected));
      recoveryNodes.push(node);
      return { value: undefined, node };
    }
    if (token.type === '{') return objectNode();
    if (token.type === '[') return arrayNode();
    if (token.type === 'string' || token.type === 'number' || token.type === 'literal') { consume(); return { value:token.value, node:scalarNode(token) }; }
    if (token.type === 'invalid-string') {
      consume();
      const node = recovery(source,token.start.offset,token.end.offset,'Unterminated string',['"']);
      recoveryNodes.push(node);
      return { value:undefined, node };
    }
    consume();
    const node = recovery(source,token.start.offset,token.end.offset,'Invalid value',['object','array','string','number','true','false','null']);
    recoveryNodes.push(node);
    return { value:undefined, node };
  }

  function objectNode() {
    const open = consume();
    const members = [];
    const out = {};
    skipComments();
    while (current()?.type !== 'eof' && current()?.type !== '}') {
      skipComments();
      const key = current();
      if (key?.type !== 'string') {
        const start = key?.start.offset ?? source.length;
        const node = recovery(source,start,key?.end.offset ?? start,'Expected object member key',['string','}']);
        recoveryNodes.push(node);
        diagnostics.push(diag(source,node.message,start,key?.end.offset ?? start,node.expected));
        members.push({ id:`member-recovery:${start}`, type:'Member', key:`<recovery@${start}>`, start:node.start, end:node.end, keyStart:node.start, keyEnd:node.end, value:node, leadingComments:[], beforeColonComments:[], beforeValueComments:[], trailingComments:[], recovery:true });
        sync([',','}']);
        if (current()?.type === ',') { consume(); continue; }
        break;
      }
      consume();
      skipComments();
      if (current()?.type !== ':') {
        const at = current()?.start.offset ?? key.end.offset;
        const node = recovery(source,at,at,'Expected colon after object key',[':']);
        recoveryNodes.push(node);
        diagnostics.push(diag(source,node.message,at,at,node.expected));
      } else consume();
      const parsed = valueNode();
      const member = {
        id:`member:${key.start.offset}`,
        type:'Member', key:key.value, rawKey:key.raw, keyStart:key.start, keyEnd:key.end,
        start:key.start, end:parsed.node.end, value:parsed.node,
        leadingComments:[], beforeColonComments:[], beforeValueComments:[], trailingComments:[], recovery: parsed.node.type === 'Recovery'
      };
      members.push(member);
      if (parsed.value !== undefined) out[key.value] = parsed.value;
      skipComments();
      if (current()?.type === ',') { consume(); skipComments(); continue; }
      if (current()?.type === '}') break;
      if (current()?.type === 'eof') break;
      const at = current().start.offset;
      diagnostics.push(diag(source,'Expected comma or closing brace',at,current().end.offset,[',','}']));
      sync([',','}']);
      if (current()?.type === ',') consume();
    }
    let close;
    if (current()?.type === '}') close = consume();
    else {
      const at = current()?.start.offset ?? source.length;
      const node = recovery(source,at,at,'Incomplete object',['}']);
      recoveryNodes.push(node);
      diagnostics.push(diag(source,node.message,at,at,node.expected));
      close = { end: position(source,at) };
    }
    return { value:out, node:{ id:`object:${open.start.offset}`, type:'Object', members, start:open.start, end:close.end, leadingComments:[], trailingComments:[], danglingComments:[], incomplete: members.some(m=>m.recovery) || !close.raw } };
  }

  function arrayNode() {
    const open = consume();
    const elements = [];
    const out = [];
    skipComments();
    while (current()?.type !== 'eof' && current()?.type !== ']') {
      const parsed = valueNode();
      const index = elements.length;
      elements.push({ id:`element:${parsed.node.start.offset}:${index}`, type:'Element', index, start:parsed.node.start, end:parsed.node.end, value:parsed.node, leadingComments:[], trailingComments:[], recovery:parsed.node.type==='Recovery' });
      if (parsed.value !== undefined) out.push(parsed.value);
      else out.push(undefined);
      skipComments();
      if (current()?.type === ',') { consume(); skipComments(); continue; }
      if (current()?.type === ']') break;
      if (current()?.type === 'eof') break;
      const at = current().start.offset;
      diagnostics.push(diag(source,'Expected comma or closing bracket',at,current().end.offset,[',',']']));
      sync([',',']']);
      if (current()?.type === ',') consume();
    }
    let close;
    if (current()?.type === ']') close = consume();
    else {
      const at = current()?.start.offset ?? source.length;
      const node = recovery(source,at,at,'Incomplete array',[']']);
      recoveryNodes.push(node);
      diagnostics.push(diag(source,node.message,at,at,node.expected));
      close = { end:position(source,at) };
    }
    return { value:out, node:{ id:`array:${open.start.offset}`, type:'Array', elements, start:open.start, end:close.end, leadingComments:[], trailingComments:[], danglingComments:[], incomplete:elements.some(e=>e.recovery) || !close.raw } };
  }

  const parsed = valueNode();
  skipComments();
  if (current()?.type !== 'eof') {
    diagnostics.push(diag(source,'Unexpected content after root value',current().start.offset,current().end.offset,['eof']));
  }
  return {
    type:'Document', version:'0.4', revision:0, source, value:parsed.value, ast:parsed.node,
    comments:tokens.filter(t=>t.type==='comment').map(t=>({ ...t.value, start:t.start, end:t.end })),
    tokens, diagnostics, recoveryNodes, incomplete: diagnostics.length > 0 || recoveryNodes.length > 0,
    lastChangeRanges:[], recoveryMode:'mixed-tree'
  };
}
