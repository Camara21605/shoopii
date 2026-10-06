/**
 * Profil public d'une entreprise — ce que voient les clients et les autres
 * acteurs en touchant une boutique. Même contenu que la page /boutique/:id du
 * site, en version téléphone :
 *   · couverture, logo, nom + badge Vérifié, activité, lieu, ancienneté,
 *     slogan, « Ouvert maintenant / Fermé · ouvre à… » (heure réelle)
 *   · chiffres : note, abonnés, ventes, nombre de produits (ou services)
 *   · actions : S'abonner · Message · Appeler · Partager
 *   · MA boutique (compte entreprise) : pas d'abonnement, de message, d'appel,
 *     de favoris ni de panier — « Modifier ma boutique » et « Mes produits »
 *     à la place, et un rappel « vue client » (features/shop/own.ts).
 *   · onglets (collés en haut au défilement) : Produits ou Services ·
 *     Promotions · Livreurs · Points relais · Avis · À propos
 * Données et règles : voir features/shop/api.ts (mêmes adresses que le site).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { capitalize, ErrorState, initials } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { useCart } from '@/features/cart/api';
import { toggleFollow, type FollowKind } from '@/features/catalog/api';
import { thumb } from '@/features/catalog/format';
import {
  addToCart,
  fetchFavoriteIds,
  fetchFollowStatus,
  fetchShop,
  fetchShopDrivers,
  fetchShopProducts,
  fetchShopPromos,
  fetchShopRelays,
  fetchShopReviews,
  fetchShopServices,
  startConversation,
  toggleFavorite,
  type ShopDetail,
} from '@/features/shop/api';
import { openStatus } from '@/features/shop/hours';
import { useIsMyShop } from '@/features/shop/own';
import { AboutTab, DriversTab, ProductsTab, PromosTab, RelaysTab, ReviewsTab, ServicesTab, Stars } from '@/features/shop/components';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

type Tab = 'catalog' | 'promos' | 'drivers' | 'relays' | 'reviews' | 'about';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SITE = 'https://www.shoneya.com';

/** 1 250 → « 1,3 k » pour les compteurs du bandeau. */
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')} k` : String(n));

