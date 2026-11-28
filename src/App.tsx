// SPDX-License-Identifier: MPL-2.0
/** NBT Manager: three tabs (the applications, the car, the rest), pages over them, and what
 * every screen shares. No router: the route is state here (route.ts). */
import { ObserveRoot, useObserve } from 'expo-observe';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Appearance, BackHandler, Linking, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { setSystemLocale, t, useLanguage } from './i18n';
import { systemLocale } from './i18n/system';
import { parsePairLink } from './protocol/pairLink';
import { HOME, back, depth, screenKey, type Route, type Tab } from './route';
import { refreshApps } from './car/operations';
import { loadCars, selectCar, type CarRecord } from './store/cars';
import { checkAppUpdate } from './store/appUpdate';
import { fetchCatalog, loadCachedCatalog, type Catalog } from './store/catalog';
import { bindLibrary } from './store/downloads';
import { loadLibrary, type LibraryEntry } from './store/library';
import { loadPreferences, preferences, usePreferences } from './store/preferences';
import { Button, useColors, useStyles } from './ui/kit';
import { Enter } from './ui/motion';
import { setCarTheme } from './ui/theme';
import { ActivityBar } from './screens/ActivityBar';
import { ActivityScreen } from './screens/ActivityScreen';
import { AppScreen } from './screens/AppScreen';
import { AppsScreen } from './screens/AppsScreen';
import { CarScreen } from './screens/CarScreen';
import { CarToolScreen } from './screens/CarToolScreen';
import { CarsScreen } from './screens/CarsScreen';
import { DiagnosticsSheet } from './screens/DiagnosticsSheet';
import { DownloadsScreen } from './screens/DownloadsScreen';
import { InstallerScreen } from './screens/InstallerScreen';
import { KeysScreen } from './screens/KeysScreen';
import { LicensesScreen } from './screens/LicensesScreen';
import { MoreScreen } from './screens/MoreScreen';
import { PairScreen } from './screens/PairScreen';
import { TabBar } from './screens/TabBar';
import { WhatsNewSheet } from './screens/WhatsNewSheet';

export type { Route, Tab } from './route';

export type AppState = {
  cars: CarRecord[];
  car?: CarRecord;
  library: LibraryEntry[];
  libraryReady: boolean;
  setLibrary: (entries: LibraryEntry[]) => void;
  /** The online catalog read last (cached), until Apps reads it again. */
  catalog?: Catalog;
  setCatalog: (catalog: Catalog) => void;
  reloadCars: (select?: string) => Promise<void>;
  updateCar: (car: CarRecord) => void;
  /** Shows another screen; without `tab`, over the tab shown now. */
  go: (next: Omit<Route, 'tab'> & { tab?: Tab }) => void;
  back: () => void;
};

type Shown = { route: Route; from: 'right' | 'left' | 'none' };

// The phone's language, before the first screen; a saved choice follows (loadPreferences).
setSystemLocale(systemLocale());

