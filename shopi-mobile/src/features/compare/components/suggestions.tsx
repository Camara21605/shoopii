/**
 * « À comparer aussi » — sous le tableau, tant qu'il reste des places : produits
 * de la même sous-catégorie (sinon de la même catégorie), un bouton « Comparer »
 * par carte, « Voir plus » ouvre la feuille d'ajout complète.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { formatPrice, thumb } from '@/features/catalog/format';
import { openProduct } from '@/features/catalog/open';
import type { ProductDetail } from '@/features/product/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchComparables, firstImageOf } from '../api';

const CARD_W = 140;

export function CompareSuggestions({ ids, onAdd, onMore }: { ids: string[]; onAdd: (p: ProductDetail) => void; onMore: () => void }) {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.comparables(ids, 'sub', '', 6), queryFn: () => fetchComparables(ids, 'sub', '', 6), enabled: ids.length > 0 });
  const list = (q.data?.data ?? []).filter((p) => !ids.includes(p.id)).slice(0, 6);
  if (!q.isPending && !list.length) return null;

  const sub =
    q.data?.scope === 'sub' && q.data.sousCategorie
      ? `Même sous-catégorie : ${q.data.sousCategorie.nom}`
      : q.data?.categorie
        ? `Même catégorie : ${q.data.categorie.nom}`
        : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <ThemedText style={styles.title}>À comparer aussi</ThemedText>
          {sub ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {sub}
            </ThemedText>
          ) : null}
        </View>
        <Pressable onPress={onMore} hitSlop={8} accessibilityRole="button">
          <ThemedText style={styles.more}>Voir plus</ThemedText>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={q.isPending ? [] : list}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skel, { backgroundColor: theme.backgroundElement }]} />
            ))}
          </View>
        }
        renderItem={({ item: p }) => {
          const img = thumb(firstImageOf(p), CARD_W * 2);
          return (
            <View style={[styles.card, { borderColor: theme.border }]}>
              <Pressable onPress={() => openProduct(p.id)} accessibilityRole="button" accessibilityLabel={`Ouvrir ${p.nom}`}>
                <View style={[styles.img, { backgroundColor: theme.backgroundElement }]}>
                  {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="cube-outline" size={26} color={theme.textSecondary} />}
                </View>
                <ThemedText numberOfLines={2} style={styles.name}>
                  {p.nom}
                </ThemedText>
                <ThemedText style={styles.price}>{formatPrice(p.prix)}</ThemedText>
              </Pressable>
              <Pressable onPress={() => onAdd(p)} style={[styles.add, { backgroundColor: theme.backgroundElement }]} accessibilityRole="button" accessibilityLabel={`Comparer ${p.nom}`}>
                <Ionicons name="add" size={16} color={Brand.primary} />
                <ThemedText style={styles.addText}>Comparer</ThemedText>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { paddingTop: 28, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  more: { fontWeight: '800', textDecorationLine: 'underline' },
  list: { paddingHorizontal: 16, gap: 10, flexDirection: 'row' },
  skel: { width: CARD_W, height: 230, borderRadius: 16 },
  card: { width: CARD_W, borderWidth: 1, borderRadius: 16, padding: 8, gap: 6, justifyContent: 'space-between' },
  img: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, lineHeight: 17, fontWeight: '700', marginTop: 6, minHeight: 34 },
  price: { fontWeight: '900' },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 999, minHeight: 36 },
  addText: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
});
