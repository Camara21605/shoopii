/*
 * FICHIER : src/shared/messagerie/MessagerieCore.tsx
 *
 * Composant principal de la messagerie partagée.
 *
 * CHANGEMENT MAJEUR :
 *   L'appel audio/vidéo n'est PLUS géré localement dans ce composant.
 *   Il passe maintenant par GlobalCallProvider (context global) qui :
 *     - maintient le socket actif quelle que soit la page courante
 *     - affiche CallOverlay sur toute l'application
 *     - persiste les événements d'appel via REST même hors messagerie
 *
 *   Ce composant enregistre seulement un handler "mise à jour locale"
 *   (applyCallEventLocally) pour l'update optimiste du state React.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation }    from 'react-i18next';
import { useMessagerie }     from './hooks/useMessagerie';
import { useDeliveryGroups } from './hooks/useDeliveryGroups';
import { useCallHistory }    from './hooks/useCallHistory';
import { useGlobalCall }     from '../context/GlobalCallContext';
import { useGroupCallCtx }  from '../context/GroupCallContext';
import { useToast }          from '../context/ToastContext';

import ConvList     from './components/ConvList';
import ChatWindow   from './sections/ChatWindow';
import InfoPanel    from './sections/InfoPanel';

import s from './styles/MessagerieLayout.module.css';

// ─────────────────────────────────────────────────────────────

interface Props {
  /** false → masque la zone de saisie de ChatWindow (collaborateur d'entreprise
   * sans la permission messaging.send). Undefined/true = comportement inchangé
   * pour tous les autres rôles/dashboards (client, livreur, correspondant…),
   * qui ne passent pas cette prop. */
  canSend?: boolean;
  /** UUID d'une conversation à ouvrir automatiquement au montage — utilisé
   * par MessageriePage pour le lien profond `?conv=` (notifications
   * message.received / call.* — voir notificationUtils.resolveNavTarget). */
  initialConversationId?: string;
}