function App() {
  useLanguage(); // every screen reads the language when it renders
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { appearance } = usePreferences();
  const { markInteractive } = useObserve();
  const [shown, setShown] = useState<Shown>({ route: { tab: HOME }, from: 'none' });
  const [cars, setCars] = useState<CarRecord[]>([]);
  const [selected, setSelected] = useState<string>();
  const [library, setLibraryState] = useState<LibraryEntry[]>([]);
  const [libraryReady, setLibraryReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>();
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [carsReady, setCarsReady] = useState(false);
  const reloadVersion = useRef(0);
  const libraryNow = useRef<LibraryEntry[]>([]);
  const { route } = shown;

  const show = useCallback((next: Route) => setShown(old => ({ route: next,
    from: depth(next) > depth(old.route) ? 'right' : depth(next) < depth(old.route) ? 'left' : 'none' })), []);
  const setLibrary = useCallback((entries: LibraryEntry[]) => {
    libraryNow.current = entries;
    setLibraryState(entries);
  }, []);

  const reloadCars = useCallback(async (select?: string) => {
    const version = ++reloadVersion.current;
    if (select) await selectCar(select);
    const loaded = await loadCars();
    if (version === reloadVersion.current) {
      setCars(loaded.cars);
      setSelected(loaded.selected);
      setCarsReady(true);
    }
    return loaded.cars.length;
  }, []);

  useEffect(() => {
    let live = true;
    bindLibrary(() => libraryNow.current, setLibrary);
    void loadPreferences().then(() => {
      if (live) setPreferencesReady(true);
    });
    // Without a car, the app opens on the tab that pairs one.
    void reloadCars().then(count => {
      if (live && !count) setShown(old => (depth(old.route) === 0 && old.route.tab === HOME ? { route: { tab: 'car' }, from: 'none' } : old));
    });
    void loadLibrary().then(entries => {
      if (live) { setLibrary(entries); setLibraryReady(true); }
    });
    // The cached copy only: the catalog is read online when the user asks in Apps.
    void loadCachedCatalog().then(cached => {
      if (live && cached) setCatalog(current => current ?? cached);
    });
    return () => {
      live = false;
    };
  }, [reloadCars, setLibrary]);

  // A Wi-Fi code from another app opens pairing with it; the user still chooses to pair.
  useEffect(() => {
    const open = (url: string | null | undefined) => {
      const code = parsePairLink(url);
      if (code) show({ tab: 'car', page: 'pairing', pairCode: code });
    };
    void Linking.getInitialURL().then(open);
    const sub = Linking.addEventListener('url', event => open(event.url));
    return () => sub.remove();
  }, [show]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const previous = back(route);
      if (previous) show(previous);
      return !!previous;
    });
    return () => sub.remove();
  }, [route, show]);

  const car = cars.find(c => c.id === selected);
  // The selected car's theme, as its own screen shows; BMW's without a car.
  useEffect(() => setCarTheme(car?.theme), [car?.theme]);
  // Dialogs, the keyboard and the system bars follow the appearance chosen.
  useEffect(() => Appearance.setColorScheme(appearance === 'auto' ? 'unspecified' : appearance), [appearance]);
  const ready = preferencesReady && carsReady && libraryReady;
  // What the user asked the app to do when it opens (More › Settings); failures stay quiet.
  const opened = useEffectEvent(() => {
    const { autoConnect, autoCheck } = preferences();
    if (autoConnect && car) void refreshApps(car).then(() => reloadCars());
    if (autoCheck) {
      void checkAppUpdate(true);
      void fetchCatalog().then(setCatalog, () => undefined);
    }
  });
  useEffect(() => {
    if (!ready) return;
    markInteractive();
    opened();
  }, [ready, markInteractive]);

  const state: AppState = {
    cars, car, library, libraryReady, setLibrary, catalog, setCatalog,
    reloadCars: async select => { await reloadCars(select); },
    go: next => show({ ...next, tab: next.tab ?? route.tab, carId: next.app ? next.carId ?? car?.id : undefined }),
    back: () => show(back(route) ?? { tab: HOME }),
    updateCar: updated => setCars(list => list.map(c => (c.id === updated.id
      ? { ...c, apps: updated.apps, appsSeenAt: updated.appsSeenAt, theme: updated.theme ?? c.theme,
        manager: updated.manager !== undefined ? updated.manager : c.manager } : c))),
  };

  // An application's page is about the car it was opened for; a forgotten car closes it.
  const appCar = route.carId ? cars.find(c => c.id === route.carId) : undefined;
  let screen;
  if (route.page === 'licenses') screen = <LicensesScreen />;
  else if (route.page === 'keys') screen = <KeysScreen state={state} />;
  else if (route.page === 'pairing') screen = <PairScreen state={state} code={route.pairCode} />;
  else if (route.page === 'installer') screen = <InstallerScreen />;
  else if (route.page === 'cars') screen = <CarsScreen state={state} />;
  else if (route.page === 'activity') screen = <ActivityScreen />;
  else if (route.page === 'downloads') screen = <DownloadsScreen state={state} />;
  else if (route.app && (!route.carId || appCar)) {
    screen = <AppScreen state={state} car={appCar} appId={route.app} section={route.section} />;
  }
  else if (route.tool && car) screen = <CarToolScreen state={state} car={car} tool={route.tool} />;
  else if (route.tab === 'car') screen = <CarScreen state={state} />;
  else if (route.tab === 'more') screen = <MoreScreen state={state} />;
  else screen = <AppsScreen state={state} />;

  const paged = depth(route) > 0;
  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} />
      {paged ? (
        <View style={styles.back}><Button label={t('common.back')} kind="plain" onPress={state.back} /></View>
      ) : null}
      <Enter key={`${screenKey(route)}:${car?.id ?? ''}`} from={shown.from} style={styles.content}>{screen}</Enter>
      <WhatsNewSheet ready={ready} usedBefore={cars.length > 0 || library.length > 0} />
      <DiagnosticsSheet ready={ready} usedBefore={cars.length > 0 || library.length > 0} />
      {route.page === 'activity' || route.page === 'pairing' ? null
        : <ActivityBar onOpen={() => state.go({ page: 'activity' })} />}
      {paged ? null : <TabBar tab={route.tab} onTab={tab => show({ tab })} />}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default ObserveRoot.wrap(App);

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  back: { alignItems: 'flex-start', paddingHorizontal: 8 },
  page: { flex: 1, backgroundColor: colors.page },
  content: { flex: 1 },
});
