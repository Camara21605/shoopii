/**
 * Temps réel des groupes — mêmes événements que le site (broadcast.service.ts) :
 *   group_new_message     { groupId, message }
 *   group_message_edited  { groupId, messageId, newContent }
 *   group_message_deleted { groupId, messageId, deletedForAll }
 *   group_status_changed  { event, groupId, … }   (créé, infos modifiées, membre ajouté…)
 * Le socket est celui déjà connecté pour toute la session (lib/realtime/socket.ts).
 *
 * ⚠ group_new_message est envoyé à TOUS les membres, expéditeur compris : mes
 * propres messages sont déjà affichés (envoi optimiste puis réponse REST), on
 * ignore donc l'écho de l'expéditeur pour ne jamais les afficher en double.
 */
import type { InfiniteData } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useSession } from '@/features/auth/session-store';
import { getSocket } from '@/lib/realtime/socket';

import type { Group, GroupMessage, GroupMessagePage } from './groups-api';

type MsgPages = InfiniteData<GroupMessagePage, number>;

interface WsGroupNewMessage { groupId: string; message: GroupMessage }
interface WsGroupEdited { groupId: string; messageId: string; newContent: string }
interface WsGroupDeleted { groupId: string; messageId: string; deletedForAll: boolean }

function preview(m: GroupMessage): string {
  switch (m.contentType) {
    case 'image': return '📷 Photo';
    case 'video': return '🎥 Vidéo';
    case 'audio': return '🎙️ Message vocal';
    case 'file':  return `📄 ${m.mediaName ?? 'Document'}`;
    case 'location': return '📍 Position';
    /* Trace d'appel : `content` est du JSON ({ status, callType, … }) — jamais affiché tel quel. */
    case 'call': {
      try {
        const meta = JSON.parse(m.content ?? '{}') as { status?: string; callType?: string };
        return meta.status === 'missed' ? '📞 Appel manqué' : `📞 Appel ${meta.callType === 'video' ? 'vidéo' : 'audio'}`;
      } catch { return '📞 Appel'; }
    }
    default:      return m.content ?? '';
  }
}

/** Liste des groupes : aperçu + non-lus mis à jour en direct, rechargée si un groupe change. */
export function useGroupsRealtime() {
  const qc = useQueryClient();
  const myId = useSession(s => s.user?.id);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = (p: WsGroupNewMessage) => {
      const mine = !!p.message.senderUserId && p.message.senderUserId === myId;
      let known = false;
      qc.setQueryData<Group[]>(['groups'], old => {
        if (!old) return old;
        const next = old.map(g => {
          if (g.id !== p.groupId) return g;
          known = true;
          return {
            ...g,
            lastMessage: p.message.contentType === 'system' || !p.message.senderName && !mine
              ? preview(p.message)
              : `${mine ? 'Vous' : p.message.senderName} : ${preview(p.message)}`,
            lastMessageAt: p.message.createdAt,
            unreadCount: mine ? g.unreadCount : g.unreadCount + 1,
          };
        });
        return next.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
      });
      if (!known) void qc.invalidateQueries({ queryKey: ['groups'] });
    };
    const onStatus = (p: { groupId?: string }) => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      if (p?.groupId) void qc.invalidateQueries({ queryKey: ['group-members', p.groupId] });
    };

    socket.on('group_new_message', onNew);
    socket.on('group_status_changed', onStatus);
    return () => {
      socket.off('group_new_message', onNew);
      socket.off('group_status_changed', onStatus);
    };
  }, [qc, myId]);
}

/** Un groupe ouvert : nouveaux messages, modifications et suppressions en direct. */
export function useGroupChatRealtime(groupId: string | undefined, onIncoming?: () => void) {
  const qc = useQueryClient();
  const myId = useSession(s => s.user?.id);
  const onIncomingRef = useRef(onIncoming);
  useEffect(() => { onIncomingRef.current = onIncoming; }, [onIncoming]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !groupId) return;
    const key = ['group-messages', groupId];

    const patchAll = (fn: (m: GroupMessage) => GroupMessage) =>
      qc.setQueryData<MsgPages>(key, old => old && { ...old, pages: old.pages.map(p => ({ ...p, messages: p.messages.map(fn) })) });

    const onNew = (p: WsGroupNewMessage) => {
      if (p.groupId !== groupId || p.message.senderUserId === myId) return;
      qc.setQueryData<MsgPages>(key, old => {
        if (!old || !old.pages.length) return old;
        if (old.pages.some(pg => pg.messages.some(m => m.id === p.message.id))) return old;
        const pages = old.pages.slice();
        pages[0] = { ...pages[0], messages: [...pages[0].messages, p.message] };
        return { ...old, pages };
      });
      onIncomingRef.current?.();
    };
    const onEdited = (p: WsGroupEdited) => {
      if (p.groupId !== groupId) return;
      patchAll(m => (m.id === p.messageId ? { ...m, content: p.newContent, isEdited: true } : m));
    };
    const onDeleted = (p: WsGroupDeleted) => {
      if (p.groupId !== groupId || !p.deletedForAll) return;
      patchAll(m => (m.id === p.messageId ? { ...m, deleted: true, content: null, mediaUrl: null } : m));
    };

    socket.on('group_new_message', onNew);
    socket.on('group_message_edited', onEdited);
    socket.on('group_message_deleted', onDeleted);
    return () => {
      socket.off('group_new_message', onNew);
      socket.off('group_message_edited', onEdited);
      socket.off('group_message_deleted', onDeleted);
    };
  }, [groupId, qc, myId]);
}
