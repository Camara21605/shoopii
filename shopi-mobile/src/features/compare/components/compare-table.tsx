/**
 * Tableau de comparaison, pensé pour le téléphone : une colonne par produit, qui
 * défilent ensemble horizontalement (au-delà de 2 produits). Le nom de chaque
 * ligne (« Prix », « Garantie »…) est posé AU-DESSUS des valeurs et reste fixé à
 * gauche pendant le défilement — l'équivalent de la 1re colonne figée du site,
 * sans lui sacrifier un tiers de la largeur.
 *   · en-tête : photo, nom, ✕ retirer, « Panier » ; ruban « Recommandé » sur le meilleur choix ;
 *   · dernière colonne « + Ajouter un produit » tant qu'il reste des places ;
 *   · lignes qui diffèrent légèrement surlignées (hors filtre « différences »).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { openProduct, openShop } from '@/features/catalog/open';
import type { ProductDetail } from '@/features/product/api';
import { useTheme } from '@/hooks/use-theme';

import { firstImageOf } from '../api';
import { isDiff, type Cell, type Row } from '../rows';

const PAD = 16;
const GAP = 10;

const TONE: Record<NonNullable<Cell['tone']>, string> = {
  price: '#1F1F1F',
  promo: '#BE123C',
  ok: Brand.success,
  low: '#B45309',
  out: Brand.danger,
  link: '#1F1F1F',
};

export function CompareTable({
  produits,
  rows,
  bestId,
  places,
  diffsOnly,
  addingToCart,
  onRemove,
  onAddToCart,
  onAddProduct,
  addHint,
}: {
  produits: ProductDetail[];
  rows: Row[];
  bestId: string | null;
  places: number;
  diffsOnly: boolean;
  addingToCart: string | null;
  onRemove: (id: string) => void;
  onAddToCart: (id: string) => void;
  onAddProduct: () => void;
  /** Sous-catégorie / catégorie proposée sous « Ajouter un produit » */
  addHint?: string | null;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [scrollX] = useState(() => new Animated.Value(0));

  const cols = produits.length + (places > 0 ? 1 : 0);
  /* 2 colonnes tiennent à l'écran ; au-delà, ~2,3 colonnes visibles pour montrer qu'on peut faire défiler. */
  const colW = Math.floor(cols <= 2 ? (width - PAD * 2 - GAP) / 2 : (width - PAD * 2 - GAP * 2) / 2.3);
  const visibleW = width - PAD * 2;
  const multi = produits.length > 1;

  const pinned = { transform: [{ translateX: scrollX }] };

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
      contentContainerStyle={styles.content}>
      <View>
        {/* En-têtes des colonnes */}
        <View style={styles.row}>
          {produits.map((p) => {
            const img = thumb(firstImageOf(p), colW * 2);
            const best = multi && bestId === p.id;
            return (
              <View key={p.id} style={[styles.head, { width: colW, borderColor: best ? Brand.success : theme.border, backgroundColor: theme.background }]}>
                <Pressable onPress={() => openProduct(p.id)} accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.nom}`}>
                  <View style={[styles.img, { backgroundColor: theme.backgroundElement }]}>
                    {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="cube-outline" size={30} color={theme.textSecondary} />}
                    {best ? (
                      <View style={styles.ribbon}>
                        <Ionicons name="trophy" size={11} color="#fff" />
                        <ThemedText style={styles.ribbonText}>Recommandé</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText numberOfLines={2} style={styles.name}>
                    {p.nom}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => onRemove(p.id)}
                  hitSlop={10}
                  style={styles.remove}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${p.nom} de la comparaison`}>
                  <Ionicons name="close" size={15} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => onAddToCart(p.id)}
                  disabled={p.stock <= 0 || addingToCart === p.id}
                  style={[styles.cartBtn, { backgroundColor: p.stock <= 0 ? theme.backgroundElement : Brand.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${p.nom} au panier`}>
                  {addingToCart === p.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name={p.stock <= 0 ? 'ban' : 'cart-outline'} size={15} color={p.stock <= 0 ? theme.textSecondary : '#fff'} />
                      <ThemedText style={[styles.cartText, { color: p.stock <= 0 ? theme.textSecondary : '#fff' }]}>{p.stock <= 0 ? 'Épuisé' : 'Panier'}</ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}
          {places > 0 ? (
            <Pressable
              onPress={onAddProduct}
              style={[styles.head, styles.addCol, { width: colW, borderColor: theme.border }]}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un produit à la comparaison">
              <View style={[styles.plus, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="add" size={26} color={Brand.primary} />
              </View>
              <ThemedText style={styles.addTitle}>Ajouter un produit</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Encore {places} place{places > 1 ? 's' : ''}
              </ThemedText>
              {addHint ? (
                <ThemedText type="small" numberOfLines={1} style={[styles.center, styles.bold]}>
                  {addHint}
                </ThemedText>
              ) : null}
            </Pressable>
          ) : null}
        </View>

        {/* Lignes */}
        {rows.map((r) =>
          r.section ? (
            <Animated.View key={r.key} style={[styles.section, { width: visibleW }, pinned]}>
              <ThemedText style={styles.sectionText}>{r.label}</ThemedText>
            </Animated.View>
          ) : (
            <View key={r.key} style={[styles.line, { borderTopColor: theme.border }, !diffsOnly && multi && isDiff(r) ? styles.lineDiff : null]}>
              <Animated.View style={[{ width: visibleW }, pinned]}>
                <ThemedText style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
                  {r.label}
                </ThemedText>
              </Animated.View>
              <View style={styles.row}>
                {r.cells.map((c, i) => (
                  <CellView key={produits[i].id} cell={c} width={colW} best={multi && bestId === produits[i].id} />
                ))}
                {places > 0 ? <View style={{ width: colW }} /> : null}
              </View>
            </View>
          ),
        )}
      </View>
    </Animated.ScrollView>
  );
}

function CellView({ cell, width, best }: { cell: Cell; width: number; best: boolean }) {
  const theme = useTheme();
  const color = cell.tone ? TONE[cell.tone] : theme.text;
  const body = (
    <View style={[styles.cell, { width }, best ? styles.cellBest : null]}>
      <View style={styles.cellMain}>
        <ThemedText style={[styles.value, { color }, cell.tone === 'price' ? styles.price : null, cell.tone === 'link' ? styles.underline : null]}>{cell.text}</ThemedText>
        {cell.verified ? <Ionicons name="shield-checkmark" size={13} color={Brand.primary} accessibilityLabel="Boutique vérifiée" /> : null}
      </View>
      {cell.sub ? (
        <ThemedText type="small" themeColor="textSecondary">
          {cell.sub}
        </ThemedText>
      ) : null}
      {cell.badge ? (
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={12} color={Brand.success} />
          <ThemedText style={styles.badgeText}>{cell.badge}</ThemedText>
        </View>
      ) : null}
    </View>
  );
  return cell.shopId ? (
    <Pressable onPress={() => openShop(cell.shopId!)} accessibilityRole="link" accessibilityLabel={`Voir la boutique ${cell.text}`}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: PAD },
  row: { flexDirection: 'row', gap: GAP },
  bold: { fontWeight: '700' },
  center: { textAlign: 'center' },
  head: { borderWidth: 1, borderRadius: 16, padding: 8, gap: 8, overflow: 'hidden' },
  ribbon: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.success, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  ribbonText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  img: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13.5, lineHeight: 18, fontWeight: '700', marginTop: 8, minHeight: 36 },
  remove: { position: 'absolute', top: 12, right: 12, zIndex: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  cartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, minHeight: 38 },
  cartText: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  addCol: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  plus: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  addTitle: { fontWeight: '800', textAlign: 'center' },
  section: { paddingTop: 22, paddingBottom: 4 },
  sectionText: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  line: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingBottom: 12, marginTop: 4 },
  lineDiff: { backgroundColor: 'rgba(250,204,21,0.08)' },
  label: { fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  cell: { gap: 3, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 8 },
  cellBest: { backgroundColor: 'rgba(15,157,88,0.06)' },
  cellMain: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  value: { fontSize: 14, lineHeight: 19, fontWeight: '600', flexShrink: 1 },
  price: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  underline: { textDecorationLine: 'underline' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: 'rgba(15,157,88,0.1)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: Brand.success },
});
