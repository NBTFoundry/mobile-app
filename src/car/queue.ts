// SPDX-License-Identifier: MPL-2.0
/**
 * One car action at a time: the phone holds one car network, and nonces are single use.
 *
 * A pairing goes first: actions queued before it stop instead of running. The car's
 * pairing window lasts 60 s, and an action for a car that is gone (reset, or out of
 * range) can spend up to 2 minutes trying to join its Wi-Fi. In the car (2026-11-16,
 * after iDrive reset itself) a scanned code waited silently behind such joins.
 */
let tail: Promise<unknown> = Promise.resolve();
let pending = 0;
let generation = 0;

export type Turn = {
  /** False once a pairing was queued after this action. */
  stillWanted(): boolean;
};

/** An action is running or waiting. */
export function busy(): boolean {
  return pending > 0;
}

/** Runs `run` after every action queued before it; `first` makes those not yet started stop. */
export function serialized<T>(run: (turn: Turn) => Promise<T>, first = false): Promise<T> {
  if (first) generation++;
  const mine = generation;
  const turn: Turn = { stillWanted: () => mine === generation };
  pending++;
  const go = async () => {
    try {
      return await run(turn);
    } finally {
      pending--;
    }
  };
  const next = tail.then(go, go);
  tail = next.catch(() => undefined);
  return next;
}
