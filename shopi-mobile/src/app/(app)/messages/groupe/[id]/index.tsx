/**
 * Messagerie › Discussion de groupe (groupes libres et groupes de commande,
 * GET/POST /delivery-groups/:id/messages). Liste inversée type messagerie,
 * nom de l'expéditeur au-dessus de ses bulles, séparateurs de jour, messages
 * système centrés (création, ajout de membres…), réponses citées, photo,
 * vidéo, fichier et message vocal (mêmes bulles et même visionneuse plein
 * écran que la discussion privée), en direct (groups-realtime.ts).
 *
 * Appui long sur un message : Répondre · Copier · Modifier (mes textes) ·
 * Supprimer pour moi / pour tous (mes messages) — mêmes règles que le serveur.
 * Les permissions fixées par un administrateur (écrire, vocal) sont
 * respectées dans la barre de saisie ; un groupe expiré/annulé est en lecture seule.
 * En-tête : toucher la photo ou le nom ouvre les infos du groupe (membres,
 * admins, droits) ; à droite, appel audio et appel vidéo du groupe
 * (features/calls/group-call-store.ts). Un appel en cours dans le groupe
 * s'affiche en bandeau « Rejoindre ». Les traces d'appel sont rangées du côté
 * de celui qui a appelé ; seuls les messages système restent centrés.
 * Bulles : les miennes vert clair à droite, les autres blanches à gauche.
 * Photo, vidéo ou fichier : aperçu avant l'envoi avec un commentaire facultatif.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, ChatBubble, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { joinGroupCall, rememberGroup, startGroupCall, useGroupCallStore } from '@/features/calls/group-call-store';
import { thumb } from '@/features/catalog/format';
import {
  deleteGroupMessage, editGroupMessage, fetchGroupMessages, fetchGroups, isGroupClosed, markGroupRead, sendGroupMessage,
  type Group, type GroupMessage, type GroupMessagePage, type OutgoingGroupMessage,
} from '@/features/messagerie/groups-api';
import { useGroupChatRealtime } from '@/features/messagerie/groups-realtime';
import { enterRecordingMode, exitRecordingMode, VOICE_FILE } from '@/features/messagerie/voice';
import { setActiveConversation } from '../../../../../../modules/shopi-calls';
import { toUserMessage } from '@/lib/api/errors';
import MediaViewer from '@/features/messagerie/MediaViewer';
import { AudioBubble, FileBubble, fmtClock, ImageBubble, VideoBubble, type OpenMedia } from '@/features/messagerie/MediaBubbles';
import { AttachmentComposer, type PendingAttachment } from '@/features/messagerie/components/attachment-composer';
import { DOCUMENT_TYPES, isPhotoOrVideo } from '@/features/messagerie/documents';
import { uploadAttachment } from '@/features/messagerie/upload';
import { useTheme } from '@/hooks/use-theme';

/** Message affiché : celui du serveur, ou un envoi optimiste en cours / échoué. */
type Msg = GroupMessage & { _sending?: boolean; _failed?: boolean };
type Pages = InfiniteData<GroupMessagePage, number>;

const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Pièce jointe à envoyer + commentaire facultatif. */
type GroupMediaOpts = {
  kind: 'image' | 'video' | 'document' | 'audio';
  contentType: 'image' | 'video' | 'file' | 'audio';
  uri: string; name: string; mimeType: string; size?: number; durationSec?: number;
  caption?: string;
};
const SENDER_COLORS = ['#1F1F1F', '#D97706', '#7C3AED', '#059669', '#DB2777', '#0E9F6E', '#B45309', '#1F1F1F'];

function senderColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
}
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (t === today) return 'Aujourd’hui';
  if (t === today - 86_400_000) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function previewOf(m: Pick<GroupMessage, 'contentType' | 'content'> & { deleted?: boolean }): string {
  if (m.deleted) return 'Message supprimé';
  switch (m.contentType) {
    case 'image': return m.content ? `📷 ${m.content}` : '📷 Photo';
    case 'video': return m.content ? `🎥 ${m.content}` : '🎥 Vidéo';
    case 'audio': return '🎙️ Message vocal';
    case 'file':  return m.content ? `📄 ${m.content}` : '📄 Document';
    default:      return m.content ?? '';
  }
}

