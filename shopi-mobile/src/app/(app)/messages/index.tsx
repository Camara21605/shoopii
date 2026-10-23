/**
 * Messagerie — liste des discussions (client, entreprise, livreur,
 * correspondant, partenaire… le contrôleur est le même pour tous les rôles).
 *
 *   ligne 1 : ← Messages ·········· 🔍 (recherche)  ⚙ (paramètres généraux)
 *   ligne 2 : 4 boutons — Entreprises proches · Livreurs proches · En ligne ·
 *             Stories (bientôt) — et la bande de photos du bouton choisi
 *             (features/messagerie/components/discover-strip.tsx) ; toucher
 *             une photo ouvre (ou démarre) la discussion
 *   filtres : Tous · Non lus · Groupes · Contacts (répertoire du téléphone :
 *             qui, parmi mes contacts, est sur Shoneya — features/contacts)
 *   liste   : conversations privées ET groupes, mélangés par date du dernier message
 *
 * La recherche (🔍) filtre les discussions et groupes déjà ouverts, et à
 * partir de 2 caractères cherche aussi dans tout l'annuaire Shoneya (nom ou
 * numéro) pour écrire à quelqu'un de nouveau. Fond BLANC, comme le reste de
 * l'application (voir hooks/use-theme.ts).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { ContactsPanel } from '@/features/contacts/components/contacts-panel';
import { useAutoContactsSync, useContactsSync, useShoneyaContacts } from '@/features/contacts/hooks';
import { thumb } from '@/features/catalog/format';
import {
  fetchConversationPage, fetchMessagePage, markConversationRead, openConversationWith, searchUsers,
  type ActorType, type Conversation, type ConversationPage, type SearchUser,
} from '@/features/messagerie/api';
import { DiscoverStrip, type StripPerson } from '@/features/messagerie/components/discover-strip';
import { fetchGroupMessages, fetchGroups, groupTitle, orderGroupStatus, type Group } from '@/features/messagerie/groups-api';
import { Avatar } from '@/features/messagerie/MemberPicker';
import { useConversationsRealtime } from '@/features/messagerie/realtime';
import { useTypingIn } from '@/features/messagerie/sync';
import { PresenceDot, useKnownPresence } from '@/features/presence';
import { useTheme } from '@/hooks/use-theme';

type Pages = InfiniteData<ConversationPage, string | null>;
type Filter = 'all' | 'unread' | 'groups' | 'contacts';
type Row = { kind: 'conv'; c: Conversation; at: string } | { kind: 'group'; g: Group; at: string };

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

function openChat(c: Conversation) {
  router.push({
    pathname: '/messages/[id]',
    params: { id: c.id, name: c.contactName, logo: c.contactLogo ?? '', online: c.contactOnline ? '1' : '0', presence: c.contactPresence ?? '', userId: c.contactUserId ?? '' },
  });
}

export default function MessagesScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [opening, setOpening] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  useConversationsRealtime();
  useAutoContactsSync();
  const contactsSync = useContactsSync();
  const phoneContacts = useShoneyaContacts(contactsSync.enabled);

  const list = useInfiniteQuery({
    queryKey: ['conversations'],
    queryFn: ({ pageParam }) => fetchConversationPage({ cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? null) : undefined),
  });
  const groups = useQuery({ queryKey: ['groups'], queryFn: fetchGroups });
  /* Contacts liés (commandes, abonnements…) avec leur statut en ligne — rafraîchi toutes les 45 s. */
  const contacts = useQuery({ queryKey: ['msg-user-search', ''], queryFn: ({ signal }) => searchUsers('', signal), staleTime: 30_000, refetchInterval: 45_000 });

  const conversations = useMemo(() => (list.data?.pages ?? []).flatMap((p) => p.data), [list.data]);
  const groupList = useMemo(() => groups.data ?? [], [groups.data]);

  /* Préchargement des fils les plus récents (6 discussions, 4 groupes) : ils
   * s'ouvrent instantanément. Déjà en mémoire → rien n'est redemandé. */
  useEffect(() => {
    for (const c of conversations.slice(0, 6)) {
      if (qc.getQueryData(['messages', c.id])) continue;
      void qc.prefetchInfiniteQuery({
        queryKey: ['messages', c.id],
        queryFn: ({ pageParam }) => fetchMessagePage(c.id, { cursor: pageParam }),
        initialPageParam: null as string | null,
      });
    }
    for (const g of groupList.slice(0, 4)) {
      if (qc.getQueryData(['group-messages', g.id])) continue;
      void qc.prefetchInfiniteQuery({
        queryKey: ['group-messages', g.id],
        queryFn: ({ pageParam }) => fetchGroupMessages(g.id, pageParam),
        initialPageParam: 1,
      });
    }
  }, [conversations, groupList, qc]);

  /* Personnes EN LIGNE (bouton « En ligne » de l'en-tête) : conversations, répertoire, contacts liés */
  const onlinePeople = useMemo<StripPerson[]>(() => {
    const seen = new Set<string>();
    const out: StripPerson[] = [];
    const push = (p: StripPerson) => { if (!seen.has(p.key)) { seen.add(p.key); out.push(p); } };
    for (const c of conversations) {
      if (c.contactOnline) push({ key: `${c.contactType}:${c.contactId}`, type: c.contactType as ActorType, id: c.contactId, name: c.contactName, logo: c.contactLogo ?? null, online: true, distanceKm: null });
    }
    for (const u of phoneContacts.data?.contacts ?? []) {
      if (u.online) push({ key: `${u.type}:${u.id}`, type: u.type, id: u.id, name: u.localName || u.name, logo: u.logo, online: true, distanceKm: null });
    }
    for (const u of contacts.data ?? []) {
      if (u.online) push({ key: `${u.type}:${u.id}`, type: u.type as ActorType, id: u.id, name: u.name, logo: u.logo ?? null, online: true, distanceKm: null });
    }
    return out;
  }, [conversations, phoneContacts.data, contacts.data]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const convRows: Row[] = filter === 'groups' ? [] : conversations
      .filter((c) => filter !== 'unread' || c.unreadCount > 0)
      .filter((c) => !q || c.contactName.toLowerCase().includes(q) || (c.lastMessage ?? '').toLowerCase().includes(q))
      .map((c) => ({ kind: 'conv', c, at: c.lastMessageAt ?? '' }));
    const groupRows: Row[] = groupList
      .filter((g) => filter !== 'unread' || g.unreadCount > 0)
      .filter((g) => !q || groupTitle(g).toLowerCase().includes(q) || (g.lastMessage ?? '').toLowerCase().includes(q))
      .map((g) => ({ kind: 'group', g, at: g.lastMessageAt ?? g.createdAt ?? '' }));
    return [...convRows, ...groupRows].sort((a, b) => b.at.localeCompare(a.at));
  }, [conversations, groupList, filter, query]);

  /* Recherche dans tout l'annuaire (≥ 2 caractères), anti-rebond 300 ms. */
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const directory = useQuery({
    queryKey: ['msg-user-search', debounced],
    queryFn: ({ signal }) => searchUsers(debounced, signal),
    enabled: searching && debounced.length >= 2,
    staleTime: 60_000,
  });
  const knownKeys = useMemo(() => new Set(conversations.map((c) => `${c.contactType}:${c.contactId}`)), [conversations]);
  const directoryHits = searching && debounced.length >= 2 ? (directory.data ?? []).filter((u) => !knownKeys.has(`${u.type}:${u.id}`)) : [];

  const unreadTotal = conversations.filter((c) => c.unreadCount > 0).length + groupList.filter((g) => g.unreadCount > 0).length;

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
    openChat(c);
  }

  function openGroup(g: Group) {
    if (g.unreadCount > 0) qc.setQueryData<Group[]>(['groups'], (old) => old?.map((x) => (x.id === g.id ? { ...x, unreadCount: 0 } : x)));
    router.push({ pathname: '/messages/groupe/[id]', params: { id: g.id, name: groupTitle(g), photo: g.photoUrl ?? '' } });
  }

  /** Ouvre la discussion avec une personne (existante ou nouvelle — le serveur renvoie la même si elle existe déjà). */
  async function startWith(type: ActorType, id: string) {
    const key = `${type}:${id}`;
    const existing = conversations.find((c) => `${c.contactType}:${c.contactId}` === key);
    if (existing) { openConversation(existing); return; }
    if (opening) return;
    setOpening(key);
    try {
      const conv = await openConversationWith(type, id);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      openChat(conv);
    } catch (err) {
      Alert.alert('Impossible d’ouvrir la discussion', err instanceof Error ? err.message : 'Réessayez dans un instant.');
    } finally {
      setOpening(null);
    }
  }

  function closeSearch() {
    setSearching(false);
    setQuery('');
  }

  const refreshing = (list.isRefetching && !list.isFetchingNextPage) || groups.isRefetching;
  function refreshAll() {
    void list.refetch();
    void groups.refetch();
    void contacts.refetch();
    if (contactsSync.enabled) void phoneContacts.refetch();
    void qc.invalidateQueries({ queryKey: ['msg-nearest'] });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {/* ── Ligne 1 : titre + recherche + paramètres généraux ── */}
      <View style={styles.header}>
        {searching ? (
          <>
            <Pressable onPress={closeSearch} accessibilityRole="button" accessibilityLabel="Fermer la recherche" hitSlop={10} style={styles.headIcon}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Ionicons name="search" size={17} color={theme.textSecondary} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder="Discussion, groupe, nom ou numéro…"
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Rechercher"
              />
              {query ? (
                <Pressable onPress={() => { setQuery(''); inputRef.current?.focus(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={styles.headIcon}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.title} numberOfLines={1} accessibilityRole="header">Messages</ThemedText>
            <Pressable onPress={() => setSearching(true)} accessibilityRole="button" accessibilityLabel="Rechercher" hitSlop={6} style={[styles.roundBtn, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="search" size={20} color={theme.text} />
            </Pressable>
            <Pressable onPress={() => router.push('/messages/parametres')} accessibilityRole="button" accessibilityLabel="Paramètres de la messagerie" hitSlop={6} style={[styles.roundBtn, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="settings-outline" size={20} color={theme.text} />
            </Pressable>
          </>
        )}
      </View>

      {/* ── Ligne 2 : Entreprises proches · Livreurs proches · En ligne · Stories ── */}
      {!searching ? <DiscoverStrip online={onlinePeople} opening={opening} onOpen={(p) => void startWith(p.type, p.id)} /> : null}

      {/* ── Filtres ── */}
      {!searching || filter === 'contacts' ? (
        <View style={styles.filters}>
          <Chip label="Tous" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label={unreadTotal ? `Non lus · ${unreadTotal}` : 'Non lus'} active={filter === 'unread'} onPress={() => setFilter('unread')} />
          <Chip label={groupList.length ? `Groupes · ${groupList.length}` : 'Groupes'} active={filter === 'groups'} onPress={() => setFilter('groups')} />
          <Chip label="Contacts" active={filter === 'contacts'} onPress={() => setFilter('contacts')} />
        </View>
      ) : null}
      <View style={[styles.sep, { backgroundColor: theme.border }]} />

      {filter === 'contacts' ? (
        <ContactsPanel query={query} opening={opening} onOpen={(c) => void startWith(c.type, c.id)} />
      ) : list.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => (r.kind === 'conv' ? `c-${r.c.id}` : `g-${r.g.id}`)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} colors={[Brand.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => !query && list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
          renderItem={({ item }) =>
            item.kind === 'conv'
              ? <ConversationRow c={item.c} onPress={() => openConversation(item.c)} />
              : <GroupRow g={item.g} onPress={() => openGroup(item.g)} />
          }
          ListFooterComponent={
            <>
              {list.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.more} /> : null}
              {searching && debounced.length >= 2 ? (
                <View>
                  <ThemedText style={styles.sectionTitle}>AUTRES PERSONNES SUR SHONEYA</ThemedText>
                  {directory.isFetching && !directory.data ? <ActivityIndicator color={Brand.primary} style={styles.more} /> : null}
                  {directoryHits.map((u) => (
                    <DirectoryRow key={`${u.type}:${u.id}`} u={u} busy={opening === `${u.type}:${u.id}`} onPress={() => void startWith(u.type as ActorType, u.id)} />
                  ))}
                  {!directory.isFetching && directoryHits.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.dirEmpty}>Aucune autre personne trouvée.</ThemedText>
                  ) : null}
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            searching && debounced.length >= 2 ? null : (
              <View style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}>
                  <Ionicons name={filter === 'groups' ? 'people-outline' : 'chatbubbles-outline'} size={36} color={Brand.primary} />
                </View>
                <ThemedText style={styles.emptyTitle}>
                  {query ? 'Aucun résultat' : filter === 'groups' ? 'Aucun groupe' : filter === 'unread' ? 'Tout est lu' : 'Aucune conversation'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.center}>
                  {query
                    ? 'Tapez au moins 2 caractères pour chercher dans tout Shoneya.'
                    : filter === 'groups'
                      ? 'Créez un groupe depuis ⚙ Paramètres pour discuter à plusieurs.'
                      : filter === 'unread'
                        ? 'Aucun message non lu.'
                        : 'Écrivez à une boutique, un livreur ou un point relais depuis sa fiche — ou touchez 🔍 pour chercher quelqu’un.'}
                </ThemedText>
                {filter === 'groups' && !query ? (
                  <Pressable onPress={() => router.push('/messages/nouveau-groupe')} accessibilityRole="button" style={styles.emptyBtn}>
                    <Ionicons name="add" size={18} color={Brand.primaryInk} />
                    <ThemedText style={styles.emptyBtnText}>Créer un groupe</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? styles.chipOn : { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={[styles.chipText, active && styles.chipTextOn]}>{label}</ThemedText>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Lignes de la liste
// ─────────────────────────────────────────────────────────────

function ConversationRow({ c, onPress }: { c: Conversation; onPress: () => void }) {
  const theme = useTheme();
  const logo = thumb(c.contactLogo, 120);
  const unread = c.unreadCount > 0;
  const presence = useKnownPresence(c.contactUserId, {
    status: c.contactPresence ?? (c.contactOnline ? 'online' : 'offline'),
    lastSeen: c.contactLastSeen ?? null,
    reachableUntil: c.contactReachableUntil ?? null,
  });
  const stateLabel = presence.status === 'online' ? ', en ligne' : presence.status === 'reachable' ? ', joignable' : '';
  /* « écrit… » en vert à la place du dernier message, comme WhatsApp */
  const typing = useTypingIn(c.id);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.contactName}${stateLabel}${unread ? `, ${c.unreadCount} non lus` : ''}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
          {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.avatarText}>{initials(c.contactName)}</ThemedText>}
        </View>
        <PresenceDot status={presence.status} size={14} style={styles.dotPos} />
      </View>
      <RowText
        title={c.contactName}
        pinned={c.pinned}
        muted={c.muted}
        preview={typing ?? (c.lastMessage || 'Démarrez la conversation')}
        live={!!typing}
        at={c.lastMessageAt}
        unreadCount={c.unreadCount}
      />
    </Pressable>
  );
}

function GroupRow({ g, onPress }: { g: Group; onPress: () => void }) {
  const theme = useTheme();
  const photo = thumb(g.photoUrl, 120);
  const title = groupTitle(g);
  const closed = g.status === 'expired' || g.status === 'cancelled';
  const myId = useSession((st) => st.user?.id);
  const othersOnline = g.onlineUserIds.filter((u) => u !== myId).length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Groupe ${title}${g.unreadCount ? `, ${g.unreadCount} non lus` : ''}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: g.kind === 'order' ? '#FFF4E5' : theme.backgroundSelected }]}>
          {photo
            ? <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" />
            : <Ionicons name={g.kind === 'order' ? 'cube' : 'people'} size={24} color={g.kind === 'order' ? '#D97706' : Brand.primary} />}
        </View>
        {othersOnline > 0 ? (
          <View style={[styles.groupOnline, { borderColor: theme.background }]}>
            <ThemedText style={styles.groupOnlineText}>{othersOnline}</ThemedText>
          </View>
        ) : null}
      </View>
      <RowText
        title={title}
        icon={g.kind === 'order' ? 'cube-outline' : 'people-outline'}
        preview={closed ? (g.status === 'cancelled' ? 'Commande annulée — groupe fermé' : 'Groupe expiré') : g.lastMessage || `${g.memberCount} membres · Démarrez la discussion`}
        badge={g.kind === 'order' ? orderGroupStatus(g) : undefined}
        at={g.lastMessageAt ?? g.createdAt}
        unreadCount={g.unreadCount}
      />
    </Pressable>
  );
}

function RowText({ title, icon, pinned, muted, preview, live, at, unreadCount, badge }: {
  title: string; icon?: React.ComponentProps<typeof Ionicons>['name']; pinned?: boolean; muted?: boolean;
  /** Statut d'une commande (groupe de livraison) : petite pastille avant l'aperçu */
  badge?: { label: string; color: string; bg: string };
  /** live : « écrit… » en cours — en vert */
  preview: string; live?: boolean; at: string | null | undefined; unreadCount: number;
}) {
  const theme = useTheme();
  const unread = unreadCount > 0;
  return (
    <View style={styles.flex}>
      <View style={styles.topLine}>
        {icon ? <Ionicons name={icon} size={14} color={theme.textSecondary} /> : null}
        {pinned ? <Ionicons name="pin" size={12} color={theme.textSecondary} /> : null}
        <ThemedText numberOfLines={1} style={[styles.name, styles.flex]}>{title}</ThemedText>
        <ThemedText style={[styles.time, unread && { color: Brand.primary }]}>{messageTime(at)}</ThemedText>
      </View>
      <View style={styles.topLine}>
        {muted ? <Ionicons name="notifications-off" size={12} color={theme.textSecondary} /> : null}
        {badge ? (
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <ThemedText style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</ThemedText>
          </View>
        ) : null}
        <ThemedText numberOfLines={1} type="small" themeColor={unread ? 'text' : 'textSecondary'} style={[styles.flex, unread && styles.previewUnread, live && styles.previewLive]}>
          {preview}
        </ThemedText>
        {unread ? (
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const TYPE_LABEL: Record<string, string> = {
  client: 'Client', company: 'Entreprise', delivery: 'Livreur', correspondent: 'Correspondant', partner: 'Partenaire',
};

function DirectoryRow({ u, busy, onPress }: { u: SearchUser; busy: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={`Écrire à ${u.name}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Avatar u={u} size={48} />
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.name}>{u.name}</ThemedText>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">{[TYPE_LABEL[u.type] ?? u.type, u.subtitle].filter(Boolean).join(' · ')}</ThemedText>
      </View>
      {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="chatbubble-ellipses-outline" size={20} color={Brand.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statusBadge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  statusBadgeText: { fontSize: 10, lineHeight: 14, fontWeight: '800' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  loader: { marginTop: 60 },
  more: { marginVertical: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.three, paddingTop: 8, paddingBottom: 6, minHeight: 56 },
  headIcon: { padding: 4 },
  title: { flex: 1, fontSize: 24, lineHeight: 30, fontWeight: '800' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 42 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.three, paddingBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipOn: { backgroundColor: Brand.primarySoft },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipTextOn: { color: Brand.primaryInk },
  sep: { height: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 11.5, lineHeight: 16, fontWeight: '800', letterSpacing: 1.2, color: Brand.primary, paddingHorizontal: Spacing.three, marginTop: Spacing.three, marginBottom: 4 },
  dirEmpty: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  list: { paddingBottom: Spacing.five, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  avatarWrap: { width: 54, height: 54 },
  avatar: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: Brand.primary },
  dot: { position: 'absolute', right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2, backgroundColor: Brand.success },
  dotPos: { position: 'absolute', right: 1, bottom: 1 },
  groupOnline: { position: 'absolute', right: -2, bottom: -2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, borderWidth: 2, backgroundColor: Brand.success, alignItems: 'center', justifyContent: 'center' },
  groupOnlineText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  time: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  previewUnread: { fontWeight: '700' },
  previewLive: { color: Brand.success, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 70, paddingHorizontal: Spacing.four },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 6 },
  emptyBtnText: { color: Brand.primaryInk, fontWeight: '800' },
});
