// SPDX-License-Identifier: MPL-2.0
/** NBT Manager: cars, their applications, the package library and activity. No router. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { setSystemLocale, t, useLanguage, type Key } from './i18n';
import { systemLocale } from './i18n/system';
import { loadCars, selectCar, type CarRecord } from './store/cars';
import { loadLibrary, type LibraryEntry } from './store/library';
import { runningCount, useActivities } from './store/activity';
import { loadPreferences } from './store/preferences';
import { Button, useColors, useStyles } from './ui/kit';
import { ActivityScreen } from './screens/ActivityScreen';
import { AppScreen } from './screens/AppScreen';
import { CarScreen } from './screens/CarScreen';
import { CarsScreen } from './screens/CarsScreen';
import { InstallerScreen } from './screens/InstallerScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { PairScreen } from './screens/PairScreen';
import { LicensesScreen } from './screens/LicensesScreen';

export type Tab = 'car' | 'library' | 'activity';
export type Route = { tab: Tab; pairing?: boolean; app?: string; installer?: boolean; cars?: boolean; licenses?: boolean; carId?: string };

export type AppState = {
  cars: CarRecord[];
  car?: CarRecord;
  library: LibraryEntry[];
  libraryReady: boolean;
  setLibrary: (entries: LibraryEntry[]) => void;
  reloadCars: (select?: string) => Promise<void>;
  updateCar: (car: CarRecord) => void;
  go: (route: Route) => void;
};

const TABS: { tab: Tab; label: Key }[] = [
  { tab: 'car', label: 'tab.car' },
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
  const reloadVersion = useRef(0);
  const activities = useActivities();

  const reloadCars = useCallback(async (select?: string) => {
    const version = ++reloadVersion.current;
    if (select) await selectCar(select);
    const loaded = await loadCars();
    if (version === reloadVersion.current) {
      setCars(loaded.cars);
      setSelected(loaded.selected);
    }
  }, []);

  useEffect(() => {
    let live = true;
    void loadPreferences();
    void reloadCars();
    void loadLibrary().then(entries => {
      if (live) { setLibrary(entries); setLibraryReady(true); }
    });
    return () => {
      live = false;
    };
  }, [reloadCars]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.pairing || route.app || route.installer || route.cars || route.licenses) {
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
    cars, car, library, libraryReady, setLibrary, reloadCars,
    go: next => setRoute({ ...next, ...(next.app ? { carId: car?.id } : {}) }),
    updateCar: updated => setCars(list => list.map(c => (c.id === updated.id ? { ...c, apps: updated.apps, appsSeenAt: updated.appsSeenAt } : c))),
  };

  let screen;
  if (route.licenses) screen = <LicensesScreen />;
  else if (route.pairing) screen = <PairScreen state={state} />;
  else if (route.installer) screen = <InstallerScreen />;
  else if (route.cars) screen = <CarsScreen state={state} />;
  else if (route.app && cars.some(c => c.id === route.carId)) {
    screen = <AppScreen key={`${route.carId}:${route.app}`} state={state}
      car={cars.find(c => c.id === route.carId)!} appId={route.app} />;
  }
  else if (route.tab === 'library') screen = <LibraryScreen state={state} />;
  else if (route.tab === 'activity') screen = <ActivityScreen />;
  else screen = <CarScreen key={car?.id ?? 'empty'} state={state} />;

  const running = runningCount(activities);
  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.page} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} />
      {route.pairing || route.installer || route.app || route.cars || route.licenses ? (
        <View style={styles.back}><Button label={t('common.back')} kind="plain" onPress={() => setRoute({ tab: route.tab })} /></View>
      ) : null}
      <View style={styles.content}>{screen}</View>
      {!(route.pairing || route.installer || route.app || route.cars || route.licenses) ? <View style={styles.tabs} accessibilityRole="tablist">
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
