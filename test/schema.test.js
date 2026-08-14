import test from 'node:test';
import assert from 'node:assert/strict';
import { parseValue, validate, compileSchema, inferSchema, runConformanceSuite, coreConformanceCases } from '../src/index.js';

test('strict parser accepts object and array trailing commas', () => {
  assert.deepEqual(parseValue('{"a":1,}'), { a: 1 });
  assert.deepEqual(parseValue('[1,2,]'), [1,2]);
});

test('schema validation reports exact data paths', () => {
  const schema = { type: 'object', required: ['name','age'], properties: { name: { type: 'string', minLength: 2 }, age: { type: 'integer', minimum: 0 } }, additionalProperties: false };
  const result = validate({ name: 'A', age: -1, extra: true }, schema);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === '$.name'));
  assert.ok(result.issues.some((issue) => issue.path === '$.age'));
  assert.ok(result.issues.some((issue) => issue.path === '$.extra'));
});

test('compiled schemas are deterministic and inferred schemas preserve structure', () => {
  const a = compileSchema({ type: 'object', properties: { x: { type: 'integer' } } });
  const b = compileSchema({ properties: { x: { type: 'integer' } }, type: 'object' });
  assert.equal(a.digest, b.digest);
  const inferred = inferSchema({ x: 1, tags: ['a'] });
  assert.equal(inferred.properties.x.type, 'integer');
  assert.equal(inferred.properties.tags.type, 'array');
});

test('core Scout conformance suite passes', () => {
  const suite = runConformanceSuite(coreConformanceCases);
  assert.equal(suite.ok, true, JSON.stringify(suite.results, null, 2));
});
