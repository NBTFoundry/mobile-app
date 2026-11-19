// SPDX-License-Identifier: MPL-2.0
/** The protocol's Link and Signer over the native modules. Native errors become fixed codes. */
import { CarLink } from '../../modules/car-link';
import { DeviceKey } from '../../modules/device-key';
import { LinkError, type Link, type LinkRequest, type LinkResponse, type Signer } from '../protocol/session';

const LINK_CODES = ['not-allowed', 'no-network', 'refused', 'no-route', 'timeout', 'io', 'closed', 'bad-reply',
  'bad-request', 'file', 'join-failed', 'permission', 'cancelled'] as const;

/** Picks the fixed code out of an Expo error; anything unrecognised is `io`. */
export function linkCode(error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  const last = text.trim().split(/\s+/).at(-1) ?? '';
  return (LINK_CODES as readonly string[]).includes(last) ? last : 'io';
}

let progressCounter = 0;

export const nativeLink: Link = {
  async request(r: LinkRequest): Promise<LinkResponse> {
    const progressId = r.onProgress ? `p${++progressCounter}` : undefined;
    const subscription = progressId && r.onProgress
      ? CarLink.addListener('onProgress', e => {
        if (e.id === progressId) r.onProgress!(e.sent, e.total);
      })
      : undefined;
    try {
      const response = await CarLink.request({
        host: r.host, method: r.method, route: r.route, headers: r.headers, progressId,
        ...(r.saveAs ? { saveAs: r.saveAs } : {}),
        ...(r.body?.kind === 'text' ? { text: r.body.text } : {}),
        ...(r.body?.kind === 'file' ? { fileUri: r.body.uri, size: r.body.size } : {}),
      });
      return { status: response.status, nonce: response.nonce ?? undefined, body: response.body,
        ...(response.saved ? { saved: response.saved } : {}) };
    } catch (error) {
      throw new LinkError(linkCode(error));
    } finally {
      subscription?.remove();
    }
  },
};

export class KeyError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'KeyError';
  }
}

const KEY_CODES = ['ERR_KEY_LOCKED', 'ERR_KEY_MISSING', 'ERR_KEY_CREATE', 'ERR_KEY_STORE', 'ERR_KEY_TEXT', 'ERR_KEY_ALIAS'];

function keyCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && KEY_CODES.includes(code) ? code : 'ERR_KEY_STORE';
}

export function deviceSigner(alias: string, keyId: string): Signer {
  return {
    keyId,
    async sign(text: string) {
      try {
        return await DeviceKey.sign(alias, text);
      } catch (error) {
        throw new KeyError(keyCode(error));
      }
    },
  };
}

export async function createKey(alias: string) {
  try {
    return await DeviceKey.create(alias);
  } catch (error) {
    throw new KeyError(keyCode(error));
  }
}

export async function removeKey(alias: string) {
  try {
    await DeviceKey.remove(alias);
  } catch {
    // A missing key is already removed.
  }
}