export default function GroupChatScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; photo?: string }>();
  const groupId = params.id;
  /* Groupe à l'écran : sa notification se ferme et ses nouveaux messages ne sonnent pas. */
  useEffect(() => {
    if (!groupId) return;
    setActiveConversation(groupId);
    return () => setActiveConversation(null);
  }, [groupId]);
  const theme = useTheme();
  const qc = useQueryClient();
  const myId = useSession((s) => s.user?.id) ?? '';
  const listRef = useRef<FlatList<Msg>>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [actionsFor, setActionsFor] = useState<Msg | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  /* Pièce jointe choisie, en attente du commentaire (aperçu avant l'envoi). */
  const [pending, setPending] = useState<{ view: PendingAttachment; media: GroupMediaOpts } | null>(null);
  const [viewerMedia, setViewerMedia] = useState<{ kind: 'image' | 'video'; url: string; name?: string | null } | null>(null);

  /* Infos du groupe (permissions, statut, membres en ligne) — même cache que la liste. */
  const groups = useQuery({ queryKey: ['groups'], queryFn: fetchGroups });
  const group: Group | undefined = groups.data?.find((g) => g.id === groupId);
  const title = group?.name ?? params.name ?? 'Groupe';
  const photo = thumb(group?.photoUrl ?? params.photo, 120);
  const perms = group?.myPermissions;
  const closed = group ? isGroupClosed(group) : false;
  const canText = !closed && (perms?.canSendMessages ?? true);
  const canVoice = !closed && (perms?.canSendVoice ?? true);
  const othersOnline = (group?.onlineUserIds ?? []).filter((u) => u !== myId).length;
  /* Appels : l'administrateur peut retirer le droit de LANCER un appel (répondre reste permis). */
  const canStartCall = !closed && ((perms?.isAdmin ?? false) || (perms?.canCall ?? true));
  const activeCall = useGroupCallStore((st) => (groupId ? st.activeByGroup[groupId] : undefined));
  const inThisCall = useGroupCallStore((st) => st.status !== 'idle' && st.groupId === groupId);
  const callNotice = useGroupCallStore((st) => (st.status === 'idle' ? st.notice : null));
  useEffect(() => {
    if (groupId) rememberGroup(groupId, title, photo ?? null);
  }, [groupId, title, photo]);

  async function callGroup(callType: 'audio' | 'video') {
    if (!groupId) return;
    const err = await startGroupCall(groupId, title, photo ?? null, callType);
    if (err) Alert.alert('Appel impossible', err);
  }

  const list = useInfiniteQuery({
    queryKey: ['group-messages', groupId],
    queryFn: ({ pageParam }) => fetchGroupMessages(groupId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: !!groupId,
    /* La copie gardée s'affiche tout de suite, et le fil est revérifié à chaque ouverture
     * (avant : 5 min sans revérifier — un message reçu hors de l'écran manquait). */
    staleTime: 0,
  });

  function markRead() {
    qc.setQueryData<Group[]>(['groups'], (old) => old?.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)));
    void markGroupRead(groupId).catch(() => undefined);
  }
  useGroupChatRealtime(groupId, markRead);
  useEffect(() => {
    if (groupId) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  /* Plus récent en premier (liste inversée) ; une page plus ancienne peut
   * recouvrir la précédente quand de nouveaux messages décalent la pagination → dédoublonnage. */
  const messagesDesc = useMemo(() => {
    const seen = new Set<string>();
    const out: Msg[] = [];
    for (const p of list.data?.pages ?? []) {
      for (let i = p.messages.length - 1; i >= 0; i--) {
        const m = p.messages[i] as Msg;
        if (!seen.has(m.id)) { seen.add(m.id); out.push(m); }
      }
    }
    return out;
  }, [list.data]);

  // ── Cache local (envois optimistes) ─────────────────────────────

  function setMessages(fn: (m: Msg) => Msg | null) {
    qc.setQueryData<Pages>(['group-messages', groupId], (old) =>
      old && { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.map((m) => fn(m as Msg)).filter((m): m is Msg => m !== null) })) });
  }
  function appendOptimistic(msg: Msg) {
    qc.setQueryData<Pages>(['group-messages', groupId], (old) => {
      if (!old || old.pages.length === 0) return old;
      const pages = old.pages.slice();
      pages[0] = { ...pages[0], messages: [...pages[0].messages, msg] };
      return { ...old, pages };
    });
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }
  function bumpGroupList(m: Pick<GroupMessage, 'contentType' | 'content' | 'createdAt'>) {
    qc.setQueryData<Group[]>(['groups'], (old) => old
      ?.map((g) => (g.id === groupId ? { ...g, lastMessage: `Vous : ${previewOf(m)}`, lastMessageAt: m.createdAt } : g))
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')));
  }

  function baseOptimistic(contentType: string): Msg {
    return {
      id: tempId(), groupId, senderUserId: myId, senderName: 'Vous', senderType: null,
      contentType, content: null, isEdited: false, deleted: false,
      replyToId: replyTo?.id ?? null,
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, contentType: replyTo.contentType, senderName: replyTo.senderName, deleted: replyTo.deleted } : null,
      createdAt: new Date().toISOString(), _sending: true,
    };
  }

  async function deliver(optimistic: Msg, payload: OutgoingGroupMessage) {
    try {
      const real = await sendGroupMessage(groupId, payload);
      /* Sans doublon si l'écho temps réel est arrivé avant la réponse */
      const already = (qc.getQueryData<Pages>(['group-messages', groupId])?.pages ?? []).some((p) => p.messages.some((m) => m.id === real.id));
      setMessages((m) => (m.id === optimistic.id ? (already ? null : real) : m));
      bumpGroupList(real);
    } catch (err) {
      setMessages((m) => (m.id === optimistic.id ? { ...m, _sending: false, _failed: true } : m));
      if (err instanceof Error && /autorise|expiré|annulée/i.test(err.message)) Alert.alert('Envoi refusé', err.message);
    }
  }

  // ── Texte (envoi ou modification) ─────────────────────────────────

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');

    if (editing) {
      const target = editing;
      setEditing(null);
      if (content === target.content) return;
      setMessages((m) => (m.id === target.id ? { ...m, content, isEdited: true } : m));
      try { await editGroupMessage(groupId, target.id, content); } catch (err) {
        setMessages((m) => (m.id === target.id ? { ...m, content: target.content, isEdited: target.isEdited } : m));
        Alert.alert('Modification impossible', err instanceof Error ? err.message : 'Réessayez.');
      }
      return;
    }

    const optimistic: Msg = { ...baseOptimistic('text'), content };
    const replyId = replyTo?.id;
    setReplyTo(null);
    appendOptimistic(optimistic);
    await deliver(optimistic, { contentType: 'text', content, replyToId: replyId });
  }

  async function retry(m: Msg) {
    setMessages((x) => (x.id === m.id ? { ...x, _failed: false, _sending: true } : x));
    if (m.contentType === 'text') {
      await deliver(m, { contentType: 'text', content: m.content ?? '', replyToId: m.replyToId ?? undefined });
    } else {
      setMessages((x) => (x.id === m.id ? null : x));
      Alert.alert('Envoi échoué', 'Renvoyez la pièce jointe depuis le bouton « + ».');
    }
  }

  // ── Pièces jointes et vocal ───────────────────────────────────────

  async function sendMedia(opts: GroupMediaOpts) {
    const optimistic: Msg = {
      ...baseOptimistic(opts.contentType),
      content: opts.caption || null,
      mediaUrl: opts.uri, mediaName: opts.name, mediaMimeType: opts.mimeType, mediaDuration: opts.durationSec ?? null,
    };
    const replyId = replyTo?.id;
    setReplyTo(null);
    appendOptimistic(optimistic);
    try {
      const url = await uploadAttachment(opts.kind, { uri: opts.uri, name: opts.name, mimeType: opts.mimeType });
      await deliver(optimistic, {
        contentType: opts.contentType, mediaUrl: url, mediaName: opts.name,
        mediaSize: opts.size, mediaMimeType: opts.mimeType, mediaDuration: opts.durationSec, replyToId: replyId,
        content: opts.caption || undefined,
      });
    } catch (err) {
      console.error('[Groupe] envoi média échoué :', err);
      // Raison lisible (format refusé, fichier trop lourd, réseau…) au lieu d'un échec muet.
      Alert.alert('Envoi impossible', toUserMessage(err));
      setMessages((m) => (m.id === optimistic.id ? { ...m, _sending: false, _failed: true } : m));
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
    const media: GroupMediaOpts = {
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
    const media: GroupMediaOpts = { kind: 'image', contentType: 'image', uri: a.uri, name: a.fileName ?? 'photo.jpg', mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize };
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
    const media: GroupMediaOpts = { kind: 'document', contentType: 'file', uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream', size: a.size };
    setPending({ media, view: { kind: 'document', uri: a.uri, name: a.name, size: a.size } });
  }

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 120);
  const [recStartedAt, setRecStartedAt] = useState(0);

  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert('Permission refusée', 'Autorisez le micro pour envoyer un message vocal.'); return; }
      await enterRecordingMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecStartedAt(Date.now());
    } catch (err) {
      console.error('[Groupe] démarrage de l’enregistrement échoué :', err);
      Alert.alert('Erreur', "Impossible de démarrer l'enregistrement.");
    }
  }
  async function cancelRecording() {
    try { await recorder.stop(); } catch { /* déjà arrêté */ }
    void exitRecordingMode();
  }
  async function sendRecording() {
    const durationSec = Math.round((Date.now() - recStartedAt) / 1000);
    try { await recorder.stop(); } catch { /* ignore */ }
    void exitRecordingMode();
    const uri = recorder.uri;
    if (!uri || durationSec < 1) return;
    void sendMedia({ kind: 'audio', contentType: 'audio', uri, ...VOICE_FILE, durationSec });
  }
  /* Quitter l'écran pendant un enregistrement : on coupe le micro. */
  useEffect(() => () => {
    try { void recorder.stop().catch(() => undefined); } catch { /* lecteur déjà libéré */ }
  }, [recorder]);

  // ── Actions sur un message ────────────────────────────────────────

  async function removeMessage(m: Msg, mode: 'me' | 'everyone') {
    setActionsFor(null);
    const before = m;
    setMessages((x) => (x.id !== m.id ? x : mode === 'me' ? null : { ...x, deleted: true, content: null, mediaUrl: null }));
    try { await deleteGroupMessage(groupId, m.id, mode); } catch (err) {
      setMessages((x) => (x.id === before.id ? before : x));
      void list.refetch();
      Alert.alert('Suppression impossible', err instanceof Error ? err.message : 'Réessayez.');
    }
  }

  const openMedia: OpenMedia = (kind, url, name) => setViewerMedia({ kind, url, name });
  const goInfos = () => router.push({ pathname: '/messages/groupe/[id]/infos', params: { id: groupId } });

  const subtitle = closed
    ? (group?.status === 'cancelled' ? 'Commande annulée — lecture seule' : 'Groupe expiré — lecture seule')
    : [group ? `${group.memberCount} membres` : null, othersOnline ? `${othersOnline} en ligne` : null].filter(Boolean).join(' · ') || 'Toucher pour les infos du groupe';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Pressable onPress={goInfos} accessibilityRole="button" accessibilityLabel="Infos du groupe" style={styles.headMain}>
          <View style={[styles.headAvatar, { backgroundColor: group?.kind === 'order' ? '#FFF4E5' : theme.backgroundSelected }]}>
            {photo
              ? <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" />
              : <Ionicons name={group?.kind === 'order' ? 'cube' : 'people'} size={20} color={group?.kind === 'order' ? '#D97706' : Brand.primary} />}
          </View>
          <View style={styles.flex}>
            <ThemedText numberOfLines={1} style={styles.headName} accessibilityRole="header">{title}</ThemedText>
            <ThemedText numberOfLines={1} type="small" style={othersOnline && !closed ? { color: Brand.success } : undefined} themeColor={othersOnline && !closed ? undefined : 'textSecondary'}>
              {subtitle}
            </ThemedText>
          </View>
        </Pressable>
        {canStartCall ? (
          <>
            <Pressable onPress={() => void callGroup('audio')} accessibilityRole="button" accessibilityLabel="Appel audio du groupe" hitSlop={8} style={styles.headBtn}>
              <Ionicons name="call" size={20} color={theme.text} />
            </Pressable>
            <Pressable onPress={() => void callGroup('video')} accessibilityRole="button" accessibilityLabel="Appel vidéo du groupe" hitSlop={8} style={styles.headBtn}>
              <Ionicons name="videocam" size={21} color={theme.text} />
            </Pressable>
          </>
        ) : null}
      </View>

      {/* ── Appel en cours dans le groupe (sonnerie manquée ou refusée) ── */}
      {activeCall && !inThisCall && !closed ? (
        <Pressable
          onPress={() => groupId && void joinGroupCall(groupId, activeCall.callId, activeCall.callType)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.callBanner, pressed && { opacity: 0.85 }]}>
          <View style={styles.callBannerIco}>
            <Ionicons name={activeCall.callType === 'video' ? 'videocam' : 'call'} size={16} color="#fff" />
          </View>
          <ThemedText numberOfLines={1} style={styles.callBannerText}>
            Appel {activeCall.callType === 'video' ? 'vidéo' : 'audio'} en cours{activeCall.initiatorName ? ` · ${activeCall.initiatorName}` : ''}
          </ThemedText>
          <View style={styles.callBannerBtn}><ThemedText style={styles.callBannerBtnText}>Rejoindre</ThemedText></View>
        </Pressable>
      ) : null}
      {callNotice ? (
        <View style={styles.callNotice}><ThemedText type="small" style={styles.callNoticeText}>{callNotice}</ThemedText></View>
      ) : null}

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Chargement / erreur : toute la hauteur — le champ de saisie reste en bas dès l'ouverture. */}
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
            renderItem={({ item, index }) => {
              const older = messagesDesc[index + 1];
              const newer = messagesDesc[index - 1];
              const newDay = !older || dayKey(older.createdAt) !== dayKey(item.createdAt);
              const isSystem = item.contentType === 'system';
              const isCall = item.contentType === 'call' && !item.deleted;
              const firstOfRun = newDay || !older || older.senderUserId !== item.senderUserId || older.contentType === 'system';
              const lastOfRun = !newer || newer.senderUserId !== item.senderUserId || dayKey(newer.createdAt) !== dayKey(item.createdAt);
              return (
                <View>
                  {newDay ? (
                    <View style={styles.dayWrap}>
                      <ThemedText style={[styles.dayPill, { backgroundColor: theme.backgroundElement }]}>{dayLabel(item.createdAt)}</ThemedText>
                    </View>
                  ) : null}
                  {isSystem ? (
                    <SystemLine m={item} />
                  ) : isCall ? (
                    <CallLine m={item} mine={item.senderUserId === myId} />
                  ) : (
                    <Bubble
                      m={item}
                      mine={item.senderUserId === myId}
                      showName={firstOfRun}
                      tail={lastOfRun}
                      onOpenMedia={openMedia}
                      onLongPress={() => !item._sending && setActionsFor(item)}
                      onRetry={() => void retry(item)}
                    />
                  )}
                </View>
              );
            }}
            ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} style={styles.more} /> : null}
            ListEmptyComponent={
              <View style={styles.empty}>
                <ThemedText themeColor="textSecondary" style={styles.center}>Aucun message. Lancez la discussion 👋</ThemedText>
              </View>
            }
          />
        )}

        {/* ── Réponse / modification en cours ── */}
        {(replyTo || editing) && !recState.isRecording ? (
          <View style={[styles.replyBar, { borderTopColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <Ionicons name={editing ? 'pencil' : 'arrow-undo'} size={16} color={Brand.primary} />
            <View style={[styles.replyQuote, { borderLeftColor: Brand.primary }]}>
              <ThemedText numberOfLines={1} style={styles.replyName}>{editing ? 'Modifier le message' : `Répondre à ${replyTo?.senderUserId === myId ? 'vous-même' : replyTo?.senderName ?? ''}`}</ThemedText>
              <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">{previewOf((editing ?? replyTo)!)}</ThemedText>
            </View>
            <Pressable onPress={() => { setReplyTo(null); if (editing) { setEditing(null); setDraft(''); } }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Annuler">
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        {/* ── Barre de saisie selon les droits ── */}
        {!canText && !canVoice ? (
          <View style={[styles.readOnly, { borderTopColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="lock-closed" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {closed ? 'Ce groupe est fermé : vous pouvez lire les messages mais plus en envoyer.' : 'Seuls les administrateurs peuvent envoyer des messages dans ce groupe.'}
            </ThemedText>
          </View>
        ) : recState.isRecording ? (
          <View style={[styles.inputBar, { borderTopColor: theme.border }]}>
            <Pressable onPress={() => void cancelRecording()} accessibilityRole="button" accessibilityLabel="Annuler" style={styles.iconBtn}>
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
            {canText && !editing ? (
              <Pressable onPress={() => setAttachOpen(true)} accessibilityRole="button" accessibilityLabel="Joindre" style={styles.iconBtn}>
                <Ionicons name="add" size={24} color={theme.textSecondary} />
              </Pressable>
            ) : null}
            <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                editable={canText}
                placeholder={canText ? 'Votre message…' : 'Seuls les messages vocaux sont autorisés'}
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text }]}
                multiline
                maxLength={5000}
                accessibilityLabel="Votre message"
              />
            </View>
            {draft.trim() ? (
              <Pressable onPress={() => void handleSend()} accessibilityRole="button" accessibilityLabel={editing ? 'Enregistrer la modification' : 'Envoyer'} style={styles.sendBtn}>
                <Ionicons name={editing ? 'checkmark' : 'send'} size={18} color={Brand.primaryInk} />
              </Pressable>
            ) : canVoice && !editing ? (
              <Pressable onPress={() => void startRecording()} accessibilityRole="button" accessibilityLabel="Message vocal" style={styles.sendBtn}>
                <Ionicons name="mic" size={19} color={Brand.primaryInk} />
              </Pressable>
            ) : (
              <View style={[styles.sendBtn, styles.sendOff]}><Ionicons name="send" size={18} color="#fff" /></View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Pièce jointe ── */}
      <Modal visible={attachOpen} transparent animationType="fade" onRequestClose={() => setAttachOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setAttachOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <SheetRow icon="image" label="Photo ou vidéo" color="#7C3AED" onPress={() => void pickFromLibrary()} />
            <SheetRow icon="camera" label="Prendre une photo" color="#059669" onPress={() => void pickFromCamera()} />
            <SheetRow icon="document" label="Fichier (PDF, Word, Excel…)" color="#1F1F1F" onPress={() => void pickDocument()} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Aperçu + commentaire avant l'envoi d'une pièce jointe ── */}
      <AttachmentComposer
        attachment={pending?.view ?? null}
        recipient={title}
        onCancel={() => setPending(null)}
        onSend={(caption) => { const p = pending; setPending(null); if (p) void sendMedia({ ...p.media, caption }); }}
      />

      {/* ── Actions sur un message (appui long) ── */}
      <Modal visible={!!actionsFor} transparent animationType="fade" onRequestClose={() => setActionsFor(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionsFor(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            {actionsFor ? (
              <>
                <ThemedText numberOfLines={2} type="small" themeColor="textSecondary" style={styles.sheetPreview}>
                  {actionsFor.senderUserId === myId ? 'Vous' : actionsFor.senderName} : {previewOf(actionsFor)}
                </ThemedText>
                {canText && !actionsFor.deleted && !actionsFor._failed ? (
                  <SheetRow icon="arrow-undo" label="Répondre" color={Brand.primary} onPress={() => { setEditing(null); setReplyTo(actionsFor); setActionsFor(null); }} />
                ) : null}
                {actionsFor.contentType === 'text' && actionsFor.content && !actionsFor.deleted ? (
                  <SheetRow icon="copy" label="Copier le texte" color="#0E9F6E" onPress={() => { void Clipboard.setStringAsync(actionsFor.content ?? ''); setActionsFor(null); }} />
                ) : null}
                {actionsFor.senderUserId === myId && actionsFor.contentType === 'text' && !actionsFor.deleted && !actionsFor._failed && canText ? (
                  <SheetRow icon="pencil" label="Modifier" color="#D97706" onPress={() => { setReplyTo(null); setEditing(actionsFor); setDraft(actionsFor.content ?? ''); setActionsFor(null); }} />
                ) : null}
                {actionsFor.senderUserId === myId && !actionsFor._failed ? (
                  <>
                    <SheetRow icon="trash-outline" label="Supprimer pour moi" color={Brand.danger} onPress={() => void removeMessage(actionsFor, 'me')} />
                    {!actionsFor.deleted ? (
                      <SheetRow icon="trash" label="Supprimer pour tout le monde" color={Brand.danger} onPress={() => void removeMessage(actionsFor, 'everyone')} />
                    ) : null}
                  </>
                ) : null}
                {actionsFor._failed ? (
                  <SheetRow icon="close-circle" label="Retirer ce message non envoyé" color={Brand.danger} onPress={() => { const id = actionsFor.id; setMessages((x) => (x.id === id ? null : x)); setActionsFor(null); }} />
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

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

function SheetRow({ icon, label, color, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.sheetIco, { backgroundColor: `${color}1F` }]}><Ionicons name={icon} size={20} color={color} /></View>
      <ThemedText style={{ color: theme.text }}>{label}</ThemedText>
    </Pressable>
  );
}

/** Message système (création, ajout de membres, admin…) : pastille centrée. */
function SystemLine({ m }: { m: Msg }) {
  const theme = useTheme();
  const text = m.content ?? '';
  return (
    <View style={styles.sysWrap}>
      <ThemedText style={[styles.sysText, { backgroundColor: theme.backgroundSelected }]}>{text}</ThemedText>
    </View>
  );
}

/** Trace d'appel de groupe, du côté de celui qui a lancé l'appel (nom au-dessus si ce n'est pas moi). */
function CallLine({ m, mine }: { m: Msg; mine: boolean }) {
  let meta: { callType?: string; status?: string; duration?: number } = {};
  try { meta = JSON.parse(m.content ?? '{}') ?? {}; } catch { /* trace ancienne */ }
  const video = meta.callType === 'video';
  const missed = meta.status === 'missed';
  const kind = video ? 'vidéo' : 'audio';
  const dur = meta.duration ? ` · ${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2, '0')}` : '';
  const label = missed
    ? (mine ? `Appel ${kind} sans réponse` : `Appel ${kind} de groupe manqué`)
    : `Appel ${kind} de groupe${dur}`;
  const color = missed ? (mine ? '#8A93A3' : Brand.danger) : Brand.success;
  const name = m.senderName ?? 'Membre';
  const tone = senderColor(m.senderUserId);
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, styles.rowGap]}>
      {!mine ? (
        <View style={styles.sideAvatar}>
          <View style={[styles.miniAvatar, { backgroundColor: `${tone}22` }]}>
            <ThemedText style={[styles.miniAvatarText, { color: tone }]}>{initials(name)}</ThemedText>
          </View>
        </View>
      ) : null}
      <View style={[
        styles.callPill, styles.shadow,
        mine ? styles.tailMine : styles.tailTheirs,
        mine ? { backgroundColor: ChatBubble.mine, borderColor: ChatBubble.mineBorder } : { backgroundColor: ChatBubble.theirs, borderColor: ChatBubble.theirsBorder },
      ]}>
        {!mine ? <ThemedText numberOfLines={1} style={[styles.sender, { color: tone }]}>{name}</ThemedText> : null}
        <View style={styles.callLineRow}>
          <View style={[styles.callIco, { backgroundColor: `${color}1F` }]}>
            <Ionicons name={video ? (missed && !mine ? 'videocam-off' : 'videocam') : 'call'} size={15} color={color} />
          </View>
          <ThemedText style={[styles.callText, { color: missed && !mine ? Brand.danger : ChatBubble.mineText }]}>{label}</ThemedText>
          <ThemedText style={[styles.metaText, mine && styles.metaMine]}>{timeOf(m.createdAt)}</ThemedText>
        </View>
      </View>
    </View>
  );
}

function Bubble({ m, mine, showName, tail, onOpenMedia, onLongPress, onRetry }: {
  m: Msg; mine: boolean; showName: boolean; tail: boolean;
  onOpenMedia: OpenMedia; onLongPress: () => void; onRetry: () => void;
}) {
  const color = senderColor(m.senderUserId);
  const media = !m.deleted && (m.contentType === 'image' || m.contentType === 'video');
  const name = m.senderName ?? 'Membre';
  /* Commentaire joint à une photo, vidéo ou fichier */
  const caption = !m.deleted && (m.contentType === 'image' || m.contentType === 'video' || m.contentType === 'file') ? (m.content?.trim() || null) : null;
  const overlay = media && !caption;

  const inner = (() => {
    if (m.deleted) return <ThemedText style={[styles.text, mine && styles.textMine, styles.italic]}>Message supprimé</ThemedText>;
    switch (m.contentType) {
      case 'image': return <ImageBubble m={m} onOpenMedia={onOpenMedia} onLongPress={onLongPress} />;
      case 'video': return <VideoBubble m={m} onOpenMedia={onOpenMedia} onLongPress={onLongPress} />;
      case 'audio': return <AudioBubble m={m} isMe={mine} />;
      case 'file':  return <FileBubble m={m} isMe={mine} onLongPress={onLongPress} />;
      default:      return <ThemedText style={[styles.text, mine && styles.textMine]} selectable>{m.content}</ThemedText>;
    }
  })();

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs, tail && styles.rowGap]}>
      {!mine ? (
        <View style={styles.sideAvatar}>
          {tail ? (
            <View style={[styles.miniAvatar, { backgroundColor: `${color}22` }]}>
              <ThemedText style={[styles.miniAvatarText, { color }]}>{initials(name)}</ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        onPress={m._failed ? onRetry : undefined}
        delayLongPress={300}
        accessibilityHint="Appui long pour plus d’actions"
        style={[
          styles.bubble,
          styles.shadow,
          tail && (mine ? styles.tailMine : styles.tailTheirs),
          media && styles.bubbleMedia,
          mine ? { backgroundColor: ChatBubble.mine, borderColor: ChatBubble.mineBorder, borderWidth: 1 } : { backgroundColor: ChatBubble.theirs, borderColor: ChatBubble.theirsBorder, borderWidth: 1 },
          m._failed && styles.failed,
        ]}>
        {!mine && showName ? (
          <ThemedText numberOfLines={1} style={[styles.sender, { color }, media && styles.senderOnMedia]}>{name}</ThemedText>
        ) : null}
        {m.replyTo ? (
          <View style={[styles.quote, { borderLeftColor: mine ? ChatBubble.mineQuoteBar : Brand.primary, backgroundColor: mine ? ChatBubble.mineQuoteBg : `${Brand.primary}0F` }]}>
            <ThemedText numberOfLines={1} style={[styles.quoteName, mine && styles.textMine]}>{m.replyTo.senderName ?? 'Membre'}</ThemedText>
            <ThemedText numberOfLines={1} type="small" style={mine ? styles.quoteMine : undefined} themeColor={mine ? undefined : 'textSecondary'}>
              {previewOf(m.replyTo)}
            </ThemedText>
          </View>
        ) : null}
        {inner}
        {caption ? (
          <ThemedText selectable style={[styles.text, styles.caption, media && styles.captionOnMedia, mine && styles.textMine]}>{caption}</ThemedText>
        ) : null}
        <View style={[styles.meta, media && !overlay && styles.metaMedia]}>
          {m.isEdited && !m.deleted ? <ThemedText style={[styles.metaText, mine && styles.metaMine]}>modifié</ThemedText> : null}
          <ThemedText style={[styles.metaText, mine && styles.metaMine, overlay && styles.metaOnMedia]}>{timeOf(m.createdAt)}</ThemedText>
          {mine && m._sending ? <Ionicons name="time-outline" size={12} color={overlay ? '#fff' : ChatBubble.mineMeta} /> : null}
          {mine && !m._sending && !m._failed ? <Ionicons name="checkmark" size={13} color={overlay ? '#fff' : ChatBubble.mineMeta} /> : null}
          {m._failed ? <Ionicons name="alert-circle" size={14} color="#fff" /> : null}
        </View>
        {m._failed ? <ThemedText style={styles.failedText}>Échec — toucher pour réessayer</ThemedText> : null}
      </Pressable>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.two, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { padding: 6 },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  headName: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  headBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.three, flexGrow: 1, justifyContent: 'flex-end' },
  chatBg: { backgroundColor: ChatBubble.screen },
  callPill: { borderWidth: 1, borderRadius: 18, paddingLeft: 8, paddingRight: 12, paddingVertical: 7, maxWidth: '100%' },
  callLineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  callIco: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  callText: { fontSize: 13.5, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  callBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: Spacing.three, marginTop: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: '#E8F7EE', borderWidth: 1, borderColor: 'rgba(18,140,74,.25)' },
  callBannerIco: { width: 30, height: 30, borderRadius: 15, backgroundColor: Brand.success, alignItems: 'center', justifyContent: 'center' },
  callBannerText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: '#14532D' },
  callBannerBtn: { backgroundColor: Brand.success, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  callBannerBtnText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  callNotice: { marginHorizontal: Spacing.three, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFF7ED' },
  callNoticeText: { color: '#B45309', fontWeight: '600' },
  empty: { paddingVertical: 60, alignItems: 'center' },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  dayPill: { fontSize: 12, lineHeight: 16, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', color: '#5E5E5E' },
  sysWrap: { alignItems: 'center', marginVertical: 6, paddingHorizontal: Spacing.four },
  sysText: { fontSize: 12.5, lineHeight: 17, textAlign: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, overflow: 'hidden', color: '#3F3F3F' },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 1.5 },
  rowGap: { marginBottom: 6 },
  rowMine: { justifyContent: 'flex-end', paddingLeft: 48 },
  rowTheirs: { justifyContent: 'flex-start', paddingRight: 40 },
  sideAvatar: { width: 32, marginRight: 6 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  bubble: { maxWidth: '100%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  shadow: { shadowColor: '#1F1F1F', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  tailMine: { borderBottomRightRadius: 4 },
  tailTheirs: { borderBottomLeftRadius: 4 },
  bubbleMedia: { padding: 4, overflow: 'hidden' },
  failed: { backgroundColor: '#E5484D' },
  failedText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '700', marginTop: 2 },
  sender: { fontSize: 12.5, lineHeight: 16, fontWeight: '800', marginBottom: 2 },
  senderOnMedia: { paddingHorizontal: 8, paddingTop: 4 },
  text: { fontSize: 15, lineHeight: 20 },
  textMine: { color: ChatBubble.mineText },
  italic: { fontStyle: 'italic', opacity: 0.85 },
  caption: { marginTop: 6 },
  captionOnMedia: { maxWidth: 220, paddingHorizontal: 6 },
  metaMedia: { paddingHorizontal: 6, paddingBottom: 2 },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingLeft: 8, paddingRight: 6, paddingVertical: 4, marginBottom: 5 },
  quoteName: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: Brand.primary },
  quoteMine: { color: ChatBubble.mineMeta },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  metaText: { fontSize: 10.5, lineHeight: 13, color: '#8A93A3' },
  metaMine: { color: ChatBubble.mineMeta },
  metaOnMedia: { color: '#fff', backgroundColor: 'rgba(0,0,0,.35)', paddingHorizontal: 5, borderRadius: 6, overflow: 'hidden' },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.three, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  replyQuote: { flex: 1, borderLeftWidth: 3, paddingLeft: 8 },
  replyName: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: Brand.primary },
  readOnly: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.three, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: Spacing.three, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inputBox: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120 },
  input: { fontSize: 15, lineHeight: 20, maxHeight: 104 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.35 },
  recBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 14, minHeight: 40 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.danger },
  recTime: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: Spacing.two, paddingBottom: Spacing.five },
  sheetPreview: { paddingHorizontal: Spacing.four, paddingVertical: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  sheetIco: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
