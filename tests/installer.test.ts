// SPDX-License-Identifier: MPL-2.0
import {
  LOG_LINES, addLine, connectError, initialState, logText, overall, reduce, started, working,
  type InstallerState,
} from '../src/installer/state';
import type { InstallerEvent } from '../modules/car-install';

const run = (state: InstallerState, events: InstallerEvent[]) =>
  events.reduce((s, e, i) => reduce(s, e, i), state);

describe('installer state', () => {
  it('waits for the user before enabling SSH, then connects', () => {
    let state = started(initialState(['ready']));
    state = run(state, [
      { type: 'message', text: 'Connecting over SSH…' },
      { type: 'phase', index: 0, count: 3, label: 'Opening the SSH connection', bytes: 0 },
      { type: 'confirmActivation', host: '169.254.199.119:22', hint: 'not reachable' },
    ]);
    expect(state.ask).toEqual({ host: '169.254.199.119:22', hint: 'not reachable' });
    expect(state.connected).toBe(false);
    state = run(state, [{ type: 'connected' }, { type: 'target', ok: true }]);
    expect(state.ask).toBeUndefined();
    expect(state.connected && state.target).toBe(true);
    expect(state.phase).toBeUndefined();
    expect(state.result).toBe('Connected.');
  });

  it('asks before moving NBTApps aside, and forgets the question when the install ends', () => {
    let state = working(run(started(initialState()), [{ type: 'connected' }, { type: 'target', ok: true }]));
    state = run(state, [{ type: 'confirmRemoveNbtApps', agent: true, plugin: false }]);
    expect(state.askNbtApps).toEqual({ agent: true, plugin: false });
    expect(state.busy).toBe(true);
    state = run(state, [{ type: 'installFinished', ok: false }]);
    expect(state.askNbtApps).toBeUndefined();
    expect(started(run(state, [{ type: 'confirmRemoveNbtApps', agent: true, plugin: true }])).askNbtApps)
      .toBeUndefined();
  });

  it('shows step and byte progress, and frees the buttons when an install ends', () => {
    let state = working(run(started(initialState()), [{ type: 'connected' }, { type: 'target', ok: true }]));
    expect(state.busy).toBe(true);
    state = run(state, [
      { type: 'phase', index: 1, count: 5, label: 'Uploading the launcher', bytes: 1000 },
      { type: 'progress', sent: 500, total: 1000 },
    ]);
    expect(overall(state)).toEqual({ value: 0.3, text: 'Step 2 of 5: Uploading the launcher' });
    state = run(state, [{ type: 'installFinished', ok: false }]);
    expect(state.busy).toBe(false);
    expect(overall(state)).toBeUndefined();
    expect(state.result).toBe('Install failed.');
    // The car's reason stays in the log, not on the screen.
    expect(logText(state, false)).toContain('Install failed.');
  });

  it('keeps diagnostic detail out of the plain log', () => {
    const state = run(initialState(), [
      { type: 'detail', text: 'Host key ssh-rsa SHA256:abc accepted without verification.' },
      { type: 'message', text: 'QNX responded.' },
    ]);
    expect(logText(state, false)).toBe('QNX responded.');
    expect(logText(state, true, true).split('\n')[0]).toContain('QNX responded.');
    expect(logText(state, true)).toMatch(/\[ {4}0\.0s\] Host key .*\n\[ {4}1\.0s\] QNX responded\./);
  });

  it('lists fetched car logs and reports one that could not be saved', () => {
    let state = run(initialState(), [
      { type: 'log', kind: 'system', uri: 'file:///cache/slog-1.log', size: 2048 },
      { type: 'log', kind: 'collection', uri: 'file:///cache/collect-2.txt', size: 9000 },
      { type: 'log', kind: 'debug', uri: null, size: 10 },
    ]);
    expect(state.fetched).toEqual([
      { kind: 'collection', uri: 'file:///cache/collect-2.txt', size: 9000 },
      { kind: 'system', uri: 'file:///cache/slog-1.log', size: 2048 },
    ]);
    expect(logText(state, false)).toContain('Got the collected logs.');
    expect(state.result).toBe('Could not save the manager log.');
    // A kind this app does not know (a newer module) is not listed.
    const unknown = run(state, [{ type: 'log', kind: 'other' as never, uri: 'file:///x', size: 1 }]);
    expect(unknown.fetched).toEqual(state.fetched);
    expect(unknown.result).toBe('Could not save the file.');
    state = run(state, [{ type: 'toolFinished', ok: false, text: 'no manager' }]);
    expect(state.result).toBe('Failed.');
    expect(logText(state, false)).toContain('no manager');
  });

  it('offers an iDrive restart once the install has finished', () => {
    let state = working(run(started(initialState()), [{ type: 'connected' }, { type: 'target', ok: true }]));
    state = run(state, [{ type: 'restartNeeded' }, { type: 'installFinished', ok: true }]);
    expect(state).toMatchObject({ restart: true, busy: false, result: 'Installed.' });
    // Restarting is itself a tool run, which withdraws the offer.
    expect(working(state).restart).toBe(false);
    expect(run(state, [{ type: 'finished', text: 'closed' }]).restart).toBe(false);
  });

  it('ends the session on finished', () => {
    const state = run(working(started(initialState())), [
      { type: 'connected' }, { type: 'target', ok: true },
      { type: 'confirmActivation', host: 'h', hint: null },
      { type: 'finished', text: 'SSH connection closed.' },
    ]);
    expect(state).toMatchObject({ running: false, connected: false, target: false, busy: false, ask: undefined,
      result: 'Disconnected.' });
  });

  it('bounds the log', () => {
    let state = initialState();
    for (let i = 0; i < LOG_LINES + 5; i++) state = addLine(state, `line ${i}`, i);
    expect(state.log).toHaveLength(LOG_LINES);
    expect(state.log[0]?.text).toBe('line 5');
  });

  it('turns native codes into sentences, never raw errors', () => {
    expect(connectError('no-wifi')).toBe('Join the adapter’s Wi-Fi first.');
    expect(connectError('java.lang.IllegalStateException: x')).toBe('Could not start.');
  });
});
