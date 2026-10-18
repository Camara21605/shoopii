/**
 * Temps réel de la messagerie — se branche sur le socket déjà connecté pour
 * toute la session (voir app/_layout.tsx → connectRealtime()) : ces hooks ne
 * font qu'ajouter/retirer des écouteurs et patcher le cache react-query, ils
 * ne gèrent ni la connexion ni la reconnexion.
 *
 * Événements serveur → client utilisés (voir broadcast.service.ts) :
 *   new_message · message_read · typing · presence
 */
import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { getSocket } from '@/lib/realtime/socket';

import type { ChatMessage, Conversation, ConversationPage, MessagePage } from './api';

type ConvPages = InfiniteData<ConversationPage, string | null>;
type MsgPages = InfiniteData<MessagePage, string | null>;

interface WsNewMessagePayload {
  conversationId: string;
  message: ChatMessage;
  convPreview: { lastMessage: string; lastMessageAt: string; unreadCount: number };
}
interface WsMessageReadPayload {
  conversationId: string;
  readAt: string;
  readerId: string;
}
interface WsMessageEditedPayload {
  conversationId: string;
  messageId: string;
  newContent: string;
}

interface WsMessageDeletedPayload {
  conversationId: string;
  messageId: string;
  /** true : supprimé pour tout le monde · false : l'expéditeur l'a retiré pour moi */
  deletedForAll: boolean;
}

interface WsTypingPayload {
  conversationId: string;
  senderId: string;
  senderName: string;
  activity: 'typing' | 'recording' | 'uploading' | 'stopped';
}
interface WsPresencePayload {
  userId: string;
  online: boolean;
  lastSeen: string;
  status?: 'online' | 'reachable' | 'offline';
  reachableUntil?: string | null;
}

/** Retire une conversation de ses pages (où qu'elle soit) et la replace en tête de la première. */
function bumpConversation(
  old: ConvPages,
  conversationId: string,
  patch: (c: Conversation) => Conversation,
): ConvPages {
  let target: Conversation | undefined;
  const pages = old.pages.map((p) => ({
    ...p,
    data: p.data.filter((c) => {
      if (c.id !== conversationId) return true;
      target = patch(c);
      return false;
    }),
  }));
  if (!target || pages.length === 0) return old;
  pages[0] = { ...pages[0], data: [target, ...pages[0].data] };
  return { ...old, pages };
}

/**
 * Liste des conversations (écran d'accueil de la messagerie) : un nouveau
 * message la fait remonter en tête avec son aperçu à jour, et la présence
 * des contacts (en ligne / vu à…) se met à jour en direct.
 */
export function useConversationsRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onNewMessage(payload: WsNewMessagePayload) {
      qc.setQueriesData<ConvPages>({ queryKey: ['conversations'] }, (old) =>
        old
          ? bumpConversation(old, payload.conversationId, (c) => ({
              ...c,
              lastMessage: payload.convPreview.lastMessage,
              lastMessageAt: payload.convPreview.lastMessageAt,
              unreadCount: payload.convPreview.unreadCount,
            }))
          : old,
      );
      void qc.invalidateQueries({ queryKey: ['unread', 'messages'] });
    }

    function onPresence(p: WsPresencePayload) {
      qc.setQueriesData<ConvPages>({ queryKey: ['conversations'] }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((pg) => ({
                ...pg,
                data: pg.data.map((c) =>
                  c.contactUserId === p.userId
                    ? { ...c, contactOnline: p.online, contactLastSeen: p.lastSeen, contactPresence: p.status ?? (p.online ? 'online' : 'offline'), contactReachableUntil: p.reachableUntil ?? null }
                    : c,
                ),
              })),
            }
          : old,
      );
    }

    socket.on('new_message', onNewMessage);
    socket.on('presence', onPresence);
    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('presence', onPresence);
    };
  }, [qc]);
}

/**
 * Une conversation ouverte : rejoint sa room, reçoit les messages entrants en
 * direct (ajoutés au cache de useInfiniteQuery(['messages', id])), l'accusé
 * de lecture de mes propres messages, et l'indicateur « en train d'écrire… ».
 * `notifyTyping()` est à appeler à chaque frappe (throttlé côté serveur).
 */
