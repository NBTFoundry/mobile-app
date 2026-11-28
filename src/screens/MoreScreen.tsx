// SPDX-License-Identifier: MPL-2.0
/** What is set once, what stays on this phone, and About. */
import { ScrollView, StyleSheet } from 'react-native';
import type { AppState } from '../App';
import { useActivities } from '../store/activity';
import { chooseDiagnostics } from '../store/diagnostics';
import { APPEARANCES, THEME_CHOICES, chooseAppearance, chooseAutoCheck, chooseAutoConnect, chooseBetas, chooseTheme, usePreferences,
  type Appearance, type ThemeChoice } from '../store/preferences';
import { ChoiceRow } from '../ui/ChoiceRow';
import { IconTile, Row, Section, Title, Toggle, formatSize } from '../ui/kit';
import { LanguageRow } from '../ui/LanguageRow';
import { t, tn, type Key } from '../i18n';
import { AboutCard } from './AboutCard';

const APPEARANCE_KEYS: Record<Appearance, Key> = { auto: 'appearance.auto', light: 'appearance.light', dark: 'appearance.dark' };
/** The makes keep their names in every language. */
const THEME_NAMES: Record<Exclude<ThemeChoice, 'car'>, string> = { bmw: 'BMW', mini: 'MINI', supra: 'Supra' };

export function MoreScreen({ state }: { state: AppState }) {
  const { appearance, theme, betas, diagnostics, autoConnect, autoCheck } = usePreferences();
  // On unless the user turned them off.
  const sharing = diagnostics !== false;
  const latest = useActivities()[0];
  const stored = state.library.reduce((sum, entry) => sum + entry.size, 0);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Title>{t('more.title')}</Title>
      <Section title={t('more.settings')}>
        <LanguageRow />
        <ChoiceRow icon={<IconTile small name="moon" />} title={t('appearance.title')} choices={APPEARANCES} chosen={appearance}
          name={choice => t(APPEARANCE_KEYS[choice])} onChoose={choice => void chooseAppearance(choice)} />
        <ChoiceRow icon={<IconTile small name="theme" />} title={t('theme.title')} choices={THEME_CHOICES} chosen={theme}
          hint={t('theme.hint')} name={choice => (choice === 'car' ? t('theme.car') : THEME_NAMES[choice])}
          onChoose={choice => void chooseTheme(choice)} />
        <Row compact icon={<IconTile small name="flask" />} title={t('more.betas')} detail={betas ? t('store.betasOn') : undefined}
          onPress={() => void chooseBetas(!betas)}
          right={<Toggle on={betas} label={t('more.betas')} onChange={on => void chooseBetas(on)} />} />
        <Row compact icon={<IconTile small name="chart" />} title={t('diag.title')} detail={t('diag.detail')}
          onPress={() => void chooseDiagnostics(!sharing)}
          right={<Toggle on={sharing} label={t('diag.title')} onChange={on => void chooseDiagnostics(on)} />} />
      </Section>
      <Section title={t('start.title')}>
        <Row compact icon={<IconTile small name="car" />} title={t('start.connect')} detail={t('start.connectDetail')}
          onPress={() => void chooseAutoConnect(!autoConnect)}
          right={<Toggle on={autoConnect} label={t('start.connect')} onChange={on => void chooseAutoConnect(on)} />} />
        <Row compact icon={<IconTile small name="refresh" />} title={t('start.check')} detail={t('start.checkDetail')}
          onPress={() => void chooseAutoCheck(!autoCheck)}
          right={<Toggle on={autoCheck} label={t('start.check')} onChange={on => void chooseAutoCheck(on)} />} />
      </Section>
      <Section title={t('more.phone')}>
        <Row compact icon={<IconTile small name="activity" />} title={t('activity.title')} value={latest?.title}
          onPress={() => state.go({ page: 'activity' })} />
        <Row compact icon={<IconTile small name="download" />} title={t('library.title')}
          value={state.library.length ? tn('more.packages', state.library.length, { size: formatSize(stored) }) : undefined}
          onPress={() => state.go({ page: 'downloads' })} />
        <Row compact icon={<IconTile small name="cars" />} title={t('cars.title')} value={state.car?.name}
          onPress={() => state.go({ page: 'cars' })} />
        <Row compact icon={<IconTile small name="plug" />} title={t('common.installNbt')}
          onPress={() => state.go({ page: 'installer' })} />
      </Section>
      <Section title={t('more.about')}>
        <AboutCard state={state} />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 32, gap: 20 },
});
