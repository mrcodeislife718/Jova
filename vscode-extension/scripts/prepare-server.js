const fs = require('node:fs');
const path = require('node:path');

const extensionRoot = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(extensionRoot, '..', 'src');
const targetRoot = path.resolve(extensionRoot, 'server', 'src');

fs.rmSync(path.resolve(extensionRoot, 'server'), { recursive: true, force: true });
fs.mkdirSync(targetRoot, { recursive: true });

for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  fs.copyFileSync(path.join(sourceRoot, entry.name), path.join(targetRoot, entry.name));
}

fs.writeFileSync(path.resolve(extensionRoot, 'server', 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');
console.log('Prepared Scout language server for VS Code packaging.');
