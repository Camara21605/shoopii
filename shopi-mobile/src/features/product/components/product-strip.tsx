/**
 * Carrousel horizontal de produits (similaires, achetés ensemble, même boutique).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { discountPercent, formatPrice, thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import type { SimilarProduct } from '../api';
import { type IconName } from './icon';

/* ── Carrousel de produits (similaires, achetés ensemble, même boutique) ── */

export function ProductStrip({
  title,
  icon,
  items,
  onOpen,
  onShop,
}: {
  title: string;
  icon: IconName;
  items: SimilarProduct[];
  onOpen: (id: string) => void;
  onShop?: (id: string) => void;
}) {
  const theme = useTheme();
  if (!items.length) return null;
  return (
    <View style={styles.gap12}>
      <View style={styles.row8}>
        <Ionicons name={icon} size={18} color={Brand.primary} />
        <ThemedText style={styles.stripTitle}>{title}</ThemedText>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row12}
        renderItem={({ item }) => {
          const pct = discountPercent(item.prix, item.prixAncien);
          return (
            <Pressable onPress={() => onOpen(item.id)} style={[styles.mini, { borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel={`${item.nom}, ${formatPrice(item.prix)}`}>
              <View style={[styles.miniImg, { backgroundColor: theme.backgroundElement }]}>
                {item.imageUrl ? <Image source={{ uri: thumb(item.imageUrl, 300) }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" /> : <ThemedText style={styles.miniEmoji}>{item.emoji || '📦'}</ThemedText>}
                {pct ? (
                  <View style={[styles.badge, styles.miniBadge, { backgroundColor: Brand.danger }]}>
                    <ThemedText style={styles.badgeText}>−{pct}%</ThemedText>
                  </View>
                ) : null}
              </View>
              <View style={styles.miniBody}>
                <ThemedText numberOfLines={2} style={styles.miniName}>
                  {item.nom}
                </ThemedText>
                <ThemedText style={styles.miniPrice}>{formatPrice(item.prix)}</ThemedText>
                {item.shopNom ? (
                  <Pressable onPress={() => item.shopId && onShop?.(item.shopId)} hitSlop={4}>
                    <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                      {item.shopNom}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gap12: { gap: 12 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stripTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mini: { width: 150, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  miniImg: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  miniEmoji: { fontSize: 36, lineHeight: 44 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  miniBadge: { position: 'absolute', top: 8, left: 8 },
  badgeText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  miniBody: { padding: 8, gap: 2 },
  miniName: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  miniPrice: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: Brand.primary },
});
