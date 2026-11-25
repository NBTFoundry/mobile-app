// SPDX-License-Identifier: MPL-2.0
/** An application's page on the phone: its widgets, read every 2 s while shown, and the
 * driver's taps sent back. The application decides what each tap changes. */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { COMPANION_POLL_MS, openCompanion, refreshCompanion, tapCompanion, type CompanionResult } from '../car/companion';
import type { Widget } from '../protocol/companion';
import type { CarRecord } from '../store/cars';
import { Dialog } from '../ui/Dialog';
import { Body, Busy, Button, Heading, Label, Panel, Progress, Row } from '../ui/kit';
import { t } from '../i18n';

type Choice = Extract<Widget, { kind: 'choice' }>;

export function CompanionPanel({ car, app, onClose }: { car: CarRecord; app: string; onClose: () => void }) {
  const [result, setResult] = useState<CompanionResult>();
  const [choosing, setChoosing] = useState<Choice>();
  const [problem, setProblem] = useState<string>();
  /** Opened when the panel opens, and again on Retry. */
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Read again while the car answers, also while the application is not running.
    const next = (shown: CompanionResult) => {
      if (!live) return;
      setResult(shown);
      if ('page' in shown) {
        timer = setTimeout(() => void refreshCompanion(car, app).then(next), COMPANION_POLL_MS);
      }
    };
    void openCompanion(car, app).then(next);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [car, app, round]);
  const tap = async (id: string, value: string) => {
    setProblem(undefined);
    setProblem(await tapCompanion(car, app, id, value));
  };
  const retry = () => {
    setResult(undefined); setProblem(undefined);
    setRound(r => r + 1);
  };
  const page = result && 'page' in result ? result.page : undefined;
  const widget = (w: Widget, key: string) => {
    switch (w.kind) {
      case 'title': return <Heading key={key}>{w.text}</Heading>;
      case 'text': return <Body key={key}>{w.text}</Body>;
      case 'button': return <Button key={key} label={w.label} onPress={() => void tap(w.id, '')} />;
      case 'toggle': return <Row key={key} title={w.label} detail={t(w.on ? 'companion.on' : 'companion.off')}
        onPress={() => void tap(w.id, w.on ? '0' : '1')} />;
      case 'choice': return <Row key={key} title={w.label} detail={w.value} onPress={() => setChoosing(w)} />;
      case 'progress': return <View key={key} style={styles.progress}><Body muted>{w.label}</Body>
        <Progress value={w.percent / 100} /></View>;
    }
  };
  return (
    <Panel>
      <Label>{t('companion.title')}</Label>
      {!result ? <Busy text={t('companion.opening')} /> : null}
      {result && 'unsupported' in result ? <Body muted>{t('companion.unsupported')}</Body> : null}
      {result && 'problem' in result ? <Body>{result.problem}</Body> : null}
      {page && !page.on ? <Body muted>{t('companion.notRunning')}</Body> : null}
      {page?.on ? <View style={styles.widgets}>{page.widgets.map((w, i) => widget(w, `${i}:${w.kind}`))}</View> : null}
      {problem ? <Body>{problem}</Body> : null}
      <View style={styles.buttons}>
        {result && 'problem' in result ? <Button label={t('companion.retry')} kind="plain" onPress={retry} /> : null}
        <Button label={t('common.close')} kind="plain" onPress={onClose} />
      </View>
      {choosing ? <Dialog title={choosing.label} onClose={() => setChoosing(undefined)}>
        {choosing.choices.map(value => <Row key={value} title={value}
          tag={value === choosing.value ? t('common.selected') : undefined}
          onPress={() => { setChoosing(undefined); void tap(choosing.id, value); }} />)}
      </Dialog> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  widgets: { gap: 12 },
  progress: { gap: 6 },
  buttons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
