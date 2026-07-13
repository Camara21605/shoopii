/*
 * FICHIER : src/shared/messagerie/hooks/useDeliveryGroups.ts
 *
 * Hook gérant les groupes de livraison automatiques.
 * Charge la liste depuis /api/delivery-groups, écoute les
 * événements Socket.IO group_* sur le socket partagé.
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { apiFetch }        from '../../services/apiFetch';
import { getActiveSocket } from './useSocket';
import type { Conversation, ChatUser, ChatMessage, GroupMember } from '../data/messagerieTypes';

// ── Types API ─────────────────────────────────────────────────

interface ApiGroup {
  id:             string;
  commandeId:     string;
  commandeNumero: string;
  companyName:    string;
  description:    string | null;
  status:         'active' | 'completed' | 'expired' | 'cancelled';
  expiresAt:      string | null;
  completedAt:    string | null;
  unreadCount:    number;
  memberCount:    number;
  lastMessage:    string | null;
  lastMessageAt:  string;
  createdAt:      string;
}

interface ApiGroupMessage {
  id:            string;
  groupId:       string;
  fromMe:        boolean;
  senderId:      string | null;
  senderUserId:  string | null;
  senderName:    string | null;
  senderType:    string | null;
  contentType:   string;
  content:       string | null;
  mediaUrl:      string | null;
  mediaName:     string | null;
  mediaMimeType: string | null;
  mediaDuration: number | null;
  isEdited:      boolean;
  deleted:       boolean;
  reactions:     Record<string, string[]>;
  replyToId:     string | null;
  replyTo:       object | null;
  createdAt:     string;
}

// ── Helpers ───────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7)  return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Retourne un texte lisible pour les messages d'appel, null sinon. */
function callPreview(m: ApiGroupMessage): string | null {
  if (m.contentType !== 'call' || !m.content) return null;
  try {
    const meta = JSON.parse(m.content);
    const type = meta.callType === 'video' ? 'vidéo' : 'audio';
    if (meta.status === 'missed') return '📞 Appel manqué';
    return `📞 Appel ${type}`;
  } catch { return '📞 Appel'; }
}

const CONTENT_TYPE_MAP: Record<string, ChatMessage['type']> = {
  text:  'text',
  image: 'image',
  video: 'video',
  file:  'file',
  audio: 'voice',
  call:  'call',
};

function apiMsgToChat(m: ApiGroupMessage): ChatMessage {
  const isCall  = m.contentType === 'call';
  const isVoice = m.contentType === 'audio';
  const msg: ChatMessage = {
    id:        m.id,
    from:      m.fromMe ? 'me' : (m.senderUserId ?? m.senderId ?? 'system'),
    type:      CONTENT_TYPE_MAP[m.contentType] ?? (m.contentType === 'system' ? 'text' : 'text'),
    text:      isCall || isVoice ? undefined : m.deleted ? 'Ce message a été supprimé' : (m.content ?? undefined),
    time:      formatTime(m.createdAt),
    read:      true,
    delivered: true,
    mediaUrl:  m.mediaUrl ?? undefined,
    mediaName: m.mediaName ?? undefined,
    mediaMime: m.mediaMimeType ?? undefined,
    duration:  m.mediaDuration ? fmtDur(m.mediaDuration) : undefined,
    isEdited:  m.isEdited,
    deleted:   m.deleted,
    reactions: m.reactions,
    replyToId: m.replyToId ?? undefined,
  };

  if (isCall && m.content && !m.deleted) {
    try {
      const parsed = JSON.parse(m.content);
      msg.callMeta = {
        status:    parsed.status,
        direction: m.fromMe ? 'outgoing' : 'incoming',
        duration:  parsed.duration,
        callType:  parsed.callType,
      };
    } catch { /* ignoré */ }
  }

  return msg;
}

function groupToConv(g: ApiGroup): Conversation {
  const statusLabel = g.status === 'completed'
    ? '✅ Livré'
    : g.status === 'expired'
      ? '🔒 Expiré'
      : g.status === 'cancelled'
        ? '❌ Annulé'
        : '🚀 En cours';

  return {
    id:             g.id,
    userId:         g.id,          // clé dans usersMap
    pinned:         false,
    unread:         g.unreadCount,
    lastMsg:        g.lastMessage ?? `Groupe de livraison · ${g.commandeNumero}`,
    lastTime:       formatTime(g.lastMessageAt),
    muted:          false,
    messages:       [],
    isGroup:        true,
    groupStatus:    g.status,
    commandeNumero: g.commandeNumero,
    memberCount:    g.memberCount,
    expiresAt:      g.expiresAt ?? undefined,
    description:    g.description ?? undefined,
  };
}

