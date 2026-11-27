// SPDX-License-Identifier: MPL-2.0
/** Fixed user-facing text for every failure code. Raw native or car text is never shown. */
import { t, type Key } from '../i18n';
import { StoppedFollowing } from '../protocol/actions';
import { ProtocolError } from '../protocol/bytes';
import type { OpeningEvent } from '../protocol/opening';
import type { Status } from '../protocol/replies';
import { DeveloperKeyError } from '../protocol/developerKey';
import { CarError, LinkError } from '../protocol/session';
import { CatalogError } from '../store/catalog';
import { LibraryError } from '../store/library';
import { KeyError } from './nativeLink';

const LINK: Record<string, Key> = {
  'permission': 'error.permission',
  'join-failed': 'error.joinFailed',
  'cancelled': 'error.cancelled',
  'stopped': 'error.sendStopped',
  'no-network': 'error.noNetwork',
  'refused': 'error.refused',
  'no-route': 'error.noRoute',
  'timeout': 'error.timeout',
  'closed': 'error.closed',
  'io': 'error.io',
  'bad-reply': 'error.badReply',
  'file': 'error.file',
  'not-allowed': 'error.notAllowed',
  'manager-closed': 'error.managerClosed',
};

const CAR: Record<number, Key> = {
  400: 'error.car400',
  403: 'error.car403',
  409: 'error.car409',
  429: 'error.car429',
  500: 'error.car500',
  503: 'error.car503',
};

/** The files routes' refusals (manager docs/files-bridge.md), by their 400, 404 or 413 code. */
const FILES: Record<string, Key> = {
  'app': 'error.filesApp',
  'type': 'error.fileType',
  'name': 'error.fileName',
  'size': 'error.fileSize',
  'phone-size': 'error.filePhoneSize',
  'quota': 'error.fileQuota',
  'count': 'error.fileCount',
  'space': 'error.fileSpace',
  'missing': 'error.fileMissing',
  'digest': 'error.fileDigest',
};

const KEY: Record<string, Key> = {
  ERR_KEY_LOCKED: 'error.keyLocked',
  ERR_KEY_MISSING: 'error.keyMissing',
  ERR_KEY_CREATE: 'error.keyCreate',
};

export function describeError(error: unknown): string {
  if (error instanceof StoppedFollowing) return t('error.stopped');
  if (error instanceof LinkError) return t(LINK[error.code] ?? 'error.io');
  if (error instanceof CarError && error.code === 'pairing-closed') return t('error.pairingClosed');
  if (error instanceof CarError) {
    const file = [400, 404, 413].includes(error.status) ? FILES[error.code] : undefined;
    if (file) return t(file);
    if (error.status === 404 || error.status === 400 && error.code === 'route') return t('error.updateManager');
    const known = CAR[error.status];
    return known ? t(known) : t('error.carOther', { status: error.status });
  }
  if (error instanceof KeyError) return t(KEY[error.code] ?? 'error.keyStore');
  if (error instanceof DeveloperKeyError) {
    return t(error.code === 'private-key' ? 'keys.privateKey'
      : error.code === 'not-rsa-3072' ? 'keys.notRsa3072' : 'keys.notPublicKey');
  }
  if (error instanceof LibraryError) {
    return t(error.code === 'not-a-package' ? 'error.notPackage'
      : error.code === 'unreadable' ? 'error.unreadable' : 'error.storage');
  }
  if (error instanceof CatalogError) {
    return t(error.code === 'offline' ? 'error.offline' : error.code === 'download' ? 'error.download'
      : error.code === 'mismatch' ? 'error.mismatch' : 'error.badCatalog');
  }
  if (error instanceof ProtocolError) {
    return t(error.code === 'code-mismatch' ? 'error.codeMismatch' : 'error.badReply');
  }
  return t('error.unknown');
}

const OWN: Record<string, Key> = {
  waiting: 'status.confirm',
  verified: 'status.confirm',
  installing: 'status.installing',
  installed: 'status.installed',
  removed: 'status.removed',
  failed: 'status.failed',
  cancelled: 'status.cancelled',
  expired: 'status.expired',
  paired: 'status.paired',
  'key-added': 'status.keyAdded',
  'key-removed': 'status.keyRemoved',
};

/** Result text decided from the state; the car's own message is added as detail. */
export function describeStatus(status: Status): string {
  // Since dev77 the car checks a package after receiving it, before the review.
  if (status.state === 'waiting' && status.message === 'Checking the package') return t('status.checking');
  const own = OWN[status.state];
  const base = own ? t(own) : status.state;
  // The car's own text (English) only adds something when it explains a failure.
  return status.state === 'failed' && status.message
    ? t('status.failedBecause', { base, reason: status.message }) : base;
}

/** A manager release the driver approved: from 0.5.2 the car starts it at once
 * ("NBT Manager <version> starts in a moment"), before that at the next opening. */
export const managerRestarts = (status: Status) => status.message.endsWith(' starts in a moment');

export function describeManagerAccepted(status: Status): string {
  return t(managerRestarts(status) ? 'op.managerRestarts' : 'op.managerAccepted');
}

export function describeOpening(event: OpeningEvent): string {
  if (event.kind === 'waking') return t('opening.waking');
  if (event.kind === 'opening') return t('opening.opening');
  const reason = t(event.reason === 'moving' ? 'opening.moving' : 'opening.open');
  return t('opening.continue', { reason });
}
