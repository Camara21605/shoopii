/**
 * Profil du client — s'ouvre en touchant sa photo de profil (en-tête).
 * Même contenu que la page /mon-profil du site, en version téléphone :
 *   · bandeau : photo, nom, badges (Vérifié, VIP Gold, 2FA, Top acheteur,
 *     Client fidèle), ville, ancienneté, « Modifier le profil »
 *   · chiffres clés : commandes, abonnements, favoris, points, dépensé, portefeuille
 *   · onglets : Commandes · Abonnements · Favoris · Souhaits · Retours
 * Données : voir features/profile/api.ts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, SectionState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { discountPercent, formatPrice, thumb } from '@/features/catalog/format';
import { openDriver, openProduct, openRelay, openShop, openSite } from '@/features/catalog/open';
import {
  fetchClientOrders,
  fetchClientProfile,
  fetchFavorites,
  fetchHomeCity,
  fetchMyFollows,
  fetchReturns,
  fetchWalletBalance,
  fetchWishlist,
  type SavedProduct,
} from '@/features/profile/api';
import { useTheme } from '@/hooks/use-theme';

type Tab = 'orders' | 'subs' | 'favs' | 'wishlist' | 'returns';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'orders', label: 'Commandes', icon: 'cube-outline' },
  { key: 'subs', label: 'Abonnements', icon: 'notifications-outline' },
  { key: 'favs', label: 'Favoris', icon: 'heart-outline' },
  { key: 'wishlist', label: 'Souhaits', icon: 'bookmark-outline' },
  { key: 'returns', label: 'Retours', icon: 'return-down-back-outline' },
];

/** Statuts de commande (mapOrderStatus du serveur : new · prep · ship · del · can). */
const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'Nouvelle', color: '#1652F0' },
  prep: { label: 'En préparation', color: '#D97706' },
  ship: { label: 'En livraison', color: '#7C3AED' },
  del: { label: 'Livrée', color: '#059669' },
  can: { label: 'Annulée', color: '#DC2626' },
};

const RETURN_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: '#D97706' },
  accepted: { label: 'Acceptée', color: '#1652F0' },
  refused: { label: 'Refusée', color: '#DC2626' },
  in_transit: { label: 'En transit', color: '#7C3AED' },
  received: { label: 'Reçue', color: '#0D9488' },
  refunded: { label: 'Remboursée', color: '#059669' },
  exchanged: { label: 'Échangée', color: '#059669' },
  closed: { label: 'Clôturée', color: '#6B7280' },
};

/** 1 250 000 → « 1,3 M » ; 45 000 → « 45 k » (chiffres clés compacts). */
function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')} M`;
  if (n >= 1_000) return `${Math.round(n / 1000)} k`;
  return String(n);
}

