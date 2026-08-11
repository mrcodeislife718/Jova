export const BRIDGES = Object.freeze({
  c: { id: 'c', kind: 'abi', boundary: 'native', ownership: 'explicit', capabilities: ['raw-ffi', 'headers', 'shared-libraries'] },
  cpp: { id: 'cpp', kind: 'generated-wrapper', boundary: 'native', ownership: 'explicit', capabilities: ['c-abi-wrapper', 'bindings'] },
  rust: { id: 'rust', kind: 'generated-wrapper', boundary: 'native', ownership: 'explicit', capabilities: ['c-abi', 'bindings', 'cargo-metadata'] },
  python: { id: 'python', kind: 'foreign-runtime', boundary: 'process-or-embedded', ownership: 'foreign-runtime', capabilities: ['imports', 'callables', 'objects', 'numpy-buffer-interop'] },
  javascript: { id: 'javascript', kind: 'foreign-runtime', boundary: 'runtime', ownership: 'garbage-collected', capabilities: ['npm', 'esm', 'callbacks', 'promises'] },
  java: { id: 'java', kind: 'foreign-runtime', boundary: 'jvm', ownership: 'garbage-collected', capabilities: ['classes', 'methods', 'maven', 'gradle'] },
  kotlin: { id: 'kotlin', kind: 'foreign-runtime', boundary: 'jvm', ownership: 'garbage-collected', capabilities: ['classes', 'methods', 'gradle'] },
  'objective-c': { id: 'objective-c', kind: 'native-runtime', boundary: 'darwin', ownership: 'reference-counted', capabilities: ['frameworks', 'objc-runtime'] },
  swift: { id: 'swift', kind: 'generated-wrapper', boundary: 'darwin', ownership: 'reference-counted', capabilities: ['frameworks', 'c-interop'] },
  wasm: { id: 'wasm', kind: 'portable-binary', boundary: 'wasm', ownership: 'linear-memory', capabilities: ['imports', 'exports', 'component-model'] },
  native: { id: 'native', kind: 'platform', boundary: 'os', ownership: 'mixed', capabilities: ['system-apis', 'dynamic-libraries', 'syscalls-via-safe-wrappers'] },
  cuda: { id: 'cuda', kind: 'accelerator', boundary: 'gpu', ownership: 'device-memory', capabilities: ['kernels', 'streams', 'device-buffers'] },
  metal: { id: 'metal', kind: 'accelerator', boundary: 'gpu', ownership: 'device-memory', capabilities: ['kernels', 'command-buffers', 'device-buffers'] },
});

export const INTEROP_TYPES = Object.freeze({
  integers: ['i8','i16','i32','i64','u8','u16','u32','u64','isize','usize'],
  floats: ['f32','f64'],
  scalar: ['bool','char'],
  text: ['string','cstring'],
  binary: ['bytes','buffer'],
  aggregate: ['list','map','struct','tuple'],
  foreign: ['Ptr','Handle','Borrowed','Owned'],
});

export function listBridges() {
  return Object.values(BRIDGES);
}

export function getBridge(id) {
  return BRIDGES[id] ?? null;
}

export function defineForeignFunction({ bridge = 'c', library, name, params = [], returns = 'void', unsafe = true }) {
  if (!BRIDGES[bridge]) throw new Error(`Unknown Scout bridge: ${bridge}`);
  if (!library || !name) throw new Error('Foreign functions require library and name');
  return Object.freeze({ bridge, library, name, params, returns, unsafe });
}
