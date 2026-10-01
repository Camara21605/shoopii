/**
 * Carte produit de l'accueil — mêmes éléments que la carte du site
 * (shopi-frontend/src/modules/home/cards/CardProduit.tsx), version téléphone :
 *   · image (toucher = fiche produit), badge −x% / NOUVEAU / GROS
 *   · ❤ favori et 🔖 liste de souhaits en haut à droite
 *   · nom, prix, ancien prix
 *   · ligne d'actions : « Ajouter » au panier (✓ si déjà au panier, rupture),
 *     🏪 voir l'entreprise, ↗ partager
 * Les actions viennent de useProductActions (features/catalog/product-actions.ts).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import type { Product } from '@/features/catalog/api';
import { discountPercent, firstImage, formatPrice, thumb } from '@/features/catalog/format';
import { openProduct, openShop } from '@/features/catalog/open';
import type { useProductActions } from '@/features/catalog/product-actions';
import { useTheme } from '@/hooks/use-theme';

const SITE = 'https://www.shoneya.com';
const NEW_DAYS = 14;
const isRecent = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < NEW_DAYS * 86_400_000;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function ProductTile({
  product: p,
  width,
  actions,
}: {
  product: Product;
  width: number;
  actions: ReturnType<typeof useProductActions>;
}) {
  const theme = useTheme();
  const img = thumb(firstImage(p.images), 400);
  const pct = discountPercent(p.prix, p.prixAncien);
  const fav = actions.favIds.has(p.id);
  const wished = actions.wishIds.has(p.id);
  const inCart = actions.cartIds.has(p.id);
  const adding = actions.pendingCart === p.id;
  const out = p.stock != null && p.stock <= 0;
  const badge = pct
    ? { label: `−${pct}%`, color: Brand.danger }
    : isRecent(p.createdAt)
      ? { label: 'NOUVEAU', color: Brand.success }
      : p.venteEnGros
        ? { label: 'GROS', color: '#7C3AED' }
        : null;

  const share = () => {
    const url = `${SITE}/produit/${p.id}`;
    Share.share({ message: `${p.nom} — ${formatPrice(p.prix)} sur Shoneya : ${url}`, url, title: p.nom }).catch(() => undefined);
  };

  return (
    <View style={[styles.card, { width, backgroundColor: theme.background, borderColor: theme.border }]}>
      <Pressable onPress={() => openProduct(p.id)} accessibilityRole="button" accessibilityLabel={`${p.nom}, ${formatPrice(p.prix)}`} style={({ pressed }) => pressed && styles.pressed}>
        <View style={[styles.imgBox, { backgroundColor: theme.backgroundElement }]}>
          {img ? (
            <Image source={{ uri: img }} style={styles.fill} contentFit="cover" transition={150} recyclingKey={p.id} />
          ) : (
            <ThemedText style={styles.emoji}>{p.category?.icone || '📦'}</ThemedText>
          )}
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badge.color }]}>
              <ThemedText style={styles.badgeText}>{badge.label}</ThemedText>
            </View>
          ) : null}
          {out ? (
            <View style={styles.outVeil}>
              <ThemedText style={styles.outText}>Rupture</ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <ThemedText numberOfLines={2} style={styles.name}>
            {p.nom}
          </ThemedText>
          {/* Prix et ancien prix sur UNE ligne : l'image garde l'essentiel de la carte. */}
          <View style={styles.priceRow}>
            <ThemedText numberOfLines={1} style={styles.price}>
              {formatPrice(p.prix)}
            </ThemedText>
            {pct && p.prixAncien ? (
              <ThemedText numberOfLines={1} style={styles.old}>
                {formatPrice(p.prixAncien)}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* ❤ et 🔖, au-dessus de l'image (jamais imbriqués dans la zone cliquable) */}
      <View style={styles.topIcons}>
        <RoundIcon icon={fav ? 'heart' : 'heart-outline'} color={fav ? Brand.danger : '#0B1F3A'} label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} onPress={() => actions.toggleFav(p.id)} />
        <RoundIcon icon={wished ? 'bookmark' : 'bookmark-outline'} color={wished ? Brand.primary : '#0B1F3A'} label={wished ? 'Retirer de la liste de souhaits' : 'Ajouter à la liste de souhaits'} onPress={() => actions.toggleWish(p.id)} />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => (inCart ? openProduct(p.id) : actions.addToCart(p.id))}
          disabled={out || adding}
          accessibilityRole="button"
          accessibilityLabel={out ? 'Rupture de stock' : inCart ? 'Déjà au panier' : `Ajouter ${p.nom} au panier`}
          style={[
            styles.cart,
            { backgroundColor: out ? theme.backgroundElement : inCart ? '#E7F6EE' : Brand.primary },
          ]}>
          {adding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name={out ? 'ban' : inCart ? 'checkmark' : 'cart-outline'} size={15} color={out ? theme.textSecondary : inCart ? Brand.success : '#fff'} />
              <ThemedText numberOfLines={1} style={[styles.cartText, { color: out ? theme.textSecondary : inCart ? Brand.success : '#fff' }]}>
                {out ? 'Épuisé' : inCart ? 'Ajouté' : 'Ajouter'}
              </ThemedText>
            </>
          )}
        </Pressable>
        <SquareIcon icon="storefront-outline" label={`Voir l’entreprise ${p.companyName ?? ''}`} onPress={() => p.companyId && openShop(p.companyId)} disabled={!p.companyId} />
        <SquareIcon icon="share-social-outline" label="Partager ce produit" onPress={share} />
      </View>
    </View>
  );
}

function RoundIcon({ icon, color, label, onPress }: { icon: IconName; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.round} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={16} color={color} />
    </Pressable>
  );
}

function SquareIcon({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={2}
      style={({ pressed }) => [styles.square, { backgroundColor: theme.backgroundElement }, (pressed || disabled) && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name={icon} size={16} color={Brand.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  pressed: { opacity: 0.8 },
  fill: { width: '100%', height: '100%' },
  /* Photo verticale (4:5) : l'image occupe l'essentiel de la carte. */
  imgBox: { width: '100%', aspectRatio: 4 / 5, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 40, lineHeight: 48 },
  badge: { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  outVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  outText: { fontWeight: '800', color: Brand.danger },
  topIcons: { position: 'absolute', top: 8, right: 8, gap: 6 },
  round: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 9, paddingTop: 7, gap: 2 },
  name: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', minHeight: 32 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, overflow: 'hidden' },
  price: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: Brand.primary, flexShrink: 0 },
  old: { fontSize: 10.5, lineHeight: 14, color: '#8A97AB', textDecorationLine: 'line-through', flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingTop: 6, paddingBottom: 7 },
  cart: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 9, height: 30, paddingHorizontal: 4 },
  cartText: { fontSize: 12, lineHeight: 16, fontWeight: '800', flexShrink: 1 },
  square: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
