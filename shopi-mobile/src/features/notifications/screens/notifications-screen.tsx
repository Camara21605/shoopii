/**
 * Centre de notifications — même contenu et même logique que celui du site
 * (NotificationCenter.tsx + notificationUtils.ts), en plein écran, version soignée :
 *   · bandeau de synthèse (non lues / à jour) + « Tout marquer comme lu »
 *   · filtres avec icône et compteur : Toutes · Non lues · Commandes · Produits ·
 *     Promotions · Compte
 *   · regroupées par date (Aujourd'hui · Hier · Cette semaine · Plus ancien)
 *   · ligne : photo de l'expéditeur ou icône colorée du type, titre (gras si
 *     non lue), texte, « catégorie · il y a 4 min », bouton d'action adapté
 *     (« Suivre la commande », « Voir l'offre »…), menu ⋯ (lue / supprimer)
 *   · toucher = marquée lue + ouverture de la bonne page ; tout effacer ;
 *     chargement des plus anciennes en bas (curseur), tirer pour actualiser
 * Les messages de discussion (message.*) n'apparaissent pas ici : leur
 * compteur est sur le bouton 💬 (comme sur le site).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { openSite } from '@/features/catalog/open';
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotificationPage,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationPage,
} from '@/features/notifications/api';
import { categoryOf, groupByDate, relativeTime, targetOf, typeMeta, type NotifFilter } from '@/features/notifications/meta';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

type Pages = InfiniteData<NotificationPage, string | null>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Category = Exclude<NotifFilter, 'all' | 'unread'>;

/* Les messages vont dans la messagerie : pas de filtre « Messages » ici. */
const FILTERS: { key: NotifFilter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'Toutes', icon: 'albums-outline' },
  { key: 'unread', label: 'Non lues', icon: 'ellipse' },
  { key: 'order', label: 'Commandes', icon: 'cube-outline' },
  { key: 'product', label: 'Produits', icon: 'pricetags-outline' },
  { key: 'promo', label: 'Promotions', icon: 'flash-outline' },
  { key: 'account', label: 'Compte', icon: 'shield-checkmark-outline' },
];

/** Libellé affiché sous la notification : par type précis (pas seulement par filtre). */
const TYPE_LABEL: Record<string, string> = {
  order: 'Commande',
  delivery: 'Livraison',
  colis: 'Colis',
  payment: 'Paiement',
  message: 'Message',
  conversation: 'Message',
  call: 'Appel',
  group_call: 'Appel',
  follow: 'Abonnement',
  product: 'Produit',
  stock: 'Stock',
  review: 'Avis',
  promo: 'Promotion',
  account: 'Sécurité',
  support: 'Aide',
};
const CATEGORY_LABEL: Record<Category, string> = { order: 'Commande', message: 'Message', product: 'Produit', promo: 'Promotion', account: 'Compte' };
const labelOf = (type: string) => TYPE_LABEL[type.split('.')[0]] ?? CATEGORY_LABEL[categoryOf(type)];

