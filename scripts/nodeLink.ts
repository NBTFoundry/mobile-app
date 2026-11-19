// SPDX-License-Identifier: MPL-2.0
/** The phone's Link over Node sockets, writing the same bytes as the native module (HttpWire.kt). */
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logTail } from '../src/protocol/logTail';
import { LinkError, isSaveName, type Link, type LinkRequest, type LinkResponse } from '../src/protocol/session';

function head(r: LinkRequest, length: number): string {
  let out = `${r.method} ${r.route} HTTP/1.1\r\nHost: ${r.host}\r\n`;
  if (r.method === 'POST') {
    out += `Content-Type: ${r.body?.kind === 'file' ? 'application/octet-stream' : 'text/plain'}\r\n`;
    out += `Content-Length: ${length}\r\n`;
  }
  for (const name of ['X-NBT-Key', 'X-NBT-Nonce', 'X-NBT-Signature']) {
    if (r.headers[name]) out += `${name}: ${r.headers[name]}\r\n`;
  }
  return out + 'Connection: close\r\n\r\n';
}

function parse(raw: Buffer, saveAs?: string): LinkResponse {
  const end = raw.indexOf('\r\n\r\n');
  if (end < 0) throw new LinkError(raw.length ? 'bad-reply' : 'closed');
  const lines = raw.subarray(0, end).toString('ascii').split('\r\n');
  const status = /^HTTP\/1\.[01] ([1-5][0-9]{2})/.exec(lines[0]!);
  if (!status) throw new LinkError('bad-reply');
  let nonce: string | undefined;
  for (const line of lines.slice(1)) {
    const [name, ...value] = line.split(':');
    if (name!.toLowerCase() === 'x-nbt-nonce') nonce = value.join(':').trim();
  }
  const body = raw.subarray(end + 4);
  // A log reply is saved as it came, like the native link does.
  if (saveAs && Number(status[1]) === 200) {
    if (!isSaveName(saveAs)) throw new LinkError('bad-request');
    const folder = path.join(tmpdir(), 'nbt-contract-logs');
    mkdirSync(folder, { recursive: true });
    const file = path.join(folder, `${saveAs}.log`);
    writeFileSync(file, body);
    return { status: 200, nonce, body: '', saved: { uri: pathToFileURL(file).href, size: body.length, tail: logTail(body) } };
  }
  if (body.length > 4096) throw new LinkError('bad-reply');
  return { status: Number(status[1]), nonce, body: body.toString('ascii') };
}

export const nodeLink: Link = {
  request(r: LinkRequest): Promise<LinkResponse> {
    const colon = r.host.lastIndexOf(':');
    const text = r.body?.kind === 'text' ? Buffer.from(r.body.text, 'ascii') : undefined;
    const length = text?.length ?? (r.body?.kind === 'file' ? r.body.size : 0);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = connect({ host: r.host.slice(0, colon), port: Number(r.host.slice(colon + 1)) });
      socket.setTimeout(15_000, () => socket.destroy(new Error('timeout')));
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('error', error => reject(new LinkError((error as NodeJS.ErrnoException).code === 'ECONNREFUSED'
        ? 'refused' : error.message === 'timeout' ? 'timeout' : 'io')));
      socket.on('close', () => {
        try {
          resolve(parse(Buffer.concat(chunks), r.saveAs));
        } catch (error) {
          reject(error);
        }
      });
      socket.on('connect', () => {
        socket.write(head(r, length));
        if (text) socket.write(text);
        if (r.body?.kind === 'file') {
          let sent = 0;
          const file = createReadStream(new URL(r.body.uri));
          file.on('data', chunk => {
            sent += chunk.length;
            r.onProgress?.(sent, length);
          });
          file.on('error', () => socket.destroy());
          file.pipe(socket, { end: false });
        }
      });
    });
  },
};
