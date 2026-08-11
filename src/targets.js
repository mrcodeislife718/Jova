export const TARGET_PROFILES = Object.freeze({
  web: {
    id: 'web',
    family: 'web',
    output: ['wasm', 'javascript-glue'],
    capabilities: ['web', 'wasm', 'js-interop', 'async', 'networking'],
    bridges: ['javascript', 'wasm'],
  },
  node: {
    id: 'node',
    family: 'javascript-runtime',
    output: ['javascript', 'native-addon'],
    capabilities: ['server', 'filesystem', 'networking', 'async', 'js-interop', 'npm'],
    bridges: ['javascript', 'native', 'wasm'],
  },
  'linux-x64': {
    id: 'linux-x64',
    family: 'native',
    output: ['native'],
    capabilities: ['systems', 'filesystem', 'networking', 'threads', 'ffi', 'simd'],
    bridges: ['c', 'cpp', 'rust', 'python', 'javascript', 'java', 'native', 'wasm'],
  },
  'linux-arm64': {
    id: 'linux-arm64',
    family: 'native',
    output: ['native'],
    capabilities: ['systems', 'filesystem', 'networking', 'threads', 'ffi', 'simd'],
    bridges: ['c', 'cpp', 'rust', 'python', 'javascript', 'java', 'native', 'wasm'],
  },
  'windows-x64': {
    id: 'windows-x64',
    family: 'native',
    output: ['native'],
    capabilities: ['systems', 'filesystem', 'networking', 'threads', 'ffi', 'simd'],
    bridges: ['c', 'cpp', 'rust', 'python', 'javascript', 'java', 'native', 'wasm'],
  },
  'macos-x64': {
    id: 'macos-x64',
    family: 'native',
    output: ['native'],
    capabilities: ['systems', 'filesystem', 'networking', 'threads', 'ffi', 'simd', 'metal'],
    bridges: ['c', 'cpp', 'rust', 'python', 'javascript', 'java', 'native', 'wasm', 'objective-c', 'swift'],
  },
  'macos-arm64': {
    id: 'macos-arm64',
    family: 'native',
    output: ['native'],
    capabilities: ['systems', 'filesystem', 'networking', 'threads', 'ffi', 'simd', 'metal'],
    bridges: ['c', 'cpp', 'rust', 'python', 'javascript', 'java', 'native', 'wasm', 'objective-c', 'swift'],
  },
  ios: {
    id: 'ios',
    family: 'mobile',
    output: ['native-app'],
    capabilities: ['mobile', 'async', 'networking', 'ffi', 'metal'],
    bridges: ['c', 'cpp', 'objective-c', 'swift', 'native'],
  },
  android: {
    id: 'android',
    family: 'mobile',
    output: ['native-app'],
    capabilities: ['mobile', 'async', 'networking', 'ffi'],
    bridges: ['c', 'cpp', 'java', 'kotlin', 'native'],
  },
  wasm: {
    id: 'wasm',
    family: 'portable',
    output: ['wasm'],
    capabilities: ['wasm', 'portable', 'sandboxed'],
    bridges: ['wasm', 'javascript'],
  },
  embedded: {
    id: 'embedded',
    family: 'systems',
    output: ['native-firmware'],
    capabilities: ['systems', 'ffi', 'no-runtime', 'deterministic-memory'],
    bridges: ['c', 'cpp', 'native'],
  },
});

export function listTargetProfiles() {
  return Object.values(TARGET_PROFILES);
}

export function getTargetProfile(id) {
  return TARGET_PROFILES[id] ?? null;
}

export function targetSupports(id, capability) {
  return !!TARGET_PROFILES[id]?.capabilities.includes(capability);
}
