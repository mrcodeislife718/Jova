import crypto from 'node:crypto';
import { parseValue } from './parser.js';
import { stringify } from './serializer.js';

export function validate(value, schema, options = {}) {
  const issues = [];
  visit(value, schema, options.path ?? '$', issues, options);
  return { ok: issues.length === 0, issues, value };
}

export function validateSource(source, schema, options = {}) {
  try {
    const value = parseValue(source);
    return validate(value, schema, options);
  } catch (error) {
    return { ok: false, value: null, issues: [{ code: 'SCOUT-SYNTAX', path: '$', message: error.message, location: error.position ?? null }] };
  }
}

export function compileSchema(schema) {
  const normalized = normalizeSchema(schema);
  const digest = crypto.createHash('sha256').update(JSON.stringify(sortObject(normalized))).digest('hex');
  const validator = (value, options = {}) => validate(value, normalized, options);
  validator.schema = normalized;
  validator.digest = digest;
  return validator;
}

export function inferSchema(value) {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    const schemas = value.map(inferSchema);
    return { type: 'array', items: unifySchemas(schemas) };
  }
  if (typeof value === 'object') {
    return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, inferSchema(entry)])), required: Object.keys(value).sort(), additionalProperties: true };
  }
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
  return { type: typeof value };
}

export function conformanceCase(name, source, expected, { schema } = {}) {
  const result = { name, source, expected: structuredClone(expected), passed: false, errors: [] };
  try {
    const value = parseValue(source);
    if (!deepEqual(value, expected)) result.errors.push(`parsed value mismatch: ${JSON.stringify(value)} != ${JSON.stringify(expected)}`);
    const roundTrip = parseValue(stringify(value));
    if (!deepEqual(roundTrip, expected)) result.errors.push('round-trip value mismatch');
    if (schema) {
      const validation = validate(value, schema);
      if (!validation.ok) result.errors.push(...validation.issues.map((issue) => `${issue.path}: ${issue.message}`));
    }
  } catch (error) { result.errors.push(error.message); }
  result.passed = result.errors.length === 0;
  return result;
}

export function runConformanceSuite(cases = []) {
  const results = cases.map((entry) => conformanceCase(entry.name, entry.source, entry.expected, entry));
  return { ok: results.every((result) => result.passed), total: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, results };
}

export const coreConformanceCases = Object.freeze([
  { name: 'comments', source: '{ // comment\n "a": 1\n}', expected: { a: 1 } },
  { name: 'trailing-object-comma', source: '{"a":1,}', expected: { a: 1 } },
  { name: 'trailing-array-comma', source: '[1,2,]', expected: [1,2] },
  { name: 'nested-data', source: '{"a":[true,null,{"b":"x"}]}', expected: { a: [true, null, { b: 'x' }] } }
]);

function visit(value, schema, path, issues, options) {
  if (schema == null || schema === true) return;
  if (schema === false) { issue(issues, 'SCOUT-SCHEMA-FALSE', path, 'value is forbidden by schema'); return; }
  if (Array.isArray(schema.anyOf)) { if (!schema.anyOf.some((candidate) => validate(value, candidate).ok)) issue(issues, 'SCOUT-SCHEMA-ANYOF', path, 'value does not match any allowed schema'); return; }
  if (Array.isArray(schema.oneOf)) { const matches = schema.oneOf.filter((candidate) => validate(value, candidate).ok).length; if (matches !== 1) issue(issues, 'SCOUT-SCHEMA-ONEOF', path, `value must match exactly one schema; matched ${matches}`); return; }
  if ('const' in schema && !deepEqual(value, schema.const)) issue(issues, 'SCOUT-SCHEMA-CONST', path, `expected constant ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((entry) => deepEqual(entry, value))) issue(issues, 'SCOUT-SCHEMA-ENUM', path, 'value is not in the allowed enum');
  const types = schema.type == null ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length && !types.some((type) => matchesType(value, type))) { issue(issues, 'SCOUT-SCHEMA-TYPE', path, `expected ${types.join(' | ')}, received ${actualType(value)}`); return; }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) issue(issues, 'SCOUT-SCHEMA-MIN_LENGTH', path, `minimum length is ${schema.minLength}`);
    if (schema.maxLength != null && value.length > schema.maxLength) issue(issues, 'SCOUT-SCHEMA-MAX_LENGTH', path, `maximum length is ${schema.maxLength}`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) issue(issues, 'SCOUT-SCHEMA-PATTERN', path, `value does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) issue(issues, 'SCOUT-SCHEMA-MINIMUM', path, `minimum is ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) issue(issues, 'SCOUT-SCHEMA-MAXIMUM', path, `maximum is ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) issue(issues, 'SCOUT-SCHEMA-MIN_ITEMS', path, `minimum items is ${schema.minItems}`);
    if (schema.maxItems != null && value.length > schema.maxItems) issue(issues, 'SCOUT-SCHEMA-MAX_ITEMS', path, `maximum items is ${schema.maxItems}`);
    if (schema.uniqueItems) {
      const seen = new Set(); for (let i=0;i<value.length;i++){const key=JSON.stringify(sortObject(value[i]));if(seen.has(key)) issue(issues,'SCOUT-SCHEMA-UNIQUE',`${path}[${i}]`,'array item must be unique');seen.add(key);}
    }
    if (schema.items) for (let i = 0; i < value.length; i++) visit(value[i], schema.items, `${path}[${i}]`, issues, options);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const required = new Set(schema.required ?? []);
    for (const key of required) if (!(key in value)) issue(issues, 'SCOUT-SCHEMA-REQUIRED', `${path}.${key}`, 'required property is missing');
    for (const [key, entry] of Object.entries(value)) {
      if (schema.properties?.[key]) visit(entry, schema.properties[key], `${path}.${key}`, issues, options);
      else if (schema.additionalProperties === false) issue(issues, 'SCOUT-SCHEMA-ADDITIONAL', `${path}.${key}`, 'additional property is not allowed');
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') visit(entry, schema.additionalProperties, `${path}.${key}`, issues, options);
    }
  }
}

function normalizeSchema(schema) { if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new TypeError('Scout schema must be an object'); return structuredClone(schema); }
function actualType(value) { if (value === null) return 'null'; if (Array.isArray(value)) return 'array'; if (typeof value === 'number' && Number.isInteger(value)) return 'integer'; return typeof value; }
function matchesType(value, type) { if (type === 'integer') return typeof value === 'number' && Number.isInteger(value); if (type === 'number') return typeof value === 'number' && Number.isFinite(value); if (type === 'array') return Array.isArray(value); if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value); if (type === 'null') return value === null; return typeof value === type; }
function issue(issues, code, path, message) { issues.push({ code, path, message }); }
function deepEqual(a,b) { return JSON.stringify(sortObject(a)) === JSON.stringify(sortObject(b)); }
function sortObject(value) { if (Array.isArray(value)) return value.map(sortObject); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])])); return value; }
function unifySchemas(schemas) { const unique = []; for (const schema of schemas) if (!unique.some((entry) => deepEqual(entry, schema))) unique.push(schema); if (!unique.length) return {}; if (unique.length === 1) return unique[0]; return { anyOf: unique }; }