export default function MessagerieCore({ canSend = true, initialConversationId }: Props = {}) {
  const { t } = useTranslation();
  const { pop } = useToast();
  /* useCallback : référence stable, propagée jusqu'à MessageBubble (via
   * ChatWindow → MessagesZone) — sans ça, MessageBubble.memo est inutile
   * puisque `onToast` change de référence à chaque rendu de ce composant. */
  const toast = useCallback((msg: string, type?: string) => pop(msg, type as any), [pop]);

  /* Verrouille le scroll de la page (html + body) tant que la messagerie
   * est montée. Le layout (.layout / .pageWrap) est déjà calé sur
   * 100dvh avec overflow:hidden, mais ça reste fragile : le moindre écart
   * de quelques pixels entre la hauteur réelle du contenu et le viewport
   * (arrondi, barre d'adresse mobile qui se montre/cache pendant le
   * scroll) rend le <body> scrollable, et tout l'écran "bouge"/rebondit
   * au moindre geste au lieu de rester parfaitement fixe. Ce verrou
   * s'applique partout où MessagerieCore est monté (page publique
   * /messagerie ET l'onglet messages de chaque dashboard). */
  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const prev = {
      htmlOverflow:   html.style.overflow,
      bodyOverflow:   body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow   = prev.htmlOverflow;
      body.style.overflow   = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, []);

  // ── Messagerie ───────────────────────────────────────────────
  const {
    conversations,
    usersMap,
    activeConv,
    activeUser,
    activeConvId,
    totalUnread,
    infoPanelOpen,
    mobileOpen,
    loadingConvs,
    loadingMoreConvs,
    hasMoreConvs,
    loadMoreConversations,
    loadOlderMessages,
    jumpToMessage,
    retryMessage,
    typingMap,
    sendTyping,
    socketConnected,
    selectConv,
    sendMessage,
    deleteMessage,
    deleteConversation,
    hideConversation,
    archivedConvs,
    loadArchivedConvs,
    unhideConversation,
    markConvAsUnread,
    markConvAsRead,
    applyCallEventLocally,
    startNewConv,
    setInfoPanelOpen,
    setMobileOpen,
    setActiveConvId,
  } = useMessagerie();

  // ── Groupes de livraison ──────────────────────────────────────
  const {
    groups,
    groupUsersMap,
    activeGroupId,
    activeGroup,
    activeGroupUser,
    activeGroupMembers,
    selectGroup,
    sendGroupMessage,
    deleteGroupMessage,
    updateGroupDescription,
  } = useDeliveryGroups();

  // ── Sélection unifiée (conv ou groupe) ───────────────────────
  const handleSelect = useCallback((id: string) => {
    if (groups.some(g => g.id === id)) {
      selectGroup(id);
      setActiveConvId(null);
    } else {
      selectConv(id);
      selectGroup(null);
    }
    setMobileOpen(false);
  }, [groups, selectGroup, selectConv, setActiveConvId, setMobileOpen]);

  /* Lien profond depuis une notification : sélectionne la conversation
   * demandée UNE SEULE fois au montage. Ne dépend pas du chargement de
   * `conversations` — selectConv() récupère les messages par id
   * indépendamment de la liste, la conversation apparaîtra dans ConvList
   * dès qu'elle aura chargé. */
  const initialConvAppliedRef = useRef(false);
  useEffect(() => {
    if (!initialConversationId || initialConvAppliedRef.current) return;
    initialConvAppliedRef.current = true;
    selectConv(initialConversationId);
    selectGroup(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId]);

  // ── Données actives (conv ou groupe) ─────────────────────────
  const currentConv = activeGroupId ? activeGroup : activeConv;
  const currentUser = activeGroupId ? activeGroupUser : activeUser;

  /* ── "Aller au message" (résultat de recherche du ChatHeader) ──
   * `jumpTarget` déclenche le défilement/surlignage dans MessagesZone
   * (voir jumpToMessageId ci-dessous) — mis à null par onJumpHandled une
   * fois consommé, pour qu'un nouveau clic sur le MÊME résultat puisse
   * redéclencher le défilement/flash. */
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);

  const handleJumpToMessage = useCallback(async (msgId: string) => {
    if (activeGroupId) {
      /* Groupes de livraison : pas de chargement "page plus ancienne" à la
       * demande côté jumpToMessage (volume de messages typiquement faible,
       * voir VirtualizedMessageList.tsx) — on vérifie juste que le message
       * est déjà dans la fenêtre chargée. */
      if (!activeGroup?.messages.some(m => m.id === msgId)) {
        toast(t('messagerie.messagesZone.messageIntrouvable'), 'w');
        return;
      }
      setJumpTarget(msgId);
      return;
    }
    if (!activeConvId) return;
    const found = await jumpToMessage(activeConvId, msgId);
    if (found) setJumpTarget(msgId);
    else toast(t('messagerie.messagesZone.messageIntrouvable'), 'w');
  }, [activeGroupId, activeGroup, activeConvId, jumpToMessage, toast, t]);

  /* ── Clic sur une entrée de l'onglet "Appels" (ConvList) ──
   * Toujours une conversation directe (les appels de groupe ne passent pas
   * par ce service, voir group-call.gateway.ts) — on sélectionne la conv
   * puis on va directement à la bulle d'appel avec l'id déjà connu, SANS
   * passer par activeConvId (qui n'aurait pas encore la bonne valeur juste
   * après selectConv — state React mis à jour de façon asynchrone). */
  const handleSelectCall = useCallback(async (conversationId: string, messageId: string | null) => {
    selectConv(conversationId);
    selectGroup(null);
    setMobileOpen(false);

    if (!messageId) return; // corrélation backend sans résultat — la conversation reste ouverte
    const found = await jumpToMessage(conversationId, messageId);
    if (found) setJumpTarget(messageId);
    else toast(t('messagerie.messagesZone.messageIntrouvable'), 'w');
  }, [selectConv, selectGroup, setMobileOpen, jumpToMessage, toast, t]);

  // ── Map utilisateurs fusionnée pour ConvList ─────────────────
  const mergedUsersMap = useMemo(() => {
    if (groupUsersMap.size === 0) return usersMap;
    return new Map([...usersMap, ...groupUsersMap]);
  }, [usersMap, groupUsersMap]);

  // ── Appel P2P global (socket + overlay persistants cross-routes) ─
  const {
    startCall,
    registerCallEventHandler,
    syncMsgUnread,
  } = useGlobalCall();

  // ── Appel de groupe ──────────────────────────────────────────
  const { initiateCall: initiateGroupCall } = useGroupCallCtx();

  // ── Historique des appels (onglet "Appels") ──────────────────
  const { data: callHistory, loading: callHistoryLoading, load: loadCallHistory, deleteItem: deleteCallHistoryItem } = useCallHistory();

  /*
   * Enregistre la fonction de mise à jour locale auprès du contexte global.
   * Quand un appel se termine, GlobalCallProvider :
   *   1. Appelle cette fonction → update optimiste du state React
   *   2. Persiste l'événement via REST (fait lui-même, pas besoin ici)
   */
  useEffect(() => {
    registerCallEventHandler((event) => {
      applyCallEventLocally(
        event.conversationId,
        event.status,
        event.direction,
        event.duration,
        event.callType,
      );
    });
    return () => registerCallEventHandler(null);
  }, [registerCallEventHandler, applyCallEventLocally]);

  /* Synchronise le badge du header en temps réel :
   * quand l'utilisateur lit une conversation, totalUnread décrémente
   * dans useMessagerie → on l'écrit directement dans GlobalCallContext */
  useEffect(() => {
    syncMsgUnread(totalUnread);
  }, [totalUnread, syncMsgUnread]);

  // ── Supprimer un message ────────────────────────────────────
  const handleDelete = useCallback((msgId: string, mode: 'me' | 'everyone' | 'other') => {
    if (activeGroupId) {
      deleteGroupMessage(activeGroupId, msgId, mode === 'other' ? 'me' : mode);
    } else if (activeConvId) {
      deleteMessage(activeConvId, msgId, mode);
    }
  }, [activeGroupId, activeConvId, deleteGroupMessage, deleteMessage]);

  // ── Charger les messages plus anciens (conv directe seulement —
  // pas de pagination messages sur les groupes de livraison, hors périmètre) ──
  const handleLoadOlderMessages = useCallback((convId: string) => {
    if (!activeGroupId) loadOlderMessages(convId);
  }, [activeGroupId, loadOlderMessages]);

  // ── Réessayer un message resté en échec (conv directe seulement) ──
  const handleRetry = useCallback((msgId: string) => {
    if (!activeGroupId && activeConvId) retryMessage(activeConvId, msgId);
  }, [activeGroupId, activeConvId, retryMessage]);

  // ── Envoyer un message (conv ou groupe) ──────────────────────
  // Le partage de commande/position (`extra`) n'est disponible que pour les
  // conversations directes — les groupes de livraison n'ont pas cette
  // permission (contenu hors de leur périmètre : coordination de livraison).
  const handleSend = useCallback((convId: string, text: string, media?: any, extra?: any, resolveMedia?: () => Promise<any>) => {
    if (activeGroupId) {
      /* Les groupes n'ont pas (encore) d'affichage optimiste pendant l'upload
       * — resolveMedia (préview locale, ex. message vocal) doit donc être
       * attendu ICI avant d'envoyer, comme avant l'ajout de resolveMedia
       * pour les conversations 1:1. */
      const doSend = async () => {
        const realMedia = resolveMedia ? await resolveMedia() : media;
        if (realMedia) {
          const grpContentType =
            realMedia.type === 'image' ? 'image' :
            realMedia.type === 'video' ? 'video' :
            realMedia.type === 'audio' ? 'audio' : 'file';
          sendGroupMessage(activeGroupId, {
            contentType:   grpContentType,
            content:       text || null as any,
            mediaUrl:      realMedia.url,
            mediaName:     realMedia.name,
            mediaSize:     realMedia.size,
            mediaMimeType: realMedia.mime,
            mediaDuration: realMedia.duration,
          });
        } else {
          sendGroupMessage(activeGroupId, { contentType: 'text', content: text });
        }
      };
      void doSend();
    } else {
      sendMessage(convId, text, media, extra, resolveMedia);
    }
  }, [activeGroupId, sendGroupMessage, sendMessage]);

  // ── Lancer un appel vers le contact actif (conv seulement) ──
  const handleCall = () => {
    if (activeGroupId || !activeConv || !activeUser) {
      console.warn('[Call] handleCall abandonné — groupe/conv/user manquant', { activeGroupId, activeConv, activeUser });
      return;
    }
    const remoteUserId = activeUser.userId ?? null;
    if (!remoteUserId) {
      console.warn('[Call] handleCall abandonné — activeUser.userId manquant', activeUser);
      return;
    }
    startCall({
      conversationId: activeConv.id,
      remoteUserId,
      remoteName:   activeUser.name,
      remoteAvatar: activeUser.ava?.startsWith('http') ? activeUser.ava : undefined,
      callType:     'audio',
    }).catch(err => console.error('[Call] startCall (audio) a rejeté :', err));
  };

  // ── Démarrer une nouvelle conversation (avec retour d'erreur visible) ──
  const handleStartNewConv = useCallback(async (user: Parameters<typeof startNewConv>[0]) => {
    try {
      await startNewConv(user);
    } catch (err: any) {
      toast(err?.message ?? t('messagerie.core.demarrerConversationEchec'), 'e');
    }
  }, [startNewConv, toast, t]);

  /*
   * "Nouvelle conversation" n'ouvre plus de fenêtre modale séparée — un
   * contact avec qui une relation existe (commande, abonnement, contact
   * partagé) apparaît directement dans l'onglet dédié à son rôle
   * (Boutiques/Livreurs/Clients/Correspondants) dans ConvList, comme un
   * contact jamais encore écrit. Ce bouton se contente d'ouvrir la liste
   * sur mobile et de donner le focus à la recherche déjà présente en
   * haut de la liste (ConvList bascule aussi sur "Tous" si l'onglet actif
   * ne peut pas afficher de nouveaux contacts, ex. Masquées/Appels).
   */
  const [focusSearchToken, setFocusSearchToken] = useState(0);
  const handleRequestNewConv = useCallback(() => {
    setMobileOpen(true);
    setFocusSearchToken(v => v + 1);
  }, [setMobileOpen]);

  const handleVideoCall = () => {
    if (activeGroupId || !activeConv || !activeUser) {
      console.warn('[Call] handleVideoCall abandonné — groupe/conv/user manquant', { activeGroupId, activeConv, activeUser });
      return;
    }
    const remoteUserId = activeUser.userId ?? null;
    if (!remoteUserId) {
      console.warn('[Call] handleVideoCall abandonné — activeUser.userId manquant', activeUser);
      return;
    }
    startCall({
      conversationId: activeConv.id,
      remoteUserId,
      remoteName:   activeUser.name,
      remoteAvatar: activeUser.ava?.startsWith('http') ? activeUser.ava : undefined,
      callType:     'video',
    }).catch(err => console.error('[Call] startCall (vidéo) a rejeté :', err));
  };

  // ── Rendu ─────────────────────────────────────────────────────
  return (
    <div className={s.layout}>

      {/* Badge Socket.IO déconnecté */}
      {!socketConnected && (
        <div style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(220,38,38,.95)', color: '#fff',
          padding: '8px 18px', borderRadius: 999,
          fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 7,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
          pointerEvents: 'none',
        }}>
          <i className="fas fa-circle-exclamation" />
          {t('messagerie.core.disconnected')}
        </div>
      )}

      {/* Colonne gauche : liste des conversations */}
      <ConvList
        conversations={conversations}
        usersMap={mergedUsersMap}
        activeId={activeGroupId ?? activeConvId}
        mobileOpen={mobileOpen}
        totalUnread={totalUnread}
        onSelect={handleSelect}
        onNewConv={handleRequestNewConv}
        onStartConversation={handleStartNewConv}
        focusSearchToken={focusSearchToken}
        onDeleteConv={deleteConversation}
        onHideConv={hideConversation}
        onToast={toast}
        archivedConvs={archivedConvs}
        onLoadArchived={loadArchivedConvs}
        onUnhideConv={unhideConversation}
        onMarkUnread={markConvAsUnread}
        onMarkRead={markConvAsRead}
        loadingConvs={loadingConvs}
        hasMoreConvs={hasMoreConvs}
        loadingMoreConvs={loadingMoreConvs}
        onLoadMoreConversations={loadMoreConversations}
        groupConvs={groups}
        groupUsersMap={groupUsersMap}
        callHistory={callHistory}
        callHistoryLoading={callHistoryLoading}
        onLoadCallHistory={loadCallHistory}
        onDeleteCallHistoryItem={id => deleteCallHistoryItem(id).catch(() => toast('❌ Suppression impossible', 'e'))}
        onSelectCall={handleSelectCall}
      />

      {/* Colonne centrale : fenêtre de chat */}
      <ChatWindow
        conv={currentConv}
        user={currentUser}
        members={activeGroupId ? activeGroupMembers : undefined}
        infoPanelOpen={infoPanelOpen}
        typingActivity={activeConvId ? typingMap.get(activeConvId) : undefined}
        onSend={handleSend}
        onTyping={activeGroupId ? undefined : sendTyping}
        onToggleInfo={() => setInfoPanelOpen(p => !p)}
        onNewConv={handleRequestNewConv}
        onToast={toast}
        onDelete={handleDelete}
        onUpdateGroup={activeGroupId ? updateGroupDescription : undefined}
        onLoadOlderMessages={handleLoadOlderMessages}
        onRetry={handleRetry}
        onArchiveConv={activeGroupId ? undefined : hideConversation}
        onDeleteConv={activeGroupId ? undefined : deleteConversation}
        onJumpToMessage={handleJumpToMessage}
        jumpToMessageId={jumpTarget}
        onJumpHandled={() => setJumpTarget(null)}
        onCall={activeGroupId
          ? () => initiateGroupCall(activeGroupId, 'audio')
          : (activeUser ? handleCall : undefined)}
        onVideoCall={activeGroupId
          ? () => initiateGroupCall(activeGroupId, 'video')
          : (activeUser ? handleVideoCall : undefined)}
        onMobileMenu={() => setMobileOpen(true)}
        canSend={canSend}
      />

      {/* Colonne droite : panneau d'info (conv directe et groupe) */}
      {infoPanelOpen && (
        <InfoPanel
          conv={currentConv}
          user={currentUser}
          members={activeGroupId ? activeGroupMembers : undefined}
          onClose={() => setInfoPanelOpen(false)}
          onToast={toast}
        />
      )}

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className={s.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/*
       * CallOverlay est intentionnellement absent ici.
       * Il est rendu par GlobalCallProvider au-dessus de toute l'application,
       * ce qui permet à l'overlay d'appel de persister lors des navigations.
       */}
    </div>
  );
}
