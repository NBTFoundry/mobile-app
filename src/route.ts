// SPDX-License-Identifier: MPL-2.0
/** Where the app is: one of three tabs, a page over it, and a section of an application's page.
 * No router and no React here: App.tsx holds the route, tests use this. */
import type { WifiCode } from './protocol/wifiCode';

export type Tab = 'apps' | 'car' | 'more';
/** A page over the tabs, with a Back button. */
export type Page = 'pairing' | 'installer' | 'cars' | 'licenses' | 'keys' | 'activity' | 'downloads';
/** What an application's page opens. */
export type AppSection = 'settings' | 'files' | 'page' | 'about' | 'help';
/** What the Car tab opens. */
export type CarTool = 'selfTest' | 'crashes' | 'logs';

export type Route = {
  tab: Tab;
  page?: Page;
  /** An application's page on the car `carId` (none: no car is paired). */
  app?: string;
  carId?: string;
  section?: AppSection;
  tool?: CarTool;
  /** A Wi-Fi code another app handed over (protocol/pairLink.ts), for `pairing`. */
  pairCode?: WifiCode;
};

export const HOME: Tab = 'apps';

/** How far below a tab the route is: 0 a tab, 1 a page, 2 a section of an application's page. */
export function depth(route: Route): number {
  if (route.app && route.section) return 2;
  return route.page || route.app || route.tool ? 1 : 0;
}

/** Where Back leads; undefined on the first tab, where Android leaves the app. */
export function back(route: Route): Route | undefined {
  if (route.app && route.section) return { tab: route.tab, app: route.app, carId: route.carId };
  if (depth(route) > 0) return { tab: route.tab };
  return route.tab === HOME ? undefined : { tab: HOME };
}

/** Changes when another screen is shown, so its state starts afresh and it slides in. */
export function screenKey(route: Route): string {
  return [route.tab, route.page ?? '', route.app ?? '', route.carId ?? '', route.section ?? '', route.tool ?? '',
    route.pairCode?.ssid ?? ''].join('/');
}
