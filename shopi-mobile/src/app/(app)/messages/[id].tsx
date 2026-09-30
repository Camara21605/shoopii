/**
 * Messagerie — fil de discussion d'une conversation : bulles de messages
 * (ordre chronologique, liste inversée type messagerie), envoi de texte en
 * direct (Socket.IO, voir features/messagerie/realtime.ts), indicateur
 * « en train d'écrire… », accusés de lecture. Fond BLANC, sans fond d'écran
 * — même thème clair que le reste de l'application.
 *
 * Médias, réactions, réponses détaillées, appels… restent sur le site pour
 * l'instant (voir la mémoire du projet : étapes suivantes du plan messagerie).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { fetchMessagePage, markConversationRead, sendTextMessage, type ChatMessage, type MessagePage } from '@/features/messagerie/api';
import { markReadRealtime, useChatRealtime } from '@/features/messagerie/realtime';
import { useTheme } from '@/hooks/use-theme';

type Pages = InfiniteData<MessagePage, string | null>;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** id temporaire pour un message optimiste, jamais confondu avec un id serveur (UUID). */
const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; logo?: string; online?: string }>();
  const conversationId = params.id;
  const theme = useTheme();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const list = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) => fetchMessagePage(conversationId, { cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? null) : undefined),
    enabled: !!conversationId,
  });

  const { typingLabel, notifyTyping, notifyStoppedTyping } = useChatRealtime(conversationId, () => {
    // Message reçu pendant que l'écran est ouvert : déjà lu à l'instant.
    markReadRealtime(conversationId);
    void markConversationRead(conversationId).catch(() => undefined);
  });

  /* Marquer lu à l'ouverture (au cas où il restait des non-lus avant l'arrivée sur l'écran). */
  useEffect(() => {
    if (!conversationId) return;
    markReadRealtime(conversationId);
    void markConversationRead(conversationId)
      .catch(() => undefined)
      .finally(() => void qc.invalidateQueries({ queryKey: ['unread', 'messages'] }));
  }, [conversationId, qc]);

  // DESC (plus récent en premier) pour la liste inversée : chaque page est ASC en interne, on l'inverse.
  const messagesDesc = (list.data?.pages ?? []).flatMap((p) => p.data.slice().reverse());

  function appendOptimistic(msg: ChatMessage) {
    qc.setQueryData<Pages>(['messages', conversationId], (old) => {
      if (!old || old.pages.length === 0) return old;
      const pages = old.pages.slice();
      pages[0] = { ...pages[0], data: [...pages[0].data, msg] };
      return { ...old, pages };
    });
  }
  function replaceOptimistic(tempIdValue: string, real: ChatMessage) {
    qc.setQueryData<Pages>(['messages', conversationId], (old) => {
      if (!old) return old;
      return { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === tempIdValue ? real : m)) })) };
    });
  }
  function markFailed(tempIdValue: string) {
    qc.setQueryData<Pages>(['messages', conversationId], (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === tempIdValue ? { ...m, contentType: 'failed' } : m)) })),
      };
    });
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft('');
    notifyStoppedTyping();
    setSending(true);

    const optimistic: ChatMessage = {
      id: tempId(),
      fromMe: true,
      senderId: 'me',
      senderType: 'me',
      contentType: 'text',
      content,
      createdAt: new Date().toISOString(),
      readAt: null,
      isEdited: false,
      deletedAt: null,
    };
    appendOptimistic(optimistic);
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));

    try {
      const real = await sendTextMessage(conversationId, content);
      replaceOptimistic(optimistic.id, real);
    } catch {
      markFailed(optimistic.id);
    } finally {
      setSending(false);
    }
  }

  const contactName = params.name || 'Conversation';
  const contactLogo = thumb(params.logo, 120);
  const online = params.online === '1';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {/* En-tête personnalisé : avatar + nom + statut (en ligne / écrit…) */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={[styles.headAvatar, { backgroundColor: theme.backgroundSelected }]}>
          {contactLogo ? <Image source={{ uri: contactLogo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.headAvatarText}>{initials(contactName)}</ThemedText>}
        </View>
        <View style={styles.flex}>
          <ThemedText numberOfLines={1} style={styles.headName} accessibilityRole="header">
            {contactName}
          </ThemedText>
          <ThemedText numberOfLines={1} type="small" style={typingLabel ? { color: Brand.primary } : undefined} themeColor={typingLabel ? undefined : 'textSecondary'}>
            {typingLabel ?? (online ? 'En ligne' : ' ')}
          </ThemedText>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        {list.isPending ? (
          <ActivityIndicator color={Brand.primary} style={styles.loader} />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={messagesDesc}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onEndReachedThreshold={0.3}
            onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
            renderItem={({ item }) => <Bubble m={item} />}
            ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.more} /> : null}
            ListEmptyComponent={
              <View style={styles.empty}>
                <ThemedText themeColor="textSecondary" style={styles.center}>
                  Aucun message. Dites bonjour 👋
                </ThemedText>
              </View>
            }
          />
        )}

        <View style={[styles.inputBar, { borderTopColor: theme.border }]}>
          <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                if (v.trim()) notifyTyping();
                else notifyStoppedTyping();
              }}
              onBlur={notifyStoppedTyping}
              placeholder="Votre message…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text }]}
              multiline
              maxLength={5000}
              accessibilityLabel="Votre message"
            />
          </View>
          <Pressable
            onPress={() => void handleSend()}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnOff]}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const theme = useTheme();
  const deleted = !!m.deletedAt;
  const failed = m.contentType === 'failed';
  const parent = m.replyToMessage;

  return (
    <View style={[styles.bubbleRow, m.fromMe ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, m.fromMe ? { backgroundColor: Brand.primary } : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 }]}>
        {parent ? (
          <View style={[styles.quote, { borderLeftColor: m.fromMe ? 'rgba(255,255,255,0.6)' : Brand.primary }]}>
            <ThemedText numberOfLines={1} type="small" style={m.fromMe ? styles.quoteTextMine : undefined} themeColor={m.fromMe ? undefined : 'textSecondary'}>
              {parent.deletedAt ? 'Message supprimé' : parent.content || '📎 Média'}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText style={[styles.bubbleText, m.fromMe && styles.bubbleTextMine, (deleted || failed) && styles.bubbleTextItalic]}>
          {deleted ? 'Message supprimé' : failed ? 'Échec de l’envoi — ' + m.content : m.content}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText style={[styles.metaText, m.fromMe ? styles.metaTextMine : undefined]}>{timeOf(m.createdAt)}</ThemedText>
          {m.fromMe && !failed ? <Ionicons name={m.readAt ? 'checkmark-done' : 'checkmark'} size={14} color={m.readAt ? '#8FD3FF' : 'rgba(255,255,255,0.8)'} /> : null}
          {failed ? <Ionicons name="alert-circle" size={14} color={Brand.danger} /> : null}
        </View>
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
  more: { marginVertical: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.two, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { padding: 6 },
  headAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  headAvatarText: { fontSize: 15, fontWeight: '800', color: Brand.primary },
  headName: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  list: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: 4, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextItalic: { fontStyle: 'italic', opacity: 0.85 },
  quote: { borderLeftWidth: 2, paddingLeft: 8, marginBottom: 4 },
  quoteTextMine: { color: 'rgba(255,255,255,0.85)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 },
  metaText: { fontSize: 10.5, lineHeight: 13, color: '#8A93A3' },
  metaTextMine: { color: 'rgba(255,255,255,0.8)' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.three, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputBox: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120 },
  input: { fontSize: 15, lineHeight: 20, maxHeight: 104 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
});
