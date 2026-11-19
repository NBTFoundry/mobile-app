import { requireNativeModule, type EventSubscription } from 'expo-modules-core';

/** What the installer core reports, one event at a time (see `src/installer/state.ts`). */
export type InstallerEvent =
  | { type: 'message'; text: string }
  | { type: 'detail'; text: string }
  | { type: 'confirmActivation'; host: string; hint: string | null }
  | { type: 'phase'; index: number; count: number; label: string; bytes: number }
  | { type: 'connected' }
  | { type: 'target'; ok: boolean }
  | { type: 'progress'; sent: number; total: number }
  | { type: 'installFinished'; ok: boolean }
  | { type: 'updateFinished'; ok: boolean }
  | { type: 'restartNeeded' }
  | { type: 'toolFinished'; ok: boolean; text: string }
  | { type: 'log'; kind: LogKind; uri: string | null; size: number }
  | { type: 'finished'; text: string };

/** The manager's debug log, the head unit's system log, or "Collect everything". */
export type LogKind = 'debug' | 'system' | 'collection';

export type InstallTool =
  | 'logOn' | 'logOff' | 'fetchLog' | 'fetchSystemLog' | 'collectAll' | 'provisionTestApp'
  | 'writeConfig' | 'removeConfig' | 'removeAll' | 'restartIdrive';

export type ConnectSettings = { host: string; port: number; user: string; password: string; gateway: string | null };

type CarInstallNative = {
  /** The manager release built into this app. */
  bundled(): { available: boolean; version: string; sequence: number; message: string; testApp: boolean;
    controllerExample: string };
  defaults(): Omit<ConnectSettings, 'gateway'>;
  /** Holds the Wi-Fi the phone is on and mobile data, then connects in the background. */
  connect(settings: ConnectSettings): Promise<{ addresses: string[]; mobileData: boolean }>;
  confirmActivation(approve: boolean): void;
  install(): boolean;
  update(): boolean;
  tool(name: InstallTool, text: string | null): boolean;
  disconnect(): void;
  addListener(event: 'onEvent', listener: (event: InstallerEvent) => void): EventSubscription;
};

/** Installs NBT Manager over a Wi-Fi ENET adapter. Errors carry a fixed code in `message`. */
export const CarInstall = requireNativeModule<CarInstallNative>('CarInstall');
