#!/usr/bin/env node
import { createLanguageServer } from './lsp-server.js';

export function encodeMessage(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body]);
}

export class MessageReader {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.buffer = Buffer.alloc(0);
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = this.buffer.slice(0, headerEnd).toString('ascii');
      const match = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)/i);
      if (!match) throw new Error('Missing Content-Length header');
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.slice(bodyStart, bodyStart + length).toString('utf8');
      this.buffer = this.buffer.slice(bodyStart + length);
      this.onMessage(JSON.parse(body));
    }
  }
}

export function runStdioServer({ input = process.stdin, output = process.stdout } = {}) {
  const server = createLanguageServer();
  let shuttingDown = false;

  const write = (message) => {
    if (message) output.write(encodeMessage(message));
  };

  const reader = new MessageReader(async (message) => {
    if (message.method === 'exit') {
      process.exitCode = shuttingDown ? 0 : 1;
      if (input === process.stdin) process.exit();
      return;
    }
    if (message.method === 'shutdown') shuttingDown = true;
    const response = await server.dispatch(message);
    write(response);
  });

  input.on('data', (chunk) => {
    try {
      reader.push(chunk);
    } catch (error) {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: `Parse error: ${error.message}` } });
    }
  });
  input.resume?.();
  return { server, reader };
}

if (import.meta.url === `file://${process.argv[1]}`) runStdioServer();
