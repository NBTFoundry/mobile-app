// SPDX-License-Identifier: MPL-2.0
/** The app's own update: looked for by itself, downloaded, never loud about a failure. */
import { appUpdate, checkAppUpdate, followAppUpdates, RECHECK_MS } from '../src/store/appUpdate';

const updates = { isEnabled: true, available: false, fails: false, checks: 0, fetches: 0 };
let front: ((state: string) => void) | undefined;
jest.mock('expo-updates', () => ({
  get isEnabled() { return updates.isEnabled; },
  checkForUpdateAsync: async () => {
    updates.checks += 1;
    if (updates.fails) throw new Error('offline');
    return { isAvailable: updates.available };
  },
  fetchUpdateAsync: async () => { updates.fetches += 1; return { isNew: true }; },
  reloadAsync: async () => undefined,
}));
jest.mock('react-native', () => ({
  AppState: { addEventListener: (_: string, listener: (state: string) => void) => {
    front = listener;
    return { remove: () => { front = undefined; } };
  } },
}));
jest.mock('react', () => ({ useSyncExternalStore: () => undefined }));

const settle = () => new Promise(resolve => setImmediate(resolve));
const read = () => appUpdate().phase;

describe('app update', () => {
  beforeAll(() => { (globalThis as { __DEV__?: boolean }).__DEV__ = false; });
  afterEach(() => jest.restoreAllMocks());

  it('looks when the app opens, then again from the front only after an hour', async () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const stop = followAppUpdates();
    await settle();
    expect(updates.checks).toBe(1);
    expect(read()).toBe('none');
    now += RECHECK_MS - 1;
    front?.('active');
    await settle();
    expect(updates.checks).toBe(1);
    now += 1;
    front?.('background');
    front?.('active');
    await settle();
    expect(updates.checks).toBe(2);
    stop();
    expect(front).toBeUndefined();
  });

  it('stays quiet about a failure that came with the app opening, and says one the user asked for', async () => {
    updates.fails = true;
    await checkAppUpdate(true);
    expect(read()).toBe('idle');
    await checkAppUpdate();
    expect(read()).toBe('failed');
    updates.fails = false;
  });

  it('downloads what it finds, once: the update then waits for the next start', async () => {
    updates.available = true;
    await checkAppUpdate(true);
    expect(read()).toBe('ready');
    expect(updates.fetches).toBe(1);
    const checks = updates.checks;
    await checkAppUpdate();
    expect(updates.checks).toBe(checks);
  });
});
