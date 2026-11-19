/**
 * Installs NBT Manager on a car from the phone, over a Wi-Fi ENET adapter. The
 * phone connects to the head unit over SSH as root, with the NBT-EVO's
 * published password; enabling SSH relays the car's gateway to a third-party
 * service, only after the user confirms here.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  answerActivation, askRestart, bundled, connect, defaults, disconnect, dismissRestart, install, runTool, update, useInstaller,
} from '../installer/session';
import { overall } from '../installer/state';
import { FetchedLogs, LogPanel } from '../installer/LogPanel';
import { ToolsPanel } from '../installer/ToolsPanel';
import { Body, Busy, Button, Label, Panel, Progress, Title, useColors, useStyles } from '../ui/kit';

const STEPS = [
  '1. Plug the Wi-Fi adapter into the car. Ignition on.',
  '2. Join the adapter’s Wi-Fi.',
  '3. Keep mobile data on.',
];

function Field({ label, value, onChange, numeric }: {
  label: string; value: string; onChange: (text: string) => void; numeric?: boolean;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false}
        secureTextEntry={label === 'Password'} keyboardType={numeric ? 'number-pad' : 'default'} style={styles.input} accessibilityLabel={label}
        placeholderTextColor={colors.muted} placeholder={label === 'Gateway' ? 'Automatic' : undefined} />
    </View>
  );
}

export function InstallerScreen() {
  const styles = useStyles(makeStyles);
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
      <Title>Install NBT Manager</Title>

      {state.running ? null : (
        <View style={styles.steps}>{STEPS.map(step => <Body key={step}>{step}</Body>)}</View>
      )}
      {release.available ? null : <Body>Installer files aren’t included in this build.</Body>}

      <View>
        {state.running
          ? <Button label="Disconnect" kind="plain" disabled={state.busy} onPress={disconnect} />
          : <Button label="Connect" onPress={start} />}
      </View>

      {state.ask ? (
        <Panel style={styles.ask}>
          <Label>Turn on SSH?</Label>
          <Body>Enabling SSH sends the car’s gateway to an online service. Allow this to continue installing NBT Manager.</Body>
          <View style={styles.buttons}>
            <Button label="Cancel" kind="plain" onPress={() => answerActivation(false)} />
            <Button label="Turn on" onPress={() => answerActivation(true)} />
          </View>
        </Panel>
      ) : null}

      {state.running && !state.connected && !state.ask ? <Busy text="Connecting…" /> : null}
      {state.busy ? <Busy text="Working…" /> : null}
      {bar && state.busy ? <Progress value={bar.value} /> : null}
      {state.result && !state.busy ? <Body>{state.result}</Body> : null}

      {state.restart && ready ? (
        <Panel style={styles.ask}>
          <Label>Restart the head unit?</Label>
          <Body>The whole head unit restarts, as when the car is switched off and on. Needed to load NBT Manager. This disconnects.</Body>
          <View style={styles.buttons}>
            <Button label="Later" kind="plain" onPress={dismissRestart} />
            <Button label="Restart head unit" onPress={() => runTool('restartIdrive')} />
          </View>
        </Panel>
      ) : null}

      {state.connected && state.target ? (
        <View style={styles.buttons}>
          <Button label="Install" disabled={!usable} onPress={install} />
          <Button label="Update" kind="plain" disabled={!usable} onPress={update} />
          {!state.restart ? <Button label="Restart head unit…" kind="plain" disabled={!ready} onPress={askRestart} /> : null}
        </View>
      ) : null}
      {state.connected && state.target
        ? <ToolsPanel ready={ready} testApp={release.testApp} example={release.controllerExample} />
        : null}
      <FetchedLogs state={state} />

      {state.log.length ? (
        <Button label={showLog ? 'Hide log' : 'Show log'} kind="plain" expanded={showLog} onPress={() => setShowLog(!showLog)} />
      ) : null}
      {showLog && state.log.length ? <LogPanel state={state} /> : null}

      {state.running ? null : (
        <>
          <Button label={advanced ? 'Hide connection settings' : 'Connection settings'} kind="plain" expanded={advanced} onPress={() => setAdvanced(!advanced)} />
          {advanced ? (
            <Panel>
              <Field label="Address" value={host} onChange={setHost} />
              <Field label="Port" value={port} onChange={setPort} numeric />
              <Field label="User" value={user} onChange={setUser} />
              <Field label="Password" value={password} onChange={setPassword} />
              <Field label="Gateway" value={gateway} onChange={setGateway} />
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
