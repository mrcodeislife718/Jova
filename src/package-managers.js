import fs from 'node:fs';
import path from 'node:path';

export const PACKAGE_MANAGERS = Object.freeze({
  npm: { id: 'npm', lockfile: 'package-lock.json', add: ['npm','install'], install: ['npm','install'], create: ['npx','create-scout-app@latest'] },
  pnpm: { id: 'pnpm', lockfile: 'pnpm-lock.yaml', add: ['pnpm','add'], install: ['pnpm','install'], create: ['pnpm','create','scout-app@latest'] },
  yarn: { id: 'yarn', lockfile: 'yarn.lock', add: ['yarn','add'], install: ['yarn','install'], create: ['yarn','create','scout-app'] },
});

export function detectPackageManager(cwd = process.cwd()) {
  for (const manager of Object.values(PACKAGE_MANAGERS)) {
    if (fs.existsSync(path.join(cwd, manager.lockfile))) return manager.id;
  }
  return 'npm';
}

export function addDependencyCommand(name, manager = 'npm') {
  const selected = PACKAGE_MANAGERS[manager];
  if (!selected) throw new Error(`Unknown package manager: ${manager}`);
  return [...selected.add, name];
}

export function installCommand(manager = 'npm') {
  const selected = PACKAGE_MANAGERS[manager];
  if (!selected) throw new Error(`Unknown package manager: ${manager}`);
  return [...selected.install];
}

export function createScoutAppCommand(manager = 'npm', template = 'blank') {
  const selected = PACKAGE_MANAGERS[manager];
  if (!selected) throw new Error(`Unknown package manager: ${manager}`);
  return [...selected.create, '--template', template];
}
