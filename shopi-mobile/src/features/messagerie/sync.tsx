/**
 * Synchronisation temps réel de TOUTE la messagerie — un seul gestionnaire,
 * monté à la racine pour toute la session (app/_layout.tsx), actif quel que
 * soit l'écran ouvert :
 *
 *   new_message / group_new_message
 *     → aperçu de la liste (discussion remontée en tête, non-lus)
 *     → ET le fil de messages déjà en mémoire (avant : seul l'écran ouvert
 *       était mis à jour ; en rentrant dans un groupe, le nouveau message
 *       manquait jusqu'à 5 min) — discussion inconnue : la liste est rechargée
 *   message_read · message_edited · message_deleted · group_message_edited ·
 *   group_message_deleted · group_status_changed
 *     → mêmes caches, partout
 *   reconnexion du socket (réseau coupé, appli en veille)
 *     → listes et fils ouverts rechargés : aucun message manqué
 *
 * Les écrans ne gardent que ce qui leur est propre (« écrit… », marquer lu).
 * Doublons impossibles : chaque message est ajouté une seule fois (par id), et
 * l'écho d'un de MES messages de groupe est ignoré tant que son envoi
 * optimiste est en cours (la réponse du serveur le remplace).
 */
import { useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSession } from '@/features/auth/session-store';
import { connectRealtime } from '@/lib/realtime/socket';

import type { ChatMessage, Conversation, ConversationPage, MessagePage } from './api';
import type { Group, GroupMessage, GroupMessagePage } from './groups-api';

type ConvPages = InfiniteData<ConversationPage, string | null>;
type MsgPages = InfiniteData<MessagePage, string | null>;
type GroupPages = InfiniteData<GroupMessagePage, number>;

interface WsNewMessage {
  conversationId: string;
  message: ChatMessage;
  convPreview?: { lastMessage: string; lastMessageAt: string; unreadCount: number };
}
interface WsRead { conversationId: string; readAt: string }
interface WsEdited { conversationId: string; messageId: string; newContent: string }
interface WsDeleted { conversationId: string; messageId: string; deletedForAll: boolean }
interface WsGroupNew { groupId: string; message: GroupMessage }
interface WsGroupEdited { groupId: string; messageId: string; newContent: string }
interface WsGroupDeleted { groupId: string; messageId: string; deletedForAll: boolean }

/* ── Aperçus ───────────────────────────────────────────────────────── */

export function groupPreview(m: Pick<GroupMessage, 'contentType' | 'content' | 'mediaName'>): string {
  const caption = m.content?.trim();
  switch (m.contentType) {
    case 'image': return caption ? `📷 ${caption}` : '📷 Photo';
    case 'video': return caption ? `🎥 ${caption}` : '🎥 Vidéo';
    case 'audio': return '🎙️ Message vocal';
    case 'file':  return caption ? `📄 ${caption}` : `📄 ${m.mediaName ?? 'Document'}`;
    case 'location': return '📍 Position';
    /* Trace d'appel : `content` est du JSON — jamais affiché tel quel. */
    case 'call': {
      try {
        const meta = JSON.parse(m.content ?? '{}') as { status?: string; callType?: string };
        return meta.status === 'missed' ? '📞 Appel manqué' : `📞 Appel ${meta.callType === 'video' ? 'vidéo' : 'audio'}`;
      } catch { return '📞 Appel'; }
    }
    default: return m.content ?? '';
  }
}

/* ── Écritures de cache (réutilisables par les écrans) ─────────────── */

/** Ajoute un message à un fil privé déjà en mémoire (une seule fois). */
export function appendPrivateMessage(qc: QueryClient, conversationId: string, message: ChatMessage) {
  qc.setQueryData<MsgPages>(['messages', conversationId], (old) => {
    if (!old || !old.pages.length) return old;
    if (old.pages.some((p) => p.data.some((m) => m.id === message.id))) return old;
    const pages = old.pages.slice();
    pages[0] = { ...pages[0], data: [...pages[0].data, message] };
    return { ...old, pages };
  });
}

/** Ajoute un message à un fil de groupe déjà en mémoire (une seule fois). */
export function appendGroupMessage(qc: QueryClient, groupId: string, message: GroupMessage, myId: string | undefined) {
  qc.setQueryData<GroupPages>(['group-messages', groupId], (old) => {
    if (!old || !old.pages.length) return old;
    const all = old.pages.flatMap((p) => p.messages);
    if (all.some((m) => m.id === message.id)) return old;
    /* Écho de MON message encore en cours d'envoi : la réponse du serveur le remplacera. */
    if (message.senderUserId && message.senderUserId === myId && all.some((m) => (m as { _sending?: boolean })._sending && m.contentType === message.contentType && (m.content ?? '') === (message.content ?? ''))) return old;
    const pages = old.pages.slice();
    pages[0] = { ...pages[0], messages: [...pages[0].messages, message] };
    return { ...old, pages };
  });
}

function bumpConversation(old: ConvPages, conversationId: string, patch: (c: Conversation) => Conversation): ConvPages | null {
  let target: Conversation | undefined;
  const pages = old.pages.map((p) => ({
    ...p,
    data: p.data.filter((c) => {
      if (c.id !== conversationId) return true;
      target = patch(c);
      return false;
    }),
  }));
  if (!target || pages.length === 0) return null;
  pages[0] = { ...pages[0], data: [target, ...pages[0].data] };
  return { ...old, pages };
}

/* ── Gestionnaire central ──────────────────────────────────────────── */

