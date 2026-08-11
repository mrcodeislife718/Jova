import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listTargetProfiles,
  getTargetProfile,
  targetSupports,
  listBridges,
  getBridge,
  defineForeignFunction,
  addDependencyCommand,
  installCommand,
  createScoutAppCommand,
  doctorReport,
} from '../src/index.js';

test('Scout exposes canonical target profiles', () => {
  const ids = listTargetProfiles().map((target) => target.id);
  for (const expected of ['web','node','linux-x64','windows-x64','macos-arm64','ios','android','wasm','embedded']) {
    assert.ok(ids.includes(expected), `missing target ${expected}`);
  }
  assert.equal(targetSupports('linux-x64', 'ffi'), true);
  assert.equal(targetSupports('web', 'ffi'), false);
  assert.equal(getTargetProfile('unknown'), null);
});

test('Scout exposes foreign language and native bridges', () => {
  const ids = listBridges().map((bridge) => bridge.id);
  for (const expected of ['c','cpp','rust','python','javascript','java','wasm','native','cuda','metal']) {
    assert.ok(ids.includes(expected), `missing bridge ${expected}`);
  }
  assert.equal(getBridge('c').kind, 'abi');
});

test('raw FFI declarations are explicit interoperability metadata', () => {
  const fn = defineForeignFunction({
    bridge: 'c',
    library: 'sqlite3',
    name: 'sqlite3_open',
    params: ['cstring', '*mut Ptr'],
    returns: 'i32',
  });
  assert.equal(fn.bridge, 'c');
  assert.equal(fn.library, 'sqlite3');
  assert.equal(fn.unsafe, true);
  assert.throws(() => defineForeignFunction({ bridge: 'missing', library: 'x', name: 'y' }));
});

test('npm pnpm and Yarn creation commands remain first-class', () => {
  assert.deepEqual(createScoutAppCommand('npm', 'blank'), ['npx','create-scout-app@latest','--template','blank']);
  assert.deepEqual(createScoutAppCommand('pnpm', 'blank'), ['pnpm','create','scout-app@latest','--template','blank']);
  assert.deepEqual(createScoutAppCommand('yarn', 'blank'), ['yarn','create','scout-app','--template','blank']);
  assert.deepEqual(addDependencyCommand('axios', 'pnpm'), ['pnpm','add','axios']);
  assert.deepEqual(installCommand('npm'), ['npm','install']);
});

test('doctor report normalizes readiness checks', () => {
  const report = doctorReport({
    platform: 'test', arch: 'test', cpus: 1, memoryBytes: 1,
    tools: { node:'v1', npm:'1', pnpm:null, yarn:null, python3:'3', python:null, cc:'cc', clang:null, gcc:null, 'c++':null, rustc:null, cargo:null, java:null, javac:null, swift:null, nvcc:null },
    packageManagers: ['npm'], nativeCompilers: ['cc'],
    foreignRuntimes: { javascript:true, python:true, rust:false, java:false, swift:false, cuda:false },
  });
  assert.equal(report.checks.find((check) => check.name === 'Node runtime').available, true);
  assert.equal(report.checks.find((check) => check.name === 'Rust toolchain').available, false);
});
