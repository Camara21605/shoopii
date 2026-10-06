/**
 * Notifications de l'espace entreprise (cloche de l'en-tête entreprise).
 * Différent du centre de notifications du client : ici on GÈRE sa boutique.
 *   · bloc « À traiter » : nouvelles commandes, retours, ruptures / stocks bas,
 *     avis sans réponse — chaque case filtre la liste ;
 *   · filtres métier : Commandes · Retours · Stock · Avis · Paiements ·
 *     Boutique (favoris, abonnés, promotions) · Compte & équipe ;
 *   · chaque notification ouvre la rubrique de gestion concernée (écran
 *     natif s'il existe, sinon page du tableau de bord du site) ; l'action
 *     n'est proposée que si le collaborateur a la permission de la rubrique ;
 *   · marquer lu / tout lu / supprimer / tout effacer, plus anciennes au
 *     défilement (curseur), tirer pour actualiser — mêmes routes que le site.
 * Logique : ../notifications.ts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { useCompanyIdentity, usePermissions } from '../hooks';
import {
  actionLabel,
  categoryOf,
  COMPANY_FILTERS,
  isListed,
  isUrgent,
  metaOf,
  permissionFor,
  targetOf,
  type CompanyFilter,
} from '../notifications';

type Pages = InfiniteData<NotificationPage, string | null>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'À l’instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604_800) return `Il y a ${Math.floor(diff / 86_400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function groupByDate(list: AppNotification[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = start.getTime();
  const groups = [
    { title: 'Aujourd’hui', data: [] as AppNotification[] },
    { title: 'Hier', data: [] as AppNotification[] },
    { title: 'Cette semaine', data: [] as AppNotification[] },
    { title: 'Plus ancien', data: [] as AppNotification[] },
  ];
  for (const n of list) {
    const t = new Date(n.createdAt).getTime();
    groups[t >= today ? 0 : t >= today - 86_400_000 ? 1 : t >= today - 6 * 86_400_000 ? 2 : 3].data.push(n);
  }
  return groups.filter((g) => g.data.length > 0);
}

/* Cases du bloc « À traiter » : ce qui demande une action de la boutique */
const TODO: { key: CompanyFilter; label: string; icon: IconName; color: string; match: (n: AppNotification) => boolean }[] = [
  { key: 'commandes', label: 'Nouvelles commandes', icon: 'cube', color: '#059669', match: (n) => n.type === 'order.placed' },
  { key: 'retours', label: 'Retours demandés', icon: 'return-down-back', color: '#EA580C', match: (n) => n.type === 'return.requested' },
  { key: 'stock', label: 'Alertes de stock', icon: 'file-tray-stacked', color: '#DC2626', match: (n) => categoryOf(n) === 'stock' && n.type !== 'product.back_in_stock' },
  { key: 'avis', label: 'Avis à lire', icon: 'star', color: '#D97706', match: (n) => n.type === 'review.received' },
];