export function MessagingSync() {
  const qc = useQueryClient();
  const myId = useSession((s) => s.user?.id);

  useEffect(() => {
    const socket = connectRealtime();
    let unreadTimer: ReturnType<typeof setTimeout> | null = null;
    /* Compteur de l'en-tête : un rechargement regroupé, pas un par message */
    const refreshUnread = () => {
      if (unreadTimer) return;
      unreadTimer = setTimeout(() => { unreadTimer = null; void qc.invalidateQueries({ queryKey: ['unread', 'messages'] }); }, 800);
    };

    /* ── Discussions privées ── */
    const onNewMessage = (p: WsNewMessage) => {
      let known = false;
      qc.setQueriesData<ConvPages>({ queryKey: ['conversations'] }, (old) => {
        if (!old) return old;
        const next = bumpConversation(old, p.conversationId, (c) => ({
          ...c,
          lastMessage: p.convPreview?.lastMessage ?? c.lastMessage,
          lastMessageAt: p.convPreview?.lastMessageAt ?? p.message.createdAt,
          unreadCount: p.convPreview?.unreadCount ?? c.unreadCount + 1,
        }));
        if (next) known = true;
        return next ?? old;
      });
      if (!known) void qc.invalidateQueries({ queryKey: ['conversations'] });   // nouvelle discussion
      appendPrivateMessage(qc, p.conversationId, { ...p.message, fromMe: false });
      refreshUnread();
    };
    const onRead = (p: WsRead) => {
      qc.setQueryData<MsgPages>(['messages', p.conversationId], (old) => old && {
        ...old,
        pages: old.pages.map((pg) => ({ ...pg, data: pg.data.map((m) => (m.fromMe && !m.readAt ? { ...m, readAt: p.readAt } : m)) })),
      });
    };
    const onEdited = (p: WsEdited) => {
      qc.setQueryData<MsgPages>(['messages', p.conversationId], (old) => old && {
        ...old,
        pages: old.pages.map((pg) => ({ ...pg, data: pg.data.map((m) => (m.id === p.messageId ? { ...m, content: p.newContent, isEdited: true } : m)) })),
      });
    };
    const onDeleted = (p: WsDeleted) => {
      qc.setQueryData<MsgPages>(['messages', p.conversationId], (old) => old && {
        ...old,
        pages: old.pages.map((pg) => ({ ...pg, data: pg.data.filter((m) => m.id !== p.messageId) })),
      });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    /* ── Groupes ── */
    const onGroupNew = (p: WsGroupNew) => {
      const mine = !!p.message.senderUserId && p.message.senderUserId === myId;
      let known = false;
      qc.setQueryData<Group[]>(['groups'], (old) => {
        if (!old) return old;
        const next = old.map((g) => {
          if (g.id !== p.groupId) return g;
          known = true;
          return {
            ...g,
            lastMessage: p.message.contentType === 'system' || (!p.message.senderName && !mine)
              ? groupPreview(p.message)
              : `${mine ? 'Vous' : p.message.senderName} : ${groupPreview(p.message)}`,
            lastMessageAt: p.message.createdAt,
            unreadCount: mine ? g.unreadCount : g.unreadCount + 1,
          };
        });
        return next.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
      });
      if (!known) void qc.invalidateQueries({ queryKey: ['groups'] });
      appendGroupMessage(qc, p.groupId, p.message, myId);
    };
    const patchGroup = (groupId: string, fn: (m: GroupMessage) => GroupMessage) =>
      qc.setQueryData<GroupPages>(['group-messages', groupId], (old) => old && {
        ...old, pages: old.pages.map((pg) => ({ ...pg, messages: pg.messages.map(fn) })),
      });
    const onGroupEdited = (p: WsGroupEdited) =>
      patchGroup(p.groupId, (m) => (m.id === p.messageId ? { ...m, content: p.newContent, isEdited: true } : m));
    const onGroupDeleted = (p: WsGroupDeleted) => {
      if (p.deletedForAll) patchGroup(p.groupId, (m) => (m.id === p.messageId ? { ...m, deleted: true, content: null, mediaUrl: null } : m));
    };
    const onGroupStatus = (p: { groupId?: string }) => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      if (p?.groupId) void qc.invalidateQueries({ queryKey: ['group-members', p.groupId] });
    };

    /* ── Reconnexion : ce qui a pu être manqué pendant la coupure est rechargé ── */
    let wasDisconnected = false;
    const onDisconnect = () => { wasDisconnected = true; };
    const onConnect = () => {
      if (!wasDisconnected) return;
      wasDisconnected = false;
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      void qc.invalidateQueries({ queryKey: ['groups'] });
      void qc.invalidateQueries({ queryKey: ['messages'] });
      void qc.invalidateQueries({ queryKey: ['group-messages'] });
      refreshUnread();
    };

    socket.on('new_message', onNewMessage);
    socket.on('message_read', onRead);
    socket.on('message_edited', onEdited);
    socket.on('message_deleted', onDeleted);
    socket.on('group_new_message', onGroupNew);
    socket.on('group_message_edited', onGroupEdited);
    socket.on('group_message_deleted', onGroupDeleted);
    socket.on('group_status_changed', onGroupStatus);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => {
      if (unreadTimer) clearTimeout(unreadTimer);
      socket.off('new_message', onNewMessage);
      socket.off('message_read', onRead);
      socket.off('message_edited', onEdited);
      socket.off('message_deleted', onDeleted);
      socket.off('group_new_message', onGroupNew);
      socket.off('group_message_edited', onGroupEdited);
      socket.off('group_message_deleted', onGroupDeleted);
      socket.off('group_status_changed', onGroupStatus);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, [qc, myId]);

  return null;
}
