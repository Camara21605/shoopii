/**
 * Éléments visuels du catalogue (accueil client) — mêmes principes que le
 * site : carte produit « l'image d'abord » (photo carrée, nom sur 2 lignes,
 * prix), carte boutique de taille fixe, types d'entreprise en vignettes
 * rondes, catégories en pastilles.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import type { Category, CompanyType, Product, Shop } from '@/features/catalog/api';
import { discountPercent, firstImage, formatPrice, thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <ThemedText style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </ThemedText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>
            {action}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Carte produit — largeur imposée par la grille ou la rangée horizontale. */
export function ProductCard({ product, width, onPress }: { product: Product; width: number; onPress: () => void }) {
  const theme = useTheme();
  const img = thumb(firstImage(product.images), 400);
  const promo = discountPercent(product.prix, product.prixAncien);
  const gros = product.venteEnGros && product.moq ? `Dès ${product.moq} unités` : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.nom}, ${formatPrice(product.prix)}`}
      style={({ pressed }) => [styles.pCard, { width, borderColor: theme.border }, pressed && styles.pressed]}>
      <View style={[styles.pImgBox, { backgroundColor: theme.backgroundElement }]}>
        {img ? (
          <Image source={{ uri: img }} style={styles.fill} contentFit="cover" transition={150} recyclingKey={product.id} />
        ) : (
          <ThemedText style={styles.pEmoji}>{product.category?.icone || '📦'}</ThemedText>
        )}
        {promo ? (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>−{promo}%</ThemedText>
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
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.pOld}>
            {formatPrice(product.prixAncien)}
          </ThemedText>
        ) : gros ? (
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.pOld}>
            {gros}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ShopCard({ shop, onPress }: { shop: Shop; onPress: () => void }) {
  const theme = useTheme();
  const cover = thumb(shop.coverImage, 500);
  const logo = thumb(shop.logo, 120);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={shop.companyName}
      style={({ pressed }) => [styles.sCard, { borderColor: theme.border }, pressed && styles.pressed]}>
      <View style={[styles.sCover, { backgroundColor: theme.backgroundSelected }]}>
        {cover ? <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" /> : null}
      </View>
      <View style={[styles.sLogo, { borderColor: theme.background, backgroundColor: theme.backgroundElement }]}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" />
        ) : (
          <ThemedText style={styles.sLogoText}>{shop.domaineIcon || shop.companyName.charAt(0).toUpperCase()}</ThemedText>
        )}
      </View>
      <View style={styles.sBody}>
        <View style={styles.row}>
          <ThemedText numberOfLines={1} style={styles.sName}>
            {shop.companyName}
          </ThemedText>
          {shop.verified ? <Ionicons name="checkmark-circle" size={15} color={Brand.primary} /> : null}
        </View>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
          {shop.domaine ?? ' '}
        </ThemedText>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
          <ThemedText numberOfLines={1} style={styles.sMeta} themeColor="textSecondary">
            {shop.localisation || 'Guinée'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

export function TypeItem({ type, selected, onPress }: { type: CompanyType; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const img = thumb(type.imageUrl, 160);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={styles.tItem}>
      <View
        style={[
          styles.tCircle,
          { backgroundColor: type.couleur ? `${type.couleur}22` : theme.backgroundElement },
          selected && { borderColor: Brand.primary, borderWidth: 2.5 },
        ]}>
        {img ? (
          <Image source={{ uri: img }} style={styles.fill} contentFit="cover" />
        ) : (
          <ThemedText style={styles.tEmoji}>{type.icone || '🏪'}</ThemedText>
        )}
      </View>
      <ThemedText numberOfLines={2} style={[styles.tName, selected && { color: Brand.primary }]}>
        {capitalize(type.nom)}
      </ThemedText>
    </Pressable>
  );
}

export function CategoryChip({ category, selected, onPress }: { category: Category; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { borderColor: selected ? Brand.primary : theme.border, backgroundColor: selected ? theme.backgroundSelected : theme.background },
      ]}>
      {category.icone ? <ThemedText style={styles.chipIcon}>{category.icone}</ThemedText> : null}
      <ThemedText numberOfLines={1} type="small" style={selected ? { color: Brand.primary, fontWeight: '700' } : undefined}>
        {capitalize(category.nom)}
      </ThemedText>
    </Pressable>
  );
}

/** Bloc vide / erreur / chargement, pour qu'une section ne soit jamais « blanche ». */
export function SectionState({ children }: { children: ReactNode }) {
  return <View style={styles.state}>{children}</View>;
}

/** « VÊTEMENTS & MODES » → « Vêtements & modes » (les types sont saisis en majuscules). */
function capitalize(s: string) {
  if (s !== s.toUpperCase()) return s.charAt(0).toUpperCase() + s.slice(1);
  const low = s.toLocaleLowerCase('fr');
  return low.charAt(0).toUpperCase() + low.slice(1);
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  // Produit
  pCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  pImgBox: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  pEmoji: { fontSize: 40, lineHeight: 48 },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: Brand.danger, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  pBody: { padding: 10, gap: 2 },
  pName: { fontSize: 13.5, lineHeight: 18, fontWeight: '600', minHeight: 36 },
  pPrice: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: Brand.primary },
  pOld: { fontSize: 12, lineHeight: 16, textDecorationLine: 'line-through' },
  // Boutique
  sCard: { width: 220, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  sCover: { height: 80 },
  sLogo: {
    position: 'absolute',
    top: 52,
    left: 12,
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sLogoText: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  sBody: { paddingHorizontal: 12, paddingTop: 30, paddingBottom: 12, gap: 2 },
  sName: { fontSize: 15, lineHeight: 20, fontWeight: '800', flexShrink: 1 },
  sMeta: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  // Type d'entreprise
  tItem: { width: 76, alignItems: 'center', gap: 6 },
  tCircle: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tEmoji: { fontSize: 28, lineHeight: 34 },
  tName: { fontSize: 11.5, lineHeight: 14, fontWeight: '600', textAlign: 'center' },
  // Catégorie
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 220 },
  chipIcon: { fontSize: 15, lineHeight: 20 },
  state: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.four, alignItems: 'center', gap: Spacing.two },
});
