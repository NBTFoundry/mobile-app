/** A signed-request session with one car listener. Requests are serialized: nonces are single use. */
import { ProtocolError, ascii, isHex } from './bytes';
import { errorCode, MAX_REPLY } from './replies';
import { EMPTY_SHA256, bodyDigest, canonicalText, isHostPort, methodFor, type Method, type Route } from './signing';

export type LinkBody =
  | { kind: 'text'; text: string }
  | { kind: 'file'; uri: string; size: number };

export type LinkRequest = {
  host: string;
  method: Method;
  route: Route;
  headers: Record<string, string>;
  body?: LinkBody;
  onProgress?: (sent: number, total: number) => void;
  /** A log route: a 200 reply is saved to a file of this name, not read as text. */
  saveAs?: string;
};

/** A reply the link saved: the file, its size and its last lines as printable text. */
export type SavedReply = { uri: string; size: number; tail: string };

export type LinkResponse = { status: number; nonce?: string; body: string; saved?: SavedReply };

/** The name a saved reply may have: the link writes `<name>.log` in its own folder. */
export const isSaveName = (name: string) => /^[a-z0-9][a-z0-9._-]{0,63}$/.test(name);

/** Transport to the car. Native on the phone, Node sockets in the contract test. */
export interface Link {
  request(request: LinkRequest): Promise<LinkResponse>;
}

/** Fixed link failure codes; native errors are never shown raw. */
export class LinkError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'LinkError';
  }
}

/** A refused HTTP request: a fixed error code from the status and body. */
export class CarError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`${status} ${code}`);
    this.name = 'CarError';
  }
}

export interface Signer {
  readonly keyId: string;
  /** DER ECDSA P-256/SHA-256 signature of the ASCII text, lowercase hex. */
  sign(text: string): Promise<string>;
}

export type SignedBody =
  | { kind: 'text'; text: string }
  | { kind: 'file'; uri: string; size: number; sha256: string };

export class CarSession {
  private nonce?: string;
  private queue: Promise<unknown> = Promise.resolve();
  /** The nonce the latest signed request used; the pairing code derives from it. */
  usedNonce?: string;

  constructor(private readonly link: Link, private readonly signer: Signer, readonly host: string) {
    if (!isHostPort(host)) throw new ProtocolError('bad-host');
  }

  /** Runs one request after the previous one has finished. */
  send(route: Route, body?: SignedBody, onProgress?: LinkRequest['onProgress'], saveAs?: string): Promise<LinkResponse> {
    const run = this.queue.then(() => this.sendNow(route, body, onProgress, saveAs));
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Like `send`, but a non-2xx status becomes a `CarError`. */
  async ok(route: Route, body?: SignedBody, onProgress?: LinkRequest['onProgress']): Promise<LinkResponse> {
    const response = await this.send(route, body, onProgress);
    if (response.status < 200 || response.status > 299) throw new CarError(response.status, errorCode(response.body));
    return response;
  }

  /** A log route's reply, saved by the link as `saveAs` (PROTOCOL.md, Logs). */
  async download(route: Route, body: SignedBody, saveAs: string): Promise<SavedReply> {
    if (!isSaveName(saveAs)) throw new ProtocolError('bad-request');
    const response = await this.send(route, body, undefined, saveAs);
    if (response.status !== 200) throw new CarError(response.status, errorCode(response.body));
    if (!response.saved) throw new ProtocolError('bad-reply');
    return response.saved;
  }

  /** Checks that the listener answers, without signing anything. */
  probe(): Promise<void> {
    const run = this.queue.then(async () => {
      this.nonce = await this.fetchNonce();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async fetchNonce(): Promise<string> {
    const response = await this.link.request({ host: this.host, method: 'GET', route: '/v1/nonce', headers: {} });
    if (response.status !== 200 || response.body !== 'NBT-REQ-1\n' || !response.nonce) {
      throw response.status === 200 ? new ProtocolError('bad-reply') : new CarError(response.status, errorCode(response.body));
    }
    return response.nonce;
  }

  private async sendNow(route: Route, body: SignedBody | undefined, onProgress: LinkRequest['onProgress'],
    saveAs?: string) {
    const method = methodFor(route);
    if ((method === 'GET') !== !body) throw new ProtocolError('bad-request');
    const nonce = this.nonce ?? await this.fetchNonce();
    this.nonce = undefined;
    this.usedNonce = nonce;
    let length = 0;
    let digest = EMPTY_SHA256;
    let linkBody: LinkBody | undefined;
    if (body?.kind === 'text') {
      const bytes = ascii(body.text);
      if (bytes.length > 2048) throw new ProtocolError('bad-request');
      length = bytes.length;
      digest = bodyDigest(bytes);
      linkBody = body;
    } else if (body?.kind === 'file') {
      if (!isHex(body.sha256, 32) || !Number.isSafeInteger(body.size) || body.size <= 0) {
        throw new ProtocolError('bad-request');
      }
      length = body.size;
      digest = body.sha256;
      linkBody = { kind: 'file', uri: body.uri, size: body.size };
    }
    const signature = await this.signer.sign(canonicalText(method, route, this.host, nonce, length, digest));
    const response = await this.link.request({
      host: this.host, method, route, body: linkBody, onProgress, saveAs,
      headers: { 'X-NBT-Key': this.signer.keyId, 'X-NBT-Nonce': nonce, 'X-NBT-Signature': signature },
    });
    if (response.body.length > MAX_REPLY) throw new ProtocolError('bad-reply');
    if (response.nonce && isHex(response.nonce, 32)) this.nonce = response.nonce;
    return response;
  }
}
