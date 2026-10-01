/**
 * Choix des variantes réelles du produit (taille, couleur…).
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { ProductDetail } from '../api';

/* ── Variantes ──────────────────────────────────────────────────────── */

export function Variants({
  variantes,
  selected,
  onSelect,
}: {
  variantes: ProductDetail['variantes'];
  selected: Record<string, string>;
  onSelect: (type: string, value: string) => void;
}) {
  const theme = useTheme();
  return (
    <>
      {variantes.map((v) => {
        const values = v.vals.split(',').map((s) => s.trim()).filter(Boolean);
        if (!values.length) return null;
        const current = selected[v.type] ?? values[0];
        return (
          <View key={v.id} style={styles.block}>
            <ThemedText style={styles.label}>
              {v.type} <ThemedText style={[styles.label, { color: Brand.primary }]}>· {current}</ThemedText>
            </ThemedText>
            <View style={styles.wrap}>
              {values.map((val) => {
                const on = current === val;
                return (
                  <Pressable
                    key={val}
                    onPress={() => onSelect(v.type, val)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on ? { borderColor: Brand.primary, backgroundColor: theme.backgroundSelected } : { borderColor: theme.border }]}>
                    <ThemedText style={[styles.chipText, on && { color: Brand.primary }]}>{val}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  chipText: { fontWeight: '600' },
});
