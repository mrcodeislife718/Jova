#!/usr/bin/env node
import fs from 'node:fs';
import {
  parse,
  toJSON,
  fromJSON,
  serializeDocument,
  listTargetProfiles,
  getTargetProfile,
  listBridges,
  discoverCapabilities,
  doctorReport,
  PACKAGE_MANAGERS,
  createScoutAppCommand,
} from './index.js';

const [command, arg] = process.argv.slice(2);

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function usage(code = 0) {
  console.log(`scout <command> [argument]\n\nLanguage/data commands:\n  parse <file>         Parse and print semantic value, AST, and comments\n  validate <file>      Validate a Scout document\n  to-json <file>       Convert Scout data to JSON\n  from-json <file>     Convert JSON to Scout data\n  format <file>        Format Scout while preserving attached comments\n\nPlatform commands:\n  targets [id]         List target profiles or inspect one target\n  bridges              List foreign-language/native bridge definitions\n  capabilities         Detect local runtimes, compilers, and package managers\n  doctor               Show readiness checks for Scout interoperability\n  package-managers     Show npm, pnpm, and Yarn compatibility\n  create-command [pm]  Print the create-scout-app command for npm/pnpm/yarn`);
  process.exit(code);
}

if (!command || command === '--help' || command === '-h') usage(0);

if (command === 'targets') {
  const target = arg ? getTargetProfile(arg) : listTargetProfiles();
  if (arg && !target) {
    console.error(`scout: unknown target ${arg}`);
    process.exit(1);
  }
  printJson(target);
  process.exit(0);
}

if (command === 'bridges') {
  printJson(listBridges());
  process.exit(0);
}

if (command === 'capabilities') {
  printJson(discoverCapabilities());
  process.exit(0);
}

if (command === 'doctor') {
  const report = doctorReport();
  console.log(`Scout doctor — ${report.platform}/${report.arch}`);
  for (const check of report.checks) console.log(`${check.available ? '✓' : '✗'} ${check.name}`);
  process.exit(0);
}

if (command === 'package-managers') {
  printJson(PACKAGE_MANAGERS);
  process.exit(0);
}

if (command === 'create-command') {
  const manager = arg || 'npm';
  try {
    console.log(createScoutAppCommand(manager, 'blank').join(' '));
  } catch (error) {
    console.error(`scout: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

const fileCommands = new Set(['parse','validate','to-json','from-json','format']);
if (!fileCommands.has(command)) {
  console.error(`scout: unknown command ${command}`);
  usage(1);
}
if (!arg) usage(1);

let source;
try {
  source = fs.readFileSync(arg, 'utf8');
} catch (error) {
  console.error(`scout: ${error.message}`);
  process.exit(2);
}

try {
  switch (command) {
    case 'parse':
      printJson(parse(source));
      break;
    case 'validate':
      parse(source);
      console.log(`${arg}: valid Scout`);
      break;
    case 'to-json':
      console.log(toJSON(source));
      break;
    case 'from-json':
      console.log(fromJSON(source));
      break;
    case 'format':
      console.log(serializeDocument(parse(source)));
      break;
  }
} catch (error) {
  console.error(`scout: ${error.message}`);
  process.exit(1);
}
