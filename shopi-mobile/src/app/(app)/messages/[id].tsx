/**
 * Messagerie — fil de discussion d'une conversation : bulles de messages
 * (ordre chronologique, liste inversée type messagerie), envoi de texte,
 * photo/vidéo, fichier, position et message vocal, en direct (Socket.IO,
 * voir features/messagerie/realtime.ts), indicateur « en train d'écrire… »,
 * accusés de lecture, appels audio/vidéo (features/calls/). Fond BLANC,
 * sans fond d'écran — même thème clair que le reste de l'application.
 *
 * BUG CORRIGÉ — le clavier Android (edge-to-edge forcé depuis Android 15)
 * masquait le champ de saisie : KeyboardAvoidingView de 'react-native' ne
 * reçoit plus les vrais insets du clavier dans ce mode. Remplacé par celui
 * de 'react-native-keyboard-controller' (KeyboardProvider posé à la racine,
 * voir app/_layout.tsx), qui s'abonne aux événements réels du clavier.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { startCall } from '@/features/calls/call-store';
import { thumb } from '@/features/catalog/format';
import {
  fetchMessagePage, markConversationRead, sendMessage,
  type ChatMessage, type MessagePage, type OutgoingMessage,
} from '@/features/messagerie/api';
import MediaViewer from '@/features/messagerie/MediaViewer';
import { enterRecordingMode, exitRecordingMode, VOICE_FILE } from '@/features/messagerie/voice';
import { toUserMessage } from '@/lib/api/errors';
import { AudioBubble, FileBubble, fmtClock, ImageBubble, VideoBubble, type OpenMedia } from '@/features/messagerie/MediaBubbles';
import { uploadAttachment } from '@/features/messagerie/upload';
import { markReadRealtime, useChatRealtime } from '@/features/messagerie/realtime';
import { useTheme } from '@/hooks/use-theme';

type Pages = InfiniteData<MessagePage, string | null>;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** id temporaire pour un message optimiste, jamais confondu avec un id serveur (UUID). */
const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; logo?: string; online?: string; userId?: string }>();
  const conversationId = params.id;
  const theme = useTheme();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<{ kind: 'image' | 'video'; url: string; name?: string | null } | null>(null);

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
  function patchOptimistic(tempIdValue: string, patch: Partial<ChatMessage>) {
    qc.setQueryData<Pages>(['messages', conversationId], (old) => {
      if (!old) return old;
      return { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === tempIdValue ? { ...m, ...patch } : m)) })) };
    });
  }
  function replaceOptimistic(tempIdValue: string, real: ChatMessage) {
    qc.setQueryData<Pages>(['messages', conversationId], (old) => {
      if (!old) return old;
      return { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === tempIdValue ? real : m)) })) };
    });
  }
  function markFailed(tempIdValue: string) {
    patchOptimistic(tempIdValue, { contentType: 'failed' });
  }
  function scrollToBottom() {
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }

  // ── Envoi texte ──────────────────────────────────────────────────

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft('');
    notifyStoppedTyping();
    setSending(true);

    const optimistic: ChatMessage = {
      id: tempId(), fromMe: true, senderId: 'me', senderType: 'me',
      contentType: 'text', content, createdAt: new Date().toISOString(),
      readAt: null, isEdited: false, deletedAt: null,
    };
    appendOptimistic(optimistic);
    scrollToBottom();

    try {
      const real = await sendMessage(conversationId, { content, contentType: 'text' });
      replaceOptimistic(optimistic.id, real);
    } catch {
      markFailed(optimistic.id);
    } finally {
      setSending(false);
    }
  }

  // ── Envoi média (photo/vidéo/fichier/vocal) — aperçu local instantané,
  //    upload + création du message en tâche de fond. ──────────────────

  async function sendMedia(opts: {
    kind: 'image' | 'video' | 'document' | 'audio';
    contentType: 'image' | 'video' | 'file' | 'audio';
    uri: string; name: string; mimeType: string; size?: number; durationSec?: number;
  }) {
    const optimistic: ChatMessage = {
      id: tempId(), fromMe: true, senderId: 'me', senderType: 'me',
      contentType: opts.contentType, content: null,
      mediaUrl: opts.uri, mediaName: opts.name, mediaMimeType: opts.mimeType,
      mediaDuration: opts.durationSec ?? null,
      createdAt: new Date().toISOString(), readAt: null, isEdited: false, deletedAt: null,
    };
    appendOptimistic(optimistic);
    scrollToBottom();

    try {
      const url = await uploadAttachment(opts.kind, { uri: opts.uri, name: opts.name, mimeType: opts.mimeType });
      const payload: OutgoingMessage = {
        contentType: opts.contentType, mediaUrl: url, mediaName: opts.name,
        mediaSize: opts.size, mediaMimeType: opts.mimeType, mediaDuration: opts.durationSec,
      };
      const real = await sendMessage(conversationId, payload);
      replaceOptimistic(optimistic.id, real);
    } catch (err) {
      console.error('[Messagerie] envoi média échoué :', err);
      // Raison lisible (format refusé, fichier trop lourd, réseau…) au lieu d'un échec muet.
      Alert.alert('Envoi impossible', toUserMessage(err));
      markFailed(optimistic.id);
    }
  }

  async function pickFromLibrary() {
    setAttachOpen(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l’accès à vos photos pour en envoyer.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: 120 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const isVideo = a.type === 'video';
    void sendMedia({
      kind: isVideo ? 'video' : 'image', contentType: isVideo ? 'video' : 'image',
      uri: a.uri, name: a.fileName ?? (isVideo ? 'video.mp4' : 'photo.jpg'),
      mimeType: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
      size: a.fileSize, durationSec: a.duration ? Math.round(a.duration / 1000) : undefined,
    });
  }

  async function pickFromCamera() {
    setAttachOpen(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l’appareil photo pour prendre une photo.'); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    void sendMedia({ kind: 'image', contentType: 'image', uri: a.uri, name: a.fileName ?? 'photo.jpg', mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize });
  }

  async function pickDocument() {
    setAttachOpen(false);
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    void sendMedia({ kind: 'document', contentType: 'file', uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size });
  }

  async function shareLocation() {
    setAttachOpen(false);
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez la localisation pour partager votre position.'); return; }
      const pos = await Location.getCurrentPositionAsync({});
      let label = '';
      try {
        const [addr] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        label = [addr?.street, addr?.city].filter(Boolean).join(', ');
      } catch { /* étiquette facultative — la position seule suffit */ }

      const optimistic: ChatMessage = {
        id: tempId(), fromMe: true, senderId: 'me', senderType: 'me',
        contentType: 'location', content: null,
        latitude: pos.coords.latitude, longitude: pos.coords.longitude, locationLabel: label || null,
        createdAt: new Date().toISOString(), readAt: null, isEdited: false, deletedAt: null,
      };
      appendOptimistic(optimistic);
      scrollToBottom();

      const real = await sendMessage(conversationId, {
        contentType: 'location', latitude: pos.coords.latitude, longitude: pos.coords.longitude, locationLabel: label || undefined,
      });
      replaceOptimistic(optimistic.id, real);
    } catch (err) {
      console.error('[Messagerie] partage de position échoué :', err);
      Alert.alert('Erreur', 'Impossible de récupérer votre position.');
    } finally {
      setLocating(false);
    }
  }

  // ── Message vocal ───────────────────────────────────────────────

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState  = useAudioRecorderState(recorder, 120);
  const [recStartedAt, setRecStartedAt] = useState(0);

  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert('Permission refusée', 'Autorisez le micro pour envoyer un message vocal.'); return; }
      await enterRecordingMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecStartedAt(Date.now());
      notifyTyping();
    } catch (err) {
      console.error('[Messagerie] démarrage de l’enregistrement échoué :', err);
      Alert.alert('Erreur', "Impossible de démarrer l'enregistrement.");
    }
  }

  async function cancelRecording() {
    try { await recorder.stop(); } catch { /* déjà arrêté */ }
    void exitRecordingMode();
    notifyStoppedTyping();
  }

  async function sendRecording() {
    const durationSec = Math.round((Date.now() - recStartedAt) / 1000);
    try {
      await recorder.stop();
    } catch { /* ignore */ }
    void exitRecordingMode();
    notifyStoppedTyping();
    const uri = recorder.uri;
    if (!uri || durationSec < 1) return;
    void sendMedia({ kind: 'audio', contentType: 'audio', uri, ...VOICE_FILE, durationSec });
  }

  // ── Changement de conversation pendant un enregistrement en cours —
  //    on annule proprement plutôt que de laisser le micro ouvert ou
  //    d'envoyer le vocal à la mauvaise conversation. ──────────────
  const prevConvIdRef = useRef(conversationId);
  useEffect(() => {
    const prev = prevConvIdRef.current;
    prevConvIdRef.current = conversationId;
    if (prev !== conversationId && recState.isRecording) void cancelRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const contactName   = params.name || 'Conversation';
  const contactLogo   = thumb(params.logo, 120);
  const online        = params.online === '1';
  const remoteUserId  = params.userId ?? '';

  function handleCall(callType: 'audio' | 'video') {
    if (!remoteUserId) { Alert.alert('Indisponible', 'Impossible de joindre ce contact pour le moment.'); return; }
    void startCall(conversationId, remoteUserId, contactName, contactLogo ?? null, callType);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {/* En-tête personnalisé : avatar + nom + statut (en ligne / écrit…) + appels */}
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
        <Pressable onPress={() => handleCall('audio')} accessibilityRole="button" accessibilityLabel="Appel audio" hitSlop={8} style={styles.headBtn}>
          <Ionicons name="call" size={20} color={theme.text} />
        </Pressable>
        <Pressable onPress={() => handleCall('video')} accessibilityRole="button" accessibilityLabel="Appel vidéo" hitSlop={8} style={styles.headBtn}>
          <Ionicons name="videocam" size={21} color={theme.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
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
            renderItem={({ item }) => <Bubble m={item} onOpenMedia={(kind, url, name) => setViewerMedia({ kind, url, name })} />}
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

        {/* ── Barre de saisie — bascule sur l'enregistrement vocal en cours ── */}
        {recState.isRecording ? (
          <View style={[styles.inputBar, { borderTopColor: theme.border }]}>
            <Pressable onPress={() => void cancelRecording()} accessibilityRole="button" accessibilityLabel="Annuler" style={styles.recCancel}>
              <Ionicons name="trash" size={20} color={Brand.danger} />
            </Pressable>
            <View style={[styles.recBar, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.recDot} />
              <ThemedText style={styles.recTime}>{fmtClock(recState.durationMillis / 1000)}</ThemedText>
            </View>
            <Pressable onPress={() => void sendRecording()} accessibilityRole="button" accessibilityLabel="Envoyer le message vocal" style={styles.sendBtn}>
              <Ionicons name="send" size={18} color={Brand.primaryInk} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.inputBar, { borderTopColor: theme.border }]}>
            <Pressable onPress={() => setAttachOpen(true)} accessibilityRole="button" accessibilityLabel="Joindre" style={styles.attachBtn}>
              <Ionicons name="add" size={24} color={theme.textSecondary} />
            </Pressable>
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
            {draft.trim() ? (
              <Pressable
                onPress={() => void handleSend()}
                disabled={sending}
                accessibilityRole="button"
                accessibilityLabel="Envoyer"
                style={[styles.sendBtn, sending && styles.sendBtnOff]}>
                <Ionicons name="send" size={18} color={Brand.primaryInk} />
              </Pressable>
            ) : (
              <Pressable onPress={() => void startRecording()} accessibilityRole="button" accessibilityLabel="Message vocal" style={styles.sendBtn}>
                <Ionicons name="mic" size={19} color={Brand.primaryInk} />
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Menu pièce jointe ── */}
      <Modal visible={attachOpen} transparent animationType="fade" onRequestClose={() => setAttachOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setAttachOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <AttachRow icon="image" label="Photo ou vidéo" color="#7C3AED" onPress={() => void pickFromLibrary()} />
            <AttachRow icon="camera" label="Prendre une photo" color="#059669" onPress={() => void pickFromCamera()} />
            <AttachRow icon="document" label="Fichier" color="#1F1F1F" onPress={() => void pickDocument()} />
            <AttachRow icon="location" label="Ma position" color="#DC2626" onPress={() => void shareLocation()} disabled={locating} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Visionneuse plein écran (image/vidéo) ── */}
      <MediaViewer
        visible={!!viewerMedia}
        kind={viewerMedia?.kind ?? 'image'}
        url={viewerMedia?.url ?? ''}
        name={viewerMedia?.name ?? undefined}
        onClose={() => setViewerMedia(null)}
      />
    </SafeAreaView>
  );
}

function AttachRow({ icon, label, color, onPress, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.attachRow, disabled && { opacity: 0.5 }]}>
      <View style={[styles.attachIco, { backgroundColor: `${color}1F` }]}>
        {disabled ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={20} color={color} />}
      </View>
      <ThemedText style={{ color: theme.text }}>{label}</ThemedText>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Bulles — une par type de contenu
// ─────────────────────────────────────────────────────────────

function Bubble({ m, onOpenMedia }: { m: ChatMessage; onOpenMedia: OpenMedia }) {
  const theme = useTheme();
  const deleted = !!m.deletedAt;
  const failed = m.contentType === 'failed';
  const parent = m.replyToMessage;

  const inner = (() => {
    if (deleted) return <ThemedText style={[styles.bubbleText, m.fromMe && styles.bubbleTextMine, styles.bubbleTextItalic]}>Message supprimé</ThemedText>;
    switch (m.contentType) {
      case 'image':    return <ImageBubble m={m} onOpenMedia={onOpenMedia} />;
      case 'video':    return <VideoBubble m={m} onOpenMedia={onOpenMedia} />;
      case 'audio':    return <AudioBubble m={m} isMe={m.fromMe} />;
      case 'file':     return <FileBubble m={m} isMe={m.fromMe} />;
      case 'location': return <LocationBubble m={m} isMe={m.fromMe} />;
      default:
        return (
          <ThemedText style={[styles.bubbleText, m.fromMe && styles.bubbleTextMine, failed && styles.bubbleTextItalic]}>
            {failed ? 'Échec de l’envoi — ' + m.content : m.content}
          </ThemedText>
        );
    }
  })();

  const mediaType = m.contentType === 'image' || m.contentType === 'video' || m.contentType === 'location';

  return (
    <View style={[styles.bubbleRow, m.fromMe ? styles.rowMine : styles.rowTheirs]}>
      <View style={[
        styles.bubble,
        styles.bubbleShadow,
        m.fromMe ? styles.bubbleTailMine : styles.bubbleTailTheirs,
        mediaType && styles.bubbleMedia,
        m.fromMe
          ? { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine }
          : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 },
      ]}>
        {parent ? (
          <View style={[styles.quote, { borderLeftColor: m.fromMe ? 'rgba(255,255,255,0.6)' : Brand.primary }]}>
            <ThemedText numberOfLines={1} type="small" style={m.fromMe ? styles.quoteTextMine : undefined} themeColor={m.fromMe ? undefined : 'textSecondary'}>
              {parent.deletedAt ? 'Message supprimé' : parent.content || '📎 Média'}
            </ThemedText>
          </View>
        ) : null}
        {inner}
        <View style={styles.metaRow}>
          <ThemedText style={[styles.metaText, m.fromMe ? styles.metaTextMine : undefined, mediaType && styles.metaOnMedia]}>{timeOf(m.createdAt)}</ThemedText>
          {m.fromMe && !failed ? <Ionicons name={m.readAt ? 'checkmark-done' : 'checkmark'} size={14} color={m.readAt ? 'rgba(0,0,0,0.12)' : (mediaType ? '#fff' : 'rgba(180,86,28,.75)')} /> : null}
          {failed ? <Ionicons name="alert-circle" size={14} color={Brand.danger} /> : null}
        </View>
      </View>
    </View>
  );
}

function LocationBubble({ m, isMe }: { m: ChatMessage; isMe: boolean }) {
  if (m.latitude == null || m.longitude == null) return null;
  const open = () => {
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${m.latitude},${m.longitude}`,
      default: `geo:${m.latitude},${m.longitude}?q=${m.latitude},${m.longitude}`,
    });
    void Linking.openURL(url!);
  };
  return (
    <Pressable onPress={open} style={styles.locBox}>
      <View style={styles.locMap}>
        <Ionicons name="location" size={30} color={Brand.primary} />
      </View>
      <View style={styles.locInfo}>
        <ThemedText numberOfLines={1} style={[styles.fileName, isMe && { color: '#1F1F1F' }]}>{m.locationLabel || 'Position partagée'}</ThemedText>
        <ThemedText type="small" style={isMe ? { color: 'rgba(180,86,28,.75)' } : undefined} themeColor={isMe ? undefined : 'textSecondary'}>Ouvrir dans Maps</ThemedText>
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
  more: { marginVertical: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.two, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { padding: 6 },
  headAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  headAvatarText: { fontSize: 15, fontWeight: '800', color: Brand.primary },
  headName: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  headBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: 4, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  /* Petite ombre portée — les bulles se détachent légèrement du fond blanc
   * plutôt que de rester à plat, même traitement WhatsApp/Telegram/iMessage. */
  bubbleShadow: {
    shadowColor: '#1F1F1F', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
    elevation: 1,
  },
  /* Coin « queue » — un angle nettement moins arrondi du côté de l'expéditeur
   * (bas-droite pour moi, bas-gauche pour l'autre), signature visuelle d'une
   * bulle de messagerie plutôt qu'une carte générique. */
  bubbleTailMine:    { borderBottomRightRadius: 4 },
  bubbleTailTheirs:  { borderBottomLeftRadius: 4 },
  bubbleMedia: { padding: 4, overflow: 'hidden' },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#1F1F1F' },
  bubbleTextItalic: { fontStyle: 'italic', opacity: 0.85 },
  quote: { borderLeftWidth: 2, paddingLeft: 8, marginBottom: 4, marginHorizontal: 8, marginTop: 4 },
  quoteTextMine: { color: 'rgba(255,255,255,0.85)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 },
  metaText: { fontSize: 10.5, lineHeight: 13, color: '#8A93A3' },
  metaTextMine: { color: 'rgba(180,86,28,.75)' },
  metaOnMedia: { position: 'absolute', bottom: 6, right: 8, color: '#fff', backgroundColor: 'rgba(0,0,0,.35)', paddingHorizontal: 5, borderRadius: 6, overflow: 'hidden' },
  fileName: { fontSize: 14, fontWeight: '700' },
  locBox: { width: 220, gap: 6 },
  locMap: { width: '100%', height: 110, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  locInfo: { paddingHorizontal: 4, paddingBottom: 2 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.three, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  attachBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inputBox: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120 },
  input: { fontSize: 15, lineHeight: 20, maxHeight: 104 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
  recCancel: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  recBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 14, minHeight: 40 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.danger },
  recTime: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: Spacing.two, paddingBottom: Spacing.five },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  attachIco: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
