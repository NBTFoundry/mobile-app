/**
 * The installer screen's state, built from the installer core's events. The
 * core's messages go to the log only; the screen shows `result`, a short
 * outcome written here. Pure, so it is tested without a phone.
 */
import type { InstallerEvent, LogKind } from '../../modules/car-install';

export type LogLine = { at: number; detail: boolean; text: string };
export type FetchedLog = { kind: LogKind; uri: string; size: number };

/** What each kind is called on the screen. */
export const LOG_NAMES: Record<LogKind, string> = {
  collection: 'collected logs', system: 'iDrive log', debug: 'manager log',
};

export type InstallerState = {
  /** A session exists: connecting, waiting for an answer or connected. */
  running: boolean;
  connected: boolean;
  /** The head unit answered as QNX: Install, Update and the tools are offered. */
  target: boolean;
  /** An install, update or tool runs. */
  busy: boolean;
  /** SSH did not answer: enabling it waits for the user. */
  ask?: { host: string; hint: string | null };
  /** The last outcome, in plain words, for the screen. */
  result?: string;
  /** The head unit has to restart to load the new plugin: offer it once nothing runs. */
  restart: boolean;
  phase?: { index: number; count: number; label: string };
  progress: { sent: number; total: number };
  log: LogLine[];
  fetched: FetchedLog[];
};

/** Lines kept; older ones are dropped. */
export const LOG_LINES = 2000;

export const initialState = (lines: string[] = []): InstallerState => ({
  running: false, connected: false, target: false, busy: false, restart: false,
  progress: { sent: 0, total: 0 },
  log: lines.map(text => ({ at: 0, detail: false, text })),
  fetched: [],
});

export function addLine(state: InstallerState, text: string, at: number, detail = false): InstallerState {
  return { ...state, log: [...state.log, { at, detail, text }].slice(-LOG_LINES) };
}

/** An outcome: shown on the screen and kept in the log. */
export const outcome = (state: InstallerState, text: string, at: number): InstallerState =>
  ({ ...addLine(state, text, at), result: text });

/** A connection was started; its events follow. */
export const started = (state: InstallerState): InstallerState =>
  ({ ...state, running: true, connected: false, target: false, busy: false, ask: undefined, phase: undefined,
    result: undefined, restart: false });

/** An install, update or tool was sent. */
export const working = (state: InstallerState): InstallerState =>
  ({ ...state, busy: true, phase: undefined, progress: { sent: 0, total: 0 }, result: undefined, restart: false });

export function reduce(state: InstallerState, event: InstallerEvent, at: number): InstallerState {
  const line = (text: string, detail = false) => addLine(state, text, at, detail);
  const said = (text: string) => outcome(state, text, at);
  switch (event.type) {
    case 'message':
      return line(event.text);
    case 'detail':
      return line(event.text, true);
    case 'confirmActivation':
      return { ...state, ask: { host: event.host, hint: event.hint } };
    case 'phase':
      return { ...state, phase: { index: event.index, count: event.count, label: event.label },
        progress: { sent: 0, total: event.bytes } };
    case 'connected':
      return { ...said('Connected.'), connected: true, ask: undefined };
    case 'target':
      return { ...state, target: event.ok, phase: undefined };
    case 'progress':
      return { ...state, progress: { sent: event.sent, total: event.total } };
    case 'installFinished':
      return { ...said(event.ok ? 'Installed.' : 'Install failed.'),
        busy: false, phase: undefined };
    case 'restartNeeded':
      return { ...state, restart: true };
    case 'updateFinished':
      return { ...said(event.ok ? 'Updated. Open NBT Manager on the car for 10 seconds to finish.'
        : 'Update failed.'), busy: false, phase: undefined };
    case 'toolFinished':
      return { ...outcome(line(event.text), event.ok ? 'Done.' : 'Failed.', at),
        busy: false, phase: undefined };
    case 'log': {
      const what = LOG_NAMES[event.kind];
      if (!what) return said('Could not save the file.');
      if (!event.uri) return said(`Could not save the ${what}.`);
      return { ...said(`Got the ${what}.`),
        fetched: [{ kind: event.kind, uri: event.uri, size: event.size }, ...state.fetched].slice(0, 10) };
    }
    case 'finished':
      return { ...outcome(line(event.text), state.connected ? 'Disconnected.' : 'Could not connect.', at),
        running: false, connected: false, target: false, busy: false, ask: undefined, phase: undefined,
        restart: false };
  }
}

/** The overall bar: finished steps plus the current step's share, and its caption. */
export function overall(state: InstallerState): { value: number; text: string } | undefined {
  const { phase, progress } = state;
  if (!phase) return undefined;
  const share = progress.total > 0 ? Math.min(1, progress.sent / progress.total) : 0;
  return {
    value: Math.min(1, (phase.index + share) / Math.max(1, phase.count)),
    text: `Step ${phase.index + 1} of ${phase.count}: ${phase.label}`,
  };
}

/** The log as shown and shared: detail only when asked for, newest line first if asked. */
export function logText(state: InstallerState, details: boolean, newestFirst = false): string {
  const lines = state.log.filter(l => details || !l.detail)
    .map(l => (details ? `[${l.at.toFixed(1).padStart(7)}s] ${l.text}` : l.text));
  return (newestFirst ? lines.reverse() : lines).join('\n');
}

/** Fixed native error codes as sentences. */
export function connectError(code: string): string {
  switch (code) {
    case 'no-wifi':
      return 'Join the adapter’s Wi-Fi first.';
    case 'no-address':
      return 'The Wi-Fi is not ready yet. Try again in a moment.';
    case 'invalid':
      return 'Check the settings.';
    case 'busy':
      return 'Already connected.';
    default:
      return 'Could not start.';
  }
}

/** The controller settings' size limit (bench.rs CONFIG_MAX); the core checks the content. */
export const CONFIG_MAX = 1024;
