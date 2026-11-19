// SPDX-License-Identifier: MPL-2.0
/** Reaching the manager's worker: directly, through a wake request to the door, or by hand. */
import { wake, StoppedFollowing, type Cancel, type Wait } from './actions';
import type { WakeState } from './replies';
import { LinkError, type CarSession } from './session';

export const WORKER_PORT = 8080;
export const DOOR_PORT = 8081;

export type OpeningEvent =
  | { kind: 'waking' }
  | { kind: 'opening' }
  | { kind: 'by-hand'; reason: Exclude<WakeState, 'open' | 'opening'> | 'no-door' };

/** The worker is the address the pairing reply named; the door is on the next port
 * (8080 and 8081 on the car; a desk car may use other ports). */
export function listenerHosts(address: string): { worker: string; door: string } {
  const colon = address.lastIndexOf(':');
  const port = Number(address.slice(colon + 1));
  return { worker: address, door: `${address.slice(0, colon)}:${port + 1}` };
}

async function answers(session: CarSession): Promise<boolean> {
  try {
    await session.probe();
    return true;
  } catch (error) {
    if (error instanceof LinkError) return false;
    throw error;
  }
}

async function pollWorker(worker: CarSession, cancel: Cancel, wait: Wait, everyMs: number, forMs: number) {
  const started = Date.now();
  while (Date.now() - started < forMs) {
    if (cancel.cancelled) throw new StoppedFollowing();
    await wait(everyMs);
    if (await answers(worker)) return true;
  }
  return false;
}

/**
 * Returns a session with the worker once App Manager is open on the car.
 * The plugin opens it only when the car allows; otherwise the driver opens it.
 */
export async function reachManager(worker: CarSession, door: CarSession, onEvent: (e: OpeningEvent) => void,
  cancel: Cancel, wait: Wait): Promise<CarSession> {
  if (await answers(worker)) return worker;
  onEvent({ kind: 'waking' });
  let state: WakeState | 'no-door';
  try {
    state = await wake(door);
  } catch (error) {
    if (!(error instanceof LinkError)) throw error;
    state = 'no-door';
  }
  if (state === 'open' || state === 'opening') {
    onEvent({ kind: 'opening' });
    if (await pollWorker(worker, cancel, wait, 1000, 20_000)) return worker;
    state = 'busy';
  }
  onEvent({ kind: 'by-hand', reason: state });
  if (await pollWorker(worker, cancel, wait, 2000, 5 * 60_000)) return worker;
  throw new LinkError('manager-closed');
}
