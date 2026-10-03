/**
 * Carte d'un produit dans la grille du catalogue (2 colonnes) — comme la carte
 * du site : photo (pastilles visibilité / rupture), catégorie, nom, marque,
 * prix (+ ancien prix barré), état du stock, puis les actions autorisées :
 * Voir · Modification rapide · Modifier (formulaire complet) · Supprimer.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import { gnf, STOCK_COLOR, stockLevel, stockText, VISIBILITY, type Product } from '../api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function VisibilityPill({ v }: { v: Product['visibilite'] }) {
  const s = VISIBILITY[v];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <ThemedText style={[styles.pillText, { color: s.color }]}>{s.label}</ThemedText>
    </View>
  );
}

export function ProductCard({
  p,
  width,
  canEdit,
  canDelete,
  onOpen,
  onQuickEdit,
  onFullEdit,
  onDelete,
}: {
  p: Product;
  width: number;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onQuickEdit: () => void;
  onFullEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const uri = thumb(p.images[0]?.url, 400);
  const level = stockLevel(p);
  return (
    <View style={[styles.card, { width, borderColor: theme.border }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Voir ${p.nom}`} style={({ pressed }) => [pressed && styles.pressed]}>
        <View style={[styles.img, { backgroundColor: theme.backgroundElement }]}>
          {uri ? <Image source={{ uri }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" transition={150} /> : <Ionicons name="image-outline" size={30} color={theme.textSecondary} />}
          <View style={styles.badges}>
            <VisibilityPill v={p.visibilite} />
            {p.stock === 0 ? (
              <View style={[styles.pill, { backgroundColor: '#DC2626' }]}>
                <ThemedText style={[styles.pillText, { color: '#fff' }]}>Rupture</ThemedText>
              </View>
            ) : null}
          </View>
          {p.images.length > 1 ? (
            <View style={styles.count}>
              <Ionicons name="images-outline" size={11} color="#fff" />
              <ThemedText style={styles.countText}>{p.images.length}</ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          {p.category?.nom ? (
            <ThemedText style={styles.cat} numberOfLines={1}>
              {p.category.icone ? `${p.category.icone} ` : ''}
              {p.category.nom}
              {p.subCategory ? ` › ${p.subCategory.nom}` : ''}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.name} numberOfLines={2}>
            {p.nom}
          </ThemedText>
          {p.marque ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {p.marque}
            </ThemedText>
          ) : null}
          <View style={styles.prices}>
            <ThemedText style={styles.price}>{gnf(p.prix)}</ThemedText>
            {p.prixAncien ? <ThemedText style={styles.old}>{gnf(p.prixAncien)}</ThemedText> : null}
          </View>
          <View style={styles.stock}>
            <View style={[styles.dot, { backgroundColor: STOCK_COLOR[level] }]} />
            <ThemedText style={[styles.stockText, { color: level === 'ok' ? theme.textSecondary : STOCK_COLOR[level] }]} numberOfLines={1}>
              {stockText(p)}
            </ThemedText>
          </View>
        </View>
      </Pressable>
      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        <Act icon="eye-outline" label="Voir le détail" onPress={onOpen} />
        {canEdit ? <Act icon="flash-outline" label="Modification rapide" onPress={onQuickEdit} /> : null}
        {canEdit ? <Act icon="create-outline" label="Modifier (formulaire complet)" onPress={onFullEdit} primary /> : null}
        {canDelete ? <Act icon="trash-outline" label="Supprimer" onPress={onDelete} danger /> : null}
      </View>
    </View>
  );
}

function Act({ icon, label, onPress, primary, danger }: { icon: IconName; label: string; onPress: () => void; primary?: boolean; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : primary ? Brand.primaryInk : theme.text;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.act, primary && { backgroundColor: Brand.primarySoft }, danger && { backgroundColor: '#FEF2F2' }, !primary && !danger && { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={17} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  fill: { width: '100%', height: '100%' },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fff' },
  img: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badges: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  count: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  countText: { color: '#fff', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  body: { padding: 10, gap: 2 },
  cat: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: '#8A8A8A' },
  name: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  prices: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  price: { fontSize: 14.5, lineHeight: 19, fontWeight: '900' },
  old: { fontSize: 11.5, lineHeight: 15, color: '#8A8A8A', textDecorationLine: 'line-through' },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  stockText: { flex: 1, fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 6, padding: 8, borderTopWidth: StyleSheet.hairlineWidth },
  act: { flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
