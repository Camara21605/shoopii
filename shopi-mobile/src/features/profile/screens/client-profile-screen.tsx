/**
 * Profil du client — s'ouvre en touchant sa photo de profil (en-tête).
 * Même contenu que la page /mon-profil du site, en version téléphone soignée :
 *   · couverture en dégradé, photo modifiable sur place (appareil photo, galerie,
 *     voir, supprimer — components/avatar-editor.tsx), nom + coche Vérifié,
 *     @identifiant, ville, ancienneté, bio, badges (VIP Gold, 2FA, Top acheteur…)
 *   · carte Portefeuille : solde réel + points Shoneya, niveau et progression
 *   · chiffres clés réunis dans une carte (commandes, dépensé, abonnements, favoris)
 *   · raccourcis (panier, messages, notifications, aide)
 *   · onglets avec compteurs : Commandes (barre de suivi) · Abonnements ·
 *     Favoris · Souhaits · Retours
 * Données : voir features/profile/api.ts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, SectionState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
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
import { qk } from '@/lib/query-keys';

import { AvatarBusy, useAvatarEditor } from '../components';

type Tab = 'orders' | 'subs' | 'favs' | 'wishlist' | 'returns';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'orders', label: 'Commandes', icon: 'cube-outline' },
  { key: 'subs', label: 'Abonnements', icon: 'notifications-outline' },
  { key: 'favs', label: 'Favoris', icon: 'heart-outline' },
  { key: 'wishlist', label: 'Souhaits', icon: 'bookmark-outline' },
  { key: 'returns', label: 'Retours', icon: 'return-down-back-outline' },
];

/** Statuts de commande (mapOrderStatus du serveur : new · prep · ship · del · can) + étape de suivi. */
const ORDER_STATUS: Record<string, { label: string; color: string; step: number }> = {
  new: { label: 'Nouvelle', color: '#1F1F1F', step: 0 },
  prep: { label: 'En préparation', color: '#D97706', step: 1 },
  ship: { label: 'En livraison', color: '#7C3AED', step: 2 },
  del: { label: 'Livrée', color: '#059669', step: 3 },
  can: { label: 'Annulée', color: '#DC2626', step: -1 },
};
const STEPS = ['Reçue', 'Préparée', 'En route', 'Livrée'];

const RETURN_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: '#D97706' },
  accepted: { label: 'Acceptée', color: '#1F1F1F' },
  refused: { label: 'Refusée', color: '#DC2626' },
  in_transit: { label: 'En transit', color: '#7C3AED' },
  received: { label: 'Reçue', color: '#0D9488' },
  refunded: { label: 'Remboursée', color: '#059669' },
  exchanged: { label: 'Échangée', color: '#059669' },
  closed: { label: 'Clôturée', color: '#6B7280' },
};

/** Niveaux de fidélité (mêmes seuils que le badge VIP Gold du site : 2 000 points). */
const TIERS = [
  { name: 'Bronze', min: 0, color: '#B45309' },
  { name: 'Argent', min: 500, color: '#737373' },
  { name: 'VIP Gold', min: 2000, color: '#D97706' },
  { name: 'Platine', min: 5000, color: '#7C3AED' },
];
function tierOf(points: number) {
  let i = 0;
  while (i + 1 < TIERS.length && points >= TIERS[i + 1].min) i++;
  const next = TIERS[i + 1];
  const progress = next ? (points - TIERS[i].min) / (next.min - TIERS[i].min) : 1;
  return { tier: TIERS[i], next, progress: Math.max(0, Math.min(1, progress)) };
}

/** 1 250 000 → « 1,3 M » ; 45 000 → « 45 k » (chiffres clés compacts). */
function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')} M`;
  if (n >= 1_000) return `${Math.round(n / 1000)} k`;
  return String(n);
}

