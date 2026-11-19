/** The car's Wi-Fi as this app holds it, for the screens: one car at a time. */
import { useSyncExternalStore } from 'react';
import { CarLink } from '../../modules/car-link';
import { t } from '../i18n';

export type Connection = { state: 'none' | 'joining' | 'connected'; ssid?: string; carId?: string; problem?: string };

let current: Connection = { state: 'none' };
const listeners = new Set<() => void>();

export function setConnection(next: Connection): void {
  current = next;
  listeners.forEach(listener => listener());
}

export function currentConnection(): Connection {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConnection(): Connection {
  return useSyncExternalStore(subscribe, currentConnection);
}

// Android may drop the network without the app asking: say so.
CarLink.addListener('onNetwork', event => {
  if (event.state === 'connected') {
    if (current.ssid) setConnection({ state: 'connected', ssid: current.ssid, carId: current.carId });
  } else if (current.state !== 'joining') {
    setConnection({ state: 'none', ssid: current.ssid, carId: current.carId,
      problem: event.state === 'lost' ? t('op.wifiLost') : undefined });
  }
});