function groupToUser(g: ApiGroup): ChatUser {
  const expired = g.status === 'expired' || g.status === 'cancelled';
  return {
    id:       g.id,
    name:     `${g.companyName} · ${g.commandeNumero}`,
    role:     'groupe',
    ava:      '📦',
    avaColor: expired ? 'rgba(107,114,128,.15)' : 'rgba(14,116,144,.12)',
    online:   false,
    context:  g.status === 'active'    ? `${g.memberCount} membres`
            : g.status === 'completed' ? `Expire le ${g.expiresAt ? new Date(g.expiresAt).toLocaleDateString('fr-FR') : '?'}`
            : g.status === 'expired'   ? 'Groupe archivé'
            : 'Commande annulée',
  };
}

// ── Hook ──────────────────────────────────────────────────────

export function useDeliveryGroups() {
  const [groups, setGroups] = useState<Conversation[]>([]);
  const [users,  setUsers]  = useState<ChatUser[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const activeGroupRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  /* Map groupId → liste des membres chargés */
  const [groupMembersMap, setGroupMembersMap] = useState<Map<string, GroupMember[]>>(new Map());

  // ── Chargement initial ────────────────────────────────────

  const loadGroups = useCallback(async () => {
    try {
      const list = await apiFetch<ApiGroup[]>('/delivery-groups');
      if (!Array.isArray(list)) return;
      setGroups(list.map(groupToConv));
      setUsers(list.map(groupToUser));
      setLoaded(true);
    } catch (err) {
      console.error('[DeliveryGroups] Erreur chargement groupes:', err);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // ── Charger les messages d'un groupe ─────────────────────

  const loadGroupMessages = useCallback(async (groupId: string, page = 1) => {
    try {
      const res = await apiFetch<{ messages: ApiGroupMessage[] }>(
        `/delivery-groups/${groupId}/messages?page=${page}&limit=30`,
      );
      if (!res || !Array.isArray(res.messages)) return;
      const chatMsgs = res.messages.map(apiMsgToChat);
      setGroups(prev => prev.map(g =>
        g.id === groupId
          ? { ...g, messages: page === 1 ? chatMsgs : [...chatMsgs, ...g.messages] }
          : g,
      ));
    } catch { /* silencieux */ }
  }, []);

  // ── Charger les membres d'un groupe ──────────────────────

  const loadGroupMembers = useCallback(async (groupId: string) => {
    try {
      const list = await apiFetch<GroupMember[]>(`/delivery-groups/${groupId}/members`);
      if (!Array.isArray(list)) return;
      setGroupMembersMap(prev => new Map(prev).set(groupId, list));
    } catch { /* silencieux */ }
  }, []);

  // ── Sélection d'un groupe ─────────────────────────────────

  const selectGroup = useCallback((groupId: string | null) => {
    activeGroupRef.current = groupId;
    setActiveGroupId(groupId);
    if (groupId) {
      loadGroupMessages(groupId);
      loadGroupMembers(groupId);
      /* Réinitialiser le compteur non lu */
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, unread: 0 } : g));
      apiFetch(`/delivery-groups/${groupId}/read`, { method: 'PATCH' }).catch(() => {});
    }
  }, [loadGroupMessages, loadGroupMembers]);

  // ── Envoi d'un message ────────────────────────────────────

  const sendGroupMessage = useCallback(async (
    groupId: string,
    payload: { contentType?: string; content?: string; mediaUrl?: string; mediaName?: string; mediaSize?: number; mediaMimeType?: string; mediaDuration?: number; replyToId?: string },
  ) => {
    const dto = { contentType: 'text', ...payload };
    try {
      const saved = await apiFetch<ApiGroupMessage>(`/delivery-groups/${groupId}/messages`, {
        method: 'POST',
        body:   dto,
      });
      if (!saved) return;
      const chatMsg  = apiMsgToChat(saved);
      const preview  = callPreview(saved) ?? (saved.contentType === 'audio' ? '🎙️ Message vocal' : saved.content ?? '');
      setGroups(prev => prev.map(g =>
        g.id === groupId
          ? { ...g, messages: [...g.messages, chatMsg], lastMsg: preview, lastTime: formatTime(saved.createdAt) }
          : g,
      ));
    } catch { /* silencieux */ }
  }, []);

  // ── Modifier la description du groupe ────────────────────

  const updateGroupDescription = useCallback(async (groupId: string, description: string) => {
    /* Mise à jour optimiste immédiate */
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, description: description || undefined } : g,
    ));
    try {
      await apiFetch(`/delivery-groups/${groupId}`, {
        method: 'PATCH',
        body:   { description },
      });
    } catch {
      /* Rollback silencieux — le socket re-synchronisera si besoin */
    }
  }, []);

  // ── Supprimer un message de groupe ───────────────────────

  const deleteGroupMessage = useCallback(async (groupId: string, messageId: string, mode: 'me' | 'everyone') => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        messages: g.messages.map(m =>
          m.id === messageId ? { ...m, deleted: true, text: 'Ce message a été supprimé' } : m,
        ),
      };
    }));
    try {
      await apiFetch(`/delivery-groups/${groupId}/messages/${messageId}`, {
        method: 'DELETE',
        body:   { mode },
      });
    } catch { /* silencieux */ }
  }, []);

  // ── Événements Socket.IO ──────────────────────────────────

  useEffect(() => {
    const RETRY_MS = 500;
    let retryId: ReturnType<typeof setTimeout> | null = null;
    let detach: (() => void) | null = null;

    function attach() {
      const socket = getActiveSocket();
      if (!socket) {
        retryId = setTimeout(attach, RETRY_MS);
        return;
      }

      const onNewMsg = (p: { groupId: string; commandeNumero: string; message: ApiGroupMessage }) => {
        const msg = apiMsgToChat(p.message);
        setGroups(prev => prev.map(g => {
          if (g.id !== p.groupId) return g;
          const isActive = activeGroupRef.current === p.groupId;
          const lastMsg  = callPreview(p.message) ?? p.message.content ?? '';
          return {
            ...g,
            messages: [...g.messages, msg],
            lastMsg,
            lastTime: formatTime(p.message.createdAt),
            unread:   isActive ? 0 : g.unread + 1,
          };
        }));
        /* Marquer lu si le groupe est ouvert */
        if (activeGroupRef.current === p.groupId) {
          apiFetch(`/delivery-groups/${p.groupId}/read`, { method: 'PATCH' }).catch(() => {});
        }
      };

      const onMsgEdited = (p: { groupId: string; messageId: string; newContent: string }) => {
        setGroups(prev => prev.map(g => {
          if (g.id !== p.groupId) return g;
          return {
            ...g,
            messages: g.messages.map(m =>
              m.id === p.messageId ? { ...m, text: p.newContent, isEdited: true } : m,
            ),
          };
        }));
      };

      const onMsgDeleted = (p: { groupId: string; messageId: string; deletedForAll: boolean }) => {
        if (!p.deletedForAll) return;
        setGroups(prev => prev.map(g => {
          if (g.id !== p.groupId) return g;
          return {
            ...g,
            messages: g.messages.map(m =>
              m.id === p.messageId ? { ...m, deleted: true, text: 'Ce message a été supprimé' } : m,
            ),
          };
        }));
      };

      const onReaction = (p: { groupId: string; messageId: string; reactions: Record<string, string[]> }) => {
        setGroups(prev => prev.map(g => {
          if (g.id !== p.groupId) return g;
          return {
            ...g,
            messages: g.messages.map(m =>
              m.id === p.messageId ? { ...m, reactions: p.reactions } : m,
            ),
          };
        }));
      };

      const onStatus = (p: { event: string; groupId: string; expiresAt?: string; description?: string | null }) => {
        /* Mise à jour de la description depuis un autre membre */
        if (p.event === 'group_info_updated') {
          setGroups(prev => prev.map(g =>
            g.id === p.groupId
              ? { ...g, description: p.description ?? undefined }
              : g,
          ));
          return;
        }

        setGroups(prev => prev.map(g => {
          if (g.id !== p.groupId) return g;
          const newStatus =
            p.event === 'group_completed' ? 'completed' :
            p.event === 'group_expired'   ? 'expired'   :
            p.event === 'group_cancelled' ? 'cancelled' : g.groupStatus;
          return { ...g, groupStatus: newStatus as Conversation['groupStatus'], expiresAt: p.expiresAt ?? g.expiresAt };
        }));

        /* Si le groupe est nouvellement créé → recharger la liste */
        if (p.event === 'group_created') loadGroups();
      };

      socket.on('group_new_message',     onNewMsg);
      socket.on('group_message_edited',  onMsgEdited);
      socket.on('group_message_deleted', onMsgDeleted);
      socket.on('group_reaction_updated', onReaction);
      socket.on('group_status_changed',  onStatus);

      /* Capture the cleanup function so the effect teardown can call it
         even when the socket wasn't available on the initial attach() call. */
      detach = () => {
        socket.off('group_new_message',     onNewMsg);
        socket.off('group_message_edited',  onMsgEdited);
        socket.off('group_message_deleted', onMsgDeleted);
        socket.off('group_reaction_updated', onReaction);
        socket.off('group_status_changed',  onStatus);
      };
    }

    attach();
    return () => {
      if (retryId) clearTimeout(retryId);
      detach?.();
    };
  }, [loadGroups]);

  // ── Dérivés ───────────────────────────────────────────────

  const groupUsersMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const activeGroup = useMemo(
    () => groups.find(g => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const activeGroupUser = useMemo(
    () => activeGroupId ? (groupUsersMap.get(activeGroupId) ?? null) : null,
    [activeGroupId, groupUsersMap],
  );

  /* Membres du groupe actif */
  const activeGroupMembers = useMemo(
    () => activeGroupId ? (groupMembersMap.get(activeGroupId) ?? []) : [],
    [activeGroupId, groupMembersMap],
  );

  return {
    groups,
    groupUsersMap,
    activeGroupId,
    activeGroup,
    activeGroupUser,
    activeGroupMembers,
    loaded,
    selectGroup,
    sendGroupMessage,
    deleteGroupMessage,
    updateGroupDescription,
    loadGroupMessages,
  };
}
