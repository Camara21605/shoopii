/**
 * Temps réel PROPRE AUX ÉCRANS de la messagerie privée. Les caches (liste,
 * fils de messages, lu, modifié, supprimé, reconnexion) sont tenus à jour
 * par UN gestionnaire central monté pour toute la session : sync.tsx.
 * Ici ne restent que :
 *   - la présence des contacts dans la liste (en ligne / vu à…) ;
 *   - pour une conversation ouverte : rejoindre sa room (« écrit… »), être
 *     prévenu d'un message entrant (pour le marquer lu), et « écrit… ».
 * connectRealtime() et non getSocket() : à l'ouverture depuis une
 * notification, l'écran se monte AVANT que la racine ait créé le socket —
 * getSocket() valait null et la conversation ne recevait plus rien en direct.
 *
 * Événements serveur → client utilisés ici : new_message · typing · presence
 */
import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { connectRealtime, getSocket } from '@/lib/realtime/socket';

import type { ChatMessage, ConversationPage } from './api';

type ConvPages = InfiniteData<ConversationPage, string | null>;

interface WsNewMessagePayload { conversationId: string; message: ChatMessage }
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

/** Liste des conversations : présence des contacts (en ligne / vu à…) mise à jour en direct. */
export function useConversationsRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = connectRealtime();

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

    socket.on('presence', onPresence);
    return () => {
      socket.off('presence', onPresence);
    };
  }, [qc]);
}

/**
 * Une conversation ouverte : rejoint sa room (et la rejoint de nouveau après
 * une reconnexion), prévient l'écran d'un message entrant (onIncoming : le
 * marquer lu) et affiche « … écrit » / « … enregistre un vocal ».
 * `notifyTyping()` est à appeler à chaque frappe (throttlé côté serveur).
 */
export function useChatRealtime(conversationId: string | undefined, onIncoming?: (m: ChatMessage) => void) {
  const [typingLabel, setTypingLabel] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIncomingRef = useRef(onIncoming);
  useEffect(() => {
    onIncomingRef.current = onIncoming;
  }, [onIncoming]);

  useEffect(() => {
    if (!conversationId) return;
    const socket = connectRealtime();
    const join = () => socket.emit('join_conv', { conversationId });
    join();

    function onNewMessage(payload: WsNewMessagePayload) {
      if (payload.conversationId !== conversationId) return;
      setTypingLabel(null);
      onIncomingRef.current?.(payload.message);
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

    socket.on('connect', join);   // rooms perdues à la reconnexion
    socket.on('new_message', onNewMessage);
    socket.on('typing', onTyping);

    return () => {
      socket.emit('leave_conv', { conversationId });
      socket.off('connect', join);
      socket.off('new_message', onNewMessage);
      socket.off('typing', onTyping);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [conversationId]);

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
