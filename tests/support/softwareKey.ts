/** A P-256 software key for tests: the phone's Keystore key, without hardware. */
import { createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import { keyId } from '../../src/protocol/signing';
import type { Signer } from '../../src/protocol/session';

const SPKI_P256 = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');

export class SoftwareKey implements Signer {
  readonly publicKey: string;
  readonly keyId: string;
  private readonly privateKey: KeyObject;

  constructor() {
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    this.privateKey = pair.privateKey;
    this.publicKey = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-65).toString('hex');
    this.keyId = keyId(this.publicKey);
  }

  async sign(text: string): Promise<string> {
    return sign('sha256', Buffer.from(text, 'ascii'), this.privateKey).toString('hex');
  }
}

export function verifyWith(publicKeyHex: string, text: string, signatureHex: string): boolean {
  const key = createPublicKey({ key: Buffer.concat([SPKI_P256, Buffer.from(publicKeyHex, 'hex')]),
    format: 'der', type: 'spki' });
  return verify('sha256', Buffer.from(text, 'ascii'), key, Buffer.from(signatureHex, 'hex'));
}