export default function CompanyNotificationsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const identity = useCompanyIdentity();
  const perms = usePermissions();
  const businessModel = identity.data?.businessModel ?? 'products';
  const [filter, setFilter] = useState<CompanyFilter>('all');
  /* La pastille du filtre actif reste visible (ex. choisi depuis le bloc « À traiter ») */
  const chipsRef = useRef<FlatList<(typeof COMPANY_FILTERS)[number]>>(null);
  useEffect(() => {
    const index = COMPANY_FILTERS.findIndex((f) => f.key === filter);
    if (index >= 0) chipsRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }, [filter]);
  const unreadOnly = filter === 'unread';
  const key = qk.notifications.list(unreadOnly);

  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchNotificationPage({ cursor: pageParam, unreadOnly }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? null) : undefined),
  });

  const all = useMemo(() => (list.data?.pages ?? []).flatMap((p) => p.data).filter(isListed), [list.data]);
  const shown = useMemo(
    () => (filter === 'all' || filter === 'unread' ? all : all.filter((n) => categoryOf(n) === filter)),
    [all, filter],
  );
  const sections = useMemo(() => groupByDate(shown), [shown]);
  const unread = all.filter((n) => !n.isRead);
  const countFor = (f: CompanyFilter) =>
    f === 'all' ? all.length : f === 'unread' ? unread.length : all.filter((n) => categoryOf(n) === f).length;
  const todo = TODO.map((t) => ({ ...t, count: unread.filter(t.match).length }));
  const todoTotal = todo.reduce((s, t) => s + t.count, 0);

  /* ── Cache : modification immédiate, puis compteurs (cloche + pastilles du menu) ── */
  function patchCache(fn: (n: AppNotification) => AppNotification | null) {
    qc.setQueriesData<Pages>({ queryKey: qk.notifications.all }, (old) =>
      old ? { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map(fn).filter((x): x is AppNotification => x !== null) })) } : old,
    );
  }
  const refreshCounts = () => {
    void qc.invalidateQueries({ queryKey: qk.notifications.unread });
    void qc.invalidateQueries({ queryKey: qk.company.badges });
  };

  function markRead(n: AppNotification) {
    if (n.isRead) return;
    patchCache((x) => (x.id === n.id ? { ...x, isRead: true } : x));
    void markNotificationRead(n.id).finally(refreshCounts);
  }

  /** Permission de la rubrique visée (le propriétaire peut tout). */
  function allowed(n: AppNotification) {
    const perm = permissionFor(targetOf(n, businessModel), businessModel);
    return !perm || perms.can(perm[0], perm[1]);
  }

  function open(n: AppNotification) {
    markRead(n);
    const t = targetOf(n, businessModel);
    if (!t) return;
    if (!allowed(n)) {
      Alert.alert('Accès réservé', 'Votre rôle dans l’équipe ne permet pas d’ouvrir cette rubrique. Demandez l’accès au propriétaire de la boutique.');
      return;
    }
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
    Alert.alert('Tout effacer ?', 'Toutes les notifications de la boutique seront supprimées définitivement.', [
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

  const header = all.length ? (
    <View style={styles.headBlock}>
      <View style={[styles.todo, { borderColor: theme.border }]}>
        <View style={styles.todoHead}>
          <View style={styles.flex}>
            <ThemedText style={styles.todoTitle}>{todoTotal ? 'À traiter' : 'Tout est traité'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {unread.length
                ? `${unread.length} notification${unread.length > 1 ? 's' : ''} non lue${unread.length > 1 ? 's' : ''}`
                : 'Aucune nouveauté à lire pour le moment.'}
            </ThemedText>
          </View>
          {unread.length ? (
            <Pressable onPress={() => void readAll()} style={styles.readAll} accessibilityRole="button" accessibilityLabel="Tout marquer comme lu">
              <Ionicons name="checkmark-done" size={16} color={Brand.primaryInk} />
              <ThemedText type="smallBold" style={styles.white}>
                Tout lu
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.todoGrid}>
          {todo.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setFilter(t.key)}
              accessibilityRole="button"
              accessibilityLabel={`${t.label} : ${t.count}`}
              style={({ pressed }) => [
                styles.todoCell,
                { backgroundColor: t.count ? `${t.color}14` : theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <View style={[styles.todoIco, { backgroundColor: t.count ? t.color : theme.border }]}>
                <Ionicons name={t.icon} size={15} color="#fff" />
              </View>
              <ThemedText style={[styles.todoCount, { color: t.count ? t.color : theme.textSecondary }]}>{t.count}</ThemedText>
              <ThemedText type="small" numberOfLines={2} style={{ color: t.count ? theme.text : theme.textSecondary }}>
                {t.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  ) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Notifications de la boutique"
        right={
          all.length ? (
            <Pressable onPress={clearAll} accessibilityRole="button" accessibilityLabel="Tout effacer" hitSlop={8}>
              <Ionicons name="trash-outline" size={22} color={theme.text} />
            </Pressable>
          ) : undefined
        }
      />

      <View style={[styles.filtersBar, { borderBottomColor: theme.border }]}>
        <FlatList
          ref={chipsRef}
          horizontal
          data={COMPANY_FILTERS}
          onScrollToIndexFailed={() => undefined}
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
                style={[styles.chip, on ? styles.chipOn : { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundElement }]}>
                <Ionicons name={item.icon} size={item.key === 'unread' ? 9 : 14} color={on ? Brand.primaryInk : item.key === 'unread' ? Brand.primary : theme.text} />
                <ThemedText type="smallBold" style={on ? styles.white : undefined}>
                  {item.label}
                </ThemedText>
                {n > 0 ? (
                  <View style={[styles.chipCount, { backgroundColor: on ? theme.background : theme.background }]}>
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
          ListHeaderComponent={filter === 'all' ? header : null}
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} colors={[Brand.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
          renderSectionHeader={({ section }) => <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>}
          renderItem={({ item }) => (
            <Row
              n={item}
              action={targetOf(item, businessModel) && allowed(item) ? actionLabel(item) : null}
              onOpen={() => open(item)}
              onMore={() => more(item)}
            />
          )}
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
                    ? 'Les nouvelles commandes, retours, alertes de stock, avis et paiements de votre boutique s’afficheront ici.'
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

function Row({ n, action, onOpen, onMore }: { n: AppNotification; action: string | null; onOpen: () => void; onMore: () => void }) {
  const theme = useTheme();
  const meta = metaOf(n);
  const img = thumb(n.imageUrl ?? n.actor?.avatar ?? null, 120);
  const urgent = isUrgent(n);

  return (
    <View style={[styles.row, !n.isRead && { backgroundColor: theme.backgroundSelected }]}>
      {!n.isRead ? <View style={[styles.accent, { backgroundColor: urgent ? meta.color : Brand.primary }]} /> : null}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${n.isRead ? '' : 'Non lue. '}${urgent ? 'À traiter. ' : ''}${n.title}`}
        style={({ pressed }) => [styles.rowTap, pressed && styles.pressed]}>
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
            <ThemedText numberOfLines={3} style={[styles.body, { color: theme.textSecondary }]}>
              {n.body}
            </ThemedText>
          ) : null}
          <View style={styles.metaRow}>
            {urgent ? (
              <View style={[styles.urgent, { backgroundColor: `${meta.color}1F` }]}>
                <ThemedText style={[styles.urgentText, { color: meta.color }]}>À traiter</ThemedText>
              </View>
            ) : null}
            <ThemedText style={[styles.cat, { color: meta.color }]}>{meta.label}</ThemedText>
            <ThemedText style={[styles.time, { color: theme.textSecondary }]}>· {relativeTime(n.createdAt)}</ThemedText>
          </View>
          {action ? (
            <View style={[styles.cta, urgent ? { backgroundColor: `${meta.color}1A`, borderColor: `${meta.color}55` } : { borderColor: `${meta.color}55` }]}>
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
  chipOn: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
  pressed: { opacity: 0.75 },
  loader: { marginTop: 60 },
  more: { marginVertical: Spacing.four },
  filtersBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  filters: { paddingHorizontal: Spacing.three, paddingVertical: 10, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingLeft: 12, paddingRight: 8, minHeight: 36 },
  chipCount: { borderRadius: 999, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' },
  chipCountText: { fontSize: 11, lineHeight: 17, fontWeight: '800' },
  list: { paddingBottom: Spacing.five, flexGrow: 1 },
  headBlock: { padding: Spacing.three, paddingBottom: 4 },
  todo: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  todoHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todoTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  readAll: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  todoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  todoCell: { flexBasis: '47%', flexGrow: 1, borderRadius: 14, padding: 10, gap: 4 },
  todoIco: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  todoCount: { fontSize: 22, lineHeight: 26, fontWeight: '900' },
  sectionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', paddingHorizontal: Spacing.three, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, paddingLeft: Spacing.three, paddingRight: 8 },
  accent: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  rowTap: { flex: 1, flexDirection: 'row', gap: 12 },
  leading: { width: 52, height: 52 },
  photo: { width: 52, height: 52, borderRadius: 26 },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  typeBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  titleUnread: { fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '600' },
  body: { marginTop: 2, fontSize: 13.5, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  urgent: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  urgentText: { fontSize: 11, lineHeight: 16, fontWeight: '800' },
  cat: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  time: { fontSize: 12, lineHeight: 16 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginTop: 8 },
  ctaText: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  side: { alignItems: 'center', gap: 14, width: 32, paddingTop: 2 },
  moreBtn: { padding: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 70, paddingHorizontal: Spacing.four },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
});
