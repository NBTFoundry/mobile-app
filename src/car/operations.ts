// SPDX-License-Identifier: MPL-2.0
/** Every phone action: join the car's Wi-Fi (or reuse it), act, record the outcome. */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { CarLink } from '../../modules/car-link';
import { changeAutostart, changeSetting, installPackage, listApps, pairPhone, readAutostart, readManager, readTheme,
  readSettings, realWait, removeApp, type Cancel, type Follow } from '../protocol/actions';
import { atCarIp, listenerHosts, pairHosts, reachManager } from '../protocol/opening';
import type { Autostart, Setting, Status } from '../protocol/replies';
import { CarError, CarSession, LinkError } from '../protocol/session';
import { cleanPhoneName, keyId } from '../protocol/signing';
import type { WifiCode } from '../protocol/wifiCode';
import { startActivity, updateActivity, type ActivityPhase } from '../store/activity';
import { forgetCar, loadCars, newCarId, saveCar, rememberApps, type CarRecord } from '../store/cars';
import { appLabel, packageFile, type LibraryEntry } from '../store/library';
import { t, tn } from '../i18n';
import { setConnection } from './connection';
import { describeError, describeManagerAccepted, describeOpening, describeStatus, managerRestarts } from './messages';
import { createKey, deviceSigner, linkCode, nativeLink, removeKey } from './nativeLink';
import { busy, serialized } from './queue';
import { IDLE_RELEASE_MS, releaseDelay } from './networkHold';

const KEEP_AWAKE = 'nbt-car-action';
const cancels = new Map<number, Cancel>();

/** Stops following an action on the phone; the car keeps its own state. */
export function stopFollowing(activityId: number): void {
  const cancel = cancels.get(activityId);
  if (cancel) cancel.cancelled = true;
}

async function wifiPermission(): Promise<void> {
  const permission = Number(Platform.Version) >= 33
    ? 'android.permission.NEARBY_WIFI_DEVICES' as const
    : PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  if (await PermissionsAndroid.request(permission) !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new LinkError('permission');
  }
}

type Network = Pick<CarRecord, 'ssid' | 'passphrase' | 'desk'> & { id?: string };

/** The car's address on the network the last join gave ('' unknown): requests go there. */
let carIp = '';

/** When the app last let go of the car's network (ms since epoch). */
let releasedAt = 0;
/** Seen in the car (dev45): a join right after pairing released the network got no
 * network for 60 s, the same join a minute later worked. Rejoins wait this long. */
const REJOIN_PAUSE_MS = 3000;
let running = 0;
let releaseRequested = false;
/** When the app went to the background (ms since epoch), 0 while in the foreground. */
let backgroundSince = 0;
/** A join is waiting for Android to bring up a car's network. */
let joining = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

/** Lets go of the car's network unless an action is using it. */
export function releaseCarNetwork(): void {
  if (running) { releaseRequested = true; return; }
  releaseRequested = false;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  CarLink.release();
  releasedAt = Date.now();
  carIp = '';
  setConnection({ state: 'none' });
}

/** Lets go of the car's network after `ms`, unless an action takes it first. */
function releaseLater(ms: number): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = ms > 0 ? setTimeout(releaseCarNetwork, ms) : undefined;
  if (ms <= 0) releaseCarNetwork();
}

// In the background the network is kept BACKGROUND_RELEASE_MS (networkHold.ts). If Android
// pauses the app meanwhile, the timer runs late and the release happens when it resumes.
AppState.addEventListener('change', state => {
  if (state === 'background') {
    backgroundSince = Date.now();
    if (!running) releaseLater(releaseDelay(backgroundSince, backgroundSince));
  } else if (state === 'active' && backgroundSince) {
    const away = releaseDelay(backgroundSince, Date.now());
    backgroundSince = 0;
    if (!running) releaseLater(away > 0 ? IDLE_RELEASE_MS : 0);
  }
});