export function useChatRealtime(conversationId: string | undefined, onIncoming?: (m: ChatMessage) => void) {
  const qc = useQueryClient();
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIncomingRef = useRef(onIncoming);
  useEffect(() => {
    onIncomingRef.current = onIncoming;
  }, [onIncoming]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversationId) return;

    socket.emit('join_conv', { conversationId });

    function onNewMessage(payload: WsNewMessagePayload) {
      if (payload.conversationId !== conversationId) return;
      qc.setQueryData<MsgPages>(['messages', conversationId], (old) => {
        if (!old || old.pages.length === 0) return old;
        if (old.pages[0].data.some((m) => m.id === payload.message.id)) return old; // déjà reçu
        const pages = old.pages.slice();
        pages[0] = { ...pages[0], data: [...pages[0].data, payload.message] };
        return { ...old, pages };
      });
      onIncomingRef.current?.(payload.message);
    }

    function onMessageRead(payload: WsMessageReadPayload) {
      if (payload.conversationId !== conversationId) return;
      qc.setQueryData<MsgPages>(['messages', conversationId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            data: p.data.map((m) => (m.fromMe && !m.readAt ? { ...m, readAt: payload.readAt } : m)),
          })),
        };
      });
    }

    /* L'autre a modifié ou supprimé un message : le fil se met à jour tout de suite. */
    function onMessageEdited(payload: WsMessageEditedPayload) {
      if (payload.conversationId !== conversationId) return;
      qc.setQueryData<MsgPages>(['messages', conversationId], (old) => old && {
        ...old,
        pages: old.pages.map((p) => ({ ...p, data: p.data.map((m) => (m.id === payload.messageId ? { ...m, content: payload.newContent, isEdited: true } : m)) })),
      });
    }

    function onMessageDeleted(payload: WsMessageDeletedPayload) {
      if (payload.conversationId !== conversationId) return;
      qc.setQueryData<MsgPages>(['messages', conversationId], (old) => old && {
        ...old,
        pages: old.pages.map((p) => ({ ...p, data: p.data.filter((m) => m.id !== payload.messageId) })),
      });
    }

    function onTyping(payload: WsTypingPayload) {
      if (payload.conversationId !== conversationId) return;
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (payload.activity === 'stopped') {
        setTypingLabel(null);
        return;
      }
      setTypingLabel(payload.activity === 'recording' ? `${payload.senderName} enregistre un vocal…` : `${payload.senderName} écrit…`);
      typingTimeout.current = setTimeout(() => setTypingLabel(null), 5000);
    }

    socket.on('new_message', onNewMessage);
    socket.on('message_read', onMessageRead);
    socket.on('typing', onTyping);
    socket.on('message_edited', onMessageEdited);
    socket.on('message_deleted', onMessageDeleted);

    return () => {
      socket.emit('leave_conv', { conversationId });
      socket.off('new_message', onNewMessage);
      socket.off('message_read', onMessageRead);
      socket.off('typing', onTyping);
      socket.off('message_edited', onMessageEdited);
      socket.off('message_deleted', onMessageDeleted);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [conversationId, qc]);

  const lastSentAt = useRef(0);
  function notifyTyping() {
    const socket = getSocket();
    if (!socket || !conversationId) return;
    const now = Date.now();
    if (now - lastSentAt.current < 1200) return;
    lastSentAt.current = now;
    socket.emit('typing', { conversationId, activity: 'typing' });
  }
  function notifyStoppedTyping() {
    const socket = getSocket();
    if (!socket || !conversationId) return;
    lastSentAt.current = 0;
    socket.emit('typing', { conversationId, activity: 'stopped' });
  }

  return { typingLabel, notifyTyping, notifyStoppedTyping };
}

/** Marque la conversation lue en direct (accusé instantané) + côté REST en filet de sécurité. */
export function markReadRealtime(conversationId: string) {
  getSocket()?.emit('mark_read', { conversationId });
}
