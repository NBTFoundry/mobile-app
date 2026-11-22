// SPDX-License-Identifier: MPL-2.0
/** Crash reports kept on the car: the list, one report to read and share, all of them in one
 * file to share, and clearing. `app`: only that application's. */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { clearCrashReports, crashTitle, fetchAllCrashes, fetchCrash, fetchCrashes, type CrashList } from '../car/crashes';
import type { CarLog } from '../car/logs';
import type { CarCrash } from '../protocol/replies';
import type { CarRecord } from '../store/cars';
import { Body, Busy, Button, Label, Panel, Row } from '../ui/kit';
import { t } from '../i18n';
import { LogView, share } from './LogView';

export function CrashesPanel({ car, app, onClose }: { car: CarRecord; app?: string; onClose: () => void }) {
  const [list, setList] = useState<CrashList>();
  const [report, setReport] = useState<CarLog>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState<string>();
  /** Read when the panel opens, and again on Refresh. */
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    void fetchCrashes(car, app).then(result => {
      if (live) setList(result);
    });
    return () => {
      live = false;
    };
  }, [car, app, round]);
  const refresh = () => {
    setList(undefined); setProblem(undefined); setReport(undefined);
    setRound(r => r + 1);
  };
  const open = async (crash: CarCrash) => {
    setBusy(t('crash.opening')); setProblem(undefined);
    const result = await fetchCrash(car, crash);
    setReport('log' in result ? result.log : undefined);
    setProblem('problem' in result ? result.problem : undefined);
    setBusy(undefined);
  };
  const shareAll = async (crashes: CarCrash[]) => {
    setBusy(t('crash.gettingAll')); setProblem(undefined);
    const result = await fetchAllCrashes(car, crashes);
    setBusy(undefined);
    if ('uri' in result) await share(result.uri);
    else setProblem(result.problem);
  };
  const clear = async () => {
    setBusy(t('crash.clearing')); setProblem(undefined);
    if (await clearCrashReports(car, app)) {
      setReport(undefined);
      setList({ crashes: [] });
    } else setProblem(t('crash.clearFailed'));
    setBusy(undefined);
  };
  const crashes = list && 'crashes' in list ? list.crashes : undefined;
  return (
    <Panel>
      <Label>{t('crash.title')}</Label>
      {list && 'unsupported' in list ? <Body muted>{t('crash.unsupported')}</Body> : null}
      {list && 'problem' in list ? <Body>{list.problem}</Body> : null}
      {crashes && !crashes.length ? <Body muted>{t('crash.none')}</Body> : null}
      {crashes?.length ? <View>{crashes.map(crash => (
        <Row key={`${crash.app}/${crash.slot}`} title={crashTitle(crash)} detail={crash.ended || undefined}
          onPress={!busy ? () => void open(crash) : undefined} />
      ))}</View> : null}
      {!list ? <Busy text={t('crash.reading')} /> : busy ? <Busy text={busy} /> : null}
      {problem ? <Body>{problem}</Body> : null}
      {report ? <LogView log={report} onClose={() => setReport(undefined)} /> : null}
      <View style={styles.buttons}>
        {crashes?.length ? <Button label={t('crash.shareAll')} kind="plain" disabled={!!busy}
          onPress={() => void shareAll(crashes)} /> : null}
        {crashes?.length ? <Button label={t('crash.clear')} kind="plain" disabled={!!busy}
          onPress={() => void clear()} /> : null}
        <Button label={t('crash.refresh')} kind="plain" disabled={!!busy || !list} onPress={refresh} />
        <Button label={t('common.close')} kind="plain" onPress={onClose} />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
