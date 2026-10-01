/**
 * Carte produit simple (image d'abord), pour les grilles et rangées horizontales.
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import type { Product } from '@/features/catalog/api';
import { discountPercent, firstImage, formatPrice, thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

/** Carte produit — largeur imposée par la grille ou la rangée horizontale. */
export function ProductCard({
  product,
  width,
  onPress,
}: {
  product: Product;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const img = thumb(firstImage(product.images), 400);
  const promo = discountPercent(product.prix, product.prixAncien);
  const gros =
    product.venteEnGros && product.moq ? `Dès ${product.moq} unités` : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.nom}, ${formatPrice(product.prix)}`}
      style={({ pressed }) => [
        styles.pCard,
        { width, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.pImgBox, { backgroundColor: theme.backgroundElement }]}
      >
        {img ? (
          <Image
            source={{ uri: img }}
            style={styles.fill}
            contentFit="cover"
            transition={150}
            recyclingKey={product.id}
          />
        ) : (
          <ThemedText style={styles.pEmoji}>
            {product.category?.icone || "📦"}
          </ThemedText>
        )}
        {promo ? (
          <View style={styles.promo}>
            <ThemedText style={styles.promoText}>−{promo}%</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.pBody}>
        <ThemedText numberOfLines={2} style={styles.pName}>
          {product.nom}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.pPrice}>
          {formatPrice(product.prix)}
        </ThemedText>
        {promo && product.prixAncien ? (
          <ThemedText
            numberOfLines={1}
            themeColor="textSecondary"
            style={styles.pOld}
          >
            {formatPrice(product.prixAncien)}
          </ThemedText>
        ) : gros ? (
          <ThemedText
            numberOfLines={1}
            themeColor="textSecondary"
            style={styles.pOld}
          >
            {gros}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* Produit */
  pCard: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  pressed: { opacity: 0.85 },
  pImgBox: { width: "100%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  fill: { width: "100%", height: "100%" },
  pEmoji: { fontSize: 40, lineHeight: 48 },
  promo: { position: "absolute", top: 8, left: 8, backgroundColor: Brand.danger, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  promoText: { color: "#fff", fontSize: 11, lineHeight: 15, fontWeight: "800" },
  pBody: { padding: 10, gap: 2 },
  pName: { fontSize: 13.5, lineHeight: 18, fontWeight: "600", minHeight: 36 },
  pPrice: { fontSize: 15, lineHeight: 20, fontWeight: "800", color: Brand.primary },
  pOld: { fontSize: 12, lineHeight: 16, textDecorationLine: "line-through" },
});
