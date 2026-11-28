// SPDX-License-Identifier: MPL-2.0
/** The selected car: its link, its NBT Manager, its health (what was read last) and its tools.
 * The applications are on the Apps tab. Connections begin with a user action. */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AppState } from '../App';
import { useConnection } from '../car/connection';
import { refreshApps } from '../car/operations';
import { appItem } from '../store/appList';
import { listsNewest } from '../store/catalog';
import { useBetas } from '../store/preferences';
import { AppIcon } from '../ui/AppIcon';
import { CarHero } from '../ui/CarHero';
import { Body, Button, Heading, IconTile, Label, Panel, Row, Section, Title, useColors, useStyles } from '../ui/kit';
import { LinkDot, type LinkState } from '../ui/motion';
import { formatWhen, t, tn } from '../i18n';
import { CarDetails } from './CarsScreen';

export function CarScreen({ state }: { state: AppState }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { car } = state;
  const connection = useConnection();
  const betas = useBetas();
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [opened] = useState(() => Date.now());
  if (!car) return (
    <ScrollView contentContainerStyle={styles.page}>
      <Title>{t('car.title')}</Title>
      <Panel>
        <CarHero state="off" />
        <Heading>{t('car.welcome')}</Heading>
        <Body muted>{t('car.welcomeBody')}</Body>
        <Button label={t('common.pairCar')} onPress={() => state.go({ page: 'pairing' })} />
      </Panel>
      <Row icon={<IconTile name="plug" />} title={t('common.installNbt')} detail={t('car.installDetail')}
        onPress={() => state.go({ page: 'installer' })} />
      {__DEV__ ? <Row title={t('car.development')} onPress={() => state.go({ page: 'cars' })} /> : null}
    </ScrollView>
  );
  const refresh = async () => {
    setRefreshing(true);
    setFailed(false);
    const updated = await refreshApps(car);
    if (updated) state.updateCar(updated);
    else setFailed(true);
    setRefreshing(false);
  };
  const ours = connection.carId === car.id;
  const link: LinkState = refreshing || (ours && connection.state === 'joining') ? 'busy'
    : car.desk || (ours && connection.state === 'connected') ? 'on' : 'off';
  const status = car.desk ? t('car.desk') : link === 'busy' ? t('common.connecting') : link === 'on' ? t('car.connected')
    : ours && connection.problem ? connection.problem : t('car.notConnected');
  const manager = appItem('manager', car, state.library, state.catalog, betas);
  const { selfTest, crashes } = car.health ?? {};
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable accessibilityRole="button" accessibilityHint={t('car.switch')} onPress={() => state.go({ page: 'cars' })}>
        <Label>{t('car.title')}</Label>
        <View style={styles.name}><Title>{car.name}</Title><Text style={styles.caret}>▾</Text></View>
      </Pressable>
      <Panel>
        <CarHero state={link} />
        <View style={styles.status}>
          <LinkDot state={link} />
          <Text style={styles.statusText}>
            {car.appsSeenAt ? `${status} · ${t('car.readAt', { time: formatWhen(car.appsSeenAt) })}` : status}
          </Text>
        </View>
        <Button label={t(car.apps === undefined ? 'car.readApps' : 'car.refresh')} kind={car.apps === undefined ? 'primary' : 'plain'}
          disabled={refreshing} onPress={() => void refresh()} />
      </Panel>
      {failed ? <Row title={t('car.readFailed')} detail={t('car.readFailedDetail')} onPress={() => state.go({ page: 'activity' })} /> : null}
      <Row icon={<AppIcon id="manager" />} title={manager.name} detail={manager.installed?.version}
        tag={manager.step !== 'none' ? t('car.updateAvailable') : listsNewest(state.catalog, 'manager', opened) && manager.installed
          ? t('common.upToDate') : undefined}
        tagColor={manager.step !== 'none' ? colors.accent : colors.ok} onPress={() => state.go({ app: 'manager' })} />
      <Section title={t('car.health')}>
        <Row icon={<IconTile name="check" />} title={t('selfTest.title')} onPress={() => state.go({ tool: 'selfTest' })}
          detail={!selfTest ? undefined : selfTest.failed ? tn('selfTest.lastFailed', selfTest.failed, { time: formatWhen(selfTest.time) })
            : t('selfTest.lastOk', { time: formatWhen(selfTest.time) })} />
        <Row icon={<IconTile name="alert" />} title={t('crash.title')} onPress={() => state.go({ tool: 'crashes' })}
          detail={!crashes ? undefined : crashes.count ? tn('crash.count', crashes.count) : t('car.noCrashes')} />
        <Row icon={<IconTile name="logs" />} title={t('car.logs')} detail="iDrive, NBT Manager" onPress={() => state.go({ tool: 'logs' })} />
      </Section>
      <Section title={t('car.tools')}>
        <Row icon={<IconTile name="key" />} title={t('keys.title')} onPress={() => state.go({ page: 'keys' })} />
        <Row icon={<IconTile name="pen" />} title={t('car.rename')} onPress={() => setEditing(true)} />
      </Section>
      {editing ? <CarDetails car={car} state={state} onDone={() => setEditing(false)} /> : null}
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 32, gap: 20 },
  name: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caret: { color: colors.muted, fontSize: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { flex: 1, color: colors.muted, fontSize: 14 },
});
