/*
 * FICHIER : src/shared/messagerie/hooks/useMessagerie.ts
 *
 * Hook central de la messagerie — connecté à l'API réelle.
 * Endpoints : GET/POST /api/messagerie/conversations
 *             GET/POST /api/messagerie/conversations/:id/messages
 *             PATCH    /api/messagerie/conversations/:id/read
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useLocation }  from 'react-router-dom';
import { apiFetch }    from '../../services/apiFetch';
import { getRoleFromToken } from '../../services/authUtils';
import type { Conversation, ChatUser, ChatMessage, NewConvUser } from '../data/messagerieTypes';
import { useSocket } from './useSocket';
import type {
  WsNewMessage, WsMessageRead, WsMessageDelivered, WsTyping, WsPresence,
} from './useSocket';

// ── Types réponse API ─────────────────────────────────────────

interface ApiConv {
  id:             string;
  contactId:      string;
  contactType:    string;
  contactName:    string;
  contactLogo:    string | null;
  contactOnline:  boolean;
  contactUserId?: string | null;
  unreadCount:    number;
  lastMessage:    string | null;
  lastMessageAt:  string | null;
}

interface ApiMessage {
  id:            string;
  fromMe:        boolean;
  senderId:      string;
  senderType:    string;
  contentType:   string;
  content:       string | null;
  mediaUrl:      string | null;
  mediaName:     string | null;
  mediaMimeType: string | null;
  mediaDuration: number | null;
  createdAt:     string;
  readAt:        string | null;
  replyToId:     string | null;
  productId:     string | null;
  orderId:       string | null;
  isEdited:      boolean;
  deletedAt:     string | null;
}

export interface MediaAttachment {
  url:       string;
  name:      string;
  size:      number;
  mime:      string;
  type:      'image' | 'video' | 'file' | 'audio';
  /** Durée en secondes — uniquement pour les messages vocaux */
  duration?: number;
}

// ── Mapping actorType → UserRole frontend ─────────────────────

const TYPE_TO_ROLE: Record<string, string> = {
  company:       'vendeur',
  delivery:      'livreur',
  correspondent: 'correspondant',
  client:        'client',
};

