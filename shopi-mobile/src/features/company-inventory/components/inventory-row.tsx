/**
 * Ligne de l'inventaire (une ligne du tableau du site, en carte) : photo, nom,
 * catégorie, référence, prix unitaire et valeur en stock, quantité + seuil,
 * barre de niveau, statut, puis Modifier / Réapprovisionner.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import { LEVEL, type Level, type Product } from '../api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function InventoryRow({
  p,
  level,
  pct,
  value,
  price,
  canEdit,
  onOpen,
  onEdit,
  onRestock,
}: {
  p: Product;
  level: Level;
  pct: number;
  value: string;
  price: string;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onRestock: () => void;
}) {
  const theme = useTheme();
  const l = LEVEL[level];
  const uri = thumb(p.images[0]?.url, 160);
  return (
    <View style={[styles.card, { borderColor: level === 'out' ? '#FECACA' : theme.border }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Ouvrir la fiche de ${p.nom}`} style={({ pressed }) => [styles.top, pressed && styles.pressed]}>
        <View style={[styles.img, { backgroundColor: theme.backgroundElement }]}>
          {uri ? <Image source={{ uri }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="image-outline" size={20} color={theme.textSecondary} />}
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {p.nom}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {p.category?.icone ? `${p.category.icone} ` : ''}
            {p.category?.nom ?? ''}
            {p.reference ? ` · ${p.reference}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {price} · <ThemedText type="small">= {value} en stock</ThemedText>
          </ThemedText>
        </View>
        <View style={[styles.pill, { backgroundColor: l.bg }]}>
          <Ionicons name={l.icon as IconName} size={11} color={l.color} />
          <ThemedText style={[styles.pillText, { color: l.color }]}>{l.label}</ThemedText>
        </View>
      </Pressable>
      <View style={styles.stockRow}>
        <View style={styles.qty}>
          <ThemedText style={[styles.qtyV, { color: level === 'ok' ? theme.text : l.color }]}>{p.stock}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            unités
          </ThemedText>
        </View>
        <View style={styles.flex}>
          <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.bar, { width: `${pct}%`, backgroundColor: l.color }]} />
          </View>
          <View style={styles.barMeta}>
            <ThemedText type="small" themeColor="textSecondary">
              {p.seuil != null ? (
                <>
                  <Ionicons name="notifications-outline" size={11} /> Seuil : {p.seuil}
                </>
              ) : (
                'Aucun seuil'
              )}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {pct}%
            </ThemedText>
          </View>
        </View>
      </View>
      {canEdit ? (
        <View style={styles.actions}>
          <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Modifier le stock de ${p.nom}`} style={({ pressed }) => [styles.btn, { borderColor: theme.border }, pressed && styles.pressed]}>
            <Ionicons name="create-outline" size={16} color={theme.text} />
            <ThemedText style={styles.btnText}>Modifier</ThemedText>
          </Pressable>
          <Pressable onPress={onRestock} accessibilityRole="button" accessibilityLabel={`Réapprovisionner ${p.nom}`} style={({ pressed }) => [styles.btn, styles.btnSoft, pressed && styles.pressed]}>
            <Ionicons name="car-outline" size={16} color={Brand.primaryInk} />
            <ThemedText style={[styles.btnText, { color: Brand.primaryInk }]}>Réapprovisionner</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.75 },
  card: { borderWidth: 1, borderRadius: 18, padding: 12, gap: 10, backgroundColor: '#fff' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  img: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qty: { flexDirection: 'row', alignItems: 'baseline', gap: 4, minWidth: 74 },
  qtyV: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  barMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, minHeight: 40 },
  btnSoft: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
  btnText: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
});
