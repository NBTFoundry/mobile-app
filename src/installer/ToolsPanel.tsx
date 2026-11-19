/** Maintenance tools for a connected head unit, folded away by default. */
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { runTool } from './session';
import { CONFIG_MAX } from './state';
import { Body, Button, Label, Panel, useColors, useStyles } from '../ui/kit';

export function ToolsPanel({ ready, testApp, example }: { ready: boolean; testApp: boolean; example: string }) {
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(example);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  if (!open) return <Button label="More tools" kind="plain" onPress={() => setOpen(true)} />;
  return (
    <Panel>
      <Label>Logs</Label>
      <Button label="Collect everything" disabled={!ready} onPress={() => runTool('collectAll')} />
      <Body>One file: both logs, audio connections, processes and the manager’s files. Changes nothing.</Body>
      <View style={styles.buttons}>
        <Button label="Manager log on" kind="plain" disabled={!ready} onPress={() => runTool('logOn')} />
        <Button label="Get manager log" kind="plain" disabled={!ready} onPress={() => runTool('fetchLog')} />
        <Button label="Manager log off" kind="plain" disabled={!ready} onPress={() => runTool('logOff')} />
        <Button label="Get iDrive log" kind="plain" disabled={!ready} onPress={() => runTool('fetchSystemLog')} />
      </View>

      {testApp ? (
        <Button label="Install test app" kind="plain" disabled={!ready} onPress={() => runTool('provisionTestApp')} />
      ) : null}

      <Label>Controller settings</Label>
      <TextInput value={config} onChangeText={setConfig} multiline maxLength={CONFIG_MAX} style={styles.config}
        autoCapitalize="none" autoCorrect={false} accessibilityLabel="Controller settings" />
      <View style={styles.buttons}>
        <Button label="Save" kind="plain" disabled={!ready || !config.trim()} onPress={() => runTool('writeConfig', config)} />
        <Button label="Delete" kind="plain" disabled={!ready} onPress={() => runTool('removeConfig')} />
      </View>

      {confirmRemoval ? (
        <View style={styles.confirm}>
          <Body>Remove NBT Manager and all its apps?</Body>
          <View style={styles.buttons}>
            <Button label="Cancel" kind="plain" onPress={() => setConfirmRemoval(false)} />
            <Button label="Remove" kind="danger" disabled={!ready}
              onPress={() => { setConfirmRemoval(false); runTool('removeAll'); }} />
          </View>
        </View>
      ) : <Button label="Remove NBT Manager" kind="danger" disabled={!ready} onPress={() => setConfirmRemoval(true)} />}

      <Button label="Hide tools" kind="plain" onPress={() => setOpen(false)} />
    </Panel>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  config: { color: colors.text, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12,
    minHeight: 140, fontSize: 14, fontFamily: 'monospace', textAlignVertical: 'top' },
  confirm: { gap: 12 },
});
