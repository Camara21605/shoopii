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
import { useCallback, useEffect, useMemo } from 'react';
import { useMessagerie }     from './hooks/useMessagerie';
import { useDeliveryGroups } from './hooks/useDeliveryGroups';
import { useGlobalCall }     from '../context/GlobalCallContext';
import { useGroupCallCtx }  from '../context/GroupCallContext';
import { useToast }          from '../context/ToastContext';

import ConvList     from './components/ConvList';
import ChatWindow   from './sections/ChatWindow';
import InfoPanel    from './sections/InfoPanel';
import NewConvModal from './components/NewConvModal';

import s from './styles/MessagerieLayout.module.css';

// ─────────────────────────────────────────────────────────────

export default function MessagerieCore() {
  const { pop } = useToast();
  const toast = (msg: string, type?: string) => pop(msg, type as any);

  // ── Messagerie ───────────────────────────────────────────────
  const {
    conversations,
    usersMap,
    activeConv,
    activeUser,
    activeConvId,
    totalUnread,
    infoPanelOpen,
    newConvOpen,
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
    setNewConvOpen,
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
    if (activeGroupId || !activeConv || !activeUser) return;
    const remoteUserId = activeUser.userId ?? null;
    if (!remoteUserId) return;
    startCall({
      conversationId: activeConv.id,
      remoteUserId,
      remoteName:   activeUser.name,
      remoteAvatar: activeUser.ava?.startsWith('http') ? activeUser.ava : undefined,
      callType:     'audio',
    });
  };

  const handleVideoCall = () => {
    if (activeGroupId || !activeConv || !activeUser) return;
    const remoteUserId = activeUser.userId ?? null;
    if (!remoteUserId) return;
    startCall({
      conversationId: activeConv.id,
      remoteUserId,
      remoteName:   activeUser.name,
      remoteAvatar: activeUser.ava?.startsWith('http') ? activeUser.ava : undefined,
      callType:     'video',
    });
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
          Déconnecté du serveur temps réel — messages et appels non disponibles
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
        onNewConv={() => setNewConvOpen(true)}
        onDeleteConv={deleteConversation}
        onHideConv={hideConversation}
        archivedConvs={archivedConvs}
        onLoadArchived={loadArchivedConvs}
        onUnhideConv={unhideConversation}
        onMarkUnread={markConvAsUnread}
        onMarkRead={markConvAsRead}
        groupConvs={groups}
        groupUsersMap={groupUsersMap}
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
        onNewConv={() => setNewConvOpen(true)}
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

      {/* Modale nouvelle conversation */}
      <NewConvModal
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onStart={startNewConv}
      />

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