export default function ShopProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const role = useSession((s) => s.user?.role);
  const isClient = role === 'client';
  const isOwn = useIsMyShop(id);
  const [tab, setTab] = useState<Tab>('catalog');

  /* ── Données ── */
  const shopQ = useQuery({ queryKey: qk.shop.detail(id), queryFn: () => fetchShop(id), enabled: !!id });
  const shop = shopQ.data;
  const services = shop?.businessModel === 'services';

  const productsQ = useQuery({ queryKey: qk.shop.products(id), queryFn: () => fetchShopProducts(id), enabled: !!shop && !services });
  const servicesQ = useQuery({ queryKey: qk.shop.services(id), queryFn: () => fetchShopServices(id), enabled: !!shop && services });
  const driversQ = useQuery({ queryKey: qk.shop.drivers(id), queryFn: () => fetchShopDrivers(id).catch(() => []), enabled: !!id });
  const relaysQ = useQuery({ queryKey: qk.shop.relays(id), queryFn: () => fetchShopRelays(id).catch(() => []), enabled: !!id });
  const promosQ = useQuery({ queryKey: qk.shop.promos(id), queryFn: () => fetchShopPromos(id).catch(() => []), enabled: !!id });
  const reviewsQ = useQuery({ queryKey: qk.shop.reviews(id), queryFn: () => fetchShopReviews(id), enabled: !!id });

  /* Propre au visiteur connecté (client) : abonnements, favoris, panier. */
  const followQ = useQuery({ queryKey: qk.follows.status('entreprises', id), queryFn: () => fetchFollowStatus('entreprises', id), enabled: !!id && isClient });
  const teamIds = useMemo(
    () => [...(driversQ.data ?? []).map((d) => `livreurs:${d.id}`), ...(relaysQ.data ?? []).map((c) => `correspondants:${c.id}`)],
    [driversQ.data, relaysQ.data],
  );
  const teamFollowQ = useQuery({
    queryKey: qk.follows.team(id, teamIds),
    enabled: isClient && teamIds.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        teamIds.map(async (k) => {
          const [kind, actorId] = k.split(':') as [FollowKind, string];
          return [actorId, await fetchFollowStatus(kind, actorId).catch(() => false)] as const;
        }),
      );
      return Object.fromEntries(pairs) as Record<string, boolean>;
    },
  });
  const favQ = useQuery({ queryKey: qk.favorites.ids, queryFn: fetchFavoriteIds, enabled: isClient });
  const cartQ = useCart();
  const cartIds = useMemo(() => new Set((cartQ.data ?? []).map((i) => i.produitId)), [cartQ.data]);

  /* ── Actions ── */
  const followShop = useMutation({
    mutationFn: () => toggleFollow('entreprises', id),
    onSuccess: (r) => {
      qc.setQueryData(qk.follows.status('entreprises', id), r.isSuivi);
      qc.setQueryData<ShopDetail>(qk.shop.detail(id), (old) =>
        old ? { ...old, totalAbonnes: r.followersCount ?? Math.max(0, old.totalAbonnes + (r.isSuivi ? 1 : -1)) } : old,
      );
      void qc.invalidateQueries({ queryKey: qk.follows.all });
    },
    onError: (e) => Alert.alert('Abonnement', toUserMessage(e)),
  });

  const followTeam = useMutation({
    mutationFn: ({ kind, actorId }: { kind: FollowKind; actorId: string }) => toggleFollow(kind, actorId),
    onSuccess: (r, v) => {
      qc.setQueryData<Record<string, boolean>>(qk.follows.team(id, teamIds), (old) => ({ ...(old ?? {}), [v.actorId]: r.isSuivi }));
      void qc.invalidateQueries({ queryKey: qk.follows.all });
    },
    onError: (e) => Alert.alert('Abonnement', toUserMessage(e)),
  });

  const cart = useMutation({
    mutationFn: (produitId: string) => addToCart(produitId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.cart }),
    onError: (e) => Alert.alert('Panier', toUserMessage(e)),
  });

  const fav = useMutation({
    mutationFn: (productId: string) => toggleFavorite(productId),
    onMutate: (productId) => {
      const prev = qc.getQueryData<Set<string>>(qk.favorites.ids);
      const next = new Set(prev ?? []);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      qc.setQueryData(qk.favorites.ids, next);
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.favorites.ids, ctx.prev);
      Alert.alert('Favoris', toUserMessage(e));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.favorites.list }),
  });

  const message = useMutation({
    mutationFn: () => startConversation('company', id),
    onSuccess: (convId) =>
      router.push({ pathname: '/messages/[id]', params: { id: convId, name: shop?.companyName ?? '', logo: shop?.logo ?? '', online: shop?.online ? '1' : '0' } }),
    onError: (e) => Alert.alert('Message', toUserMessage(e)),
  });

  const clientsOnly = (what: string) => Alert.alert(what, 'Connectez-vous avec un compte client pour utiliser cette fonction.');
  const followed = !!followQ.data;

  const onFollow = () => (isClient ? followShop.mutate() : clientsOnly('Abonnement'));
  const onTeamFollow = (kind: FollowKind) => (actorId: string) => (isClient ? followTeam.mutate({ kind, actorId }) : clientsOnly('Abonnement'));

  /* Même règle que le site : un client doit être abonné pour écrire à la boutique. */
  const onMessage = () => {
    if (isClient && !followed)
      return Alert.alert('Abonnez-vous d’abord', 'Abonnez-vous à cette boutique pour pouvoir lui envoyer un message.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'S’abonner', onPress: () => followShop.mutate(undefined, { onSuccess: (r) => r.isSuivi && message.mutate() }) },
      ]);
    message.mutate();
  };

  const onCall = () => {
    if (!shop) return;
    const wa = shop.whatsapp?.replace(/\D/g, '');
    const opts: { text: string; onPress?: () => void; style?: 'cancel' }[] = [];
    if (shop.businessPhone) opts.push({ text: `Appeler ${shop.businessPhone}`, onPress: () => void Linking.openURL(`tel:${shop.businessPhone!.replace(/\s/g, '')}`) });
    if (wa) opts.push({ text: 'WhatsApp', onPress: () => void Linking.openURL(`https://wa.me/${wa}`) });
    if (!opts.length) return Alert.alert('Appeler', 'Cette boutique n’a pas indiqué de numéro. Écrivez-lui plutôt par message.');
    Alert.alert('Contacter la boutique', shop.companyName, [...opts, { text: 'Annuler', style: 'cancel' }]);
  };

  const onShare = () => {
    if (!shop) return;
    const url = `${SITE}/boutique/${id}`;
    Share.share({ message: `${shop.companyName} sur Shoneya : ${url}`, url, title: shop.companyName }).catch(() => undefined);
  };

  const onRefresh = () => {
    void qc.invalidateQueries({ queryKey: qk.shop.detail(id) });
    void qc.invalidateQueries({ queryKey: qk.follows.statusAll });
    void qc.invalidateQueries({ queryKey: qk.favorites.ids });
    void cartQ.refetch();
  };

  const shareBtn = (
    <Pressable onPress={onShare} hitSlop={10} accessibilityRole="button" accessibilityLabel="Partager la boutique">
      <Ionicons name="share-social-outline" size={23} color={theme.text} />
    </Pressable>
  );

  /* ── Chargement / erreur ── */
  if (!shop) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        <ScreenHeader title="Boutique" />
        {shopQ.isError ? (
          <View style={styles.center}>
            <ThemedText style={styles.bigEmoji}>🏪</ThemedText>
            <ThemedText style={styles.notFound}>Boutique introuvable</ThemedText>
            <ErrorState error={shopQ.error} onRetry={() => void shopQ.refetch()} />
          </View>
        ) : (
          <View>
            <View style={[styles.cover, { backgroundColor: theme.backgroundElement }]} />
            <View style={[styles.skelLine, { backgroundColor: theme.backgroundElement, width: '60%' }]} />
            <View style={[styles.skelLine, { backgroundColor: theme.backgroundElement, width: '40%' }]} />
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const status = openStatus(shop.horaires);
  const place = [shop.quartier || shop.localisation, shop.commune, shop.ville].filter((v): v is string => !!v).map(capitalize).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  const catalog = services ? (servicesQ.data ?? []) : (productsQ.data ?? []);
  const reviews = reviewsQ.data;
  const avg = reviews?.averageRating || shop.averageRating;
  const totalReviews = reviews?.totalRatings ?? shop.totalRatings;

  const TABS: { key: Tab; label: string; icon: IconName; count?: number }[] = [
    services
      ? { key: 'catalog', label: 'Services', icon: 'construct-outline', count: catalog.length }
      : { key: 'catalog', label: 'Produits', icon: 'cube-outline', count: catalog.length },
    { key: 'promos', label: 'Promotions', icon: 'pricetags-outline', count: promosQ.data?.length ?? 0 },
    { key: 'drivers', label: 'Livreurs', icon: 'bicycle-outline', count: driversQ.data?.length ?? 0 },
    { key: 'relays', label: 'Points relais', icon: 'location-outline', count: relaysQ.data?.length ?? 0 },
    { key: 'reviews', label: 'Avis', icon: 'star-outline', count: totalReviews },
    { key: 'about', label: 'À propos', icon: 'information-circle-outline' },
  ];

  const cover = thumb(shop.coverImage, 1000);
  const logo = thumb(shop.logo, 240);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScreenHeader title={shop.companyName} right={shareBtn} />
      <ScrollView
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={shopQ.isRefetching} onRefresh={onRefresh} colors={[Brand.primary]} tintColor={Brand.primary} />}
        contentContainerStyle={styles.scroll}>
        {/* ── 0. Couverture + identité ── */}
        <View>
          {/* Couverture (ou dégradé de marque) + voile sombre en bas pour la lisibilité */}
          <View style={styles.cover}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" transition={200} />
            ) : (
              <LinearGradient colors={['#3A3A3A', '#1F1F1F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, styles.coverFallback]}>
                <ThemedText style={styles.coverEmoji}>{shop.domaineIcon || '🏪'}</ThemedText>
              </LinearGradient>
            )}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={styles.coverShade} pointerEvents="none" />
          </View>
          <View style={styles.identity}>
            <View style={styles.logoRow}>
              <View>
                <View style={[styles.logo, { borderColor: theme.background, backgroundColor: theme.backgroundSelected }]}>
                  {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.logoText}>{initials(shop.companyName)}</ThemedText>}
                </View>
                {shop.online ? <View style={[styles.onlineDot, { borderColor: theme.background }]} accessibilityLabel="En ligne" /> : null}
              </View>
              {status ? (
                <View style={[styles.statusPill, { backgroundColor: status.open ? '#E7F6EE' : '#FDECEC' }]}>
                  <View style={[styles.statusDot, { backgroundColor: status.open ? Brand.success : Brand.danger }]} />
                  <ThemedText type="smallBold" style={{ color: status.open ? Brand.success : Brand.danger }} numberOfLines={1}>
                    {status.label}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={styles.nameRow}>
              <ThemedText style={styles.name}>{shop.companyName}</ThemedText>
              {shop.verified ? <Ionicons name="checkmark-circle" size={22} color={Brand.primary} accessibilityLabel="Boutique vérifiée" /> : null}
            </View>
            {shop.slogan ? (
              <ThemedText themeColor="textSecondary" style={styles.slogan}>
                « {shop.slogan} »
              </ThemedText>
            ) : null}

            <View style={styles.metaWrap}>
              {shop.domaine ? (
                <View style={[styles.chipInfo, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText style={styles.domainText}>
                    {shop.domaineIcon ? `${shop.domaineIcon} ` : ''}
                    {capitalize(shop.domaine)}
                  </ThemedText>
                </View>
              ) : null}
              {shop.verified ? (
                <View style={[styles.chipInfo, { backgroundColor: theme.backgroundSelected }]}>
                  <Ionicons name="shield-checkmark" size={12} color={Brand.primary} />
                  <ThemedText style={styles.domainText}>Vérifiée Shoneya</ThemedText>
                </View>
              ) : null}
              {place ? (
                <View style={[styles.chipInfo, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="location" size={12} color={Brand.primary} />
                  <ThemedText type="small">{place}</ThemedText>
                </View>
              ) : null}
              {shop.membre ? (
                <View style={[styles.chipInfo, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} />
                  <ThemedText type="small">{shop.membre}</ThemedText>
                </View>
              ) : null}
            </View>

            {/* Chiffres clés */}
            <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
              <Pressable style={styles.stat} onPress={() => setTab('reviews')} accessibilityRole="button" accessibilityLabel={`Note ${avg.toFixed(1)} sur 5`}>
                <ThemedText style={styles.statV}>{avg > 0 ? avg.toFixed(1) : '—'}</ThemedText>
                <Stars value={avg} size={10} />
                <ThemedText style={styles.statL}>{totalReviews} avis</ThemedText>
              </Pressable>
              <View style={[styles.sep, { backgroundColor: theme.border }]} />
              <View style={styles.stat}>
                <ThemedText style={styles.statV}>{compact(shop.totalAbonnes)}</ThemedText>
                <ThemedText style={styles.statL}>Abonnés</ThemedText>
              </View>
              <View style={[styles.sep, { backgroundColor: theme.border }]} />
              <View style={styles.stat}>
                <ThemedText style={styles.statV}>{shop.totalOrders > 0 ? `${compact(shop.totalOrders)}+` : '—'}</ThemedText>
                <ThemedText style={styles.statL}>Ventes</ThemedText>
              </View>
              <View style={[styles.sep, { backgroundColor: theme.border }]} />
              <Pressable style={styles.stat} onPress={() => setTab('catalog')} accessibilityRole="button">
                <ThemedText style={styles.statV}>{compact(catalog.length)}</ThemedText>
                <ThemedText style={styles.statL}>{services ? 'Services' : 'Produits'}</ThemedText>
              </Pressable>
            </View>

            {/* Actions — ma boutique : gérer plutôt que s'abonner / écrire / appeler */}
            {isOwn ? (
              <>
                <View style={[styles.ownNote, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="eye-outline" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                    C’est votre boutique, telle que la voient vos clients.
                  </ThemedText>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => router.push('/entreprise/parametres')} accessibilityRole="button" style={[styles.followBtn, { backgroundColor: Brand.primarySoft }]}>
                    <Ionicons name="create-outline" size={18} color={Brand.primaryInk} />
                    <ThemedText style={[styles.followText, { color: Brand.primaryInk }]}>Modifier ma boutique</ThemedText>
                  </Pressable>
                  <ActionBtn icon="cube-outline" label="Mes produits" onPress={() => router.push('/entreprise/produits')} />
                </View>
              </>
            ) : (
              <View style={styles.actions}>
                <Pressable
                  onPress={onFollow}
                  disabled={followShop.isPending}
                  accessibilityRole="button"
                  accessibilityState={{ selected: followed, busy: followShop.isPending }}
                  style={[styles.followBtn, followed ? { backgroundColor: theme.backgroundSelected } : { backgroundColor: Brand.primarySoft }]}>
                  {followShop.isPending ? (
                    <ActivityIndicator color={followed ? Brand.primary : Brand.primaryInk} />
                  ) : (
                    <>
                      <Ionicons name={followed ? 'checkmark' : 'add'} size={19} color={followed ? Brand.primary : Brand.primaryInk} />
                      <ThemedText style={[styles.followText, { color: followed ? Brand.primary : Brand.primaryInk }]}>{followed ? 'Abonné' : 'S’abonner'}</ThemedText>
                    </>
                  )}
                </Pressable>
                <ActionBtn icon="chatbubble-ellipses-outline" label="Message" loading={message.isPending} onPress={onMessage} dim={isClient && !followed} />
                <ActionBtn icon="call-outline" label="Appeler" onPress={onCall} />
              </View>
            )}
          </View>
        </View>

        {/* ── 1. Onglets (collés en haut) ── */}
        <View style={[styles.tabsBar, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && { borderBottomColor: Brand.primary }]}>
                  <Ionicons name={t.icon} size={16} color={active ? Brand.primary : theme.textSecondary} />
                  <ThemedText style={[styles.tabText, { color: active ? Brand.primary : theme.textSecondary }]}>{t.label}</ThemedText>
                  {t.count != null ? (
                    <View style={[styles.count, { backgroundColor: active ? Brand.primary : theme.backgroundElement }]}>
                      <ThemedText style={[styles.countText, { color: active ? '#fff' : theme.textSecondary }]}>{t.count}</ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── 2. Contenu de l'onglet ── */}
        <View style={styles.body}>
          {tab === 'catalog' ? (
            services ? (
              <ServicesTab services={servicesQ.data ?? []} loading={servicesQ.isLoading} />
            ) : productsQ.isError ? (
              <ErrorState error={productsQ.error} onRetry={() => void productsQ.refetch()} />
            ) : (
              <ProductsTab
                products={productsQ.data ?? []}
                loading={productsQ.isLoading}
                width={width}
                favIds={favQ.data ?? new Set()}
                cartIds={cartIds}
                pendingCart={cart.isPending ? cart.variables : undefined}
                onToggleFav={isOwn ? undefined : (pid) => (isClient ? fav.mutate(pid) : clientsOnly('Favoris'))}
                onAddToCart={isOwn ? undefined : (pid) => (isClient ? cart.mutate(pid) : clientsOnly('Panier'))}
              />
            )
          ) : null}
          {tab === 'promos' ? <PromosTab promos={promosQ.data ?? []} loading={promosQ.isLoading} /> : null}
          {tab === 'drivers' ? (
            <DriversTab
              drivers={driversQ.data ?? []}
              loading={driversQ.isLoading}
              follows={teamFollowQ.data ?? {}}
              pending={followTeam.isPending ? followTeam.variables?.actorId : undefined}
              onFollow={isOwn ? undefined : onTeamFollow('livreurs')}
            />
          ) : null}
          {tab === 'relays' ? (
            <RelaysTab
              relays={relaysQ.data ?? []}
              loading={relaysQ.isLoading}
              follows={teamFollowQ.data ?? {}}
              pending={followTeam.isPending ? followTeam.variables?.actorId : undefined}
              onFollow={isOwn ? undefined : onTeamFollow('correspondants')}
            />
          ) : null}
          {tab === 'reviews' ? <ReviewsTab average={avg} total={totalReviews} reviews={reviews?.avis ?? []} loading={reviewsQ.isLoading} /> : null}
          {tab === 'about' ? <AboutTab shop={shop} drivers={driversQ.data ?? []} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionBtn({ icon, label, onPress, loading, dim }: { icon: IconName; label: string; onPress: () => void; loading?: boolean; dim?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionBtn, { backgroundColor: theme.backgroundElement }, (pressed || dim) && { opacity: 0.6 }]}>
      {loading ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name={icon} size={19} color={theme.text} />}
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },
  fill: { width: '100%', height: '100%' },
  center: { alignItems: 'center', paddingTop: 60, gap: 6 },
  bigEmoji: { fontSize: 48, lineHeight: 58 },
  notFound: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  loader: { marginTop: 24 },
  skelLine: { height: 16, borderRadius: 8, marginTop: 14, marginLeft: 16 },
  cover: { height: 170, overflow: 'hidden' },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  coverShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 },
  coverEmoji: { fontSize: 56, lineHeight: 66, opacity: 0.5 },
  identity: { paddingHorizontal: 16, gap: 8 },
  logoRow: { marginTop: -46, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 4, flexShrink: 1 },
  logo: { width: 96, height: 96, borderRadius: 48, borderWidth: 5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 30, lineHeight: 36, fontWeight: '900', color: Brand.primary },
  onlineDot: { position: 'absolute', right: 6, bottom: 6, width: 18, height: 18, borderRadius: 9, borderWidth: 3, backgroundColor: Brand.success },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '900', flexShrink: 1 },
  slogan: { fontStyle: 'italic' },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  chipInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  domainText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: Brand.primary },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingVertical: 14, marginTop: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statV: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  statL: { fontSize: 11, lineHeight: 14, color: '#6B6B6B' },
  sep: { width: 1, height: 32 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 12 },
  flex: { flex: 1 },
  ownNote: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 6 },
  followBtn: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, minHeight: 44 },
  followText: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, minHeight: 44 },
  tabsBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabs: { paddingHorizontal: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 48, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  count: { borderRadius: 999, minWidth: 22, paddingHorizontal: 6, alignItems: 'center' },
  countText: { fontSize: 11, lineHeight: 17, fontWeight: '800' },
  body: { padding: 16 },
});
