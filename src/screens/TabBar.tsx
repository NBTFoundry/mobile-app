// SPDX-License-Identifier: MPL-2.0
/** The three tabs: an icon over a label each; More carries a dot when an app update waits. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t, type Key } from '../i18n';
import type { Tab } from '../route';
import { useAppUpdate } from '../store/appUpdate';
import { Icon, type IconName } from '../ui/icons';
import { useColors, useStyles } from '../ui/kit';

const TABS: { tab: Tab; label: Key; icon: IconName }[] = [
  { tab: 'apps', label: 'tab.apps', icon: 'apps' }, { tab: 'car', label: 'tab.car', icon: 'car' },
  { tab: 'more', label: 'tab.more', icon: 'more' },
];

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const waiting = useAppUpdate().phase === 'ready';
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map(item => {
        const on = tab === item.tab;
        return (
          <Pressable key={item.tab} accessibilityRole="tab" accessibilityState={{ selected: on }}
            onPress={() => onTab(item.tab)} style={[styles.tab, on && { borderTopColor: colors.glow }]}>
            <View>
              <Icon name={item.icon} size={22} color={on ? colors.accent : colors.muted} />
              {item.tab === 'more' && waiting ? <View style={styles.dot} /> : null}
            </View>
            <Text style={[styles.text, on && styles.active]}>{t(item.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line,
    backgroundColor: colors.panel },
  tab: { borderTopWidth: 3, borderTopColor: 'transparent', paddingHorizontal: 8, flex: 1, minHeight: 60, gap: 3,
    alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  active: { color: colors.text },
  dot: { position: 'absolute', top: -2, right: -6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.glow },
});
