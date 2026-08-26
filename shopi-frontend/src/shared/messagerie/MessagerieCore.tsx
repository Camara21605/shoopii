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
import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function MessagerieCore() {
  const { t } = useTranslation();
  const { pop } = useToast();
  /* useCallback : référence stable, propagée jusqu'à MessageBubble (via
   * ChatWindow → MessagesZone) — sans ça, MessageBubble.memo est inutile
   * puisque `onToast` change de référence à chaque rendu de ce composant. */
  const toast = useCallback((msg: string, type?: string) => pop(msg, type as any), [pop]);

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

  // ── Données actives (conv ou groupe) ─────────────────────────
  const currentConv = activeGroupId ? activeGroup : activeConv;
  const currentUser = activeGroupId ? activeGroupUser : activeUser;

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
  const { data: callHistory, loading: callHistoryLoading, load: loadCallHistory } = useCallHistory();

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

  // ── Envoyer un message (conv ou groupe) ──────────────────────
  const handleSend = useCallback((convId: string, text: string, media?: any) => {
    if (activeGroupId) {
      if (media) {
        const grpContentType =
          media.type === 'image' ? 'image' :
          media.type === 'video' ? 'video' :
          media.type === 'audio' ? 'audio' : 'file';
        sendGroupMessage(activeGroupId, {
          contentType:   grpContentType,
          content:       text || null as any,
          mediaUrl:      media.url,
          mediaName:     media.name,
          mediaSize:     media.size,
          mediaMimeType: media.mime,
          mediaDuration: media.duration,
        });
      } else {
        sendGroupMessage(activeGroupId, { contentType: 'text', content: text });
      }
    } else {
      sendMessage(convId, text, media);
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
        archivedConvs={archivedConvs}
        onLoadArchived={loadArchivedConvs}
        onUnhideConv={unhideConversation}
        onMarkUnread={markConvAsUnread}
        onMarkRead={markConvAsRead}
        groupConvs={groups}
        groupUsersMap={groupUsersMap}
        callHistory={callHistory}
        callHistoryLoading={callHistoryLoading}
        onLoadCallHistory={loadCallHistory}
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
        onCall={activeGroupId
          ? () => initiateGroupCall(activeGroupId, 'audio')
          : (activeUser ? handleCall : undefined)}
        onVideoCall={activeGroupId
          ? () => initiateGroupCall(activeGroupId, 'video')
          : (activeUser ? handleVideoCall : undefined)}
        onMobileMenu={() => setMobileOpen(true)}
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
