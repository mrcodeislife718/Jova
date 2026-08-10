#!/usr/bin/env node
import fs from 'node:fs';
import { parse, toJSON, fromJSON, serializeDocument } from './index.js';

const [command, file] = process.argv.slice(2);

function usage(code = 0) {
  console.log(`jova <command> <file>\n\nCommands:\n  parse      Parse and print semantic value, AST, and comments\n  validate   Validate a JOVA document\n  to-json    Convert JOVA to JSON\n  from-json  Convert JSON to JOVA\n  format     Format JOVA while preserving attached comments`);
  process.exit(code);
}

if (!command || command === '--help' || command === '-h') usage(0);
if (!file) usage(1);

let source;
try {
  source = fs.readFileSync(file, 'utf8');
} catch (error) {
  console.error(`jova: ${error.message}`);
  process.exit(2);
}

try {
  switch (command) {
    case 'parse':
      console.log(JSON.stringify(parse(source), null, 2));
      break;
    case 'validate':
      parse(source);
      console.log(`${file}: valid JOVA`);
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
    default:
      console.error(`jova: unknown command ${command}`);
      usage(1);
  }
} catch (error) {
  console.error(`jova: ${error.message}`);
  process.exit(1);
}
