// SPDX-License-Identifier: MPL-2.0
/** Accessible modal surface with Android Back and keyboard handling. */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Title, useColors, useStyles } from './kit';
import { t } from '../i18n';

/** `closeLabel`: the bottom button's label (Close by default; Cancel for a transfer). */
export function Dialog({ title, children, onClose, closeLabel }: {
  title: string; children: ReactNode; onClose: () => void; closeLabel?: string;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Title>{title}</Title>
            {children}
            <Button label={closeLabel ?? t('common.close')} kind="plain" onPress={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.panel, borderRadius: 24, maxHeight: '90%' },
  content: { padding: 24, gap: 16 },
});
