/**
 * Fiche produit — même contenu que la page /produit/:id du site, en version téléphone :
 *   · galerie photos/vidéos (balayage, miniatures, plein écran), remise, Nouveau, Gros, ❤
 *   · catégorie › sous-catégorie, référence, nom, marque, boutique (vers son profil)
 *   · prix, ancien prix, économie, stock réel, état, garantie, délai de livraison
 *   · variantes réelles, vente en gros (paliers), politique de retour de la boutique
 *   · quantité (max 5 par commande, comme le site) + total estimé
 *   · onglets : Description · Caractéristiques · Vente en gros · Livraison · Avis
 *   · vendeur (note, abonnés, ventes, S'abonner, Message, Boutique)
 *   · souvent achetés ensemble, produits similaires, autres produits de la boutique
 *   · ⚖️ « Comparer » + « Voir la comparaison (n) » (features/compare)
 *   · barre d'achat fixe : Ajouter au panier · Acheter maintenant (→ panier)
 *   · MON produit (compte entreprise) : ni ❤, ni ⚖️, ni panier, ni S'abonner / Message,
 *     « Gérer ce produit » à la place (features/shop/own.ts)
 * Données : voir features/product/api.ts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { requireAuth, requireClient } from '@/features/auth/auth-gate';
import { useSession } from '@/features/auth/session-store';
import { cartCount, useCart } from '@/features/cart/api';
import { toggleFollow } from '@/features/catalog/api';
import { discountPercent, formatPrice, thumb } from '@/features/catalog/format';
import { openProduct, openShop } from '@/features/catalog/open';
import { CompareButton } from '@/features/compare/components';
import { fetchDefaultCity } from '@/features/explore/api';
import { fetchBoughtTogether, fetchDeliveryFee, fetchProduct, fetchSimilar, type SimilarProduct } from '@/features/product/api';
import { conditionLabel, Gallery, InfoTabs, ProductStrip, QtyStepper, SellerCard, Variants, Wholesale } from '@/features/product/components';
import { addToCart, fetchFavoriteIds, fetchFollowStatus, fetchShop, fetchShopDrivers, fetchShopProducts, startConversation, toggleFavorite } from '@/features/shop/api';
import { useIsMyShop } from '@/features/shop/own';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

const SITE = 'https://www.shoneya.com';
const MAX_PER_ORDER = 5; // même règle que le site (PanierPanel)
const NEW_DAYS = 14;
/** Publié depuis moins de 14 jours (badge « Nouveau », même règle que la boutique). */
const isRecent = (iso: string) => !!iso && Date.now() - new Date(iso).getTime() < NEW_DAYS * 86_400_000;
const AFRICA = ['GN', 'SN', 'CI', 'ML', 'CM', 'BF', 'NE', 'TG', 'BJ', 'SL', 'LR', 'GW', 'MA', 'DZ', 'TN', 'NG', 'GH'];

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const isClient = useSession((s) => s.user?.role) === 'client';

  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string>>({});

  /* ── Données ── */
  const q = useQuery({ queryKey: qk.product.detail(id), queryFn: () => fetchProduct(id), enabled: !!id });
  const p = q.data;
  const companyId = p?.companyId;
  const isOwn = useIsMyShop(companyId);
  const manage = () => router.push({ pathname: '/entreprise/produits/[id]', params: { id } });
  const shopQ = useQuery({ queryKey: qk.shop.detail(companyId), queryFn: () => fetchShop(companyId!), enabled: !!companyId });
  const driversQ = useQuery({ queryKey: qk.shop.drivers(companyId), queryFn: () => fetchShopDrivers(companyId!).catch(() => []), enabled: !!companyId });
  const similarQ = useQuery({ queryKey: qk.product.similar(id), queryFn: () => fetchSimilar(id), enabled: !!id });
  const togetherQ = useQuery({ queryKey: qk.product.together(id), queryFn: () => fetchBoughtTogether(id), enabled: !!id });
  const shopProductsQ = useQuery({ queryKey: qk.shop.products(companyId), queryFn: () => fetchShopProducts(companyId!), enabled: !!companyId });
  const cityQ = useQuery({ queryKey: qk.defaultCity, queryFn: fetchDefaultCity, enabled: isClient, staleTime: 10 * 60_000 });
  const feeQ = useQuery({ queryKey: qk.deliveryFee(cityQ.data), queryFn: () => fetchDeliveryFee(cityQ.data!), enabled: !!cityQ.data });
  const followQ = useQuery({ queryKey: qk.follows.status('entreprises', companyId), queryFn: () => fetchFollowStatus('entreprises', companyId!), enabled: !!companyId && isClient });
  const favQ = useQuery({ queryKey: qk.favorites.ids, queryFn: fetchFavoriteIds, enabled: isClient });
  const cartQ = useCart();

  const inCart = !!cartQ.data?.some((i) => i.produitId === id);
  const fav = !!favQ.data?.has(id);
  const followed = !!followQ.data;

  /* Variante choisie : première valeur de chaque type par défaut. */
  const selected = useMemo(() => {
    const out: Record<string, string> = {};
    for (const v of p?.variantes ?? []) {
      const first = v.vals.split(',')[0]?.trim();
      out[v.type] = picked[v.type] ?? first ?? '';
    }
    return out;
  }, [p?.variantes, picked]);
  const variante = Object.values(selected).filter(Boolean).join(' · ') || undefined;

  /* ── Actions ── */

  const add = useMutation({
    mutationFn: (_next: 'stay' | 'buy') => addToCart(id, qty, variante),
    onSuccess: (_r, next) => {
      void qc.invalidateQueries({ queryKey: qk.cart });
      if (next === 'buy') router.push('/panier');
      else Alert.alert('Panier', `${p?.nom ?? 'Produit'} ajouté au panier (× ${qty}).`, [{ text: 'Continuer' }, { text: 'Voir le panier', onPress: () => requireClient(() => router.push('/panier')) }]);
    },
    onError: (e) => Alert.alert('Panier', toUserMessage(e)),
  });

  const favM = useMutation({
    mutationFn: () => toggleFavorite(id),
    onMutate: () => {
      const prev = qc.getQueryData<Set<string>>(qk.favorites.ids);
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      qc.setQueryData(qk.favorites.ids, next);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.favorites.ids, ctx.prev);
      Alert.alert('Favoris', toUserMessage(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.favorites.list }),
  });

  const followM = useMutation({
    mutationFn: () => toggleFollow('entreprises', companyId!),
    onSuccess: (r) => {
      qc.setQueryData(qk.follows.status('entreprises', companyId), r.isSuivi);
      void qc.invalidateQueries({ queryKey: qk.shop.detail(companyId) });
      void qc.invalidateQueries({ queryKey: qk.follows.all });
    },
    onError: (e) => Alert.alert('Abonnement', toUserMessage(e)),
  });

  /* Comme sur le site (PanierPanel) : écrire au vendeur ne demande pas d'abonnement. */
  const messageM = useMutation({
    mutationFn: () => startConversation('company', companyId!),
    onSuccess: (convId) =>
      router.push({ pathname: '/messages/[id]', params: { id: convId, name: p?.companyName ?? '', logo: p?.companyLogo ?? '', online: '0' } }),
    onError: (e) => Alert.alert('Message', toUserMessage(e)),
  });

  const share = () => {
    if (!p) return;
    const url = `${SITE}/produit/${p.id}`;
    Share.share({ message: `${p.nom} — ${formatPrice(p.prix)} sur Shoneya : ${url}`, url, title: p.nom }).catch(() => undefined);
  };

  const onRefresh = () => {
    void qc.invalidateQueries({ queryKey: qk.product.detail(id) });
    if (companyId) void qc.invalidateQueries({ queryKey: qk.shop.detail(companyId) });
    void cartQ.refetch();
  };

  const count = cartCount(cartQ.data);
  const headerRight = (
    <View style={styles.headerBtns}>
      <Pressable onPress={share} hitSlop={8} accessibilityRole="button" accessibilityLabel="Partager ce produit">
        <Ionicons name="share-social-outline" size={23} color={theme.text} />
      </Pressable>
      {isOwn ? null : (
        <Pressable onPress={() => requireClient(() => router.push('/panier'))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Panier, ${count} article${count > 1 ? 's' : ''}`}>
          <Ionicons name="bag-handle-outline" size={24} color={theme.text} />
          {count > 0 ? (
            <View style={styles.cartBadge}>
              <ThemedText style={styles.cartBadgeText}>{count > 99 ? '99+' : count}</ThemedText>
            </View>
          ) : null}
        </Pressable>
      )}
    </View>
  );

  if (!p) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <ScreenHeader title="Produit" />
        {q.isError ? (
          <View style={styles.centerBox}>
            <ThemedText style={styles.bigEmoji}>📦</ThemedText>
            <ThemedText style={styles.notFound}>Produit introuvable</ThemedText>
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          </View>
        ) : (
          <View>
            <View style={{ width, height: width, backgroundColor: theme.backgroundElement }} />
            <View style={[styles.skel, { backgroundColor: theme.backgroundElement, width: '70%' }]} />
            <View style={[styles.skel, { backgroundColor: theme.backgroundElement, width: '40%' }]} />
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  /* ── Valeurs dérivées ── */
  const pct = discountPercent(p.prix, p.prixAncien);
  const saving = pct && p.prixAncien ? p.prixAncien - p.prix : 0;
  const out = p.stock <= 0;
  const low = !out && p.stock < 5;
  const maxQty = Math.max(1, Math.min(MAX_PER_ORDER, p.stock));
  const intl = !AFRICA.includes(p.companyPays);
  const isNew = isRecent(p.createdAt);
  const badges = [
    pct ? { label: `−${pct}%`, color: Brand.danger } : null,
    isNew ? { label: 'NOUVEAU', color: Brand.success } : null,
    p.venteEnGros ? { label: 'GROS', color: '#7C3AED' } : null,
    intl ? { label: '🌍 IMPORTÉ', color: '#1F1F1F' } : null,
  ].filter((b): b is { label: string; color: string } => !!b);
  const ref = p.id.slice(0, 8).toUpperCase();
  const shopLogo = thumb(p.companyLogo, 120);
  const shop = shopQ.data;

  const sameShop: SimilarProduct[] = (shopProductsQ.data ?? [])
    .filter((x) => x.id !== p.id)
    .slice(0, 10)
    .map((x) => ({
      id: x.id,
      nom: x.nom,
      prix: x.prix,
      prixAncien: x.prixAncien,
      imageUrl: [...x.images].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).find((i) => (i.type ?? 'image') === 'image')?.url ?? null,
      emoji: x.category?.icone ?? null,
      shopNom: '',
      shopId: p.companyId,
      badge: null,
    }));

  const doAdd = (next: 'stay' | 'buy') => {
    if (!isClient) return requireClient(() => undefined, 'Ajoutez ce produit à votre panier et commandez en quelques secondes.');
    if (out) return;
    if (inCart) return router.push('/panier');
    add.mutate(next);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={p.nom} right={headerRight} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={onRefresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <Gallery product={p} width={width} fav={fav} onFav={isOwn ? undefined : () => requireClient(() => favM.mutate(), 'Gardez ce produit dans vos favoris.')} badges={badges} />

        <View style={styles.body}>
          {/* Catégorie + référence */}
          <View style={styles.rowBetween}>
            <ThemedText style={styles.cat} numberOfLines={1}>
              {p.category?.icone ? `${p.category.icone} ` : ''}
              {[p.category?.nom, p.subCategory?.nom].filter(Boolean).join(' › ').toUpperCase()}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Réf. {ref}
            </ThemedText>
          </View>

          {/* Produit importé */}
          {intl ? (
            <View style={[styles.note, { backgroundColor: '#EEF2FF' }]}>
              <ThemedText style={styles.noteEmoji}>🌍</ThemedText>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>Boutique internationale</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Cette boutique est située hors d’Afrique. Un correspondant Shoneya peut réceptionner votre commande et assurer la liaison locale.
                </ThemedText>
              </View>
            </View>
          ) : null}

          <ThemedText style={styles.title}>{p.nom}</ThemedText>
          {p.marque ? (
            <ThemedText themeColor="textSecondary">
              Marque : <ThemedText style={styles.bold}>{p.marque}</ThemedText>
            </ThemedText>
          ) : null}

          {/* Boutique */}
          <Pressable onPress={() => openShop(p.companyId)} style={[styles.shopRow, { borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel={`Voir la boutique ${p.companyName}`}>
            <View style={[styles.shopLogo, { backgroundColor: theme.backgroundSelected }]}>
              {shopLogo ? (
                <Image source={{ uri: shopLogo }} style={styles.fill} contentFit="cover" />
              ) : (
                <Ionicons name="storefront" size={18} color={Brand.primary} />
              )}
            </View>
            <View style={styles.flex}>
              <View style={styles.row6}>
                <ThemedText numberOfLines={1} style={[styles.bold, styles.shrink]}>
                  {p.companyName || 'Boutique'}
                </ThemedText>
                {p.companyVerified ? <Ionicons name="shield-checkmark" size={14} color={Brand.primary} /> : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {p.companyVerified ? 'Boutique vérifiée Shoneya · ' : ''}
                {p.companyPays === 'GN' ? '🇬🇳 Guinée' : p.companyPays}
                {p.companyVille ? ` · ${p.companyVille}` : ''}
                {shop ? ` · ${shop.totalAbonnes} abonné${shop.totalAbonnes > 1 ? 's' : ''}` : ''}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>

          {/* Prix */}
          <View style={[styles.priceBox, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.priceRow}>
              <ThemedText style={styles.price}>{formatPrice(p.prix)}</ThemedText>
              {pct && p.prixAncien ? <ThemedText style={styles.old}>{formatPrice(p.prixAncien)}</ThemedText> : null}
            </View>
            {saving > 0 ? (
              <View style={styles.row6}>
                <Ionicons name="pricetag" size={14} color={Brand.success} />
                <ThemedText style={styles.save}>
                  Économie de {formatPrice(saving)} (−{pct}%)
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.row6}>
              <Ionicons name="lock-closed" size={13} color={Brand.success} />
              <ThemedText type="small" themeColor="textSecondary">
                Prix garanti · Paiement sécurisé · Hors frais de livraison
              </ThemedText>
            </View>
          </View>

          {/* Stock + infos rapides */}
          <View style={styles.row8}>
            <View style={[styles.dot, { backgroundColor: out ? Brand.danger : low ? '#D97706' : Brand.success }]} />
            <ThemedText style={[styles.bold, { color: out ? Brand.danger : low ? '#D97706' : Brand.success }]}>
              {out ? 'Rupture de stock' : low ? 'Stock limité' : 'En stock'}
            </ThemedText>
            {!out ? (
              <ThemedText type="small" themeColor="textSecondary">
                {low ? `— seulement ${p.stock} restant${p.stock > 1 ? 's' : ''}` : `— ${p.stock} unités disponibles`}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.facts}>
            {conditionLabel(p.condition) ? <Fact icon="sparkles-outline" text={conditionLabel(p.condition)!} /> : null}
            {p.garantie ? <Fact icon="shield-checkmark-outline" text={`Garantie ${p.garantie}`} /> : null}
            {p.delaiLivraison ? <Fact icon="time-outline" text={`Livré en ${p.delaiLivraison}`} /> : null}
            {p.livraisonCorrespondant ? <Fact icon="location-outline" text="Retrait en point relais" /> : null}
          </View>

          {isOwn ? null : <CompareButton product={p} />}

          <Variants variantes={p.variantes} selected={selected} onSelect={(type, value) => setPicked((s) => ({ ...s, [type]: value }))} />

          <Wholesale product={p} onContact={() => (companyId ? requireAuth(() => messageM.mutate(), 'Écrivez au vendeur pour négocier un prix de gros.') : undefined)} />

          {p.returnPolicy ? (
            <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="return-down-back-outline" size={18} color={Brand.primary} />
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>Politique de retour</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {p.returnPolicy}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {/* Quantité + total (pas pour mon propre produit) */}
          {!out && !isOwn ? (
            <View style={[styles.qtyBox, { borderColor: theme.border }]}>
              <View style={styles.rowBetween}>
                <View>
                  <ThemedText style={styles.bold}>Quantité</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Max. {MAX_PER_ORDER} par commande
                  </ThemedText>
                </View>
                <QtyStepper qty={qty} max={maxQty} onChange={setQty} />
              </View>
              <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
                <ThemedText themeColor="textSecondary">
                  Produit × {qty}
                  {variante ? ` · ${variante}` : ''}
                </ThemedText>
                <ThemedText style={styles.total}>{formatPrice(p.prix * qty)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Total estimé hors livraison : mode et frais choisis à la commande.
              </ThemedText>
            </View>
          ) : null}

          <InfoTabs
            product={p}
            drivers={driversQ.data ?? []}
            fee={feeQ.data}
            city={cityQ.data ?? null}
            shopRating={shop?.averageRating ?? 0}
            shopReviews={shop?.totalRatings ?? 0}
            onShopReviews={() => openShop(p.companyId)}
          />

          <SellerCard
            product={p}
            followers={shop?.totalAbonnes}
            rating={shop?.averageRating}
            sales={shop?.totalOrders}
            followed={followed}
            following={followM.isPending}
            messaging={messageM.isPending}
            onShop={() => openShop(p.companyId)}
            onMessage={() => requireAuth(() => messageM.mutate(), 'Écrivez au vendeur pour lui poser vos questions.')}
            onFollow={() => requireClient(() => followM.mutate(), 'Abonnez-vous pour suivre ses nouveautés et lui écrire.')}
            onManage={isOwn ? manage : undefined}
          />

          <ProductStrip title="Souvent achetés ensemble" icon="git-merge-outline" items={togetherQ.data ?? []} onOpen={openProduct} onShop={openShop} />
          <ProductStrip title="Produits similaires" icon="albums-outline" items={similarQ.data ?? []} onOpen={openProduct} onShop={openShop} />
          <ProductStrip title={`Autres produits de ${p.companyName || 'la boutique'}`} icon="storefront-outline" items={sameShop} onOpen={openProduct} />
        </View>
      </ScrollView>

      {/* Barre d'achat fixe */}
      <View style={[styles.buyBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <View style={styles.buyPrice}>
          <ThemedText type="small" themeColor="textSecondary">
            {isOwn ? 'Prix' : 'Total'}
          </ThemedText>
          <ThemedText style={styles.buyTotal} numberOfLines={1}>
            {formatPrice(p.prix * qty)}
          </ThemedText>
        </View>
        {isOwn ? (
          <Pressable onPress={manage} style={[styles.buyBtn, styles.flex2, { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine }]} accessibilityRole="button">
            <Ionicons name="create-outline" size={18} color={Brand.primaryInk} />
            <ThemedText style={[styles.buyText, { color: Brand.primaryInk }]}>Gérer ce produit</ThemedText>
          </Pressable>
        ) : out ? (
          <View style={[styles.buyBtn, styles.flex2, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="ban" size={18} color={theme.textSecondary} />
            <ThemedText style={[styles.buyText, { color: theme.textSecondary }]}>Rupture de stock</ThemedText>
          </View>
        ) : inCart ? (
          <Pressable onPress={() => requireClient(() => router.push('/panier'))} style={[styles.buyBtn, styles.flex2, { backgroundColor: Brand.success }]} accessibilityRole="button">
            <Ionicons name="checkmark" size={18} color="#fff" />
            <ThemedText style={styles.buyText}>Déjà au panier — Voir</ThemedText>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => doAdd('stay')}
              disabled={add.isPending}
              style={[styles.buyBtn, styles.flex1, { backgroundColor: theme.backgroundSelected }]}
              accessibilityRole="button"
              accessibilityLabel="Ajouter au panier">
              {add.isPending && add.variables === 'stay' ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="cart-outline" size={20} color={Brand.primary} />}
              <ThemedText style={[styles.buyText, { color: Brand.primary }]}>Panier</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => doAdd('buy')}
              disabled={add.isPending}
              style={[styles.buyBtn, styles.flex1, { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine }]}
              accessibilityRole="button"
              accessibilityLabel="Acheter maintenant">
              {add.isPending && add.variables === 'buy' ? <ActivityIndicator color={Brand.primaryInk} /> : <Ionicons name="flash" size={18} color={Brand.primaryInk} />}
              <ThemedText style={[styles.buyText, { color: Brand.primaryInk }]}>Acheter</ThemedText>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Fact({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={14} color={Brand.primary} />
      <ThemedText type="small" style={styles.factText}>
        {text}
      </ThemedText>
    </View>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 24 },
  flex: { flex: 1 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  shrink: { flexShrink: 1 },
  fill: { width: '100%', height: '100%' },
  bold: { fontWeight: '700' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  centerBox: { alignItems: 'center', paddingTop: 60, gap: 6 },
  bigEmoji: { fontSize: 56, lineHeight: 66 },
  notFound: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  skel: { height: 18, borderRadius: 9, marginTop: 14, marginLeft: 16 },
  loader: { marginTop: 24 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cartBadge: { position: 'absolute', top: -6, right: -9, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  body: { padding: 16, gap: 14 },
  cat: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.6, color: Brand.primary },
  title: { fontSize: 22, lineHeight: 29, fontWeight: '900' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  noteEmoji: { fontSize: 22, lineHeight: 28 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  shopLogo: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  priceBox: { borderRadius: 14, padding: 14, gap: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  price: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: Brand.primary },
  old: { fontSize: 15, lineHeight: 20, color: '#8A8A8A', textDecorationLine: 'line-through' },
  save: { color: Brand.success, fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  factText: { fontWeight: '600' },
  qtyBox: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  total: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  buyBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  buyPrice: { minWidth: 92, maxWidth: 120 },
  buyTotal: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, minHeight: 48, paddingHorizontal: 10 },
  buyText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