async function joinCar(car: Network, onRetry: () => void): Promise<void> {
  setConnection({ state: 'joining', ssid: car.ssid, carId: car.id });
  const pause = releasedAt + REJOIN_PAUSE_MS - Date.now();
  if (pause > 0) await realWait(pause);
  joining = true;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        carIp = await CarLink.join(car.ssid, car.passphrase);
        setConnection({ state: 'connected', ssid: car.ssid, carId: car.id });
        return;
      } catch (error) {
        const code = linkCode(error);
        if (code !== 'join-failed' || attempt > 0) {
          const failure = new LinkError(code);
          setConnection({ state: 'none', ssid: car.ssid, carId: car.id, problem: describeError(failure) });
          throw failure;
        }
        onRetry();
      }
    }
  } finally {
    joining = false;
  }
}

/** Ends a join in progress (it fails with `cancelled`) so that a pairing need not wait for it. */
function interruptJoin(): void {
  if (!joining) return;
  CarLink.release();
  releasedAt = Date.now();
}

/** Joins the car's Wi-Fi ahead of an action, so that actions start at once. */
export function connectCar(car: CarRecord): Promise<void> {
  if (car.desk) return Promise.resolve();
  return serialized(turn => (turn.stillWanted() ? onCarNetwork(car, async () => undefined) : Promise.resolve()))
    .catch(error => setConnection({ state: 'none', ssid: car.ssid, carId: car.id, problem: describeError(error) }));
}

export async function onCarNetwork<T>(car: Network, run: () => Promise<T>, id?: number): Promise<T> {
  await activateKeepAwakeAsync(KEEP_AWAKE);
  running++;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  try {
    CarLink.setDeskIp(car.desk ?? null);
    if (!car.desk) {
      await wifiPermission();
      await joinCar(car, () => {
        if (id !== undefined) updateActivity(id, { detail: t('common.connecting') });
      });
    }
    if (id !== undefined) updateActivity(id, { detail: t('common.connected') });
    return await run();
  } finally {
    running--;
    deactivateKeepAwake(KEEP_AWAKE);
    // In the background: what is left of BACKGROUND_RELEASE_MS; otherwise the idle delay.
    releaseLater(releaseRequested ? 0 : releaseDelay(backgroundSince, Date.now()));
  }
}

/**
 * Runs an action with an activity entry, shown at once (also while it waits for the action
 * before it); failures become fixed messages. `first`: see queue.ts.
 */
export function act<T>(carName: string, title: string, detail: string,
  run: (id: number, cancel: Cancel) => Promise<{ value: T; phase: ActivityPhase; detail: string }>,
  onStarted?: (id: number) => void, first = false): Promise<T | undefined> {
  const id = startActivity(carName, title, busy() ? t('op.waitingBefore') : detail);
  onStarted?.(id);
  const result = serialized(async turn => {
    if (!turn.stillWanted()) {
      updateActivity(id, { phase: 'failed', detail: t('op.stoppedForPairing') });
      return undefined;
    }
    updateActivity(id, { detail });
    const cancel: Cancel = { cancelled: false };
    cancels.set(id, cancel);
    try {
      const result = await run(id, cancel);
      updateActivity(id, { phase: result.phase, detail: result.detail });
      return result.value;
    } catch (error) {
      updateActivity(id, { phase: 'failed', detail: describeError(error) });
      return undefined;
    } finally {
      cancels.delete(id);
    }
  }, first);
  if (first) interruptJoin();
  return result;
}

export const follow = (id: number, cancel: Cancel): Follow => ({
  cancel, wait: realWait,
  onStatus: status => updateActivity(id, { detail: describeStatus(status) }),
});

const phaseOf = (status: Status): ActivityPhase =>
  ['installed', 'removed', 'paired', 'key-added', 'key-removed'].includes(status.state) ? 'done'
    : status.state === 'failed' ? 'failed' : 'refused';

function sessions(car: CarRecord) {
  const signer = deviceSigner(car.keyAlias, car.keyId);
  const hosts = listenerHosts(car.desk ? car.address : atCarIp(car.address, carIp));
  return { worker: new CarSession(nativeLink, signer, hosts.worker), door: new CarSession(nativeLink, signer, hosts.door) };
}

