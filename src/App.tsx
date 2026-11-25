// SPDX-License-Identifier: MPL-2.0
/** NBT Manager: cars, their applications, the online catalog, the package library and activity. No router. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { setSystemLocale, t, useLanguage, type Key } from './i18n';
import { systemLocale } from './i18n/system';
import { loadCars, selectCar, type CarRecord } from './store/cars';
import { loadCachedCatalog, type Catalog } from './store/catalog';
import { loadLibrary, type LibraryEntry } from './store/library';
import { runningCount, useActivities } from './store/activity';
import { loadPreferences } from './store/preferences';
import { parsePairLink } from './protocol/pairLink';
import type { WifiCode } from './protocol/wifiCode';
import { Button, useColors, useStyles } from './ui/kit';
import { ActivityScreen } from './screens/ActivityScreen';
import { AppScreen } from './screens/AppScreen';
import { CarScreen } from './screens/CarScreen';
import { CarsScreen } from './screens/CarsScreen';
import { InstallerScreen } from './screens/InstallerScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { PairScreen } from './screens/PairScreen';
import { WhatsNewSheet } from './screens/WhatsNewSheet';
import { StoreScreen } from './screens/StoreScreen';
import { KeysScreen } from './screens/KeysScreen';
import { LicensesScreen } from './screens/LicensesScreen';

export type Tab = 'car' | 'store' | 'library' | 'activity';
/** `storeApp`: the application Get apps opens with. */
/** `pairCode`: a Wi-Fi code another app handed over (protocol/pairLink.ts). */
export type Route = { tab: Tab; pairing?: boolean; app?: string; installer?: boolean; cars?: boolean; licenses?: boolean; keys?: boolean; carId?: string;
  storeApp?: string; pairCode?: WifiCode };

/** A page over the tabs, with a Back button. */
const isPage = (route: Route) =>
  !!(route.pairing || route.app || route.installer || route.cars || route.licenses || route.keys);

export type AppState = {
  cars: CarRecord[];
  car?: CarRecord;
  library: LibraryEntry[];
  libraryReady: boolean;
  setLibrary: (entries: LibraryEntry[]) => void;
  /** The online catalog read last (cached), until Get apps reads it again. */
  catalog?: Catalog;
  setCatalog: (catalog: Catalog) => void;
  reloadCars: (select?: string) => Promise<void>;
  updateCar: (car: CarRecord) => void;
  go: (route: Route) => void;
};

const TABS: { tab: Tab; label: Key }[] = [
  { tab: 'car', label: 'tab.car' }, { tab: 'store', label: 'tab.store' },
  { tab: 'library', label: 'tab.library' }, { tab: 'activity', label: 'tab.activity' },
];

// The phone's language, before the first screen; a saved choice follows (loadPreferences).
setSystemLocale(systemLocale());

export default function App() {
  useLanguage(); // every screen reads the language when it renders
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [route, setRoute] = useState<Route>({ tab: 'car' });
  const [cars, setCars] = useState<CarRecord[]>([]);
  const [selected, setSelected] = useState<string>();
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>();
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [carsReady, setCarsReady] = useState(false);
  const reloadVersion = useRef(0);
  const activities = useActivities();

  const reloadCars = useCallback(async (select?: string) => {
    const version = ++reloadVersion.current;
    if (select) await selectCar(select);
    const loaded = await loadCars();
    if (version === reloadVersion.current) {
      setCars(loaded.cars);
      setSelected(loaded.selected);
      setCarsReady(true);
    }
  }, []);

  useEffect(() => {
    let live = true;
    void loadPreferences().then(() => {
      if (live) setPreferencesReady(true);
    });
    void reloadCars();
    void loadLibrary().then(entries => {
      if (live) { setLibrary(entries); setLibraryReady(true); }
    });
    // The cached copy only: the catalog is read online when Get apps opens.
    void loadCachedCatalog().then(cached => {
      if (live && cached) setCatalog(current => current ?? cached);
    });
    return () => {
      live = false;
    };
  }, [reloadCars]);

  // A Wi-Fi code from another app opens pairing with it; the user still chooses to pair.
  useEffect(() => {
    const open = (url: string | null | undefined) => {
      const code = parsePairLink(url);
      if (code) setRoute({ tab: 'car', pairing: true, pairCode: code });
    };
    void Linking.getInitialURL().then(open);
    const sub = Linking.addEventListener('url', event => open(event.url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isPage(route)) {
        setRoute({ tab: route.tab });
        return true;
      }
      if (route.tab !== 'car') {
        setRoute({ tab: 'car' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route]);

  const car = cars.find(c => c.id === selected);
  const state: AppState = {
    cars, car, library, libraryReady, setLibrary, reloadCars, catalog, setCatalog,
    go: next => setRoute({ ...next, ...(next.app ? { carId: car?.id } : {}) }),
    updateCar: updated => setCars(list => list.map(c => (c.id === updated.id ? { ...c, apps: updated.apps, appsSeenAt: updated.appsSeenAt } : c))),
  };

  let screen;
  if (route.licenses) screen = <LicensesScreen />;
  else if (route.keys) screen = <KeysScreen state={state} />;
  else if (route.pairing) screen = <PairScreen key={route.pairCode?.ssid ?? 'scan'} state={state} code={route.pairCode} />;
  else if (route.installer) screen = <InstallerScreen />;
  else if (route.cars) screen = <CarsScreen state={state} />;
  else if (route.app && cars.some(c => c.id === route.carId)) {
    screen = <AppScreen key={`${route.carId}:${route.app}`} state={state}
      car={cars.find(c => c.id === route.carId)!} appId={route.app} />;
  }
  else if (route.tab === 'store') screen = <StoreScreen key={route.storeApp ?? 'store'} state={state} open={route.storeApp} />;
  else if (route.tab === 'library') screen = <LibraryScreen state={state} />;
  else if (route.tab === 'activity') screen = <ActivityScreen />;
  else screen = <CarScreen key={car?.id ?? 'empty'} state={state} />;

  const running = runningCount(activities);
  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} />
      {isPage(route) ? (
        <View style={styles.back}><Button label={t('common.back')} kind="plain" onPress={() => setRoute({ tab: route.tab })} /></View>
      ) : null}
      <View style={styles.content}>{screen}</View>
      <WhatsNewSheet ready={preferencesReady && carsReady && libraryReady} usedBefore={cars.length > 0 || library.length > 0} />
      {!isPage(route) ? <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map(item => (
          <Pressable key={item.tab} accessibilityRole="tab" accessibilityState={{ selected: route.tab === item.tab }}
            onPress={() => setRoute({ tab: item.tab })} style={[styles.tab, route.tab === item.tab && { borderTopColor: colors.accent }]}>
            <Text style={[styles.tabText, route.tab === item.tab && styles.tabActive]}>
              {t(item.label)}{item.tab === 'activity' && running ? ` (${running})` : ''}
            </Text>
          </Pressable>
        ))}
      </View> : null}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  back: { alignItems: 'flex-start', paddingHorizontal: 8 },
  page: { flex: 1, backgroundColor: colors.page },
  content: { flex: 1 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
    backgroundColor: colors.panel },
  tab: { borderTopWidth: 3, borderTopColor: 'transparent', paddingHorizontal: 8, flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabActive: { color: colors.accent },
});
