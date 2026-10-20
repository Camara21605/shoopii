/**
 * Messagerie — fil de discussion d'une conversation : bulles de messages
 * (ordre chronologique, liste inversée type messagerie), envoi de texte,
 * photo/vidéo, fichier, position et message vocal, en direct (Socket.IO,
 * voir features/messagerie/realtime.ts), indicateur « en train d'écrire… »,
 * accusés de lecture, appels audio/vidéo (features/calls/). Fond gris très
 * clair sous les bulles : les miennes en vert clair à droite, celles reçues en
 * blanc à gauche (jetons ChatBubble). Les traces d'appel sont aussi rangées du
 * côté de celui qui a appelé. « Fichier » n'ouvre que les documents (PDF,
 * Word, Excel, audio…) — photos et vidéos passent par « Photo ou vidéo ».
 *
 * Appui long sur un message : Répondre · Copier · Modifier (mes textes, 24 h) ·
 * Supprimer pour moi / pour tout le monde (mes messages) — règles du serveur.
 * Toucher la photo ou le nom en haut : infos du contact et son profil public
 * (/messages/infos).
 *
 * Photo, vidéo, fichier ou position : aperçu avant l'envoi avec un commentaire
 * facultatif (AttachmentComposer), affiché sous le média dans la bulle.
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
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openDirections } from '@/features/location/open-directions';

import { ErrorState, initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, ChatBubble, Spacing } from '@/constants/theme';
import { startCall } from '@/features/calls/call-store';
import { thumb } from '@/features/catalog/format';
import {
  deleteMessage, editMessage, fetchMessagePage, markConversationRead, sendMessage,
  type ChatMessage, type MessagePage, type OutgoingMessage,
} from '@/features/messagerie/api';
import MediaViewer from '@/features/messagerie/MediaViewer';
import { enterRecordingMode, exitRecordingMode, VOICE_FILE } from '@/features/messagerie/voice';
import { describeCallLog } from '@/features/messagerie/call-log';
import { setActiveConversation } from '../../../../modules/shopi-calls';
import { toUserMessage } from '@/lib/api/errors';
import { AudioBubble, FileBubble, fmtClock, ImageBubble, VideoBubble, type OpenMedia } from '@/features/messagerie/MediaBubbles';
import { AttachmentComposer, type PendingAttachment } from '@/features/messagerie/components/attachment-composer';
import { DOCUMENT_TYPES, isPhotoOrVideo } from '@/features/messagerie/documents';
import { uploadAttachment } from '@/features/messagerie/upload';
import { markReadRealtime, useChatRealtime } from '@/features/messagerie/realtime';
import { PresenceDot, PresenceLegend, PresenceLine, usePresence, type PresenceStatus } from '@/features/presence';
import { useTheme } from '@/hooks/use-theme';

type Pages = InfiniteData<MessagePage, string | null>;

/** Pièce jointe à envoyer (photo, vidéo, document, vocal) + commentaire facultatif. */
type MediaOpts = {
  kind: 'image' | 'video' | 'document' | 'audio';
  contentType: 'image' | 'video' | 'file' | 'audio';
  uri: string; name: string; mimeType: string; size?: number; durationSec?: number;
  caption?: string;
};

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** id temporaire pour un message optimiste, jamais confondu avec un id serveur (UUID). */
const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; logo?: string; online?: string; presence?: string; userId?: string; prefill?: string }>();
  const conversationId = params.id;
  const theme = useTheme();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  /* `prefill` : message proposé (ex. demande de devis d'une prestation), modifiable avant l'envoi. */
  const [draft, setDraft] = useState(params.prefill ?? '');
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  /* Pièce jointe choisie, en attente du commentaire (aperçu avant l'envoi). */
  const [pending, setPending] = useState<{ view: PendingAttachment; media?: MediaOpts } | null>(null);
  const [viewerMedia, setViewerMedia] = useState<{ kind: 'image' | 'video'; url: string; name?: string | null } | null>(null);
  /* Appui long : menu d'actions, réponse citée ou modification en cours. */
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  /** Heure d'ouverture du menu (délai de modification de 24 h) — lue au toucher, pas au rendu */
  const [actionsAt, setActionsAt] = useState(0);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  /** Envoi raté → comment le refaire (toucher la bulle en échec). Indexé par l'id temporaire. */
  const retries = useRef(new Map<string, () => void>());

  const list = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) => fetchMessagePage(conversationId, { cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? null) : undefined),
    enabled: !!conversationId,
    /* La copie gardée s'affiche tout de suite, et le fil est revérifié à chaque ouverture. */
    staleTime: 0,
  });

  const { typingLabel, notifyTyping, notifyStoppedTyping } = useChatRealtime(conversationId, () => {
    // Message reçu pendant que l'écran est ouvert : déjà lu à l'instant.
    markReadRealtime(conversationId);
    void markConversationRead(conversationId).catch(() => undefined);
  });

  /* Conversation à l'écran : sa notification se ferme et ses nouveaux messages ne sonnent pas. */
  useEffect(() => {
    if (!conversationId) return;
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId]);

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
  /** Envoi confirmé : le message temporaire devient le vrai (sans doublon s'il est déjà arrivé autrement). */
  function replaceOptimistic(tempIdValue: string, real: ChatMessage) {
    qc.setQueryData<Pages>(['messages', conversationId], (old) => {
      if (!old) return old;
      const already = old.pages.some((p) => p.data.some((m) => m.id === real.id));
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          data: already ? p.data.filter((m) => m.id !== tempIdValue) : p.data.map((m) => (m.id === tempIdValue ? real : m)),
        })),
      };
    });
  }
  /* Le message GARDE son type (vocal, photo, texte…) : avant, il devenait « failed »
   * et une photo ou un vocal raté s'affichait « Échec de l'envoi — null ». */
  function markFailed(tempIdValue: string, retry: () => void) {
    retries.current.set(tempIdValue, retry);
    patchOptimistic(tempIdValue, { _failed: true });
  }
  function retrySend(tempIdValue: string) {
    const retry = retries.current.get(tempIdValue);
    if (!retry) return;
    retries.current.delete(tempIdValue);
    patchOptimistic(tempIdValue, { _failed: false });
    retry();
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

    if (editing) {
      const target = editing;
      setEditing(null);
      if (content === target.content) return;
      patchOptimistic(target.id, { content, isEdited: true });
      try {
        await editMessage(target.id, content);
      } catch (err) {
        patchOptimistic(target.id, { content: target.content, isEdited: target.isEdited });
        Alert.alert('Modification impossible', toUserMessage(err));
      }
      return;
    }

    setSending(true);
    const quoted = replyTo;
    setReplyTo(null);
    const optimistic: ChatMessage = {
      id: tempId(), fromMe: true, senderId: 'me', senderType: 'me',
      contentType: 'text', content, createdAt: new Date().toISOString(),
      readAt: null, isEdited: false, deletedAt: null,
      replyToId: quoted?.id ?? null,
      replyToMessage: quoted ? { id: quoted.id, fromMe: quoted.fromMe, contentType: quoted.contentType, content: quoted.content, deletedAt: quoted.deletedAt ?? null } : null,
    };
    appendOptimistic(optimistic);
    scrollToBottom();

    try {
      await deliverText(optimistic.id, content, quoted?.id);
    } finally {
      setSending(false);
    }
  }

  async function deliverText(id: string, content: string, replyToId?: string) {
    try {
      const real = await sendMessage(conversationId, { content, contentType: 'text', replyToId });
      replaceOptimistic(id, real);
    } catch {
      markFailed(id, () => void deliverText(id, content, replyToId));
    }
  }

  /** Supprimer : pour moi (le message disparaît de MON fil) ou pour tout le monde. */
  async function removeMessage(m: ChatMessage, mode: 'me' | 'everyone') {
    setActionsFor(null);
    const snapshot = qc.getQueryData<Pages>(['messages', conversationId]);
    qc.setQueryData<Pages>(['messages', conversationId], (old) => old && {
      ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.filter((x) => x.id !== m.id) })),
    });
    if (m.id.startsWith('tmp-')) return;   // envoi raté : rien côté serveur
    try {
      await deleteMessage(m.id, mode);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      if (snapshot) qc.setQueryData(['messages', conversationId], snapshot);
      Alert.alert('Suppression impossible', toUserMessage(err));
    }
  }

  const canEdit = (m: ChatMessage) =>
    m.fromMe && m.contentType === 'text' && !m.deletedAt && !m._failed && !m.id.startsWith('tmp-') &&
    actionsAt - new Date(m.createdAt).getTime() < 24 * 3_600_000;

  // ── Envoi média (photo/vidéo/fichier/vocal) — aperçu local instantané,
  //    upload + création du message en tâche de fond. ──────────────────

  async function sendMedia(opts: MediaOpts) {
    const optimistic: ChatMessage = {
      id: tempId(), fromMe: true, senderId: 'me', senderType: 'me',
      contentType: opts.contentType, content: opts.caption || null,
      mediaUrl: opts.uri, mediaName: opts.name, mediaMimeType: opts.mimeType,
      mediaDuration: opts.durationSec ?? null,
      createdAt: new Date().toISOString(), readAt: null, isEdited: false, deletedAt: null,
    };
    appendOptimistic(optimistic);
    scrollToBottom();
    await deliverMedia(optimistic.id, opts);
  }

  async function deliverMedia(id: string, opts: MediaOpts) {
    try {
      const url = await uploadAttachment(opts.kind, { uri: opts.uri, name: opts.name, mimeType: opts.mimeType });
      const payload: OutgoingMessage = {
        contentType: opts.contentType, mediaUrl: url, mediaName: opts.name,
        mediaSize: opts.size, mediaMimeType: opts.mimeType, mediaDuration: opts.durationSec,
        content: opts.caption || undefined,
      };
      const real = await sendMessage(conversationId, payload);
      replaceOptimistic(id, real);
    } catch (err) {
      console.error('[Messagerie] envoi média échoué :', err);
      // Raison lisible (format refusé, fichier trop lourd, réseau…) au lieu d'un échec muet.
      Alert.alert('Envoi impossible', toUserMessage(err));
      markFailed(id, () => void deliverMedia(id, opts));
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
    const media: MediaOpts = {
      kind: isVideo ? 'video' : 'image', contentType: isVideo ? 'video' : 'image',
      uri: a.uri, name: a.fileName ?? (isVideo ? 'video.mp4' : 'photo.jpg'),
      mimeType: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
      size: a.fileSize, durationSec: a.duration ? Math.round(a.duration / 1000) : undefined,
    };
    setPending({ media, view: isVideo ? { kind: 'video', uri: a.uri, name: media.name, durationSec: media.durationSec } : { kind: 'image', uri: a.uri, name: media.name } });
  }

  async function pickFromCamera() {
    setAttachOpen(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l’appareil photo pour prendre une photo.'); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const media: MediaOpts = { kind: 'image', contentType: 'image', uri: a.uri, name: a.fileName ?? 'photo.jpg', mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize };
    setPending({ media, view: { kind: 'image', uri: a.uri, name: media.name } });
  }

  async function pickDocument() {
    setAttachOpen(false);
    const res = await DocumentPicker.getDocumentAsync({ type: DOCUMENT_TYPES, copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (isPhotoOrVideo(a.mimeType, a.name)) {
      Alert.alert('Photo ou vidéo', 'Pour envoyer une photo ou une vidéo, utilisez « Photo ou vidéo » : elle s’affichera directement dans la discussion.');
      return;
    }
    const media: MediaOpts = { kind: 'document', contentType: 'file', uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size };
    setPending({ media, view: { kind: 'document', uri: a.uri, name: a.name, size: a.size } });
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
      setPending({ view: { kind: 'location', label: label || null, latitude: pos.coords.latitude, longitude: pos.coords.longitude } });
    } catch (err) {
      console.error('[Messagerie] partage de position échoué :', err);
      Alert.alert('Erreur', 'Impossible de récupérer votre position.');
    } finally {
      setLocating(false);
    }
  }

  async function sendLocation(latitude: number, longitude: number, label: string | null, caption: string) {
    const optimistic: ChatMessage = {
      id: tempId(), fromMe: true, senderId: 'me', senderType: 'me',
      contentType: 'location', content: caption || null,
      latitude, longitude, locationLabel: label,
      createdAt: new Date().toISOString(), readAt: null, isEdited: false, deletedAt: null,
    };
    appendOptimistic(optimistic);
    scrollToBottom();
    try {
      const real = await sendMessage(conversationId, {
        contentType: 'location', latitude, longitude, locationLabel: label || undefined, content: caption || undefined,
      });
      replaceOptimistic(optimistic.id, real);
    } catch (err) {
      Alert.alert('Envoi impossible', toUserMessage(err));
      markFailed(optimistic.id, () => {
        replaceOptimistic(optimistic.id, { ...optimistic, _failed: false });
        void sendMessage(conversationId, { contentType: 'location', latitude, longitude, locationLabel: label || undefined, content: caption || undefined })
          .then((real) => replaceOptimistic(optimistic.id, real))
          .catch(() => patchOptimistic(optimistic.id, { _failed: true }));
      });
    }
  }

  /** Commentaire saisi dans l'aperçu → envoi de la pièce jointe. */
  function confirmPending(caption: string) {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.view.kind === 'location') void sendLocation(p.view.latitude, p.view.longitude, p.view.label, caption);
    else if (p.media) void sendMedia({ ...p.media, caption });
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
  const remoteUserId  = params.userId ?? '';
  /* 3 états, vérifiés à l'ouverture (« joignable » = appli fermée mais téléphone connecté) */
  const initialPresence: PresenceStatus | null =
    params.presence === 'online' || params.presence === 'reachable' || params.presence === 'offline' ? params.presence : params.online === '1' ? 'online' : null;
  const presence = usePresence(remoteUserId || null, { probe: true, fallback: { status: initialPresence } });
  const [legendOpen, setLegendOpen] = useState(false);

  function openInfos() {
    router.push({ pathname: '/messages/infos', params: { id: conversationId, name: contactName, logo: params.logo ?? '', userId: remoteUserId } });
  }

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
        <Pressable onPress={openInfos} accessibilityRole="button" accessibilityLabel={`Infos de ${contactName}`} hitSlop={6}>
          <View style={[styles.headAvatar, { backgroundColor: theme.backgroundSelected }]}>
            {contactLogo ? <Image source={{ uri: contactLogo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.headAvatarText}>{initials(contactName)}</ThemedText>}
          </View>
          <PresenceDot status={presence.status} size={13} style={styles.headDot} />
        </Pressable>
        <Pressable
          style={styles.flex}
          onPress={openInfos}
          onLongPress={() => remoteUserId && setLegendOpen(true)}
          accessibilityRole="button"
          accessibilityHint="Ouvre les infos du contact et son profil">
          <ThemedText numberOfLines={1} style={styles.headName} accessibilityRole="header">
            {contactName}
          </ThemedText>
          {typingLabel ? (
            <ThemedText numberOfLines={1} type="small" style={{ color: Brand.primary }}>
              {typingLabel}
            </ThemedText>
          ) : remoteUserId && (presence.known || presence.checking) ? (
            <PresenceLine status={presence.status} lastSeen={presence.lastSeen} checking={presence.checking} />
          ) : (
            <ThemedText type="small"> </ThemedText>
          )}
        </Pressable>
        <Pressable onPress={() => handleCall('audio')} accessibilityRole="button" accessibilityLabel="Appel audio" hitSlop={8} style={styles.headBtn}>
          <Ionicons name="call" size={20} color={theme.text} />
        </Pressable>
        <Pressable onPress={() => handleCall('video')} accessibilityRole="button" accessibilityLabel="Appel vidéo" hitSlop={8} style={styles.headBtn}>
          <Ionicons name="videocam" size={21} color={theme.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Chargement / erreur : la zone prend toute la hauteur — le champ de saisie reste EN BAS
          * dès l'ouverture (avant, il remontait sous l'indicateur de chargement, en haut de l'écran). */}
        {list.isPending ? (
          <View style={[styles.flex, styles.chatBg]}>
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          </View>
        ) : list.error ? (
          <View style={[styles.flex, styles.chatBg]}>
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={messagesDesc}
            keyExtractor={(m) => m.id}
            style={[styles.flex, styles.chatBg]}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReachedThreshold={0.3}
            onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
            renderItem={({ item }) => (
              <Bubble
                m={item}
                onOpenMedia={(kind, url, name) => setViewerMedia({ kind, url, name })}
                onRetry={() => retrySend(item.id)}
                onLongPress={() => { setActionsAt(Date.now()); setActionsFor(item); }}
              />
            )}
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

        {(replyTo || editing) && !recState.isRecording ? (
          <View style={[styles.replyBar, { borderTopColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <Ionicons name={editing ? 'pencil' : 'arrow-undo'} size={16} color={ChatBubble.mineAccent} />
            <View style={styles.replyQuote}>
              <ThemedText numberOfLines={1} style={styles.replyName}>{editing ? 'Modifier le message' : replyTo?.fromMe ? 'Répondre à vous-même' : `Répondre à ${contactName}`}</ThemedText>
              <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">{previewOf(editing ?? replyTo!)}</ThemedText>
            </View>
            <Pressable onPress={() => { setReplyTo(null); if (editing) { setEditing(null); setDraft(''); } }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Annuler">
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}

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
            {!editing ? (
              <Pressable onPress={() => setAttachOpen(true)} accessibilityRole="button" accessibilityLabel="Joindre" style={styles.attachBtn}>
                <Ionicons name="add" size={24} color={theme.textSecondary} />
              </Pressable>
            ) : null}
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
                accessibilityLabel={editing ? 'Enregistrer la modification' : 'Envoyer'}
                style={[styles.sendBtn, sending && styles.sendBtnOff]}>
                <Ionicons name={editing ? 'checkmark' : 'send'} size={18} color={Brand.primaryInk} />
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
            <AttachRow icon="document" label="Fichier (PDF, Word, Excel…)" color="#1F1F1F" onPress={() => void pickDocument()} />
            <AttachRow icon="location" label="Ma position" color="#DC2626" onPress={() => void shareLocation()} disabled={locating} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Aperçu + commentaire avant l'envoi d'une pièce jointe ── */}
      <AttachmentComposer attachment={pending?.view ?? null} recipient={contactName} onCancel={() => setPending(null)} onSend={confirmPending} />

      {/* ── Actions sur un message (appui long) ── */}
      <Modal visible={!!actionsFor} transparent animationType="fade" onRequestClose={() => setActionsFor(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionsFor(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            {actionsFor ? (
              <>
                <ThemedText numberOfLines={2} type="small" themeColor="textSecondary" style={styles.sheetPreview}>
                  {actionsFor.fromMe ? 'Vous' : contactName} : {previewOf(actionsFor)}
                </ThemedText>
                {!actionsFor._failed && !actionsFor.id.startsWith('tmp-') ? (
                  <AttachRow icon="arrow-undo" label="Répondre" color={ChatBubble.mineAccent} onPress={() => { setEditing(null); setReplyTo(actionsFor); setActionsFor(null); }} />
                ) : null}
                {actionsFor.contentType === 'text' && actionsFor.content ? (
                  <AttachRow icon="copy" label="Copier le texte" color="#0E9F6E" onPress={() => { void Clipboard.setStringAsync(actionsFor.content ?? ''); setActionsFor(null); }} />
                ) : null}
                {canEdit(actionsFor) ? (
                  <AttachRow icon="pencil" label="Modifier" color="#D97706" onPress={() => { setReplyTo(null); setEditing(actionsFor); setDraft(actionsFor.content ?? ''); setActionsFor(null); }} />
                ) : null}
                <AttachRow icon="trash-outline" label="Supprimer pour moi" color={Brand.danger} onPress={() => void removeMessage(actionsFor, 'me')} />
                {actionsFor.fromMe && !actionsFor._failed && !actionsFor.id.startsWith('tmp-') ? (
                  <AttachRow icon="trash" label="Supprimer pour tout le monde" color={Brand.danger} onPress={() => {
                    const target = actionsFor;
                    setActionsFor(null);
                    Alert.alert('Supprimer pour tout le monde ?', `Le message sera retiré pour vous et pour ${contactName}.`, [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: () => void removeMessage(target, 'everyone') },
                    ]);
                  }} />
                ) : null}
              </>
            ) : null}
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
      {legendOpen ? <PresenceLegend current={presence.status} onClose={() => setLegendOpen(false)} /> : null}
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

/** Aperçu d'un message (barre de réponse, menu d'actions). */
function previewOf(m: Pick<ChatMessage, 'contentType' | 'content' | 'deletedAt'>): string {
  if (m.deletedAt) return 'Message supprimé';
  switch (m.contentType) {
    case 'image': return m.content ? `📷 ${m.content}` : '📷 Photo';
    case 'video': return m.content ? `🎥 ${m.content}` : '🎥 Vidéo';
    case 'audio': return '🎙️ Message vocal';
    case 'file': return m.content ? `📄 ${m.content}` : '📄 Document';
    case 'location': return m.content ? `📍 ${m.content}` : '📍 Position';
    default: return m.content ?? '';
  }
}

function Bubble({ m, onOpenMedia, onRetry, onLongPress }: { m: ChatMessage; onOpenMedia: OpenMedia; onRetry: () => void; onLongPress: () => void }) {
  const deleted = !!m.deletedAt;
  const failed = m._failed === true;
  const parent = m.replyToMessage;

  /* Trace d'appel : ligne lisible au lieu du JSON brut stocké par le serveur. */
  if (m.contentType === 'call' && !deleted) return <CallLogLine m={m} />;

  const inner = (() => {
    if (deleted) return <ThemedText style={[styles.bubbleText, m.fromMe && styles.bubbleTextMine, styles.bubbleTextItalic]}>Message supprimé</ThemedText>;
    switch (m.contentType) {
      case 'image':    return <ImageBubble m={m} onOpenMedia={onOpenMedia} onLongPress={onLongPress} />;
      case 'video':    return <VideoBubble m={m} onOpenMedia={onOpenMedia} onLongPress={onLongPress} />;
      case 'audio':    return <AudioBubble m={m} isMe={m.fromMe} />;
      case 'file':     return <FileBubble m={m} isMe={m.fromMe} onLongPress={onLongPress} />;
      case 'location': return <LocationBubble m={m} isMe={m.fromMe} />;
      default:
        return (
          <ThemedText style={[styles.bubbleText, m.fromMe && styles.bubbleTextMine]}>
            {m.content ?? ''}
          </ThemedText>
        );
    }
  })();

  const mediaType = m.contentType === 'image' || m.contentType === 'video' || m.contentType === 'location';
  /* Commentaire joint à une photo, vidéo, fichier ou position */
  const caption = !deleted && m.contentType !== 'text' && m.contentType !== 'audio' ? (m.content?.trim() || null) : null;
  /* Heure posée sur l'image seulement sans commentaire (sinon sous le texte) */
  const overlay = mediaType && !caption;

  return (
    <View style={[styles.bubbleRow, m.fromMe ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        onLongPress={deleted ? undefined : onLongPress}
        delayLongPress={300}
        accessibilityHint="Appui long pour répondre, copier, modifier ou supprimer"
        style={[
        styles.bubble,
        styles.bubbleShadow,
        m.fromMe ? styles.bubbleTailMine : styles.bubbleTailTheirs,
        mediaType && styles.bubbleMedia,
        m.fromMe
          ? { backgroundColor: ChatBubble.mine, borderColor: ChatBubble.mineBorder, borderWidth: 1 }
          : { backgroundColor: ChatBubble.theirs, borderColor: ChatBubble.theirsBorder, borderWidth: 1 },
      ]}>
        {parent ? (
          <View style={[styles.quote, { borderLeftColor: m.fromMe ? ChatBubble.mineQuoteBar : Brand.primary }]}>
            <ThemedText numberOfLines={1} type="small" style={m.fromMe ? styles.quoteTextMine : undefined} themeColor={m.fromMe ? undefined : 'textSecondary'}>
              {parent.deletedAt ? 'Message supprimé' : parent.content || '📎 Média'}
            </ThemedText>
          </View>
        ) : null}
        {inner}
        {caption ? (
          <ThemedText selectable style={[styles.bubbleText, styles.caption, mediaType && styles.captionOnMedia, m.fromMe && styles.bubbleTextMine]}>{caption}</ThemedText>
        ) : null}
        <View style={[styles.metaRow, mediaType && !overlay && styles.metaRowMedia]}>
          {m.isEdited && !deleted ? <ThemedText style={[styles.metaText, m.fromMe ? styles.metaTextMine : undefined]}>modifié</ThemedText> : null}
          <ThemedText style={[styles.metaText, m.fromMe ? styles.metaTextMine : undefined, overlay && styles.metaOnMedia]}>{timeOf(m.createdAt)}</ThemedText>
          {m.fromMe && !failed ? (
            <Ionicons
              name={m.readAt ? 'checkmark-done' : 'checkmark'}
              size={15}
              color={m.readAt ? ChatBubble.read : overlay ? '#fff' : ChatBubble.mineMeta}
              accessibilityLabel={m.readAt ? 'Lu' : 'Envoyé'}
            />
          ) : null}
          {failed ? <Ionicons name="alert-circle" size={14} color={Brand.danger} /> : null}
        </View>
        {failed ? (
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Réessayer l’envoi" hitSlop={8}>
            <ThemedText style={styles.failedText}>Échec de l’envoi — toucher pour réessayer</ThemedText>
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

/** Trace d'appel rangée du côté de celui qui a appelé (moi à droite, l'autre à gauche). */
function CallLogLine({ m }: { m: ChatMessage }) {
  const v = describeCallLog(m.content, m.fromMe);
  return (
    <View style={[styles.bubbleRow, m.fromMe ? styles.rowMine : styles.rowTheirs]}>
      <View style={[
        styles.callPill,
        m.fromMe ? styles.bubbleTailMine : styles.bubbleTailTheirs,
        m.fromMe
          ? { backgroundColor: ChatBubble.mine, borderColor: ChatBubble.mineBorder }
          : { backgroundColor: ChatBubble.theirs, borderColor: ChatBubble.theirsBorder },
      ]}>
        <View style={[styles.callIco, { backgroundColor: `${v.color}1F` }]}>
          <Ionicons name={v.icon} size={15} color={v.color} />
        </View>
        <ThemedText style={[styles.callText, { color: v.alert ? Brand.danger : ChatBubble.mineText }]}>{v.label}</ThemedText>
        <ThemedText style={[styles.callTime, { color: m.fromMe ? ChatBubble.mineMeta : ChatBubble.theirsMeta }]}>{timeOf(m.createdAt)}</ThemedText>
      </View>
    </View>
  );
}

function LocationBubble({ m, isMe }: { m: ChatMessage; isMe: boolean }) {
  if (m.latitude == null || m.longitude == null) return null;
  /* Toucher la position : itinéraire dans l'appli (façon Google Maps), depuis ma position. */
  const open = () => openDirections({ lat: m.latitude, lng: m.longitude, name: m.locationLabel || 'Position partagée' });
  return (
    <Pressable onPress={open} style={styles.locBox}>
      <View style={styles.locMap}>
        <Ionicons name="location" size={30} color={Brand.primary} />
      </View>
      <View style={styles.locInfo}>
        <ThemedText numberOfLines={1} style={[styles.fileName, isMe && { color: ChatBubble.mineText }]}>{m.locationLabel || 'Position partagée'}</ThemedText>
        <ThemedText type="small" style={isMe ? { color: ChatBubble.mineMeta } : undefined} themeColor={isMe ? undefined : 'textSecondary'}>Itinéraire</ThemedText>
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
  headDot: { position: 'absolute', right: -1, bottom: -1 },
  headAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  headAvatarText: { fontSize: 15, fontWeight: '800', color: Brand.primary },
  headName: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  headBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, gap: 4, flexGrow: 1, justifyContent: 'flex-end' },
  /* Gris très clair : bulles blanches (reçues) et vert clair (envoyées) bien détachées */
  chatBg: { backgroundColor: ChatBubble.screen },
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
  bubbleTextMine: { color: ChatBubble.mineText },
  bubbleTextItalic: { fontStyle: 'italic', opacity: 0.85 },
  caption: { marginTop: 6 },
  /* Sous une photo / vidéo / position (largeur 220) : même largeur, petit retrait */
  captionOnMedia: { maxWidth: 220, paddingHorizontal: 6 },
  metaRowMedia: { paddingHorizontal: 6, paddingBottom: 2 },
  failedText: { fontSize: 12, lineHeight: 16, marginTop: 4, color: Brand.danger, fontWeight: '600' },
  callPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 18, paddingLeft: 8, paddingRight: 12, paddingVertical: 7, maxWidth: '82%' },
  callIco: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  callText: { fontSize: 13.5, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  callTime: { fontSize: 11, lineHeight: 16 },
  quote: { borderLeftWidth: 2, paddingLeft: 8, marginBottom: 4, marginHorizontal: 8, marginTop: 4 },
  quoteTextMine: { color: ChatBubble.mineMeta },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 },
  metaText: { fontSize: 10.5, lineHeight: 13, color: '#8A93A3' },
  metaTextMine: { color: ChatBubble.mineMeta },
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
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.three, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  replyQuote: { flex: 1, borderLeftWidth: 3, borderLeftColor: ChatBubble.mineAccent, paddingLeft: 8 },
  replyName: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: ChatBubble.mineAccent },
  sheetPreview: { paddingHorizontal: Spacing.four, paddingVertical: 8 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: Spacing.two, paddingBottom: Spacing.five },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  attachIco: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
