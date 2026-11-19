// SPDX-License-Identifier: MPL-2.0
/**
 * The installer session for the whole app: one at a time, kept while the user
 * moves between screens. Events from the native core are reduced into one
 * state (state.ts) that the installer screen reads.
 */
import { useSyncExternalStore } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { CarInstall, type ConnectSettings, type InstallTool } from '../../modules/car-install';
import { releaseCarNetwork } from '../car/operations';
import { t } from '../i18n';
import {
  addLine, connectError, initialState, outcome, reduce, started, working, type InstallerState,
} from './state';

const KEEP_AWAKE = 'nbt-installer';
const CODES = ['no-wifi', 'no-address', 'invalid', 'busy'];
const startedAt = Date.now();
const now = () => (Date.now() - startedAt) / 1000;

let state: InstallerState | undefined;
let subscribed = false;
const listeners = new Set<() => void>();

function current(): InstallerState {
  state ??= initialState();
  return state;
}

function set(next: InstallerState): void {
  state = next;
  listeners.forEach(l => l());
}

function subscribe(): void {
  if (subscribed) return;
  subscribed = true;
  CarInstall.addListener('onEvent', event => {
    set(reduce(current(), event, now()));
    // The screen stays on while a session runs: Android would end it otherwise.
    if (event.type === 'finished') deactivateKeepAwake(KEEP_AWAKE);
  });
}

export function useInstaller(): InstallerState {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, current);
}

export function bundled() {
  return CarInstall.bundled();
}

export function defaults() {
  return CarInstall.defaults();
}

export async function connect(settings: ConnectSettings): Promise<void> {
  subscribe();
  if (current().running) return;
  // The car's own Wi-Fi (App Manager's) must not be taken for the adapter's.
  releaseCarNetwork();
  set(started(addLine(current(), t('common.connecting'), now())));
  await activateKeepAwakeAsync(KEEP_AWAKE);
  try {
    const result = await CarInstall.connect(settings);
    set(addLine(current(), t('installer.addresses', { addresses: result.addresses.join(', ') }), now(), true));
    if (!result.mobileData) {
      set(outcome(current(), t('installer.mobileDataOff'), now()));
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : '';
    const code = CODES.find(c => text.trim().endsWith(c)) ?? '';
    set({ ...outcome(current(), connectError(code), now()), running: false });
    deactivateKeepAwake(KEEP_AWAKE);
  }
}

/** The user's answer to "SSH did not answer; enable it?". */
export function answerActivation(approve: boolean): void {
  CarInstall.confirmActivation(approve);
  set({ ...current(), ask: undefined });
}

export function install(): void {
  if (CarInstall.install()) set(working(current()));
}

export function update(): void {
  if (CarInstall.update()) set(working(current()));
}

/** "Later" on the restart question. */
export function dismissRestart(): void {
  set({ ...current(), restart: false });
}

/** Shows the restart question; the head unit restarts only from there. */
export function askRestart(): void {
  set({ ...current(), restart: true });
}

export function runTool(tool: InstallTool, text: string | null = null): void {
  if (CarInstall.tool(tool, text)) set(working(current()));
}

export function disconnect(): void {
  CarInstall.disconnect();
}
