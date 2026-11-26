// SPDX-License-Identifier: MPL-2.0
/**
 * Installs NBT Manager on a car from the phone, over a Wi-Fi ENET adapter. The
 * phone connects to the head unit over SSH as root, with the NBT-EVO's
 * published password; enabling SSH relays the car's gateway to a third-party
 * service, only after the user confirms here.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  answerActivation, askRestart, bundled, connect, defaults, disconnect, dismissRestart, install, runTool, update, useInstaller,
} from '../installer/session';
import { overall } from '../installer/state';
import { FetchedLogs, LogPanel } from '../installer/LogPanel';
import { ToolsPanel } from '../installer/ToolsPanel';
import { Body, Busy, Button, Label, Panel, Progress, Title, useColors, useStyles } from '../ui/kit';
import { t, type Key } from '../i18n';

const STEPS: Key[] = ['installer.step1', 'installer.step2', 'installer.step3'];

function Field({ label, value, onChange, numeric, secret, placeholder }: {
  label: string; value: string; onChange: (text: string) => void; numeric?: boolean; secret?: boolean;
  placeholder?: string;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false}
        secureTextEntry={secret} keyboardType={numeric ? 'number-pad' : 'default'} style={styles.input} accessibilityLabel={label}
        placeholderTextColor={colors.muted} placeholder={placeholder} />
    </View>
  );
}

export function InstallerScreen() {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const state = useInstaller();
  const release = useMemo(() => bundled(), []);
  const initial = useMemo(() => defaults(), []);
  const [advanced, setAdvanced] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port));
  const [user, setUser] = useState(initial.user);
  const [password, setPassword] = useState(initial.password);
  const [gateway, setGateway] = useState('');
  const bar = overall(state);
  const ready = state.connected && state.target && !state.busy;
  const usable = ready && release.available;

  const start = () => void connect({
    host: host.trim(), port: Number(port) || 0, user: user.trim(), password,
    gateway: gateway.trim() || null,
  });

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Title>{t('installer.title')}</Title>
      <Text style={{ color: colors.warn, fontSize: 15, lineHeight: 22 }}>{t('legal.risk')}</Text>

      {state.running ? null : (
        <View style={styles.steps}>{STEPS.map(step => <Body key={step}>{t(step)}</Body>)}</View>
      )}
      {release.available ? null : <Body>{t('installer.noFiles')}</Body>}

      <View>
        {state.running
          ? <Button label={t('installer.disconnect')} kind="plain" disabled={state.busy} onPress={disconnect} />
          : <Button label={t('installer.connect')} onPress={start} />}
      </View>

      {state.ask ? (
        <Panel style={styles.ask}>
          <Label>{t('installer.sshQuestion')}</Label>
          <Body>{t('installer.sshBody')}</Body>
          <View style={styles.buttons}>
            <Button label={t('common.cancel')} kind="plain" onPress={() => answerActivation(false)} />
            <Button label={t('installer.turnOn')} onPress={() => answerActivation(true)} />
          </View>
        </Panel>
      ) : null}

      {state.running && !state.connected && !state.ask ? <Busy text={t('common.connecting')} /> : null}
      {state.busy ? <Busy text={t('installer.working')} /> : null}
      {bar && state.busy ? <Progress value={bar.value} /> : null}
      {state.result && !state.busy ? <Body>{state.result}</Body> : null}

      {state.restart && ready ? (
        <Panel style={styles.ask}>
          <Label>{t('installer.restartQuestion')}</Label>
          <Body>{t('installer.restartBody')}</Body>
          <View style={styles.buttons}>
            <Button label={t('common.later')} kind="plain" onPress={dismissRestart} />
            <Button label={t('installer.restart')} onPress={() => runTool('restartIdrive')} />
          </View>
        </Panel>
      ) : null}

      {state.connected && state.target ? (
        <View style={styles.buttons}>
          <Button label={t('installer.install')} disabled={!usable} onPress={install} />
          <Button label={t('installer.update')} kind="plain" disabled={!usable} onPress={update} />
          {!state.restart ? <Button label={t('installer.restartAsk')} kind="plain" disabled={!ready} onPress={askRestart} /> : null}
        </View>
      ) : null}
      {state.connected && state.target
        ? <ToolsPanel ready={ready} testApp={release.testApp} example={release.controllerExample} />
        : null}
      <FetchedLogs state={state} />

      {state.log.length ? (
        <Button label={t(showLog ? 'installer.hideLog' : 'installer.showLog')} kind="plain" expanded={showLog} onPress={() => setShowLog(!showLog)} />
      ) : null}
      {showLog && state.log.length ? <LogPanel state={state} /> : null}

      {state.running ? null : (
        <>
          <Button label={t(advanced ? 'installer.hideSettings' : 'installer.settings')} kind="plain" expanded={advanced} onPress={() => setAdvanced(!advanced)} />
          {advanced ? (
            <Panel>
              <Field label={t('installer.address')} value={host} onChange={setHost} />
              <Field label={t('installer.port')} value={port} onChange={setPort} numeric />
              <Field label={t('installer.user')} value={user} onChange={setUser} />
              <Field label={t('installer.password')} value={password} onChange={setPassword} secret />
              <Field label={t('installer.gateway')} value={gateway} onChange={setGateway}
                placeholder={t('installer.automatic')} />
            </Panel>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  page: { padding: 24, paddingBottom: 40, gap: 24 },
  steps: { gap: 6 },
  field: { gap: 6 },
  input: { color: colors.text, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 12,
    minHeight: 48, fontSize: 16 },
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  ask: { borderWidth: 1, borderColor: colors.warn },
});
