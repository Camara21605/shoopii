/**
 * Morceaux de la fiche produit (écran app/(app)/produit/[id].tsx) :
 * galerie (photos + vidéos, plein écran), variantes, quantité, vente en gros,
 * onglets d'information, carte vendeur et carrousel de produits.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { discountPercent, formatPrice, thumb } from '@/features/catalog/format';
import MediaViewer from '@/features/messagerie/MediaViewer';
import type { ShopDriver } from '@/features/shop/api';
import { Stars } from '@/features/shop/sections';
import { useTheme } from '@/hooks/use-theme';

import type { ProductDetail, SimilarProduct } from './api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ── Galerie ────────────────────────────────────────────────────────── */

export function Gallery({
  product,
  width,
  fav,
  onFav,
  badges,
}: {
  product: ProductDetail;
  width: number;
  fav: boolean;
  onFav: () => void;
  badges: { label: string; color: string }[];
}) {
  const theme = useTheme();
  const media = [...product.images].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [list, setList] = useState<FlatList | null>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };
  const goTo = (i: number) => {
    setIndex(i);
    list?.scrollToOffset({ offset: i * width, animated: true });
  };
  const open = viewer != null ? media[viewer] : null;

  return (
    <View>
      <View style={{ width, height: width, backgroundColor: theme.backgroundElement }}>
        {media.length ? (
          <FlatList
            ref={setList}
            data={media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            onScroll={onScroll}
            scrollEventThrottle={32}
            keyExtractor={(m, i) => m.id ?? String(i)}
            renderItem={({ item, index: i }) => (
              <Pressable onPress={() => setViewer(i)} style={{ width, height: width }} accessibilityRole="imagebutton" accessibilityLabel={`Image ${i + 1} sur ${media.length}, agrandir`}>
                {item.type === 'video' ? (
                  <View style={[styles.fill, styles.videoBox]}>
                    <Ionicons name="play-circle" size={72} color="#fff" />
                    <ThemedText style={styles.videoText}>Lire la vidéo</ThemedText>
                  </View>
                ) : (
                  <Image source={{ uri: thumb(item.url, 1000) }} style={styles.fill} contentFit="cover" transition={150} />
                )}
              </Pressable>
            )}
          />
        ) : (
          <View style={[styles.fill, styles.center]}>
            <ThemedText style={styles.bigEmoji}>{product.category?.icone || '📦'}</ThemedText>
          </View>
        )}

        <View style={styles.badges} pointerEvents="none">
          {badges.map((b) => (
            <View key={b.label} style={[styles.badge, { backgroundColor: b.color }]}>
              <ThemedText style={styles.badgeText}>{b.label}</ThemedText>
            </View>
          ))}
        </View>
        <Pressable onPress={onFav} style={styles.heart} accessibilityRole="button" accessibilityLabel={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={22} color={fav ? Brand.danger : '#0B1F3A'} />
        </Pressable>
        {media.length > 1 ? (
          <View style={styles.counter} pointerEvents="none">
            <ThemedText style={styles.counterText}>
              {index + 1} / {media.length}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {media.length > 1 ? (
        <FlatList
          data={media}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m, i) => `t${m.id ?? i}`}
          contentContainerStyle={styles.thumbs}
          renderItem={({ item, index: i }) => (
            <Pressable
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={`Voir l’image ${i + 1}`}
              style={[styles.thumb, { borderColor: i === index ? Brand.primary : theme.border, backgroundColor: theme.backgroundElement }]}>
              {item.type === 'video' ? (
                <Ionicons name="videocam" size={22} color={theme.textSecondary} />
              ) : (
                <Image source={{ uri: thumb(item.url, 160) }} style={styles.fill} contentFit="cover" />
              )}
            </Pressable>
          )}
        />
      ) : null}

      {open ? (
        <MediaViewer
          visible
          onClose={() => setViewer(null)}
          kind={open.type === 'video' ? 'video' : 'image'}
          url={open.url}
          name={`${product.nom}${open.type === 'video' ? '.mp4' : '.jpg'}`}
        />
      ) : null}
    </View>
  );
}

/* ── Variantes ──────────────────────────────────────────────────────── */

export function Variants({
  variantes,
  selected,
  onSelect,
}: {
  variantes: ProductDetail['variantes'];
  selected: Record<string, string>;
  onSelect: (type: string, value: string) => void;
}) {
  const theme = useTheme();
  return (
    <>
      {variantes.map((v) => {
        const values = v.vals.split(',').map((s) => s.trim()).filter(Boolean);
        if (!values.length) return null;
        const current = selected[v.type] ?? values[0];
        return (
          <View key={v.id} style={styles.block}>
            <ThemedText style={styles.label}>
              {v.type} <ThemedText style={[styles.label, { color: Brand.primary }]}>· {current}</ThemedText>
            </ThemedText>
            <View style={styles.wrap}>
              {values.map((val) => {
                const on = current === val;
                return (
                  <Pressable
                    key={val}
                    onPress={() => onSelect(v.type, val)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on ? { borderColor: Brand.primary, backgroundColor: theme.backgroundSelected } : { borderColor: theme.border }]}>
                    <ThemedText style={[styles.chipText, on && { color: Brand.primary }]}>{val}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </>
  );
}

/* ── Quantité ───────────────────────────────────────────────────────── */

export function QtyStepper({ qty, max, onChange }: { qty: number; max: number; onChange: (q: number) => void }) {
  const theme = useTheme();
  const btn = (icon: IconName, disabled: boolean, next: number, label: string) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.qtyBtn, { borderColor: theme.border }, disabled && { opacity: 0.35 }]}>
      <Ionicons name={icon} size={18} color={theme.text} />
    </Pressable>
  );
  return (
    <View style={styles.qtyRow}>
      {btn('remove', qty <= 1, qty - 1, 'Diminuer la quantité')}
      <ThemedText style={styles.qtyNum} accessibilityLabel={`Quantité ${qty}`}>
        {qty}
      </ThemedText>
      {btn('add', qty >= max, qty + 1, 'Augmenter la quantité')}
    </View>
  );
}

/* ── Vente en gros ──────────────────────────────────────────────────── */

export function Wholesale({ product, onContact }: { product: ProductDetail; onContact: () => void }) {
  const theme = useTheme();
  const tiers = [...product.wholesaleTiers].sort((a, b) => (a.ordre ?? a.quantiteMin) - (b.ordre ?? b.quantiteMin));
  if (!product.venteEnGros) return null;
  return (
    <View style={[styles.gros, { borderColor: '#C7D7FE', backgroundColor: '#F3F6FF' }]}>
      <View style={styles.rowBetween}>
        <View style={styles.row6}>
          <Ionicons name="cube" size={18} color={Brand.primary} />
          <ThemedText style={styles.grosTitle}>Vente en gros — prix dégressifs</ThemedText>
        </View>
        {product.moq ? (
          <View style={[styles.pill, { backgroundColor: Brand.primary }]}>
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

/* ── Onglets d'information ──────────────────────────────────────────── */

type InfoTab = 'desc' | 'specs' | 'gros' | 'delivery' | 'reviews';

const CONDITION: Record<string, string> = { neuf: 'Neuf', occasion: 'Occasion', reconditionne: 'Reconditionné', 'reconditionné': 'Reconditionné' };
export const conditionLabel = (c?: string | null) => (c ? (CONDITION[c.toLowerCase()] ?? c.charAt(0).toUpperCase() + c.slice(1)) : null);

export function InfoTabs({
  product,
  drivers,
  fee,
  city,
  shopRating,
  shopReviews,
  onShopReviews,
}: {
  product: ProductDetail;
  drivers: ShopDriver[];
  fee: { fraisLivraison: number; zoneNom?: string | null } | null | undefined;
  city: string | null;
  shopRating: number;
  shopReviews: number;
  onShopReviews: () => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState<InfoTab>('desc');
  const tabs: { key: InfoTab; label: string }[] = [
    { key: 'desc', label: 'Description' },
    { key: 'specs', label: `Caractéristiques${product.specs.length ? ` (${product.specs.length})` : ''}` },
    ...(product.venteEnGros ? [{ key: 'gros' as InfoTab, label: 'Vente en gros' }] : []),
    { key: 'delivery', label: 'Livraison' },
    { key: 'reviews', label: 'Avis' },
  ];
  const specs = [...product.specs].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const general = [
    product.marque ? { cle: 'Marque', valeur: product.marque } : null,
    conditionLabel(product.condition) ? { cle: 'État', valeur: conditionLabel(product.condition)! } : null,
    product.garantie ? { cle: 'Garantie', valeur: product.garantie } : null,
    product.category?.nom ? { cle: 'Catégorie', valeur: [product.category.nom, product.subCategory?.nom].filter(Boolean).join(' › ') } : null,
  ].filter((x): x is { cle: string; valeur: string } => !!x);

  const modes = [
    product.livraisonStandard && {
      icon: 'cube-outline' as IconName,
      title: 'Livraison par la boutique',
      sub: product.fraisLivraisonLocal ? `${formatPrice(product.fraisLivraisonLocal)} en local` : 'Frais calculés à la commande',
    },
    product.livraisonLivreur && { icon: 'bicycle-outline' as IconName, title: 'Livreur Shoneya', sub: 'Un livreur récupère le colis à la boutique et vous le remet' },
    product.livraisonCorrespondant && {
      icon: 'location-outline' as IconName,
      title: 'Retrait en point relais',
      sub: 'Un correspondant réceptionne le colis, vérifie son état et le garde pour vous',
    },
  ].filter(Boolean) as { icon: IconName; title: string; sub: string }[];

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <FlatList
        horizontal
        data={tabs}
        keyExtractor={(t) => t.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabs, { borderBottomColor: theme.border }]}
        renderItem={({ item }) => {
          const on = tab === item.key;
          return (
            <Pressable
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && { borderBottomColor: Brand.primary }]}>
              <ThemedText style={[styles.tabText, { color: on ? Brand.primary : theme.textSecondary }]}>{item.label}</ThemedText>
            </Pressable>
          );
        }}
      />
      <View style={styles.tabBody}>
        {tab === 'desc' ? (
          product.description?.trim() ? (
            <>
              <ThemedText style={styles.h3}>À propos de ce produit</ThemedText>
              <ThemedText style={styles.para}>{product.description.trim()}</ThemedText>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">Le vendeur n’a pas encore renseigné de description pour ce produit.</ThemedText>
          )
        ) : null}

        {tab === 'specs' ? (
          general.length + specs.length ? (
            <View style={[styles.table, { borderColor: theme.border }]}>
              {[...general, ...specs].map((s, i) => (
                <View key={`${s.cle}${i}`} style={[styles.specRow, i % 2 === 0 && { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={styles.specKey}>{s.cle}</ThemedText>
                  <ThemedText style={styles.specVal}>{s.valeur}</ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText themeColor="textSecondary">Aucune caractéristique technique renseignée pour ce produit.</ThemedText>
          )
        ) : null}

        {tab === 'gros' ? (
          <>
            {product.moq ? <ThemedText style={styles.para}>Commande minimum : {product.moq} unités.</ThemedText> : null}
            {product.wholesaleTiers.length ? (
              <View style={[styles.table, { borderColor: theme.border }]}>
                {product.wholesaleTiers.map((t, i) => (
                  <View key={i} style={[styles.specRow, i % 2 === 0 && { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.specKey}>
                      {t.quantiteMin}
                      {t.quantiteMax != null ? ` – ${t.quantiteMax}` : '+'} unités
                    </ThemedText>
                    <ThemedText style={styles.specVal}>{formatPrice(t.prixUnitaire)} / unité</ThemedText>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText themeColor="textSecondary">Aucun palier de prix dégressif renseigné pour ce produit.</ThemedText>
            )}
          </>
        ) : null}

        {tab === 'delivery' ? (
          <View style={styles.gap12}>
            {product.delaiLivraison ? (
              <View style={styles.row8}>
                <Ionicons name="time-outline" size={18} color={Brand.primary} />
                <ThemedText>
                  Délai annoncé : <ThemedText style={styles.bold}>{product.delaiLivraison}</ThemedText>
                </ThemedText>
              </View>
            ) : null}
            {city && fee && fee.fraisLivraison > 0 ? (
              <View style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="navigate-outline" size={18} color={Brand.primary} />
                <ThemedText style={styles.flex}>
                  Livraison vers <ThemedText style={styles.bold}>{city}</ThemedText>
                  {fee.zoneNom ? ` (${fee.zoneNom})` : ''} : <ThemedText style={styles.bold}>{formatPrice(fee.fraisLivraison)}</ThemedText>
                </ThemedText>
              </View>
            ) : null}
            {modes.length ? (
              modes.map((m) => (
                <View key={m.title} style={styles.mode}>
                  <View style={[styles.modeIco, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name={m.icon} size={18} color={Brand.primary} />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>{m.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {m.sub}
                    </ThemedText>
                  </View>
                </View>
              ))
            ) : (
              <ThemedText themeColor="textSecondary">Aucun mode de livraison renseigné : contactez la boutique.</ThemedText>
            )}
            {drivers.length ? (
              <>
                <ThemedText style={styles.h3}>Livreurs de la boutique</ThemedText>
                {drivers.slice(0, 3).map((d) => (
                  <View key={d.id} style={styles.row8}>
                    <ThemedText style={styles.emoji}>{d.emoji}</ThemedText>
                    <ThemedText numberOfLines={1} style={styles.flex}>
                      {d.fullName}
                    </ThemedText>
                    <Stars value={d.note} size={11} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {d.trips} livr.
                    </ThemedText>
                  </View>
                ))}
              </>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              Vous choisissez le mode de livraison et l’adresse au moment de commander ; les frais exacts y sont calculés.
            </ThemedText>
          </View>
        ) : null}

        {tab === 'reviews' ? (
          <View style={styles.gap12}>
            <ThemedText themeColor="textSecondary">Aucun avis sur ce produit pour le moment.</ThemedText>
            <Pressable onPress={onShopReviews} style={[styles.note, { backgroundColor: theme.backgroundElement }]} accessibilityRole="button">
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>Avis sur la boutique</ThemedText>
                <View style={styles.row6}>
                  <Stars value={shopRating} size={13} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {shopRating > 0 ? shopRating.toFixed(1) : '—'} · {shopReviews} avis
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ── Carte vendeur ──────────────────────────────────────────────────── */

export function SellerCard({
  product,
  followers,
  rating,
  sales,
  followed,
  onShop,
  onMessage,
  onFollow,
  messaging,
  following,
}: {
  product: ProductDetail;
  followers?: number;
  rating?: number;
  sales?: number;
  followed: boolean;
  onShop: () => void;
  onMessage: () => void;
  onFollow: () => void;
  messaging: boolean;
  following: boolean;
}) {
  const theme = useTheme();
  const logo = thumb(product.companyLogo, 160);
  return (
    <View style={[styles.card, styles.pad, { borderColor: theme.border }]}>
      <ThemedText style={styles.kick}>VENDU PAR</ThemedText>
      <Pressable onPress={onShop} style={styles.row12} accessibilityRole="button" accessibilityLabel={`Voir la boutique ${product.companyName}`}>
        <View style={[styles.sellerLogo, { backgroundColor: theme.backgroundSelected }]}>
          {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.sellerInit}>{initials(product.companyName || 'B')}</ThemedText>}
        </View>
        <View style={styles.flex}>
          <View style={styles.row6}>
            <ThemedText numberOfLines={1} style={[styles.sellerName, styles.shrink]}>
              {product.companyName || 'Boutique'}
            </ThemedText>
            {product.companyVerified ? <Ionicons name="checkmark-circle" size={16} color={Brand.primary} /> : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {product.companyVerified ? 'Boutique vérifiée Shoneya · ' : ''}
            {product.companyPays === 'GN' ? '🇬🇳 Guinée' : product.companyPays}
            {product.companyVille ? ` · ${product.companyVille}` : ''}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>
      <View style={[styles.sellerStats, { backgroundColor: theme.backgroundElement }]}>
        {[
          { v: rating && rating > 0 ? rating.toFixed(1) : '—', l: 'Note' },
          { v: followers != null ? String(followers) : '—', l: 'Abonnés' },
          { v: sales && sales > 0 ? `${sales}+` : '—', l: 'Ventes' },
        ].map((s) => (
          <View key={s.l} style={styles.sellerStat}>
            <ThemedText style={styles.sellerStatV}>{s.v}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {s.l}
            </ThemedText>
          </View>
        ))}
      </View>
      <View style={styles.row8}>
        <Pressable onPress={onFollow} disabled={following} style={[styles.sellerBtn, followed ? { backgroundColor: theme.backgroundSelected } : { backgroundColor: Brand.primary }]} accessibilityRole="button">
          <Ionicons name={followed ? 'checkmark' : 'add'} size={17} color={followed ? Brand.primary : '#fff'} />
          <ThemedText type="smallBold" style={{ color: followed ? Brand.primary : '#fff' }}>
            {followed ? 'Abonné' : 'S’abonner'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={onMessage} disabled={messaging} style={[styles.sellerBtn, styles.sellerOutline, { borderColor: theme.border }]} accessibilityRole="button">
          <Ionicons name="chatbubble-ellipses-outline" size={17} color={theme.text} />
          <ThemedText type="smallBold">{messaging ? '…' : 'Message'}</ThemedText>
        </Pressable>
        <Pressable onPress={onShop} style={[styles.sellerBtn, styles.sellerOutline, { borderColor: theme.border }]} accessibilityRole="button">
          <Ionicons name="storefront-outline" size={17} color={theme.text} />
          <ThemedText type="smallBold">Boutique</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

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
                {item.imageUrl ? <Image source={{ uri: thumb(item.imageUrl, 300) }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.miniEmoji}>{item.emoji || '📦'}</ThemedText>}
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
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  fill: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gap12: { gap: 12 },
  bigEmoji: { fontSize: 90, lineHeight: 104 },
  videoBox: { backgroundColor: '#0B1F3A', alignItems: 'center', justifyContent: 'center', gap: 6 },
  videoText: { color: '#fff', fontWeight: '700' },
  badges: { position: 'absolute', top: 12, left: 12, gap: 6 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  heart: { position: 'absolute', top: 12, right: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(11,31,58,0.7)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  counterText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  thumbs: { gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  thumb: { width: 60, height: 60, borderRadius: 10, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  block: { gap: 8 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  chipText: { fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyNum: { minWidth: 36, textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  gros: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  grosTitle: { fontWeight: '800', color: Brand.primary },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  tierPrice: { fontWeight: '800' },
  tierSave: { color: Brand.success, fontWeight: '800', fontSize: 12, minWidth: 38, textAlign: 'right' },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, minHeight: 42, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  pad: { padding: 14, gap: 12 },
  tabs: { paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingHorizontal: 10, minHeight: 46, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  tabBody: { padding: 16, gap: 8 },
  h3: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  para: { fontSize: 15, lineHeight: 23 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  specRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  specKey: { flex: 1, fontWeight: '700', fontSize: 14, lineHeight: 19 },
  specVal: { flex: 1.4, fontSize: 14, lineHeight: 19 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeIco: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20, lineHeight: 26 },
  kick: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2, color: Brand.primary },
  sellerLogo: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sellerInit: { fontWeight: '900', fontSize: 18, lineHeight: 23, color: Brand.primary },
  sellerName: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  sellerStats: { flexDirection: 'row', borderRadius: 12, paddingVertical: 10 },
  sellerStat: { flex: 1, alignItems: 'center' },
  sellerStatV: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  sellerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, minHeight: 42 },
  sellerOutline: { borderWidth: 1 },
  stripTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  mini: { width: 150, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  miniImg: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  miniEmoji: { fontSize: 36, lineHeight: 44 },
  miniBadge: { position: 'absolute', top: 8, left: 8 },
  miniBody: { padding: 8, gap: 2 },
  miniName: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  miniPrice: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: Brand.primary },
});