function toFrontRole(type: string): string {
  return TYPE_TO_ROLE[type] ?? 'client';
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function nowTime(): string {
  return fmtTime(new Date().toISOString());
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function apiConvToState(api: ApiConv, messages: ChatMessage[] = []): { conv: Conversation; user: ChatUser } {
  const user: ChatUser = {
    id:       api.contactId,
    userId:   api.contactUserId ?? undefined,
    name:     api.contactName,
    role:     toFrontRole(api.contactType) as any,
    ava:      api.contactLogo ? api.contactLogo : initials(api.contactName) || '?',
    avaColor: 'linear-gradient(135deg,var(--sky,#EEF3FD),var(--sky-2,#E2EAFB))',
    online:   api.contactOnline,
    context:  (api as any).contactSubtitle ?? undefined,
  };
  const conv: Conversation = {
    id:       api.id,
    userId:   api.contactId,
    pinned:   false,
    unread:   api.unreadCount,
    lastMsg:  api.lastMessage ?? '',
    lastTime: fmtTime(api.lastMessageAt),
    muted:    false,
    messages,
  };
  return { conv, user };
}

const CONTENT_TYPE_MAP: Record<string, ChatMessage['type']> = {
  text:    'text',
  image:   'image',
  video:   'video',
  audio:   'voice',
  file:    'file',
  product: 'product',
  order:   'order',
  call:    'call',
};

function apiMsgToChat(m: ApiMessage): ChatMessage {
  const base: ChatMessage = {
    id:        m.id,
    from:      m.fromMe ? 'me' : m.senderId,
    type:      CONTENT_TYPE_MAP[m.contentType] ?? 'text',
    text:      m.content ?? undefined,
    time:      fmtTime(m.createdAt),
    read:      !!m.readAt,
    mediaUrl:  m.mediaUrl  ?? undefined,
    mediaName: m.mediaName ?? undefined,
    mediaMime: m.mediaMimeType ?? undefined,
    duration:  m.mediaDuration ? fmtDuration(m.mediaDuration) : undefined,
  };

  /* Désérialise les métadonnées d'appel */
  if (m.contentType === 'call' && m.content) {
    try { base.callMeta = JSON.parse(m.content); } catch { /* ignoré */ }
  }

  return base;
}

// ═════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═════════════════════════════════════════════════════════════

export function useMessagerie() {
  const [conversations,     setConversations]     = useState<Conversation[]>([]);
  const [archivedConvs,     setArchivedConvs]     = useState<Conversation[]>([]);
  const [archivedLoaded,    setArchivedLoaded]    = useState(false);
  const [users,             setUsers]             = useState<ChatUser[]>([]);
  const [activeConvId,      setActiveConvId]      = useState<string | null>(null);
  const [infoPanelOpen,     setInfoPanelOpen]     = useState(false);
  const [newConvOpen,       setNewConvOpen]       = useState(false);
  const [mobileOpen,        setMobileOpen]        = useState(() => window.innerWidth <= 640);
  const [loadingConvs,      setLoadingConvs]      = useState(true);

  /** Map<convId, {senderId, senderName, activity}> — indicateurs typing temps réel */
  const [typingMap, setTypingMap] = useState<Map<string, WsTyping>>(new Map());

  const loadedMsgs    = useRef<Set<string>>(new Set());
  const activeConvRef = useRef<string | null>(null);

  // ── Callbacks Socket.IO ───────────────────────────────────

  const handleNewMessage = useCallback((payload: WsNewMessage) => {
    const { conversationId, message, convPreview } = payload;

    const chatMsg: ChatMessage = {
      id:          message.id,
      from:        message.senderId,
      type:        (message.contentType as any) === 'text' ? 'text'
                 : (message.contentType as any) === 'image' ? 'image'
                 : (message.contentType as any) === 'video' ? 'video'
                 : (message.contentType as any) === 'file'  ? 'file'
                 : (message.contentType as any) === 'audio' ? 'voice'
                 : 'text',
      text:        message.content ?? undefined,
      mediaUrl:    message.mediaUrl  ?? undefined,
      mediaName:   message.mediaName ?? undefined,
      mediaMime:   message.mediaMimeType ?? undefined,
      time:        new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      read:        false,
      replyToId:   message.replyToId ?? undefined,
    };

    setConversations(prev => prev.map(c => {
      if (c.id !== conversationId) return c;

      /* Si la conv est active → ajoute le message et ne badge pas */
      const isActive = activeConvRef.current === conversationId;
      return {
        ...c,
        messages:  [...c.messages, chatMsg],
        lastMsg:   convPreview.lastMessage,
        lastTime:  new Date(convPreview.lastMessageAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        unread:    isActive ? 0 : convPreview.unreadCount,
      };
    }));
  }, []);

  /* message_delivered → ✓✓ gris sur les messages envoyés */
  const handleMessageDelivered = useCallback((payload: WsMessageDelivered) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== payload.conversationId) return c;
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === payload.messageId && m.from === 'me'
            ? { ...m, delivered: true }
            : m,
        ),
      };
    }));
  }, []);

  /* message_read → ✓✓ coloré sur tous mes messages de la conv */
  const handleMessageRead = useCallback((payload: WsMessageRead) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== payload.conversationId) return c;
      return {
        ...c,
        messages: c.messages.map(m =>
          m.from === 'me' ? { ...m, delivered: true, read: true } : m,
        ),
      };
    }));
  }, []);

  const handleTyping = useCallback((payload: WsTyping) => {
    setTypingMap(prev => {
      const next = new Map(prev);
      if (payload.activity === 'stopped') {
        next.delete(payload.conversationId);
      } else {
        next.set(payload.conversationId, payload);
        /* Auto-nettoie après 4s si "stopped" n'arrive pas */
        setTimeout(() => setTypingMap(m => {
          const n = new Map(m);
          n.delete(payload.conversationId);
          return n;
        }), 4000);
      }
      return next;
    });
  }, []);

  const handlePresence = useCallback((payload: WsPresence) => {
    setUsers(prev => prev.map(u =>
      (u.userId === payload.userId || u.id === payload.userId)
        ? { ...u, online: payload.online }
        : u,
    ));
  }, []);

  const handleMessageEdited = useCallback((payload: import('./useSocket').WsMessageEdited) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== payload.conversationId) return c;
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === payload.messageId
            ? { ...m, text: payload.newContent, isEdited: true }
            : m,
        ),
      };
    }));
  }, []);

  const handleMessageDeleted = useCallback((payload: import('./useSocket').WsMessageDeleted) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== payload.conversationId) return c;
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === payload.messageId
            ? { ...m, deleted: true, text: undefined, mediaUrl: undefined }
            : m,
        ),
      };
    }));
  }, []);

  const handleReactionUpdated = useCallback((payload: import('./useSocket').WsReactionUpdated) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== payload.conversationId) return c;
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === payload.messageId
            ? { ...m, reactions: payload.reactions }
            : m,
        ),
      };
    }));
  }, []);

  /* Socket — abonnements temps réel */
  const { joinConv, leaveConv, sendTyping, markRead, socketConnected } = useSocket({
    onNewMessage:       handleNewMessage,
    onMessageDelivered: handleMessageDelivered,
    onMessageRead:      handleMessageRead,
    onTyping:           handleTyping,
    onPresence:         handlePresence,
    onMessageEdited:    handleMessageEdited,
    onMessageDeleted:   handleMessageDeleted,
    onReactionUpdated:  handleReactionUpdated,
  });

  const role     = getRoleFromToken();
  const location = useLocation();
  /* convId passé via navigate('/messagerie', { state: { activeConvId } }) */
  const pendingConvId = (location.state as any)?.activeConvId as string | undefined;

  // ── Charge les conversations + pré-sélectionne si nécessaire ──
  useEffect(() => {
    if (!role) { setLoadingConvs(false); return; }

    apiFetch<ApiConv[]>('/messagerie/conversations')
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        const newConvs: Conversation[] = [];
        const newUsers: ChatUser[]     = [];
        list.forEach(api => {
          const { conv, user } = apiConvToState(api);
          newConvs.push(conv);
          newUsers.push(user);
        });
        setConversations(newConvs);
        setUsers(newUsers);

        /* Pré-sélectionner la conversation demandée (ex. depuis profil boutique) */
        if (pendingConvId) {
          const exists = newConvs.find(c => c.id === pendingConvId);
          if (exists) setActiveConvId(pendingConvId);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConvs(false));
  }, []);

  // ── Map userId → user ─────────────────────────────────────
  const usersMap = useMemo(() => {
    const m = new Map<string, ChatUser>();
    users.forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  const activeConv = useMemo(() => conversations.find(c => c.id === activeConvId) ?? null, [conversations, activeConvId]);
  const activeUser = activeConv ? usersMap.get(activeConv.userId) ?? null : null;
  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + c.unread, 0), [conversations]);

  // ── Sélectionner une conversation ─────────────────────────
  const selectConv = useCallback(async (id: string) => {
    /* Quitte la room de l'ancienne conv */
    if (activeConvRef.current && activeConvRef.current !== id) {
      leaveConv(activeConvRef.current);
    }

    setActiveConvId(id);
    activeConvRef.current = id;
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
    setMobileOpen(false);

    /* Rejoint la room Socket.IO pour les typing indicators */
    joinConv(id);
    /* Marque lue via Socket (plus rapide que REST) */
    markRead(id);

    if (loadedMsgs.current.has(id)) return;

    try {
      const msgs = await apiFetch<ApiMessage[]>(`/messagerie/conversations/${id}/messages?limit=50`);
      if (Array.isArray(msgs)) {
        setConversations(prev => prev.map(c =>
          c.id === id ? { ...c, messages: msgs.map(apiMsgToChat) } : c
        ));
        loadedMsgs.current.add(id);
        /* REST fallback — garantit la mise à jour BDD même si socket hors ligne */
        apiFetch(`/messagerie/conversations/${id}/read`, { method: 'PATCH' }).catch(() => {});
      }
    } catch { /* silencieux */ }
  }, [joinConv, leaveConv, markRead]);

  // ── Envoyer un message (texte ou média) ──────────────────
  const sendMessage = useCallback(async (
    convId: string,
    text:   string,
    media?: MediaAttachment,
  ) => {
    const rawType  = media?.type ?? 'text';
    const msgType: ChatMessage['type'] = rawType === 'audio' ? 'voice' : rawType as ChatMessage['type'];
    const optimistic: ChatMessage = {
      id:        'tmp-' + Date.now(),
      from:      'me',
      type:      msgType,
      text:      text || undefined,
      time:      nowTime(),
      read:      false,
      mediaUrl:  media?.url,
      mediaName: media?.name,
      mediaMime: media?.mime,
      duration:  media?.duration ? fmtDuration(media.duration) : undefined,
    };
    const previewText = text || (
      msgType === 'image' ? '📷 Photo' :
      msgType === 'video' ? '🎥 Vidéo' :
      msgType === 'file'  ? `📄 ${media?.name ?? 'Document'}` :
      msgType === 'voice' ? '🎙️ Message vocal' : ''
    );

    setConversations(prev => prev.map(c =>
      c.id === convId
        ? { ...c, messages: [...c.messages, optimistic], lastMsg: previewText, lastTime: nowTime() }
        : c
    ));

    try {
      const body: Record<string, unknown> = {
        contentType: media ? media.type : 'text',
        content:     text || null,
      };
      if (media) {
        body.mediaUrl      = media.url;
        body.mediaName     = media.name;
        body.mediaSize     = media.size;
        body.mediaMimeType = media.mime;
        if (media.duration) body.mediaDuration = media.duration;
      }

      const saved = await apiFetch<ApiMessage>(
        `/messagerie/conversations/${convId}/messages`,
        { method: 'POST', body },
      );
      if (saved) {
        setConversations(prev => prev.map(c =>
          c.id === convId
            ? { ...c, messages: c.messages.map(m => m.id === optimistic.id ? apiMsgToChat(saved) : m) }
            : c
        ));
      }
    } catch { /* garder le message optimiste */ }
  }, []);

  // ── Enregistrer un événement d'appel dans la conversation ──
  const sendCallEvent = useCallback(async (
    convId:    string,
    status:    'completed' | 'missed' | 'rejected' | 'cancelled' | 'busy',
    direction: 'outgoing' | 'incoming',
    duration?: number,
    callType?: 'audio' | 'video',
  ) => {
    const meta = { status, direction, duration, callType: callType ?? 'audio' };
    const icon = callType === 'video' ? '📹' : '📞';
    const preview = status === 'completed'  ? `${icon} Appel ${callType === 'video' ? 'vidéo' : 'audio'}${duration ? ` · ${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}` : ''}`
      : status === 'missed'    ? `${icon} Appel manqué`
      : status === 'rejected'  ? `${icon} Appel refusé`
      : status === 'cancelled' ? `${icon} Appel annulé`
      : `${icon} Appel occupé`;

    /* Mise à jour optimiste locale */
    const optimistic: ChatMessage = {
      id:       'tmp-call-' + Date.now(),
      from:     direction === 'outgoing' ? 'me' : convId,
      type:     'call',
      time:     nowTime(),
      read:     false,
      callMeta: meta,
    };
    setConversations(prev => prev.map(c =>
      c.id === convId
        ? { ...c, messages: [...c.messages, optimistic], lastMsg: preview, lastTime: nowTime() }
        : c,
    ));

    /* Persistance via REST */
    try {
      const saved = await apiFetch<ApiMessage>(
        `/messagerie/conversations/${convId}/messages`,
        { method: 'POST', body: { contentType: 'call', content: JSON.stringify(meta) } },
      );
      if (saved) {
        setConversations(prev => prev.map(c =>
          c.id === convId
            ? { ...c, messages: c.messages.map(m => m.id === optimistic.id ? apiMsgToChat(saved) : m) }
            : c,
        ));
      }
    } catch { /* garder le message optimiste */ }
  }, []);

  /**
   * Met à jour LOCALEMENT la liste de messages après un appel.
   * Utilisé par GlobalCallProvider via registerCallEventHandler :
   * le provider gère la persistance REST, cette fonction gère l'UI optimiste.
   */
  const applyCallEventLocally = useCallback((
    convId:    string,
    status:    'completed' | 'missed' | 'rejected' | 'cancelled' | 'busy',
    direction: 'outgoing' | 'incoming',
    duration?: number,
    callType?: 'audio' | 'video',
  ) => {
    const meta    = { status, direction, duration, callType: callType ?? 'audio' };
    const icon    = callType === 'video' ? '📹' : '📞';
    const preview = status === 'completed'  ? `${icon} Appel ${callType === 'video' ? 'vidéo' : 'audio'}${duration ? ` · ${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}` : ''}`
      : status === 'missed'    ? `${icon} Appel manqué`
      : status === 'rejected'  ? `${icon} Appel refusé`
      : status === 'cancelled' ? `${icon} Appel annulé`
      : `${icon} Appel occupé`;

    setConversations(prev => prev.map(c =>
      c.id !== convId ? c : {
        ...c,
        lastMsg:  preview,
        lastTime: nowTime(),
        messages: [...c.messages, {
          id:       'tmp-call-' + Date.now(),
          from:     direction === 'outgoing' ? 'me' : convId,
          type:     'call' as const,
          time:     nowTime(),
          read:     false,
          callMeta: meta,
        }],
      },
    ));
  }, []);

  // ── Modifier un message (texte, délai 24h) ───────────────
  const editMessage = useCallback(async (convId: string, msgId: string, newContent: string) => {
    /* Optimiste : mise à jour immédiate locale */
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, text: newContent, isEdited: true } : m) };
    }));
    try {
      await apiFetch(`/messagerie/messages/${msgId}`, { method: 'PATCH', body: { content: newContent } });
    } catch { /* garder l'optimiste */ }
  }, []);

  // ── Supprimer un message ─────────────────────────────────
  const deleteMessage = useCallback(async (
    convId: string,
    msgId: string,
    mode: 'me' | 'everyone' | 'other' = 'me',
  ) => {
    // 'me' et 'everyone' : je ne vois plus le message → update optimiste local
    // 'other' : je le vois encore, c'est l'autre qui ne le verra plus
    if (mode === 'me' || mode === 'everyone') {
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === msgId ? { ...m, deleted: true, text: undefined, mediaUrl: undefined } : m,
          ),
        };
      }));
    }
    try {
      await apiFetch(`/messagerie/messages/${msgId}`, { method: 'DELETE', body: { mode } });
    } catch { /* garder l'optimiste */ }
  }, []);

  // ── Supprimer une conversation ───────────────────────────
  const deleteConversation = useCallback(async (convId: string) => {
    /* Optimiste : retrait immédiat de la liste */
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConvRef.current === convId) {
      setActiveConvId(null);
      activeConvRef.current = null;
    }
    try {
      await apiFetch(`/messagerie/conversations/${convId}`, { method: 'DELETE' });
    } catch { /* silencieux — la liste a déjà été mise à jour */ }
  }, []);

  // ── Masquer une conversation (archive) ───────────────────
  const hideConversation = useCallback(async (convId: string) => {
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConvRef.current === convId) {
      setActiveConvId(null);
      activeConvRef.current = null;
    }
    try {
      await apiFetch(`/messagerie/conversations/${convId}/archive`, { method: 'PATCH', body: { archived: true } });
    } catch { /* silencieux */ }
  }, []);

  // ── Charger les conversations masquées ───────────────────
  const loadArchivedConvs = useCallback(async () => {
    if (archivedLoaded) return;
    try {
      const list = await apiFetch<ApiConv[]>('/messagerie/conversations/archived');
      if (Array.isArray(list)) {
        const convs: Conversation[] = [];
        const newUsers: ChatUser[]  = [];
        list.forEach(api => {
          const { conv, user } = apiConvToState(api);
          convs.push(conv);
          newUsers.push(user);
        });
        setArchivedConvs(convs);
        setUsers(prev => {
          const ids = new Set(prev.map(u => u.id));
          return [...prev, ...newUsers.filter(u => !ids.has(u.id))];
        });
        setArchivedLoaded(true);
      }
    } catch { /* silencieux */ }
  }, [archivedLoaded]);

  // ── Démasquer une conversation (unarchive) ────────────────
  const unhideConversation = useCallback(async (convId: string) => {
    /* Retire des masquées, remet dans la liste principale */
    const conv = archivedConvs.find(c => c.id === convId);
    setArchivedConvs(prev => prev.filter(c => c.id !== convId));
    if (conv) {
      setConversations(prev =>
        prev.some(c => c.id === convId) ? prev : [conv, ...prev],
      );
    }
    try {
      await apiFetch(`/messagerie/conversations/${convId}/archive`, { method: 'PATCH', body: { archived: false } });
    } catch { /* silencieux */ }
  }, [archivedConvs]);

  // ── Marquer une conversation comme non lue ────────────────
  const markConvAsUnread = useCallback(async (convId: string) => {
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread: 1 } : c));
    try {
      await apiFetch(`/messagerie/conversations/${convId}/unread`, { method: 'PATCH' });
    } catch { /* silencieux */ }
  }, []);

  // ── Marquer toute une conversation comme lue ─────────────
  const markConvAsRead = useCallback(async (convId: string) => {
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread: 0 } : c));
    try {
      await apiFetch(`/messagerie/conversations/${convId}/read`, { method: 'PATCH' });
    } catch { /* silencieux */ }
  }, []);

  // ── Toggle réaction emoji ─────────────────────────────────
  const toggleReaction = useCallback(async (convId: string, msgId: string, emoji: string) => {
    try {
      const res = await apiFetch<{ reactions: Record<string, string[]> }>(
        `/messagerie/messages/${msgId}/reactions`,
        { method: 'POST', body: { emoji } },
      );
      if (res?.reactions) {
        setConversations(prev => prev.map(c => {
          if (c.id !== convId) return c;
          return { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, reactions: res.reactions } : m) };
        }));
      }
    } catch { /* silencieux */ }
  }, []);

  // ── Démarrer une nouvelle conversation ────────────────────
  const startNewConv = useCallback(async (newUser: NewConvUser) => {
    setNewConvOpen(false);
    try {
      const api = await apiFetch<ApiConv>(
        '/messagerie/conversations',
        { method: 'POST', body: { targetType: newUser.id.split(':')[0], targetId: newUser.id.split(':')[1] } },
      );
      if (!api) return;

      const { conv, user } = apiConvToState(api);
      setUsers(prev => prev.some(u => u.id === user.id) ? prev : [...prev, user]);
      setConversations(prev => {
        if (prev.some(c => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      setActiveConvId(conv.id);
    } catch { /* silencieux */ }
  }, []);

  return {
    conversations,
    usersMap,
    activeConv,
    activeUser,
    activeConvId,
    totalUnread,
    infoPanelOpen,
    newConvOpen,
    mobileOpen,
    loadingConvs,
    typingMap,       // indicateurs "X est en train d'écrire" temps réel
    sendTyping,
    socketConnected, // true = Socket.IO connecté au serveur
    selectConv,
    sendMessage,
    editMessage,
    deleteMessage,
    deleteConversation,
    hideConversation,
    archivedConvs,
    loadArchivedConvs,
    unhideConversation,
    markConvAsUnread,
    markConvAsRead,
    toggleReaction,
    sendCallEvent,
    applyCallEventLocally,
    startNewConv,
    setInfoPanelOpen,
    setNewConvOpen,
    setMobileOpen,
    setActiveConvId,
  };
}