export default function ClientProfileScreen() {
  const theme = useTheme();
  const user = useSession((s) => s.user);
  /* ?tab=favs depuis le menu ☰ (« Mes favoris ») */
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'orders'));
  const snack = useSnack();
  const avatar = useAvatarEditor(snack.show);

  const profile = useQuery({ queryKey: qk.profile.me, queryFn: fetchClientProfile });
  const orders = useQuery({ queryKey: qk.profile.orders, queryFn: fetchClientOrders });
  const follows = useQuery({ queryKey: qk.follows.mine, queryFn: fetchMyFollows });
  const favs = useQuery({ queryKey: qk.favorites.list, queryFn: fetchFavorites });
  const wishlist = useQuery({ queryKey: qk.wishlist.list, queryFn: fetchWishlist });
  const returns = useQuery({ queryKey: qk.profile.returns, queryFn: fetchReturns });
  const wallet = useQuery({ queryKey: qk.wallet, queryFn: fetchWalletBalance });
  const city = useQuery({ queryKey: qk.profile.city, queryFn: fetchHomeCity });

  const refreshing = profile.isRefetching || orders.isRefetching;
  const refresh = () => {
    void profile.refetch();
    void orders.refetch();
    void follows.refetch();
    void favs.refetch();
    void wishlist.refetch();
    void wallet.refetch();
    void returns.refetch();
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
  const counts: Record<Tab, number | null> = {
    orders: orders.data?.length ?? null,
    subs: followCount,
    favs: favs.data?.length ?? null,
    wishlist: wishlist.data?.length ?? null,
    returns: returns.data?.length ?? null,
  };

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
        <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[Brand.primary]} />}>
          {/* ── Couverture + identité ── */}
          <LinearGradient colors={['#3A3A3A', '#1F1F1F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
            <View style={[styles.bubble, styles.bubble1]} />
            <View style={[styles.bubble, styles.bubble2]} />
          </LinearGradient>
          <View style={styles.identity}>
            <View>
              <Pressable
                onPress={avatar.openSheet}
                disabled={avatar.busy}
                accessibilityRole="button"
                accessibilityLabel={p.profilePicture ? 'Photo de profil : changer, voir ou supprimer' : 'Ajouter une photo de profil'}
                style={[styles.avatar, { borderColor: theme.background, backgroundColor: theme.backgroundElement }]}>
                {avatar.preview || p.profilePicture ? (
                  <Image source={{ uri: avatar.preview ?? thumb(p.profilePicture, 300) }} style={styles.fill} contentFit="cover" transition={200} />
                ) : (
                  <ThemedText style={styles.avatarText}>{(p.initiales || p.nomComplet.slice(0, 2)).toUpperCase()}</ThemedText>
                )}
                {avatar.busy ? <AvatarBusy /> : null}
              </Pressable>
              <Pressable
                onPress={avatar.openSheet}
                disabled={avatar.busy}
                style={[styles.camera, { borderColor: theme.background }]}
                accessibilityRole="button"
                accessibilityLabel="Changer la photo de profil"
                hitSlop={8}>
                <Ionicons name={p.profilePicture ? 'camera' : 'add'} size={p.profilePicture ? 15 : 18} color="#fff" />
              </Pressable>
            </View>
            {!p.profilePicture && !avatar.busy ? (
              <Pressable onPress={avatar.openSheet} accessibilityRole="button" hitSlop={6}>
                <ThemedText type="smallBold" style={styles.addPhoto}>
                  Ajouter une photo de profil
                </ThemedText>
              </Pressable>
            ) : null}
            <View style={styles.nameRow}>
              <ThemedText style={styles.name}>{p.nomComplet}</ThemedText>
              {p.emailVerifie ? <Ionicons name="checkmark-circle" size={20} color={Brand.primary} accessibilityLabel="Compte vérifié" /> : null}
            </View>
            <ThemedText themeColor="textSecondary">{user?.username ? `@${user.username}` : p.email}</ThemedText>
            <View style={styles.metaRow}>
              {city.data ? <Meta icon="location" text={city.data} /> : null}
              {p.membreDepuis ? <Meta icon="calendar-outline" text={p.membreDepuis} /> : null}
            </View>
            {p.bio ? <ThemedText style={styles.bio}>{p.bio}</ThemedText> : null}
            <View style={styles.badges}>
              {p.twoFaEnabled ? <Badge label="2FA actif" icon="shield-checkmark" color="#059669" /> : null}
              {p.totalOrders >= 40 ? <Badge label="Top acheteur" icon="flame" color="#DC2626" /> : null}
              {p.totalOrders >= 3 ? <Badge label="Client fidèle" icon="heart" color="#DB2777" /> : null}
              {p.emailVerifie ? <Badge label="E-mail vérifié" icon="mail" color="#1F1F1F" /> : null}
            </View>
            <View style={styles.btnRow}>
              <Pressable onPress={() => router.push('/parametres/profil')} style={[styles.btn, styles.btnPrimary]} accessibilityRole="button">
                <Ionicons name="create-outline" size={17} color={Brand.primaryInk} />
                <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>
                  Modifier le profil
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => router.push('/adresses')} style={[styles.btn, { backgroundColor: theme.backgroundElement }]} accessibilityRole="button">
                <Ionicons name="home-outline" size={17} color={theme.text} />
                <ThemedText type="smallBold">Mes adresses</ThemedText>
              </Pressable>
            </View>
          </View>

          {/* ── Portefeuille + fidélité ── */}
          <WalletCard balance={wallet.data} points={p.shopiPoints} />

          {/* ── Chiffres clés ── */}
          <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
            {[
              { v: String(orders.data?.length ?? p.totalOrders), l: 'Commandes' },
              { v: compact(p.totalSpent), l: 'GNF dépensés' },
              { v: followCount === null ? '…' : String(followCount), l: 'Abonnements' },
              { v: String(favs.data?.length ?? p.totalFavorites), l: 'Favoris' },
            ].map((s, i) => (
              <View key={s.l} style={[styles.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border }]}>
                <ThemedText style={styles.statV} numberOfLines={1}>
                  {s.v}
                </ThemedText>
                <ThemedText style={styles.statL} themeColor="textSecondary" numberOfLines={1}>
                  {s.l}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* ── Raccourcis ── */}
          <View style={styles.shortcuts}>
            <Shortcut icon="bag-handle-outline" label="Panier" color="#1F1F1F" to="/panier" />
            <Shortcut icon="chatbubble-ellipses-outline" label="Messages" color="#7C3AED" to="/messages" />
            <Shortcut icon="notifications-outline" label="Alertes" color="#D97706" to="/notifications" />
            <Shortcut icon="help-buoy-outline" label="Aide" color="#059669" web="/aide" />
          </View>

          {/* ── Onglets ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { borderBottomColor: theme.border }]}>
            {TABS.map((t) => {
              const on = t.key === tab;
              const n = counts[t.key];
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && { borderBottomColor: Brand.primary }]}>
                  <Ionicons name={t.icon} size={16} color={on ? Brand.primary : theme.textSecondary} />
                  <ThemedText style={[styles.tabText, { color: on ? Brand.primary : theme.textSecondary }]}>{t.label}</ThemedText>
                  {n ? (
                    <View style={[styles.count, { backgroundColor: on ? Brand.primarySoft : theme.backgroundElement }]}>
                      <ThemedText style={[styles.countText, { color: on ? Brand.primaryInk : theme.textSecondary }]}>{n}</ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.tabBody}>
            {tab === 'orders' && <OrdersTab q={orders} />}
            {tab === 'subs' && <FollowsTab q={follows} />}
            {tab === 'favs' && <ProductsTab q={favs} icon="heart-outline" empty="Aucun produit en favori. Touchez ❤ sur un produit pour le retrouver ici." />}
            {tab === 'wishlist' && <ProductsTab q={wishlist} icon="bookmark-outline" empty="Votre liste de souhaits est vide. Touchez 🔖 sur un produit pour l’y ajouter." />}
            {tab === 'returns' && <ReturnsTab q={returns} />}
          </View>
        </ScrollView>
      )}
      {avatar.sheet(p?.profilePicture)}
      <Snack msg={snack.msg} />
    </SafeAreaView>
  );
}

/* ── Éléments de l'en-tête ──────────────────────────────────────────── */

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={Brand.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}

function Badge({ label, icon, color }: { label: string; icon: IconName; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}12` }]}>
      <Ionicons name={icon} size={12} color={color} />
      <ThemedText style={[styles.badgeText, { color }]}>{label}</ThemedText>
    </View>
  );
}

function Shortcut({ icon, label, color, to, web }: { icon: IconName; label: string; color: string; to?: Href; web?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => (to ? router.push(to) : web ? openSite(web) : undefined)}
      style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={[styles.shortcutIco, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <ThemedText type="small" style={{ color: theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Carte Portefeuille : solde RÉEL (GET /wallet) + points Shoneya, niveau et progression. */
function WalletCard({ balance, points }: { balance: number | undefined; points: number }) {
  const { tier, next, progress } = tierOf(points);
  return (
    <LinearGradient colors={['#1F1F1F', '#3A3A3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wallet}>
      <View style={styles.rowBetween}>
        <View style={styles.row6}>
          <Ionicons name="wallet" size={18} color="rgba(255,255,255,0.85)" />
          <ThemedText style={styles.walletLabel}>Portefeuille Shoneya</ThemedText>
        </View>
        <Pressable onPress={() => router.push('/portefeuille/recharger')} style={styles.recharge} accessibilityRole="button" accessibilityLabel="Recharger mon portefeuille">
          <Ionicons name="add" size={16} color="#1F1F1F" />
          <ThemedText type="smallBold" style={{ color: '#1F1F1F' }}>
            Recharger
          </ThemedText>
        </Pressable>
      </View>
      <Pressable onPress={() => router.push('/portefeuille')} accessibilityRole="button" accessibilityLabel="Ouvrir mon portefeuille">
        <ThemedText style={styles.walletAmount}>{balance === undefined ? '…' : formatPrice(balance)}</ThemedText>
      </Pressable>
      <View style={[styles.walletSep]} />
      <View style={styles.rowBetween}>
        <View style={styles.row6}>
          <Ionicons name="star" size={15} color="#FBBF24" />
          <ThemedText style={styles.walletPts}>{points.toLocaleString('fr-FR')} points</ThemedText>
        </View>
        <View style={[styles.tier, { backgroundColor: `${tier.color}33` }]}>
          <Ionicons name="trophy" size={12} color="#FBBF24" />
          <ThemedText style={styles.tierText}>{tier.name}</ThemedText>
        </View>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <ThemedText style={styles.walletHint}>
        {next ? `Encore ${(next.min - points).toLocaleString('fr-FR')} points pour le niveau ${next.name}` : 'Niveau maximal atteint 🎉'}
      </ThemedText>
    </LinearGradient>
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
    <View style={styles.empty}>
      <View style={[styles.emptyIco, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={30} color={Brand.primary} />
      </View>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {text}
      </ThemedText>
    </View>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}14` }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
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
            const n = o.items.reduce((s, i) => s + (i.qty || 1), 0) || 1;
            const more = o.items.length > 1 ? ` + ${o.items.length - 1} autre${o.items.length > 2 ? 's' : ''}` : '';
            return (
              <Pressable
                key={o.uuid}
                onPress={() => openSite(`/commande/${o.uuid}/suivi`)}
                accessibilityRole="button"
                accessibilityLabel={`Commande ${o.id}, ${st.label}`}
                style={({ pressed }) => [styles.orderCard, { borderColor: theme.border }, pressed && styles.pressed]}>
                <View style={styles.rowBetween}>
                  <ThemedText style={styles.small} themeColor="textSecondary">
                    {o.id} · {o.date}
                  </ThemedText>
                  <StatusPill label={st.label} color={st.color} />
                </View>
                <View style={styles.orderMain}>
                  <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                    {o.imageUrl ? <Image source={{ uri: thumb(o.imageUrl, 140) }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.emoji}>📦</ThemedText>}
                  </View>
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1} style={styles.cardTitle}>
                      {o.nm}
                      {more}
                    </ThemedText>
                    <View style={styles.meta}>
                      <Ionicons name="storefront-outline" size={13} color={theme.textSecondary} />
                      <ThemedText numberOfLines={1} type="small" themeColor="textSecondary" style={styles.flexShrink}>
                        {o.client}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {n} article{n > 1 ? 's' : ''}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.price}>{formatPrice(o.price)}</ThemedText>
                </View>
                {/* Barre de suivi : Reçue → Préparée → En route → Livrée */}
                {st.step >= 0 ? (
                  <View style={styles.track}>
                    {STEPS.map((label, i) => {
                      const done = i <= st.step;
                      return (
                        <View key={label} style={styles.trackStep}>
                          <View style={[styles.trackBar, { backgroundColor: done ? st.color : theme.border }]} />
                          <ThemedText style={[styles.trackText, { color: done ? st.color : theme.textSecondary }, i === st.step && styles.bold]}>{label}</ThemedText>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <ThemedText type="small" style={{ color: ORDER_STATUS.can.color }}>
                    Commande annulée
                  </ThemedText>
                )}
                <View style={[styles.orderFoot, { borderTopColor: theme.border }]}>
                  <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                    {o.status === 'del' ? 'Voir le détail' : o.status === 'can' ? 'Voir la commande' : 'Suivre ma commande'}
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={16} color={Brand.primary} />
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
          { title: 'Boutiques', items: d.boutiques, open: openShop, icon: 'storefront' as IconName, color: '#1F1F1F' },
          { title: 'Livreurs', items: d.livreurs, open: openDriver, icon: 'bicycle' as IconName, color: '#059669' },
          { title: 'Points relais', items: d.correspondants, open: openRelay, icon: 'location' as IconName, color: '#7C3AED' },
        ].filter((g) => g.items.length > 0);
        if (!groups.length) return <Empty icon="notifications-outline" text="Vous ne suivez encore aucune boutique, aucun livreur ni point relais." />;
        return groups.map((g) => (
          <View key={g.title} style={styles.group}>
            <ThemedText style={styles.groupTitle}>
              {g.title.toUpperCase()} · {g.items.length}
            </ThemedText>
            <View style={[styles.listCard, { borderColor: theme.border }]}>
              {g.items.map((it, i) => (
                <Pressable
                  key={it.id}
                  onPress={() => g.open(it.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.followRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && styles.pressed]}>
                  <View style={[styles.followIcon, { backgroundColor: `${g.color}14` }]}>
                    <Ionicons name={g.icon} size={20} color={g.color} />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1} style={styles.cardTitle}>
                      {it.nom}
                    </ThemedText>
                    <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                      {[it.categorie, `${it.abonnes} abonné${it.abonnes > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        ));
      }}
    </Loading>
  );
}

function ProductsTab({ q, empty, icon }: { q: Q<SavedProduct[]>; empty: string; icon: IconName }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const w = Math.floor((width - Spacing.three * 2 - 12) / 2);
  return (
    <Loading q={q}>
      {(list) =>
        list.length === 0 ? (
          <Empty icon={icon} text={empty} />
        ) : (
          <View style={styles.grid}>
            {list.map((it) => {
              const promo = discountPercent(it.prix, it.prixAncien);
              return (
                <Pressable
                  key={it.id}
                  onPress={() => openProduct(it.productId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.nom}, ${formatPrice(it.prix)}`}
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
                    <View style={styles.row6}>
                      <ThemedText style={styles.price}>{formatPrice(it.prix)}</ThemedText>
                      {promo && it.prixAncien ? <ThemedText style={styles.old}>{formatPrice(it.prixAncien)}</ThemedText> : null}
                    </View>
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
          <Empty icon="return-down-back-outline" text="Aucune demande de retour. Elles apparaîtront ici avec leur suivi." />
        ) : (
          list.map((r) => {
            const st = RETURN_STATUS[r.status] ?? RETURN_STATUS.pending;
            return (
              <View key={r.id} style={[styles.orderCard, { borderColor: theme.border }]}>
                <View style={styles.rowBetween}>
                  <ThemedText style={styles.small} themeColor="textSecondary">
                    {r.reference} · {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </ThemedText>
                  <StatusPill {...st} />
                </View>
                <View style={styles.orderMain}>
                  <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                    {r.productImage ? <Image source={{ uri: thumb(r.productImage, 140) }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.emoji}>↩️</ThemedText>}
                  </View>
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1} style={styles.cardTitle}>
                      {r.productName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Montant demandé
                    </ThemedText>
                  </View>
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
  flexShrink: { flexShrink: 1 },
  fill: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  bold: { fontWeight: '800' },
  white: { color: '#fff' },
  pressed: { opacity: 0.85 },
  loader: { marginTop: 60 },
  loaderSmall: { marginVertical: Spacing.four },
  content: { paddingBottom: Spacing.five },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  /* En-tête */
  cover: { height: 130, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  bubble1: { width: 220, height: 220, top: -90, right: -60 },
  bubble2: { width: 140, height: 140, bottom: -70, left: -30 },
  identity: { alignItems: 'center', marginTop: -56, paddingHorizontal: Spacing.three, gap: 4 },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Brand.primaryInk, fontSize: 38, lineHeight: 46, fontWeight: '900' },
  addPhoto: { color: Brand.primary, textDecorationLine: 'underline', marginTop: 6 },
  camera: { position: 'absolute', right: 2, bottom: 4, width: 34, height: 34, borderRadius: 17, borderWidth: 3, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  name: { fontSize: 23, lineHeight: 29, fontWeight: '900', textAlign: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  bio: { textAlign: 'center', marginTop: 6, fontSize: 14.5, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignSelf: 'stretch' },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, minHeight: 44 },
  btnPrimary: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine },
  /* Portefeuille */
  wallet: { marginHorizontal: Spacing.three, marginTop: Spacing.four, borderRadius: 20, padding: 16, gap: 8 },
  walletLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  recharge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  walletAmount: { color: '#fff', fontSize: 28, lineHeight: 36, fontWeight: '900' },
  walletSep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  walletPts: { color: '#fff', fontWeight: '800' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tierText: { color: '#FDE68A', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  progress: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#FBBF24' },
  walletHint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 16 },
  /* Chiffres + raccourcis */
  stats: { flexDirection: 'row', marginHorizontal: Spacing.three, marginTop: 12, borderRadius: 16, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  statV: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  statL: { fontSize: 11, lineHeight: 14 },
  shortcuts: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: Spacing.three, marginTop: 18 },
  shortcut: { alignItems: 'center', gap: 6, width: 76 },
  shortcutIco: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  /* Onglets */
  tabs: { paddingHorizontal: 8, marginTop: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 48, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  count: { borderRadius: 999, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' },
  countText: { fontSize: 11, lineHeight: 17, fontWeight: '800' },
  tabBody: { paddingHorizontal: Spacing.three, paddingTop: 14, gap: 12 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 20 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  /* Commandes */
  orderCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  orderMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  track: { flexDirection: 'row', gap: 4 },
  trackStep: { flex: 1, gap: 4 },
  trackBar: { height: 4, borderRadius: 2 },
  trackText: { fontSize: 10.5, lineHeight: 13 },
  thumb: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26, lineHeight: 32 },
  small: { fontSize: 11.5, lineHeight: 15 },
  cardTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  price: { fontSize: 14.5, lineHeight: 19, fontWeight: '900', color: Brand.primary },
  old: { fontSize: 11, lineHeight: 15, color: '#8A8A8A', textDecorationLine: 'line-through' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  /* Abonnements */
  group: { gap: 8 },
  groupTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.2, color: Brand.primary, marginTop: 4 },
  listCard: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  followIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  /* Favoris / souhaits */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  pImg: { width: '100%', aspectRatio: 4 / 5, alignItems: 'center', justifyContent: 'center' },
  pEmoji: { fontSize: 36, lineHeight: 44 },
  promo: { position: 'absolute', top: 8, left: 8, backgroundColor: Brand.danger, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  promoText: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  pBody: { padding: 9, gap: 2 },
  pName: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', minHeight: 32 },
});
