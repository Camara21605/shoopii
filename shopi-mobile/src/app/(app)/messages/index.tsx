/**
 * Messagerie — liste des conversations (client, entreprise, livreur,
 * correspondant, partenaire… le contrôleur est le même pour tous les
 * rôles) : avatar + statut en ligne, dernier message, heure, non lus,
 * recherche locale. Toucher une conversation ouvre le fil de discussion
 * (messages/[id].tsx). Fond BLANC — pas de fond coloré/sombre, comme le
 * reste de l'application (voir hooks/use-theme.ts).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, initials } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { fetchConversationPage, markConversationRead, type Conversation, type ConversationPage } from '@/features/messagerie/api';
import { useConversationsRealtime } from '@/features/messagerie/realtime';
import { useTheme } from '@/hooks/use-theme';

type Pages = InfiniteData<ConversationPage, string | null>;

/** Petit texte relatif type messagerie : « 14:32 » aujourd'hui, « Hier », « Lun », sinon date courte. */
function messageTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (t >= startToday - 86_400_000) return 'Hier';
  if (t >= startToday - 6 * 86_400_000) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function MessagesScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  useConversationsRealtime();

  const list = useInfiniteQuery({
    queryKey: ['conversations'],
    queryFn: ({ pageParam }) => fetchConversationPage({ cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? null) : undefined),
  });

  const all = useMemo(() => (list.data?.pages ?? []).flatMap((p) => p.data), [list.data]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.contactName.toLowerCase().includes(q) || (c.lastMessage ?? '').toLowerCase().includes(q));
  }, [all, query]);

  function openConversation(c: Conversation) {
    if (c.unreadCount > 0) {
      qc.setQueriesData<Pages>({ queryKey: ['conversations'] }, (old) =>
        old
          ? { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)) })) }
          : old,
      );
      void markConversationRead(c.id)
        .catch(() => undefined)
        .finally(() => void qc.invalidateQueries({ queryKey: ['unread', 'messages'] }));
    }
    router.push({
      pathname: '/messages/[id]',
      params: { id: c.id, name: c.contactName, logo: c.contactLogo ?? '', online: c.contactOnline ? '1' : '0', userId: c.contactUserId ?? '' },
    });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Messages" />

      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher une conversation…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
          autoCorrect={false}
          accessibilityLabel="Rechercher une conversation"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {list.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} colors={[Brand.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => !query && list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
          renderItem={({ item }) => <ConversationRow c={item} onPress={() => openConversation(item)} />}
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.more} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="chatbubbles-outline" size={36} color={Brand.primary} />
              </View>
              <ThemedText style={styles.emptyTitle}>{query ? 'Aucun résultat' : 'Aucune conversation'}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {query
                  ? 'Aucune conversation ne correspond à cette recherche.'
                  : 'Écrivez à une boutique, un livreur ou un point relais depuis sa fiche — vos discussions apparaîtront ici.'}
              </ThemedText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function ConversationRow({ c, onPress }: { c: Conversation; onPress: () => void }) {
  const theme = useTheme();
  const logo = thumb(c.contactLogo, 120);
  const unread = c.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.contactName}${unread ? `, ${c.unreadCount} non lus` : ''}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
          {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.avatarText}>{initials(c.contactName)}</ThemedText>}
        </View>
        {c.contactOnline ? <View style={[styles.dot, { borderColor: theme.background }]} /> : null}
      </View>

      <View style={styles.flex}>
        <View style={styles.topLine}>
          <ThemedText numberOfLines={1} style={[styles.name, styles.flex]}>
            {c.pinned ? <Ionicons name="pin" size={12} color={theme.textSecondary} /> : null} {c.contactName}
          </ThemedText>
          <ThemedText style={[styles.time, unread && { color: Brand.primary }]}>{messageTime(c.lastMessageAt)}</ThemedText>
        </View>
        <View style={styles.topLine}>
          <ThemedText numberOfLines={1} type="small" themeColor={unread ? 'text' : 'textSecondary'} style={[styles.flex, unread && styles.previewUnread]}>
            {c.muted ? <Ionicons name="notifications-off" size={12} color={theme.textSecondary} /> : null} {c.lastMessage || 'Démarrez la conversation'}
          </ThemedText>
          {unread ? (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  loader: { marginTop: 60 },
  more: { marginVertical: Spacing.four },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, marginHorizontal: Spacing.three, marginTop: Spacing.two, marginBottom: Spacing.two },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  list: { paddingBottom: Spacing.five, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  avatarWrap: { width: 54, height: 54 },
  avatar: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: Brand.primary },
  dot: { position: 'absolute', right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2, backgroundColor: Brand.success },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  time: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  previewUnread: { fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 90, paddingHorizontal: Spacing.four },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
});