/** Bouton d'action proposé sous la notification, selon ce qu'elle ouvre. */
function actionLabel(n: AppNotification): string | null {
  const p = n.type.split('.')[0];
  if (!targetOf(n)) return null;
  if (p === 'order' || p === 'delivery' || p === 'colis') return 'Suivre la commande';
  if (p === 'payment') return n.payload?.commandeId ? 'Voir la commande' : 'Voir le détail';
  if (p === 'promo') return 'Voir l’offre';
  if (p === 'review') return 'Donner mon avis';
  if (p === 'product' || p === 'stock') return 'Voir le produit';
  if (p === 'follow') return 'Voir';
  if (p === 'support') return 'Ouvrir l’aide';
  if (p === 'account') return 'Vérifier';
  return 'Ouvrir';
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<NotifFilter>('all');
  const unreadOnly = filter === 'unread';
  const key = qk.notifications.list(unreadOnly);

  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchNotificationPage({ cursor: pageParam, unreadOnly }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? null) : undefined),
  });

  const all = useMemo(
    () => (list.data?.pages ?? []).flatMap((p) => p.data).filter((n) => !n.type.startsWith('message')),
    [list.data],
  );
  const shown = useMemo(
    () => (filter === 'all' || filter === 'unread' ? all : all.filter((n) => categoryOf(n.type) === filter)),
    [all, filter],
  );
  const sections = useMemo(() => groupByDate(shown), [shown]);
  const unreadCount = all.filter((n) => !n.isRead).length;
  const countFor = (f: NotifFilter) =>
    f === 'all' ? all.length : f === 'unread' ? unreadCount : all.filter((n) => categoryOf(n.type) === f).length;

  /** Modifie la liste en cache (toutes les variantes) sans attendre le serveur. */
  function patchCache(fn: (n: AppNotification) => AppNotification | null) {
    qc.setQueriesData<Pages>({ queryKey: qk.notifications.all }, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p) => ({ ...p, data: p.data.map(fn).filter((x): x is AppNotification => x !== null) })),
          }
        : old,
    );
  }
  const refreshCounts = () => void qc.invalidateQueries({ queryKey: qk.notifications.unread });

  function markRead(n: AppNotification) {
    if (n.isRead) return;
    patchCache((x) => (x.id === n.id ? { ...x, isRead: true } : x));
    void markNotificationRead(n.id).finally(refreshCounts);
  }

  function open(n: AppNotification) {
    markRead(n);
    const t = targetOf(n);
    if (!t) return;
    if ('app' in t) router.push(t.app);
    else if (t.web.startsWith('http')) void WebBrowser.openBrowserAsync(t.web);
    else openSite(t.web);
  }

  function remove(n: AppNotification) {
    patchCache((x) => (x.id === n.id ? null : x));
    void deleteNotification(n.id)
      .catch(() => void list.refetch())
      .finally(refreshCounts);
  }

  const more = (n: AppNotification) =>
    Alert.alert(n.title, undefined, [
      ...(!n.isRead ? [{ text: 'Marquer comme lue', onPress: () => markRead(n) }] : []),
      { text: 'Supprimer', style: 'destructive' as const, onPress: () => remove(n) },
      { text: 'Annuler', style: 'cancel' as const },
    ]);

  async function readAll() {
    patchCache((x) => ({ ...x, isRead: true }));
    await markAllNotificationsRead().catch(() => void list.refetch());
    refreshCounts();
  }

  const clearAll = () =>
    Alert.alert('Tout effacer ?', 'Toutes vos notifications seront supprimées définitivement.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Tout effacer',
        style: 'destructive',
        onPress: async () => {
          patchCache(() => null);
          await deleteAllNotifications().catch(() => void list.refetch());
          refreshCounts();
        },
      },
    ]);

  const summary = (
    <View style={[styles.summary, { backgroundColor: unreadCount ? theme.backgroundSelected : theme.backgroundElement }]}>
      <View style={[styles.summaryIco, { backgroundColor: unreadCount ? Brand.primarySoft : Brand.success }]}>
        <Ionicons name={unreadCount ? 'notifications' : 'checkmark-done'} size={20} color={unreadCount ? Brand.primaryInk : '#fff'} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.summaryTitle}>
          {unreadCount ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}` : 'Vous êtes à jour'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {unreadCount ? 'Touchez une notification pour l’ouvrir.' : 'Aucune nouveauté à lire pour le moment.'}
        </ThemedText>
      </View>
      {unreadCount ? (
        <Pressable onPress={() => void readAll()} style={styles.summaryBtn} accessibilityRole="button" accessibilityLabel="Tout marquer comme lu">
          <ThemedText type="smallBold" style={styles.white}>
            Tout lu
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Notifications"
        right={
          all.length ? (
            <Pressable onPress={clearAll} accessibilityRole="button" accessibilityLabel="Tout effacer" hitSlop={8}>
              <Ionicons name="trash-outline" size={22} color={theme.text} />
            </Pressable>
          ) : undefined
        }
      />

      {/* Filtres */}
      <View style={[styles.filtersBar, { borderBottomColor: theme.border }]}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const on = item.key === filter;
            const n = countFor(item.key);
            return (
              <Pressable
                onPress={() => setFilter(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.chip, { backgroundColor: on ? Brand.primarySoft : theme.backgroundElement }]}>
                <Ionicons name={item.icon} size={item.key === 'unread' ? 9 : 14} color={on ? Brand.primaryInk : item.key === 'unread' ? Brand.primary : theme.text} />
                <ThemedText type="smallBold" style={on ? styles.white : undefined}>
                  {item.label}
                </ThemedText>
                {n > 0 ? (
                  <View style={[styles.chipCount, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : theme.background }]}>
                    <ThemedText style={[styles.chipCountText, on && styles.white]}>{n}</ThemedText>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>

      {list.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={all.length ? summary : null}
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} colors={[Brand.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
          renderSectionHeader={({ section }) => <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>}
          renderItem={({ item }) => <NotificationRow n={item} onOpen={() => open(item)} onMore={() => more(item)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name={unreadOnly ? 'checkmark-done' : 'notifications-off-outline'} size={36} color={Brand.primary} />
              </View>
              <ThemedText style={styles.emptyTitle}>{unreadOnly ? 'Tout est lu 🎉' : 'Aucune notification'}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {unreadOnly
                  ? 'Vous n’avez aucune notification non lue.'
                  : filter === 'all'
                    ? 'Vos commandes, livraisons, promotions et nouvelles de vos boutiques s’afficheront ici.'
                    : 'Rien dans cette catégorie pour le moment.'}
              </ThemedText>
            </View>
          }
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator color={Brand.primary} style={styles.more} />
            ) : all.length && !list.hasNextPage ? (
              <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.more]}>
                Vous avez tout vu
              </ThemedText>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ n, onOpen, onMore }: { n: AppNotification; onOpen: () => void; onMore: () => void }) {
  const theme = useTheme();
  const meta = typeMeta(n.type);
  const img = thumb(n.imageUrl ?? n.actor?.avatar ?? null, 120);
  const action = actionLabel(n);
  const cat = labelOf(n.type);

  return (
    <View style={[styles.row, !n.isRead && { backgroundColor: theme.backgroundSelected }]}>
      {!n.isRead ? <View style={styles.accent} /> : null}
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${n.isRead ? '' : 'Non lue. '}${n.title}`} style={({ pressed }) => [styles.rowTap, pressed && styles.pressed]}>
        <View style={styles.leading}>
          {img ? (
            <>
              <Image source={{ uri: img }} style={styles.photo} contentFit="cover" />
              <View style={[styles.typeBadge, { backgroundColor: meta.color, borderColor: theme.background }]}>
                <Ionicons name={meta.icon} size={11} color="#fff" />
              </View>
            </>
          ) : (
            <View style={[styles.tile, { backgroundColor: `${meta.color}1A` }]}>
              <Ionicons name={meta.icon} size={22} color={meta.color} />
            </View>
          )}
        </View>
        <View style={styles.flex}>
          <ThemedText numberOfLines={2} style={[styles.title, !n.isRead && styles.titleUnread]}>
            {n.title}
            {n.count > 1 ? <ThemedText themeColor="textSecondary" style={styles.count}> · {n.count}</ThemedText> : null}
          </ThemedText>
          {n.body ? (
            <ThemedText numberOfLines={2} style={[styles.body, { color: theme.textSecondary }]}>
              {n.body}
            </ThemedText>
          ) : null}
          <View style={styles.metaRow}>
            <ThemedText style={[styles.cat, { color: meta.color }]}>{cat}</ThemedText>
            <ThemedText style={[styles.time, { color: theme.textSecondary }]}>· {relativeTime(n.createdAt)}</ThemedText>
          </View>
          {action ? (
            <View style={[styles.cta, { borderColor: `${meta.color}55` }]}>
              <ThemedText style={[styles.ctaText, { color: meta.color }]}>{action}</ThemedText>
              <Ionicons name="arrow-forward" size={13} color={meta.color} />
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.side}>
        <Pressable onPress={onMore} accessibilityRole="button" accessibilityLabel="Options de la notification" hitSlop={10} style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
        </Pressable>
        {!n.isRead ? <View style={styles.dot} accessibilityLabel="Non lue" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  white: { color: Brand.primaryInk },
  pressed: { opacity: 0.75 },
  loader: { marginTop: 60 },
  more: { marginVertical: Spacing.four },
  filtersBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  filters: { paddingHorizontal: Spacing.three, paddingVertical: 10, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingLeft: 12, paddingRight: 8, minHeight: 36 },
  chipCount: { borderRadius: 999, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' },
  chipCountText: { fontSize: 11, lineHeight: 17, fontWeight: '800' },
  list: { paddingBottom: Spacing.five, flexGrow: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: Spacing.three, marginBottom: 4, borderRadius: 16, padding: 12 },
  summaryIco: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  summaryBtn: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  sectionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', paddingHorizontal: Spacing.three, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingLeft: Spacing.three, paddingRight: 8 },
  accent: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: Brand.primary },
  rowTap: { flex: 1, flexDirection: 'row', gap: 12 },
  leading: { width: 52, height: 52 },
  photo: { width: 52, height: 52, borderRadius: 26 },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  typeBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  titleUnread: { fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '600' },
  body: { marginTop: 2, fontSize: 13.5, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  cat: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  time: { fontSize: 12, lineHeight: 16 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginTop: 8 },
  ctaText: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  side: { alignItems: 'center', gap: 14, width: 32, paddingTop: 2 },
  moreBtn: { padding: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 70, paddingHorizontal: Spacing.four },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
});
