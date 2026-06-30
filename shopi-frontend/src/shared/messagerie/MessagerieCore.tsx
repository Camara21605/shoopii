/*
 * FICHIER : src/shared/messagerie/MessagerieCore.tsx
 *
 * Composant principal de la messagerie partagée.
 * Intègre la liste des conversations, la fenêtre de chat,
 * le panneau d'info, la modale nouvelle conversation et
 * l'overlay d'appel audio WebRTC.
 */
import { useMessagerie }   from './hooks/useMessagerie';
import { useAudioCall }    from './hooks/useAudioCall';
import { useToast }        from '../context/ToastContext';

import ConvList     from './components/ConvList';
import ChatWindow   from './sections/ChatWindow';
import InfoPanel    from './sections/InfoPanel';
import NewConvModal from './components/NewConvModal';
import CallOverlay  from './components/CallOverlay';

import s from './styles/MessagerieLayout.module.css';

// ─────────────────────────────────────────────────────────────

export default function MessagerieCore() {
  const { pop } = useToast();
  /* Adaptateur de type : ToastType → string pour les sous-composants */
  const toast = (msg: string, type?: string) => pop(msg, type as any);

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
    sendCallEvent,
    startNewConv,
    setInfoPanelOpen,
    setNewConvOpen,
    setMobileOpen,
  } = useMessagerie();

  const {
    callStatus,
    callInfo,
    duration,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    localMediaStream,
    remoteMediaStream,
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    flipCamera,
  } = useAudioCall({
    onCallEvent: (event) => {
      sendCallEvent(
        event.conversationId,
        event.status,
        event.direction,
        event.duration,
        event.callType,
      );
    },
  });

  /**
   * Démarre un appel audio vers l'utilisateur actif.
   * Résout le userId depuis le token JWT du profil actif.
   */
  /**
   * Résout le userId (JWT) du destinataire pour le signaling WebRTC.
   * ⚠️ NE PAS utiliser activeUser.id : c'est l'ID du profil (entreprise/
   * livreur/...), pas l'ID User. Les rooms Socket.IO sont `user:{userId}`
   * (rempli depuis le JWT côté backend) — seul activeUser.userId matche.
   */
  const getRemoteUserId = () => {
    if (!activeConv || !activeUser) return null;
    return activeUser.userId ?? null;
  };

  const handleCall = () => {
    const remoteUserId = getRemoteUserId();
    if (!remoteUserId || !activeConv || !activeUser) return;
    startCall({
      conversationId: activeConv.id,
      remoteUserId,
      remoteName:    activeUser.name,
      remoteAvatar:  activeUser.ava?.startsWith('http') ? activeUser.ava : undefined,
      callType:      'audio',
    });
  };

  const handleVideoCall = () => {
    const remoteUserId = getRemoteUserId();
    if (!remoteUserId || !activeConv || !activeUser) return;
    startCall({
      conversationId: activeConv.id,
      remoteUserId,
      remoteName:    activeUser.name,
      remoteAvatar:  activeUser.ava?.startsWith('http') ? activeUser.ava : undefined,
      callType:      'video',
    });
  };

  return (
    <div className={s.layout}>

      {/* ── Badge statut Socket.IO (debug — visible uniquement si déconnecté) ── */}
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

      {/* ── Colonne gauche : liste des conversations ── */}
      <ConvList
        conversations={conversations}
        usersMap={usersMap}
        activeId={activeConvId}
        mobileOpen={mobileOpen}
        totalUnread={totalUnread}
        onSelect={selectConv}
      />

      {/* ── Colonne centrale : fenêtre de chat ── */}
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

      {/* ── Colonne droite : panneau d'info (conditionnel) ── */}
      {infoPanelOpen && (
        <InfoPanel
          conv={activeConv}
          user={activeUser}
          onClose={() => setInfoPanelOpen(false)}
          onToast={toast}
        />
      )}

      {/* ── Modale nouvelle conversation ── */}
      <NewConvModal
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onStart={startNewConv}
      />

      {/* ── Overlay mobile ── */}
      {mobileOpen && (
        <div className={s.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Overlay appel audio ── */}
      {callInfo && callStatus !== 'idle' && (
        <CallOverlay
          status={callStatus}
          callInfo={callInfo}
          duration={duration}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSpeakerOn={isSpeakerOn}
          localMediaStream={localMediaStream}
          remoteMediaStream={remoteMediaStream}
          onAccept={acceptCall}
          onReject={rejectCall}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleSpeaker={toggleSpeaker}
          onFlipCamera={flipCamera}
        />
      )}
    </div>
  );
}
