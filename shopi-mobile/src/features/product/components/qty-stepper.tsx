/**
 * Sélecteur de quantité − / + (bornes min 1 et max fournie).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { type IconName } from './icon';

/* ── Quantité ───────────────────────────────────────────────────────── */

export function QtyStepper({ qty, max, onChange }: { qty: number; max: number; onChange: (q: number) => void }) {
  const theme = useTheme();
  const btn = (icon: IconName, disabled: boolean, next: number, label: string) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.qtyBtn, { borderColor: theme.border }, disabled && { opacity: 0.35 }]}>
      <Ionicons name={icon} size={18} color={theme.text} />
    </Pressable>
  );
  return (
    <View style={styles.qtyRow}>
      {btn('remove', qty <= 1, qty - 1, 'Diminuer la quantité')}
      <ThemedText style={styles.qtyNum} accessibilityLabel={`Quantité ${qty}`}>
        {qty}
      </ThemedText>
      {btn('add', qty >= max, qty + 1, 'Augmenter la quantité')}
    </View>
  );
}

const styles = StyleSheet.create({
  qtyBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyNum: { minWidth: 36, textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '800' },
});