/** The worker if App Manager is open, else the door; both serve lists and settings. */
export async function anyListener(car: CarRecord): Promise<CarSession> {
  const { worker, door } = sessions(car);
  try {
    await worker.probe();
    return worker;
  } catch (error) {
    if (!(error instanceof LinkError)) throw error;
    await door.probe();
    return door;
  }
}

async function remember(car: CarRecord, session: CarSession): Promise<CarRecord> {
  const apps = await listApps(session);
  // The car's manager release; unread on a failure.
  const manager = await readManager(session).catch(() => undefined);
  // The theme its screen shows, which this app then takes; unread on a failure or an older manager.
  const theme = await readTheme(session).catch(() => undefined);
  const updated = await rememberApps(car.id, apps, manager, theme ?? undefined);
  if (!updated) throw new LinkError('cancelled');
  return updated;
}

/** `desk` is a debug-only workstation `ip` or `ip:port` (worker port; the door is the next one). */
export function pairCar(wifi: WifiCode, deskTarget?: string, onStarted?: (id: number) => void): Promise<CarRecord | undefined> {
  const [desk, deskPort = '8080'] = deskTarget ? deskTarget.split(':') : [];
  const name = cleanPhoneName(String((Platform.constants as { Model?: string }).Model ?? 'Android phone'));
  return act(wifi.ssid, t('pair.title'), t('common.joining'), async (id, cancel) => {
    const carId = newCarId();
    const alias = `car-${carId}`;
    const key = await createKey(alias);
    let paired = false;
    try {
      return await onCarNetwork({ ...wifi, desk }, async () => {
        updateActivity(id, { detail: t('op.asking') });
        const signer = deviceSigner(alias, keyId(key.publicKey));
        const candidates = desk ? [`127.0.0.1:${deskPort}`] : pairHosts(carIp);
        let session: CarSession | undefined;
        for (const host of candidates) {
          const s = new CarSession(nativeLink, signer, host);
          try {
            await s.probe();
            session = s;
            break;
          } catch (error) {
            if (!(error instanceof LinkError)) throw error;
          }
        }
        if (!session) throw new LinkError('refused');
        const compare = t('op.compare');
        const result = await pairPhone(session, name, key.publicKey, digits => updateActivity(id, { digits, detail: compare }), {
          ...follow(id, cancel),
          onStatus: status => updateActivity(id, { detail: status.state === 'waiting' ? compare : describeStatus(status) }),
        }).catch(error => {
          // A refused proposal means the car's 60-second pairing window is not open.
          throw error instanceof CarError && error.status === 403 ? new CarError(403, 'pairing-closed') : error;
        });
        if ('state' in result) return { value: undefined, phase: phaseOf(result), detail: describeStatus(result) };
        const { cars } = await loadCars();
        for (const old of cars.filter(c => c.bssid === result.bssid)) {
          await forgetCar(old.id);
          await removeKey(old.keyAlias);
        }
        const car: CarRecord = { id: carId, name: desk ? 'Desk car' : wifi.ssid, ssid: wifi.ssid,
          passphrase: wifi.passphrase, bssid: result.bssid, address: result.address, keyAlias: alias,
          keyId: signer.keyId, protection: key.protection, ...(desk ? { desk } : {}) };
        await saveCar(car, true);
        paired = true;
        const updated = await remember(car, session).catch(() => car);
        return { value: updated, phase: 'done' as const, detail: t('op.paired') };
      }, id);
    } finally {
      if (!paired) await removeKey(alias);
    }
  }, onStarted, true);
}

export function refreshApps(car: CarRecord): Promise<CarRecord | undefined> {
  return act(car.name, t('car.readApps'), t('common.joining'), async id =>
    onCarNetwork(car, async () => {
      const updated = await remember(car, await anyListener(car));
      return { value: updated, phase: 'done' as const, detail: tn('op.appsOnCar', updated.apps?.length ?? 0) };
    }, id));
}

/** An application's declared settings, and Start with the car (null: the car's manager has none). */
export type AppSettings = { settings: Setting[]; autostart: Autostart | null };

