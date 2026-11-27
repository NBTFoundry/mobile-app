// SPDX-License-Identifier: MPL-2.0
/** Maintenance tools for a connected head unit, folded away by default. */
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { runTool } from './session';
import { CONFIG_MAX } from './state';
import { Body, Button, Label, Panel, useColors, useStyles } from '../ui/kit';
import { t } from '../i18n';

export function ToolsPanel({ ready, testApp, example }: { ready: boolean; testApp: boolean; example: string }) {
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(example);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  if (!open) return <Button label={t('tools.more')} kind="plain" onPress={() => setOpen(true)} />;
  return (
    <Panel>
      <Label>{t('tools.logs')}</Label>
      <Button label={t('tools.collect')} disabled={!ready} onPress={() => runTool('collectAll')} />
      <Body>{t('tools.collectBody')}</Body>
      <View style={styles.buttons}>
        <Button label={t('tools.logOn')} kind="plain" disabled={!ready} onPress={() => runTool('logOn')} />
        <Button label={t('tools.getLog')} kind="plain" disabled={!ready} onPress={() => runTool('fetchLog')} />
        <Button label={t('tools.logOff')} kind="plain" disabled={!ready} onPress={() => runTool('logOff')} />
        <Button label={t('tools.getIdriveLog')} kind="plain" disabled={!ready} onPress={() => runTool('fetchSystemLog')} />
      </View>

      {testApp ? (
        <Button label={t('tools.testApp')} kind="plain" disabled={!ready} onPress={() => runTool('provisionTestApp')} />
      ) : null}

      <Label>{t('tools.shim')}</Label>
      <View style={styles.buttons}>
        <Button label={t('tools.shimOn')} kind="plain" disabled={!ready} onPress={() => runTool('shimOn')} />
        <Button label={t('tools.shimOff')} kind="plain" disabled={!ready} onPress={() => runTool('shimOff')} />
      </View>
      <Body>{t('tools.shimBody')}</Body>

      <Label>{t('tools.controller')}</Label>
      <TextInput value={config} onChangeText={setConfig} multiline maxLength={CONFIG_MAX} style={styles.config}
        autoCapitalize="none" autoCorrect={false} accessibilityLabel={t('tools.controller')} />
      <View style={styles.buttons}>
        <Button label={t('tools.save')} kind="plain" disabled={!ready || !config.trim()} onPress={() => runTool('writeConfig', config)} />
        <Button label={t('tools.delete')} kind="plain" disabled={!ready} onPress={() => runTool('removeConfig')} />
      </View>

      {confirmRemoval ? (
        <View style={styles.confirm}>
          <Body>{t('tools.removeQuestion')}</Body>
          <View style={styles.buttons}>
            <Button label={t('common.cancel')} kind="plain" onPress={() => setConfirmRemoval(false)} />
            <Button label={t('tools.remove')} kind="danger" disabled={!ready}
              onPress={() => { setConfirmRemoval(false); runTool('removeAll'); }} />
          </View>
        </View>
      ) : <Button label={t('tools.removeManager')} kind="danger" disabled={!ready} onPress={() => setConfirmRemoval(true)} />}

      <Button label={t('tools.hide')} kind="plain" onPress={() => setOpen(false)} />
    </Panel>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  config: { color: colors.text, borderWidth: 1, borderColor: colors.line, borderRadius: Math.min(colors.corner, 12), padding: 12,
    minHeight: 140, fontSize: 14, fontFamily: 'monospace', textAlignVertical: 'top' },
  confirm: { gap: 12 },
});
