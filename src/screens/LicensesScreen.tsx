// SPDX-License-Identifier: MPL-2.0
/** Notices are bundled in the app and readable without a car or Internet access. */
import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, Text } from 'react-native';
import notices from '../../legal/notices.json';
import { t } from '../i18n';
import { Button, Row, Title, useColors } from '../ui/kit';

export function LicensesScreen() {
  const [selected, setSelected] = useState<number>();
  const colors = useColors();
  useEffect(() => {
    if (selected === undefined) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(undefined);
      return true;
    });
    return () => handler.remove();
  }, [selected]);
  const section = selected === undefined ? undefined : notices.sections[selected];
  return <ScrollView key={selected ?? 'index'} contentContainerStyle={{ padding: 20, gap: 12 }}>
    <Title>{t('legal.licenses')}</Title>
    {section ? <>
      <Button label={t('legal.all')} kind="plain" onPress={() => setSelected(undefined)} />
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18 }}>{section.title}</Text>
      <Text selectable style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{section.text}</Text>
    </> : notices.sections.map((item, index) =>
      <Row key={index} title={item.title} onPress={() => setSelected(index)} />)}
  </ScrollView>;
}
