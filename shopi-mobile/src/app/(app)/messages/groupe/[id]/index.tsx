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
 * En-tête : toucher le nom ouvre les infos du groupe (membres, admins, droits).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { thumb } from '@/features/catalog/format';
import {
  deleteGroupMessage, editGroupMessage, fetchGroupMessages, fetchGroups, isGroupClosed, markGroupRead, sendGroupMessage,
  type Group, type GroupMessage, type GroupMessagePage, type OutgoingGroupMessage,
} from '@/features/messagerie/groups-api';
import { useGroupChatRealtime } from '@/features/messagerie/groups-realtime';
import MediaViewer from '@/features/messagerie/MediaViewer';
import { AudioBubble, FileBubble, fmtClock, ImageBubble, VideoBubble, type OpenMedia } from '@/features/messagerie/MediaBubbles';
import { uploadAttachment } from '@/features/messagerie/upload';
import { useTheme } from '@/hooks/use-theme';

/** Message affiché : celui du serveur, ou un envoi optimiste en cours / échoué. */
type Msg = GroupMessage & { _sending?: boolean; _failed?: boolean };
type Pages = InfiniteData<GroupMessagePage, number>;

const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    case 'image': return '📷 Photo';
    case 'video': return '🎥 Vidéo';
    case 'audio': return '🎙️ Message vocal';
    case 'file':  return '📄 Document';
    default:      return m.content ?? '';
  }
}

export default function GroupChatScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string; photo?: string }>();
  const groupId = params.id;
  const theme = useTheme();
  const qc = useQueryClient();
  const myId = useSession((s) => s.user?.id) ?? '';
  const listRef = useRef<FlatList<Msg>>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [actionsFor, setActionsFor] = useState<Msg | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
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

  const list = useInfiniteQuery({
    queryKey: ['group-messages', groupId],
    queryFn: ({ pageParam }) => fetchGroupMessages(groupId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: !!groupId,
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
      setMessages((m) => (m.id === optimistic.id ? real : m));
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

  async function sendMedia(opts: {
    kind: 'image' | 'video' | 'document' | 'audio';
    contentType: 'image' | 'video' | 'file' | 'audio';
    uri: string; name: string; mimeType: string; size?: number; durationSec?: number;
  }) {
    const optimistic: Msg = {
      ...baseOptimistic(opts.contentType),
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
      });
    } catch (err) {
      console.error('[Groupe] envoi média échoué :', err);
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

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 120);
  const [recStartedAt, setRecStartedAt] = useState(0);

  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert('Permission refusée', 'Autorisez le micro pour envoyer un message vocal.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
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
  }
  async function sendRecording() {
    const durationSec = Math.round((Date.now() - recStartedAt) / 1000);
    try { await recorder.stop(); } catch { /* ignore */ }
    const uri = recorder.uri;
    if (!uri || durationSec < 1) return;
    void sendMedia({ kind: 'audio', contentType: 'audio', uri, name: 'vocal.m4a', mimeType: 'audio/m4a', durationSec });
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
        <Pressable onPress={goInfos} accessibilityRole="button" accessibilityLabel="Infos du groupe" hitSlop={8} style={styles.headBtn}>
          <Ionicons name="information-circle-outline" size={24} color={theme.text} />
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
            renderItem={({ item, index }) => {
              const older = messagesDesc[index + 1];
              const newer = messagesDesc[index - 1];
              const newDay = !older || dayKey(older.createdAt) !== dayKey(item.createdAt);
              const isSystem = item.contentType === 'system' || item.contentType === 'call';
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
            <SheetRow icon="document" label="Fichier" color="#1F1F1F" onPress={() => void pickDocument()} />
          </Pressable>
        </Pressable>
      </Modal>

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

/** Message système (création, ajout de membres, admin…) ou trace d'appel : pastille centrée. */
function SystemLine({ m }: { m: Msg }) {
  const theme = useTheme();
  let text = m.content ?? '';
  if (m.contentType === 'call') {
    try {
      const meta = JSON.parse(m.content ?? '{}') as { callType?: string; status?: string };
      text = meta.status === 'missed' ? '📞 Appel de groupe manqué' : `📞 Appel ${meta.callType === 'video' ? 'vidéo' : 'audio'} de groupe`;
    } catch { text = '📞 Appel de groupe'; }
  }
  return (
    <View style={styles.sysWrap}>
      <ThemedText style={[styles.sysText, { backgroundColor: theme.backgroundSelected }]}>{text}</ThemedText>
    </View>
  );
}

function Bubble({ m, mine, showName, tail, onOpenMedia, onLongPress, onRetry }: {
  m: Msg; mine: boolean; showName: boolean; tail: boolean;
  onOpenMedia: OpenMedia; onLongPress: () => void; onRetry: () => void;
}) {
  const theme = useTheme();
  const color = senderColor(m.senderUserId);
  const media = !m.deleted && (m.contentType === 'image' || m.contentType === 'video');
  const name = m.senderName ?? 'Membre';

  const inner = (() => {
    if (m.deleted) return <ThemedText style={[styles.text, mine && styles.textMine, styles.italic]}>Message supprimé</ThemedText>;
    switch (m.contentType) {
      case 'image': return <ImageBubble m={m} onOpenMedia={onOpenMedia} />;
      case 'video': return <VideoBubble m={m} onOpenMedia={onOpenMedia} />;
      case 'audio': return <AudioBubble m={m} isMe={mine} />;
      case 'file':  return <FileBubble m={m} isMe={mine} />;
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
          mine ? { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine } : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 },
          m._failed && styles.failed,
        ]}>
        {!mine && showName ? (
          <ThemedText numberOfLines={1} style={[styles.sender, { color }, media && styles.senderOnMedia]}>{name}</ThemedText>
        ) : null}
        {m.replyTo ? (
          <View style={[styles.quote, { borderLeftColor: mine ? 'rgba(255,255,255,.7)' : Brand.primary, backgroundColor: mine ? 'rgba(255,255,255,.14)' : `${Brand.primary}0F` }]}>
            <ThemedText numberOfLines={1} style={[styles.quoteName, mine && styles.textMine]}>{m.replyTo.senderName ?? 'Membre'}</ThemedText>
            <ThemedText numberOfLines={1} type="small" style={mine ? styles.quoteMine : undefined} themeColor={mine ? undefined : 'textSecondary'}>
              {previewOf(m.replyTo)}
            </ThemedText>
          </View>
        ) : null}
        {inner}
        <View style={styles.meta}>
          {m.isEdited && !m.deleted ? <ThemedText style={[styles.metaText, mine && styles.metaMine]}>modifié</ThemedText> : null}
          <ThemedText style={[styles.metaText, mine && styles.metaMine, media && styles.metaOnMedia]}>{timeOf(m.createdAt)}</ThemedText>
          {mine && m._sending ? <Ionicons name="time-outline" size={12} color="rgba(255,255,255,.8)" /> : null}
          {mine && !m._sending && !m._failed ? <Ionicons name="checkmark" size={13} color={media ? '#fff' : 'rgba(180,86,28,.75)'} /> : null}
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
  textMine: { color: '#1F1F1F' },
  italic: { fontStyle: 'italic', opacity: 0.85 },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingLeft: 8, paddingRight: 6, paddingVertical: 4, marginBottom: 5 },
  quoteName: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: Brand.primary },
  quoteMine: { color: 'rgba(255,255,255,.85)' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  metaText: { fontSize: 10.5, lineHeight: 13, color: '#8A93A3' },
  metaMine: { color: 'rgba(180,86,28,.75)' },
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
