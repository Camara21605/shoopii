/**
 * Carte produit complète (photo 4:5, remise, ❤, stock, « Ajouter »).
 * Utilisée par le profil entreprise et par Explorer (avec le nom de la boutique).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { discountPercent, formatPrice, thumb } from '@/features/catalog/format';
import { openProduct } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';

import type { ShopProduct } from '../api';
import { isNew } from './shared';

/** Carte produit complète (image, remise, ❤, stock, « Ajouter ») — aussi utilisée par Explorer, avec la boutique. */
export function ShopProductCard({
  p,
  width,
  fav,
  inCart,
  adding,
  onFav,
  onAdd,
  shopName,
  shopVerified,
  onShop,
}: {
  p: ShopProduct;
  width: number;
  fav: boolean;
  inCart: boolean;
  adding: boolean;
  onFav: () => void;
  onAdd: () => void;
  shopName?: string | null;
  shopVerified?: boolean;
  onShop?: () => void;
}) {
  const theme = useTheme();
  const img = thumb([...p.images].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).find((i) => (i.type ?? 'image') === 'image')?.url, 400);
  const pct = discountPercent(p.prix, p.prixAncien);
  const out = p.stock <= 0;
  const stock = out
    ? { label: 'Rupture de stock', color: Brand.danger }
    : p.stock < 5
      ? { label: `Plus que ${p.stock} en stock`, color: '#D97706' }
      : { label: 'En stock', color: Brand.success };
  return (
    <View style={[s.pCard, { width, borderColor: theme.border }]}>
      <Pressable onPress={() => openProduct(p.id)} accessibilityRole="button" accessibilityLabel={`${p.nom}, ${formatPrice(p.prix)}`}>
        <View style={[s.pImg, { backgroundColor: theme.backgroundElement }]}>
          {img ? <Image source={{ uri: img }} style={s.fill} contentFit="cover" cachePolicy="memory-disk" transition={150} recyclingKey={p.id} /> : <ThemedText style={s.pEmoji}>{p.category?.icone || '📦'}</ThemedText>}
          {pct ? (
            <View style={[s.badge, { backgroundColor: Brand.danger }]}>
              <ThemedText style={s.badgeText}>−{pct}%</ThemedText>
            </View>
          ) : isNew(p) ? (
            <View style={[s.badge, { backgroundColor: Brand.success }]}>
              <ThemedText style={s.badgeText}>NOUVEAU</ThemedText>
            </View>
          ) : null}
          {out ? <View style={s.outVeil} /> : null}
        </View>
        <View style={s.pBody}>
          {p.category?.nom ? (
            <ThemedText numberOfLines={1} themeColor="textSecondary" style={s.pCat}>
              {p.category.nom}
            </ThemedText>
          ) : null}
          <ThemedText numberOfLines={2} style={s.pName}>
            {p.nom}
          </ThemedText>
          {/* Prix + ancien prix sur une ligne : l'image garde l'essentiel de la carte. */}
          <View style={s.priceRow}>
            <ThemedText numberOfLines={1} style={s.pPrice}>
              {formatPrice(p.prix)}
            </ThemedText>
            {pct && p.prixAncien ? (
              <ThemedText numberOfLines={1} themeColor="textSecondary" style={s.pOld}>
                {formatPrice(p.prixAncien)}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText style={[s.pStock, { color: stock.color }]}>● {stock.label}</ThemedText>
        </View>
      </Pressable>
      {shopName ? (
        <Pressable onPress={onShop} disabled={!onShop} style={s.pShop} accessibilityRole="button" accessibilityLabel={`Boutique ${shopName}`}>
          <Ionicons name="storefront-outline" size={12} color={theme.textSecondary} />
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={s.pShopText}>
            {shopName}
          </ThemedText>
          {shopVerified ? <Ionicons name="checkmark-circle" size={12} color={Brand.primary} /> : null}
        </Pressable>
      ) : null}
      <Pressable onPress={onFav} hitSlop={6} style={s.heart} accessibilityRole="button" accessibilityLabel={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
        <Ionicons name={fav ? 'heart' : 'heart-outline'} size={18} color={fav ? Brand.danger : '#1F1F1F'} />
      </Pressable>
      <Pressable
        onPress={onAdd}
        disabled={out || adding}
        accessibilityRole="button"
        style={[s.addBtn, inCart ? { backgroundColor: theme.backgroundSelected } : { backgroundColor: Brand.primarySoft }, out && { opacity: 0.45 }]}>
        {adding ? (
          <ActivityIndicator size="small" color={inCart ? Brand.primary : Brand.primaryInk} />
        ) : (
          <>
            <Ionicons name={inCart ? 'checkmark' : 'cart-outline'} size={16} color={inCart ? Brand.primary : Brand.primaryInk} />
            <ThemedText type="smallBold" style={{ color: inCart ? Brand.primary : Brand.primaryInk }}>
              {out ? 'Indisponible' : inCart ? 'Au panier · +1' : 'Ajouter'}
            </ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.04)' },
  /* Photo verticale 4:5, comme les cartes de l'accueil. */
  pImg: { aspectRatio: 4 / 5, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  pEmoji: { fontSize: 38, lineHeight: 46 },
  badge: { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  outVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.55)' },
  pBody: { paddingHorizontal: 9, paddingTop: 7, paddingBottom: 6, gap: 1 },
  pCat: { fontSize: 10, lineHeight: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  pName: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', minHeight: 32 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, overflow: 'hidden' },
  pPrice: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: Brand.primary, flexShrink: 0 },
  pOld: { fontSize: 10.5, lineHeight: 14, textDecorationLine: 'line-through', flexShrink: 1 },
  pStock: { fontSize: 10.5, lineHeight: 14, fontWeight: '600', marginTop: 1 },
  pShop: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingBottom: 8, marginTop: -4 },
  pShopText: { flexShrink: 1, fontSize: 12, lineHeight: 16 },
  heart: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 34, marginHorizontal: 8, marginBottom: 8, borderRadius: 10 },
});