export default function ClientProfileScreen() {
  const theme = useTheme();
  const user = useSession((s) => s.user);
  const [tab, setTab] = useState<Tab>('orders');

  const profile = useQuery({ queryKey: ['client-profile'], queryFn: fetchClientProfile });
  const orders = useQuery({ queryKey: ['client-orders'], queryFn: fetchClientOrders });
  const follows = useQuery({ queryKey: ['follows', 'all'], queryFn: fetchMyFollows });
  const favs = useQuery({ queryKey: ['client-favs'], queryFn: fetchFavorites });
  const wishlist = useQuery({ queryKey: ['client-wishlist'], queryFn: fetchWishlist });
  const returns = useQuery({ queryKey: ['client-returns'], queryFn: fetchReturns, enabled: tab === 'returns' });
  const wallet = useQuery({ queryKey: ['wallet-balance'], queryFn: fetchWalletBalance });
  const city = useQuery({ queryKey: ['home-city'], queryFn: fetchHomeCity });

  const refreshing = profile.isRefetching || orders.isRefetching;
  const refresh = () => {
    void profile.refetch();
    void orders.refetch();
    void follows.refetch();
    void favs.refetch();
    void wishlist.refetch();
    void wallet.refetch();
    if (tab === 'returns') void returns.refetch();
  };

  if (user && user.role !== 'client') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScreenHeader title="Mon profil" />
        <SectionState>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Le profil client est réservé aux comptes clients.
          </ThemedText>
        </SectionState>
      </SafeAreaView>
    );
  }

  const p = profile.data;
  const followCount = follows.data ? follows.data.boutiques.length + follows.data.livreurs.length + follows.data.correspondants.length : null;
  const badges: { label: string; icon: IconName; color: string }[] = p
    ? [
        ...(p.emailVerifie ? [{ label: 'Vérifié', icon: 'checkmark-circle' as IconName, color: '#1652F0' }] : []),
        ...(p.shopiPoints >= 2000 ? [{ label: 'VIP Gold', icon: 'trophy' as IconName, color: '#D97706' }] : []),
        ...(p.twoFaEnabled ? [{ label: '2FA actif', icon: 'shield-checkmark' as IconName, color: '#059669' }] : []),
        ...(p.totalOrders >= 40 ? [{ label: 'Top acheteur', icon: 'flame' as IconName, color: '#DC2626' }] : []),
        { label: 'Client fidèle', icon: 'heart' as IconName, color: '#DB2777' },
      ]
    : [];
  const kpis = p
    ? [
        { label: 'Commandes', value: String(orders.data?.length ?? p.totalOrders), icon: 'cube' as IconName },
        { label: 'Abonnements', value: followCount === null ? '…' : String(followCount), icon: 'notifications' as IconName },
        { label: 'Favoris', value: String(favs.data?.length ?? p.totalFavorites), icon: 'heart' as IconName },
        { label: 'Pts Shoneya', value: p.shopiPoints.toLocaleString('fr-FR'), icon: 'star' as IconName },
        { label: 'Dépensé GNF', value: compact(p.totalSpent), icon: 'card' as IconName },
        { label: 'Portefeuille GNF', value: wallet.data === undefined ? '…' : compact(wallet.data), icon: 'wallet' as IconName },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Mon profil"
        right={
          <Pressable onPress={() => router.push('/parametres')} accessibilityRole="button" accessibilityLabel="Paramètres" hitSlop={8}>
            <Ionicons name="settings-outline" size={23} color={theme.text} />
          </Pressable>
        }
      />
      {profile.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : profile.error || !p ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[Brand.primary]} />}>
          {/* ── Bandeau identité ── */}
          <View style={[styles.cover, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.identity}>
            <View style={[styles.avatar, { borderColor: theme.background, backgroundColor: Brand.primary }]}>
              {p.profilePicture ? (
                <Image source={{ uri: thumb(p.profilePicture, 300) }} style={styles.fill} contentFit="cover" />
              ) : (
                <ThemedText style={styles.avatarText}>{(p.initiales || p.nomComplet.slice(0, 2)).toUpperCase()}</ThemedText>
              )}
            </View>
            <ThemedText style={styles.name}>{p.nomComplet}</ThemedText>
            <ThemedText themeColor="textSecondary">{p.email}</ThemedText>
            <View style={styles.metaRow}>
              {city.data ? (
                <View style={styles.meta}>
                  <Ionicons name="location" size={14} color={Brand.primary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {city.data}
                  </ThemedText>
                </View>
              ) : null}
              {p.membreDepuis ? (
                <View style={styles.meta}>
                  <Ionicons name="calendar-outline" size={14} color={Brand.primary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {p.membreDepuis}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            {p.bio ? (
              <ThemedText type="small" style={styles.bio}>
                {p.bio}
              </ThemedText>
            ) : null}
            <View style={styles.badges}>
              {badges.map((b) => (
                <View key={b.label} style={[styles.badge, { backgroundColor: `${b.color}14`, borderColor: `${b.color}40` }]}>
                  <Ionicons name={b.icon} size={12} color={b.color} />
                  <ThemedText style={[styles.badgeText, { color: b.color }]}>{b.label}</ThemedText>
                </View>
              ))}
            </View>
            <Pressable onPress={() => router.push('/parametres/profil')} accessibilityRole="button" style={[styles.editBtn, { borderColor: theme.border }]}>
              <Ionicons name="create-outline" size={17} color={theme.text} />
              <ThemedText type="smallBold">Modifier le profil</ThemedText>
            </Pressable>
          </View>

          {/* ── Chiffres clés ── */}
          <View style={styles.kpis}>
            {kpis.map((k) => (
              <View key={k.label} style={[styles.kpi, { borderColor: theme.border }]}>
                <Ionicons name={k.icon} size={16} color={Brand.primary} />
                <ThemedText style={styles.kpiValue} numberOfLines={1}>
                  {k.value}
                </ThemedText>
                <ThemedText style={styles.kpiLabel} themeColor="textSecondary" numberOfLines={1}>
                  {k.label}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* ── Onglets ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.tab, on ? { backgroundColor: Brand.primary, borderColor: Brand.primary } : { borderColor: theme.border }]}>
                  <Ionicons name={t.icon} size={15} color={on ? '#fff' : theme.text} />
                  <ThemedText type="smallBold" style={on ? { color: '#fff' } : undefined}>
                    {t.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.tabBody}>
            {tab === 'orders' && <OrdersTab q={orders} />}
            {tab === 'subs' && <FollowsTab q={follows} />}
            {tab === 'favs' && <ProductsTab q={favs} empty="Aucun produit en favori. Touchez ♥ sur un produit pour le retrouver ici." />}
            {tab === 'wishlist' && <ProductsTab q={wishlist} empty="Votre liste de souhaits est vide." />}
            {tab === 'returns' && <ReturnsTab q={returns} />}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ── Onglets ─────────────────────────────────────────────────────────── */

type Q<T> = { data?: T; isPending: boolean; error: unknown; refetch: () => unknown };

function Loading<T>({ q, children }: { q: Q<T>; children: (data: T) => React.ReactNode }) {
  if (q.isPending) return <ActivityIndicator color={Brand.primary} style={styles.loaderSmall} />;
  if (q.error || q.data === undefined) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <>{children(q.data)}</>;
}

function Empty({ icon, text }: { icon: IconName; text: string }) {
  const theme = useTheme();
  return (
    <SectionState>
      <Ionicons name={icon} size={40} color={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {text}
      </ThemedText>
    </SectionState>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}14` }]}>
      <ThemedText style={[styles.pillText, { color }]}>{label}</ThemedText>
    </View>
  );
}

function OrdersTab({ q }: { q: Q<Awaited<ReturnType<typeof fetchClientOrders>>> }) {
  const theme = useTheme();
  return (
    <Loading q={q}>
      {(list) =>
        list.length === 0 ? (
          <Empty icon="cube-outline" text="Vous n’avez pas encore passé de commande." />
        ) : (
          list.map((o) => {
            const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.new;
            const more = o.items.length > 1 ? ` + ${o.items.length - 1} autre${o.items.length > 2 ? 's' : ''}` : '';
            return (
              <Pressable
                key={o.uuid}
                onPress={() => openSite(`/commande/${o.uuid}/suivi`)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.card, { borderColor: theme.border }, pressed && styles.pressed]}>
                <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                  {o.imageUrl ? <Image source={{ uri: thumb(o.imageUrl, 140) }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.emoji}>📦</ThemedText>}
                </View>
                <View style={styles.flex}>
                  <View style={styles.rowBetween}>
                    <ThemedText style={styles.small} themeColor="textSecondary">
                      {o.id} · {o.date}
                    </ThemedText>
                    <StatusPill {...st} />
                  </View>
                  <ThemedText numberOfLines={1} style={styles.cardTitle}>
                    {o.nm}
                    {more}
                  </ThemedText>
                  <View style={styles.rowBetween}>
                    <View style={styles.meta}>
                      <Ionicons name="storefront-outline" size={13} color={theme.textSecondary} />
                      <ThemedText numberOfLines={1} type="small" themeColor="textSecondary" style={styles.flex}>
                        {o.client}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.price}>{formatPrice(o.price)}</ThemedText>
                  </View>
                </View>
              </Pressable>
            );
          })
        )
      }
    </Loading>
  );
}

function FollowsTab({ q }: { q: Q<Awaited<ReturnType<typeof fetchMyFollows>>> }) {
  const theme = useTheme();
  return (
    <Loading q={q}>
      {(d) => {
        const groups = [
          { title: 'Boutiques', items: d.boutiques, open: openShop, icon: 'storefront' as IconName },
          { title: 'Livreurs', items: d.livreurs, open: openDriver, icon: 'bicycle' as IconName },
          { title: 'Points relais', items: d.correspondants, open: openRelay, icon: 'location' as IconName },
        ].filter((g) => g.items.length > 0);
        if (!groups.length) return <Empty icon="notifications-outline" text="Vous ne suivez encore aucune boutique, aucun livreur ni point relais." />;
        return groups.map((g) => (
          <View key={g.title} style={styles.group}>
            <ThemedText style={styles.groupTitle}>
              {g.title.toUpperCase()} ({g.items.length})
            </ThemedText>
            {g.items.map((it) => (
              <Pressable
                key={it.id}
                onPress={() => g.open(it.id)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.card, { borderColor: theme.border }, pressed && styles.pressed]}>
                <View style={[styles.followIcon, { backgroundColor: theme.backgroundSelected }]}>
                  <Ionicons name={g.icon} size={20} color={Brand.primary} />
                </View>
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1} style={styles.cardTitle}>
                    {it.nom}
                  </ThemedText>
                  {it.categorie ? (
                    <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                      {it.categorie}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {it.abonnes} abonné{it.abonnes > 1 ? 's' : ''}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ));
      }}
    </Loading>
  );
}

function ProductsTab({ q, empty }: { q: Q<SavedProduct[]>; empty: string }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const w = Math.floor((width - Spacing.three * 2 - 12) / 2);
  return (
    <Loading q={q}>
      {(list) =>
        list.length === 0 ? (
          <Empty icon="heart-outline" text={empty} />
        ) : (
          <View style={styles.grid}>
            {list.map((it) => {
              const promo = discountPercent(it.prix, it.prixAncien);
              return (
                <Pressable
                  key={it.id}
                  onPress={() => openProduct(it.productId)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.pCard, { width: w, borderColor: theme.border }, pressed && styles.pressed]}>
                  <View style={[styles.pImg, { backgroundColor: theme.backgroundElement }]}>
                    {it.imageUrl ? <Image source={{ uri: thumb(it.imageUrl, 400) }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.pEmoji}>{it.emoji || '📦'}</ThemedText>}
                    {promo ? (
                      <View style={styles.promo}>
                        <ThemedText style={styles.promoText}>−{promo}%</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.pBody}>
                    <ThemedText numberOfLines={2} style={styles.pName}>
                      {it.nom}
                    </ThemedText>
                    <ThemedText style={styles.price}>{formatPrice(it.prix)}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )
      }
    </Loading>
  );
}

function ReturnsTab({ q }: { q: Q<Awaited<ReturnType<typeof fetchReturns>>> }) {
  const theme = useTheme();
  return (
    <Loading q={q}>
      {(list) =>
        list.length === 0 ? (
          <Empty icon="return-down-back-outline" text="Aucune demande de retour." />
        ) : (
          list.map((r) => {
            const st = RETURN_STATUS[r.status] ?? RETURN_STATUS.pending;
            return (
              <View key={r.id} style={[styles.card, { borderColor: theme.border }]}>
                <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                  {r.productImage ? <Image source={{ uri: thumb(r.productImage, 140) }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.emoji}>↩️</ThemedText>}
                </View>
                <View style={styles.flex}>
                  <View style={styles.rowBetween}>
                    <ThemedText style={styles.small} themeColor="textSecondary">
                      {r.reference} · {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </ThemedText>
                    <StatusPill {...st} />
                  </View>
                  <ThemedText numberOfLines={1} style={styles.cardTitle}>
                    {r.productName}
                  </ThemedText>
                  <ThemedText style={styles.price}>{formatPrice(r.montantDemande)}</ThemedText>
                </View>
              </View>
            );
          })
        )
      }
    </Loading>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.85 },
  loader: { marginTop: 60 },
  loaderSmall: { marginVertical: Spacing.four },
  content: { paddingBottom: Spacing.five },
  cover: { height: 90 },
  identity: { alignItems: 'center', marginTop: -50, paddingHorizontal: Spacing.three, gap: 4 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarText: { color: '#fff', fontSize: 34, lineHeight: 40, fontWeight: '800' },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  bio: { textAlign: 'center', marginTop: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, minHeight: 42, marginTop: 12 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: Spacing.three, marginTop: Spacing.four },
  kpi: { width: '31.5%', borderWidth: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 2 },
  kpiValue: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 11, lineHeight: 14 },
  tabs: { paddingHorizontal: Spacing.three, gap: 8, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabBody: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  thumb: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26, lineHeight: 32 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  small: { fontSize: 11.5, lineHeight: 15 },
  cardTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '700', marginVertical: 2 },
  price: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: Brand.primary },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  group: { gap: 8, marginBottom: Spacing.two },
  groupTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.3, color: Brand.primary, marginTop: 4 },
  followIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  pImg: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  pEmoji: { fontSize: 36, lineHeight: 44 },
  promo: { position: 'absolute', top: 8, left: 8, backgroundColor: Brand.danger, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  promoText: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  pBody: { padding: 10, gap: 2 },
  pName: { fontSize: 13.5, lineHeight: 18, fontWeight: '600', minHeight: 36 },
});
