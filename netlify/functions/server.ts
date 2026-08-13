import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleRequest } from '../../src/server.ts';

class ResponseCapture {
  statusCode = 200;
  readonly headers = new Headers();
  readonly chunks: Buffer[] = [];

  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
  }

  writeHead(statusCode: number, headers: Record<string, string> = {}) {
    this.statusCode = statusCode;
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    return this;
  }

  end(chunk?: string | Buffer) {
    if (chunk) this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
}

export default async function handler(request: Request) {
  const incomingUrl = new URL(request.url);
  const requestedPath = incomingUrl.searchParams.get('path');
  const path = requestedPath ?? `${incomingUrl.pathname}${incomingUrl.search}`;
  const headers = Object.fromEntries([...request.headers].map(([name, value]) => [name.toLowerCase(), value]));
  headers.host ??= incomingUrl.host;
  headers['x-forwarded-proto'] ??= incomingUrl.protocol.slice(0, -1);
  const body = request.body ? Readable.fromWeb(request.body as import('node:stream/web').ReadableStream) : Readable.from([]);
  const req = Object.assign(body, { method: request.method, url: path, headers }) as IncomingMessage;
  const res = new ResponseCapture();

  await handleRequest(req, res as unknown as ServerResponse);
  return new Response(Buffer.concat(res.chunks), { status: res.statusCode, headers: res.headers });
}