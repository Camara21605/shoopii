/**
 * Centre de notifications — même contenu et même logique que celui du site
 * (NotificationCenter.tsx + notificationUtils.ts), en plein écran :
 *   · filtres : Toutes · Non lues · Commandes · Messages · Produits · Promotions · Compte
 *   · regroupées par date (Aujourd'hui · Hier · Cette semaine · Plus ancien)
 *   · avatar (image ou initiale) + pastille d'icône colorée par type
 *   · toucher = marquée lue + ouverture de la bonne page (suivi de commande,
 *     messagerie, produit…), ✕ = suppression
 *   · « Tout marquer lu », « Tout effacer », chargement des plus anciennes
 *     en bas de liste (curseur), tirer pour actualiser
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
import { FILTERS, categoryOf, groupByDate, relativeTime, targetOf, typeMeta, type NotifFilter } from '@/features/notifications/meta';
import { useTheme } from '@/hooks/use-theme';

type Pages = InfiniteData<NotificationPage, string | null>;

export default function NotificationsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<NotifFilter>('all');
  const unreadOnly = filter === 'unread';
  const key = ['notifications', unreadOnly] as const;

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

  /** Modifie la liste en cache (toutes les variantes) sans attendre le serveur. */
  function patchCache(fn: (n: AppNotification) => AppNotification | null) {
    qc.setQueriesData<Pages>({ queryKey: ['notifications'] }, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p) => ({ ...p, data: p.data.map(fn).filter((x): x is AppNotification => x !== null) })),
          }
        : old,
    );
  }
  const refreshCounts = () => void qc.invalidateQueries({ queryKey: ['unread', 'notifications'] });

  function open(n: AppNotification) {
    if (!n.isRead) {
      patchCache((x) => (x.id === n.id ? { ...x, isRead: true } : x));
      void markNotificationRead(n.id).finally(refreshCounts);
    }
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <Pressable onPress={() => void readAll()} accessibilityRole="button" accessibilityLabel="Tout marquer comme lu" hitSlop={8} style={styles.headBtn}>
              <Ionicons name="checkmark-done" size={20} color={Brand.primary} />
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Tout lu
              </ThemedText>
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
            const badge = item.key === 'unread' && unreadCount > 0 ? ` ${unreadCount}` : '';
            return (
              <Pressable
                onPress={() => setFilter(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on ? { backgroundColor: Brand.primary, borderColor: Brand.primary } : { borderColor: theme.border }]}>
                <ThemedText type="smallBold" style={on ? { color: '#fff' } : undefined}>
                  {item.label}
                  {badge}
                </ThemedText>
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
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} colors={[Brand.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <View style={styles.dash} />
              <ThemedText style={styles.sectionTitle}>{section.title.toUpperCase()}</ThemedText>
            </View>
          )}
          renderItem={({ item }) => <NotificationRow n={item} onOpen={() => open(item)} onDelete={() => remove(item)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="notifications-off-outline" size={36} color={Brand.primary} />
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
            ) : all.length > 0 && filter === 'all' ? (
              <Pressable onPress={clearAll} accessibilityRole="button" style={styles.clearAll}>
                <Ionicons name="trash-outline" size={16} color={Brand.danger} />
                <ThemedText type="smallBold" style={{ color: Brand.danger }}>
                  Tout effacer
                </ThemedText>
              </Pressable>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ n, onOpen, onDelete }: { n: AppNotification; onOpen: () => void; onDelete: () => void }) {
  const theme = useTheme();
  const meta = typeMeta(n.type);
  const img = thumb(n.imageUrl ?? n.actor?.avatar ?? null, 120);

  return (
    <View style={[styles.row, { backgroundColor: n.isRead ? theme.background : theme.backgroundSelected, borderColor: n.isRead ? theme.border : 'transparent' }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${n.isRead ? '' : 'Non lue. '}${n.title}`} style={styles.rowTap}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: `${meta.color}1F` }]}>
            {img ? (
              <Image source={{ uri: img }} style={styles.fill} contentFit="cover" />
            ) : (
              <ThemedText style={[styles.initial, { color: meta.color }]}>{n.title.charAt(0).toUpperCase()}</ThemedText>
            )}
          </View>
          <View style={[styles.typeBadge, { backgroundColor: meta.color, borderColor: theme.background }]}>
            <Ionicons name={meta.icon} size={11} color="#fff" />
          </View>
        </View>
        <View style={styles.flex}>
          <ThemedText numberOfLines={2} style={[styles.title, !n.isRead && styles.titleUnread]}>
            {n.title}
            {n.count > 1 ? <ThemedText themeColor="textSecondary" style={styles.count}> ({n.count})</ThemedText> : null}
          </ThemedText>
          {n.body ? (
            <ThemedText numberOfLines={3} type="small" themeColor="textSecondary" style={styles.body}>
              {n.body}
            </ThemedText>
          ) : null}
          <ThemedText style={[styles.time, { color: n.isRead ? theme.textSecondary : meta.color }]}>{relativeTime(n.createdAt)}</ThemedText>
        </View>
      </Pressable>
      <View style={styles.side}>
        {!n.isRead ? <View style={styles.dot} /> : <View style={styles.dotSpace} />}
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Supprimer la notification" hitSlop={10} style={styles.del}>
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  loader: { marginTop: 60 },
  more: { marginVertical: Spacing.four },
  headBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filtersBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  filters: { paddingHorizontal: Spacing.three, paddingVertical: 12, gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five, flexGrow: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: Spacing.four, paddingBottom: 10 },
  dash: { width: 18, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  sectionTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', letterSpacing: 1.5, color: Brand.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 16, marginBottom: 8, paddingVertical: 12, paddingLeft: 12, paddingRight: 6 },
  rowTap: { flex: 1, flexDirection: 'row', gap: 12 },
  avatarWrap: { width: 48, height: 48 },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  typeBadge: { position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, lineHeight: 19, fontWeight: '600' },
  titleUnread: { fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '500' },
  body: { marginTop: 2, lineHeight: 19 },
  time: { fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  side: { alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingLeft: 4, width: 30 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.primary, marginTop: 4 },
  dotSpace: { height: 14 },
  del: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 70, paddingHorizontal: Spacing.four },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  clearAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.four },
});
