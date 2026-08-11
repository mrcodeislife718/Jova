import { spawnSync } from 'node:child_process';
import os from 'node:os';

const TOOL_PROBES = Object.freeze([
  ['node', ['--version']],
  ['npm', ['--version']],
  ['pnpm', ['--version']],
  ['yarn', ['--version']],
  ['python3', ['--version']],
  ['python', ['--version']],
  ['cc', ['--version']],
  ['clang', ['--version']],
  ['gcc', ['--version']],
  ['c++', ['--version']],
  ['rustc', ['--version']],
  ['cargo', ['--version']],
  ['java', ['--version']],
  ['javac', ['--version']],
  ['swift', ['--version']],
  ['nvcc', ['--version']],
]);

function probe(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 3000 });
  if (result.error || result.status !== 0) return null;
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n')[0];
  return output || 'available';
}

export function discoverCapabilities() {
  const tools = {};
  for (const [command, args] of TOOL_PROBES) tools[command] = probe(command, args);
  return {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus()?.length ?? null,
    memoryBytes: os.totalmem(),
    tools,
    packageManagers: ['npm','pnpm','yarn'].filter((name) => !!tools[name]),
    nativeCompilers: ['cc','clang','gcc','c++'].filter((name) => !!tools[name]),
    foreignRuntimes: {
      javascript: !!tools.node,
      python: !!(tools.python3 || tools.python),
      rust: !!tools.rustc,
      java: !!tools.java,
      swift: !!tools.swift,
      cuda: !!tools.nvcc,
    },
  };
}

export function doctorReport(capabilities = discoverCapabilities()) {
  const checks = [
    ['Node runtime', capabilities.foreignRuntimes.javascript],
    ['npm', !!capabilities.tools.npm],
    ['pnpm', !!capabilities.tools.pnpm],
    ['Yarn', !!capabilities.tools.yarn],
    ['Python runtime', capabilities.foreignRuntimes.python],
    ['Native C/C++ toolchain', capabilities.nativeCompilers.length > 0],
    ['Rust toolchain', capabilities.foreignRuntimes.rust],
    ['Java/JVM', capabilities.foreignRuntimes.java],
    ['Swift toolchain', capabilities.foreignRuntimes.swift],
    ['CUDA toolchain', capabilities.foreignRuntimes.cuda],
  ];
  return { ...capabilities, checks: checks.map(([name, available]) => ({ name, available })) };
}
