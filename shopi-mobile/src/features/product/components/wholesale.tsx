/**
 * Encadré « Vente en gros » : quantité minimum, paliers de prix, contact boutique.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { discountPercent, formatPrice } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import type { ProductDetail } from '../api';

/* ── Vente en gros ──────────────────────────────────────────────────── */

export function Wholesale({ product, onContact }: { product: ProductDetail; onContact: () => void }) {
  const theme = useTheme();
  const tiers = [...product.wholesaleTiers].sort((a, b) => (a.ordre ?? a.quantiteMin) - (b.ordre ?? b.quantiteMin));
  if (!product.venteEnGros) return null;
  return (
    <View style={[styles.gros, { borderColor: '#FBE3D0', backgroundColor: '#F3F6FF' }]}>
      <View style={styles.rowBetween}>
        <View style={styles.row6}>
          <Ionicons name="cube" size={18} color={Brand.primary} />
          <ThemedText style={styles.grosTitle}>Vente en gros — prix dégressifs</ThemedText>
        </View>
        {product.moq ? (
          <View style={[styles.pill, { backgroundColor: Brand.primarySoft }]}>
            <ThemedText style={styles.pillText}>Min. {product.moq} unités</ThemedText>
          </View>
        ) : null}
      </View>
      {tiers.length ? (
        tiers.map((t, i) => {
          const save = discountPercent(t.prixUnitaire, product.prix);
          return (
            <View key={i} style={[styles.tier, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <ThemedText style={styles.flex}>
                {t.quantiteMin}
                {t.quantiteMax != null ? ` – ${t.quantiteMax}` : '+'} unités
              </ThemedText>
              <ThemedText style={styles.tierPrice}>{formatPrice(t.prixUnitaire)}</ThemedText>
              {save ? <ThemedText style={styles.tierSave}>−{save}%</ThemedText> : null}
            </View>
          );
        })
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Aucun palier de prix dégressif renseigné.
        </ThemedText>
      )}
      <Pressable onPress={onContact} style={[styles.outlineBtn, { borderColor: Brand.primary }]} accessibilityRole="button">
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={Brand.primary} />
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
          Commander en gros : écrire à la boutique
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  gros: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grosTitle: { fontWeight: '800', color: Brand.primary },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { color: Brand.primaryInk, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  flex: { flex: 1 },
  tierPrice: { fontWeight: '800' },
  tierSave: { color: Brand.success, fontWeight: '800', fontSize: 12, minWidth: 38, textAlign: 'right' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, minHeight: 42, marginTop: 4 },
});