export function loadSettings(car: CarRecord, app: string): Promise<AppSettings | undefined> {
  return act(car.name, t('op.settingsOf', { app }), t('common.joining'), async id =>
    onCarNetwork(car, async () => {
      const session = await anyListener(car);
      const settings = await readSettings(session, app);
      const autostart = await readAutostart(session, app);
      return { value: { settings, autostart }, phase: 'done' as const, detail: tn('op.settingsRead', settings.length) };
    }, id));
}

export function applyAutostart(car: CarRecord, app: string, on: boolean): Promise<boolean | undefined> {
  return act(car.name, t(on ? 'op.autostartOn' : 'op.autostartOff', { app }), t('common.joining'), async id =>
    onCarNetwork(car, async () => {
      await changeAutostart(await anyListener(car), app, on);
      return { value: true, phase: 'done' as const, detail: t('op.applied', { app }) };
    }, id));
}

export function applySetting(car: CarRecord, app: string, setting: Setting, value: string): Promise<boolean | undefined> {
  return act(car.name, t('op.settingTitle', { label: setting.label, value }), t('common.joining'), async id =>
    onCarNetwork(car, async () => {
      await changeSetting(await anyListener(car), app, setting.key, value);
      return { value: true, phase: 'done' as const, detail: t('op.applied', { app }) };
    }, id));
}

/** The car shows an approved manager update for 3 s, then stages and starts it (on trial). */
const MANAGER_RESTART_MS = 8000;

/** The worker, once App Manager is open on the car: installs, removals and files need it. */
export function reachWorker(car: CarRecord, id: number, cancel: Cancel): Promise<CarSession> {
  const { worker, door } = sessions(car);
  return reachManager(worker, door, e => updateActivity(id, { detail: describeOpening(e) }), cancel, realWait);
}

export async function managerAction(car: CarRecord, id: number, cancel: Cancel,
  run: (worker: CarSession) => Promise<Status>) {
  const session = await reachWorker(car, id, cancel);
  const status = await run(session);
  await remember(car, session).catch(() => undefined);
  return { value: status, phase: phaseOf(status), detail: describeStatus(status) };
}

export function install(car: CarRecord, entry: LibraryEntry,
  onStarted?: (id: number) => void): Promise<Status | undefined> {
  const installed = car.apps?.some(a => a.id === entry.info.app);
  const manager = entry.info.app === 'manager';
  const title = t(installed || manager ? 'op.updateTitle' : 'op.installTitle',
    { app: appLabel(entry.info.app), version: entry.info.version });
  return act(car.name, title, t('common.joining'), (id, cancel) => onCarNetwork(car, () =>
    managerAction(car, id, cancel, worker => {
      updateActivity(id, { detail: t('op.sending'), progress: 0 });
      return installPackage(worker, { uri: packageFile(entry.sha256).uri, size: entry.size, sha256: entry.sha256 },
        (sent, total) => updateActivity(id, { progress: total ? sent / total : 0 }), follow(id, cancel));
    }).then(result => (manager && result.phase === 'done' ? afterManagerUpdate(car, id, cancel, result) : result)), id),
  onStarted);
}

/** The car keeps an approved manager release: a manager from 0.5.2 starts it at once
 * ("… starts in a moment"), an older one at the next opening. Once it has restarted, the car's
 * release is read again, so that its pages do not offer the release it now runs. */
async function afterManagerUpdate<T extends { value: Status; phase: ActivityPhase; detail: string }>(
  car: CarRecord, id: number, cancel: Cancel, result: T): Promise<T> {
  const done = { ...result, detail: describeManagerAccepted(result.value) };
  if (!managerRestarts(result.value)) return done;
  updateActivity(id, { detail: t('op.managerRestarting') });
  await realWait(MANAGER_RESTART_MS);
  // Best effort, never a wait for the driver: the car's pages read it again at the next refresh.
  if (!cancel.cancelled) await anyListener(car).then(session => remember(car, session)).catch(() => undefined);
  return done;
}

export function uninstall(car: CarRecord, app: string): Promise<Status | undefined> {
  return act(car.name, t('op.uninstallTitle', { app }), t('common.joining'), (id, cancel) => onCarNetwork(car, () =>
    managerAction(car, id, cancel, worker => removeApp(worker, app, follow(id, cancel))), id));
}
