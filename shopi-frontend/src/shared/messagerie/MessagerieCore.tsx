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
import { useEffect }      from 'react';
import { useMessagerie }  from './hooks/useMessagerie';
import { useGlobalCall }  from '../context/GlobalCallContext';
import { useToast }       from '../context/ToastContext';

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
    applyCallEventLocally,
    startNewConv,
    setInfoPanelOpen,
    setNewConvOpen,
    setMobileOpen,
  } = useMessagerie();

  // ── Appel global (socket + overlay persistants cross-routes) ─
  const {
    startCall,
    registerCallEventHandler,
  } = useGlobalCall();

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

  // ── Lancer un appel vers le contact actif ───────────────────
  const getRemoteUserId = () =>
    (activeConv && activeUser) ? (activeUser.userId ?? null) : null;

  const handleCall = () => {
    const remoteUserId = getRemoteUserId();
    if (!remoteUserId || !activeConv || !activeUser) return;
    startCall({
      conversationId: activeConv.id,
      remoteUserId,
      remoteName:   activeUser.name,
      remoteAvatar: activeUser.ava?.startsWith('http') ? activeUser.ava : undefined,
      callType:     'audio',
    });
  };

  const handleVideoCall = () => {
    const remoteUserId = getRemoteUserId();
    if (!remoteUserId || !activeConv || !activeUser) return;
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
        usersMap={usersMap}
        activeId={activeConvId}
        mobileOpen={mobileOpen}
        totalUnread={totalUnread}
        onSelect={selectConv}
      />

      {/* Colonne centrale : fenêtre de chat */}
      <ChatWindow
        conv={activeConv}
        user={activeUser}
        infoPanelOpen={infoPanelOpen}
        typingActivity={activeConvId ? typingMap.get(activeConvId) : undefined}
        onSend={sendMessage}
        onTyping={sendTyping}
        onToggleInfo={() => setInfoPanelOpen(p => !p)}
        onNewConv={() => setNewConvOpen(true)}
        onToast={toast}
        onCall={activeUser ? handleCall : undefined}
        onVideoCall={activeUser ? handleVideoCall : undefined}
      />

      {/* Colonne droite : panneau d'info (conditionnel) */}
      {infoPanelOpen && (
        <InfoPanel
          conv={activeConv}
          user={activeUser}
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
