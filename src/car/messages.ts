/** Fixed user-facing text for every failure code. Raw native or car text is never shown. */
import { StoppedFollowing } from '../protocol/actions';
import { ProtocolError } from '../protocol/bytes';
import type { OpeningEvent } from '../protocol/opening';
import type { Status } from '../protocol/replies';
import { CarError, LinkError } from '../protocol/session';
import { LibraryError } from '../store/library';
import { KeyError } from './nativeLink';

const LINK: Record<string, string> = {
  'permission': 'Allow Nearby devices for NBT Manager, then try again.',
  'join-failed': 'Could not join the car’s Wi-Fi. Check that the car is on and nearby. If the car was reset, pair it again.',
  'cancelled': 'Stopped to pair a car.',
  'no-network': 'The car’s Wi-Fi was lost.',
  'refused': 'The car did not answer. Open App Manager on the car.',
  'no-route': 'The car is not reachable on its Wi-Fi.',
  'timeout': 'The car stopped answering.',
  'closed': 'The car closed the connection.',
  'io': 'The connection to the car failed.',
  'bad-reply': 'Update the app or NBT Manager on the car.',
  'file': 'The package file could not be read.',
  'not-allowed': 'This request is not permitted.',
  'manager-closed': 'App Manager was not opened on the car.',
};

const CAR: Record<number, string> = {
  400: 'The car refused the request.',
  403: 'The car does not recognise this phone. Pair it again.',
  409: 'The car is busy with another action. Try again when it has finished.',
  429: 'Too many requests. Wait a moment.',
  500: 'The car could not store the change.',
  503: 'The car is busy. Try again in a minute.',
};

const KEY: Record<string, string> = {
  ERR_KEY_LOCKED: 'Unlock your phone, then try again.',
  ERR_KEY_MISSING: 'This phone’s key for the car is gone. Forget the car and pair it again.',
  ERR_KEY_CREATE: 'This phone could not create a key.',
};

export function describeError(error: unknown): string {
  if (error instanceof StoppedFollowing) return 'Stopped following.';
  if (error instanceof LinkError) return LINK[error.code] ?? LINK.io!;
  if (error instanceof CarError && error.code === 'pairing-closed') {
    return 'On the car, open Pair a phone, then try again.';
  }
  if (error instanceof CarError) {
    if (error.status === 404 || error.status === 400 && error.code === 'route') {
      return 'Update NBT Manager on the car.';
    }
    return CAR[error.status] ?? `The car refused the request (${error.status}).`;
  }
  if (error instanceof KeyError) return KEY[error.code] ?? 'The phone’s key store failed.';
  if (error instanceof LibraryError) {
    return error.code === 'not-a-package' ? 'This is not an NBT Manager file.'
      : error.code === 'unreadable' ? 'The file could not be read.' : 'The phone’s storage failed.';
  }
  if (error instanceof ProtocolError) {
    return error.code === 'code-mismatch' ? 'The car showed a different code. Pairing stopped.'
      : 'Update the app or NBT Manager on the car.';
  }
  return 'Something went wrong.';
}

/** Result text decided from the state; the car's own message is added as detail. */
export function describeStatus(status: Status): string {
  const own: Record<string, string> = {
    waiting: 'Confirm on the car.',
    verified: 'Confirm on the car.',
    installing: 'Installing on the car.',
    installed: 'Installed.',
    removed: 'Uninstalled.',
    failed: 'The car reported a failure.',
    cancelled: 'Declined on the car.',
    expired: 'Timed out on the car.',
    paired: 'Paired.',
  };
  // Since dev77 the car checks a package after receiving it, before the review.
  if (status.state === 'waiting' && status.message === 'Checking the package') {
    return 'The car is checking the package.';
  }
  const base = own[status.state] ?? status.state;
  // The car's own text only adds something when it explains a failure.
  return status.state === 'failed' && status.message ? `${base} ${status.message}.` : base;
}

export function describeOpening(event: OpeningEvent): string {
  if (event.kind === 'waking') return 'Asking the car to open App Manager.';
  if (event.kind === 'opening') return 'App Manager is opening on the car.';
  const reasons: Record<string, string> = {
    'busy': 'Open App Manager on the car.',
    'moving': 'Stop the car first.',
    'off': 'Open App Manager on the car.',
    'no-door': 'Open App Manager on the car.',
  };
  return `${reasons[event.reason]} Open App Manager on the car; this continues when it opens.`;
}
