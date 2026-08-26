/**
 * src/shared/messagerie/components/GroupCallOverlay.tsx
 *
 * Overlay plein écran pour les appels de groupe (mesh WebRTC).
 *
 * LAYOUT (adaptatif selon nombre de participants) :
 *   1 pair     → flux distant centré (style P2P)
 *   2–3 pairs  → grille 2 colonnes
 *   4+ pairs   → grille 3 colonnes, scroll vertical
 *
 * LOCAL : PiP fixé en bas-droite, toujours visible.
 */

import { memo, useEffect, useRef, useState } from 'react';
import type { GroupCallPeer, GroupCallState } from '../data/messagerieTypes';

interface Props {
  callState:     GroupCallState;
  peers:         Map<string, GroupCallPeer>;
  localStream:   MediaStream | null;
  isMuted:       boolean;
  isVideoOff:    boolean;
  isScreenSharing?: boolean;
  /** false = un seul périphérique vidéo détecté (enumerateDevices) — masque "Retourner". */
  canFlipCamera?:   boolean;
  /** false = navigateur sans support getDisplayMedia. */
  canShareScreen?:  boolean;
  onLeave:       () => void;
  onToggleMute:  () => void;
  onToggleVideo: () => void;
  onFlipCamera:  () => void;
  onToggleScreenShare?: () => void;
}

// ── Tuile vidéo d'un participant distant ──────────────────────

function PeerTile({ peer }: { peer: GroupCallPeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  /* Autoplay non-mute peut être bloqué par le navigateur (fréquent hors
     interaction utilisateur directe, ex. mobile) — sans ce contrôle, un
     pair restait silencieux/figé sans aucune explication (partie 8). */
  const [needsUnlock, setNeedsUnlock] = useState(false);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      videoRef.current.play()
        .then(() => setNeedsUnlock(false))
        .catch(() => setNeedsUnlock(true));
    }
  }, [peer.stream]);

  const enableTile = () => {
    videoRef.current?.play()
      .then(() => setNeedsUnlock(false))
      .catch(() => { /* toujours bloqué — le bouton reste affiché */ });
  };

  const initials = peer.displayName.slice(0, 2).toUpperCase();

  return (
    <div style={{
      position: 'relative',
      background: '#0d1f3c',
      borderRadius: 16,
      overflow: 'hidden',
      aspectRatio: '16/9',
      minHeight: 120,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {peer.stream && !peer.videoEnabled ? (
        /* Vidéo coupée → avatar */
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg,#0e7490,#112648)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#fff',
        }}>
          {initials}
        </div>
      ) : peer.stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {needsUnlock && (
            <button
              onClick={enableTile}
              aria-label={`Activer le son de ${peer.displayName}`}
              style={{
                position: 'absolute', inset: 0, margin: 'auto', width: 'fit-content', height: 'fit-content',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', background: '#0B1F3A', color: '#fff',
                border: '1px solid rgba(255,255,255,.15)', borderRadius: 999,
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                boxShadow: '0 4px 14px rgba(0,0,0,.35)',
              }}
            >
              <i className="fas fa-volume-xmark" aria-hidden="true" /> Activer le son
            </button>
          )}
        </>
      ) : (
        /* Pas encore de stream — connexion en cours */
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.4)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, margin: '0 auto 10px',
          }}>
            {initials}
          </div>
          <div style={{ fontSize: 12 }}>Connexion…</div>
        </div>
      )}

      {/* Bandeau reconnexion — coupure réseau avec CE participant uniquement,
          n'affecte jamais les autres tuiles du mesh. */}
      {peer.connectionState && (
        <div style={{
          position: 'absolute', top: 8, left: 10, right: 10,
          background: 'rgba(251,191,36,.18)', color: '#FBBF24',
          borderRadius: 99, padding: '3px 9px', fontSize: 10, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 5, width: 'fit-content',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#FBBF24',
          }} />
          {peer.connectionState === 'unstable' ? 'Connexion instable…' : 'Reconnexion…'}
        </div>
      )}

      {/* Badges micro / vidéo */}
      <div style={{
        position: 'absolute', bottom: 8, left: 10,
        display: 'flex', gap: 6,
      }}>
        {!peer.audioEnabled && (
          <span style={{
            background: 'rgba(239,68,68,.85)', borderRadius: 99,
            padding: '3px 7px', fontSize: 10, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <i className="fas fa-microphone-slash" style={{ fontSize: 9 }} /> Muet
          </span>
        )}
        {!peer.videoEnabled && (
          <span style={{
            background: 'rgba(0,0,0,.55)', borderRadius: 99,
            padding: '3px 7px', fontSize: 10, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <i className="fas fa-video-slash" style={{ fontSize: 9 }} />
          </span>
        )}
      </div>

      {/* Nom */}
      <div style={{
        position: 'absolute', bottom: 8, right: 10,
        background: 'rgba(0,0,0,.55)',
        borderRadius: 6, padding: '3px 8px',
        fontSize: 11, color: '#fff', fontWeight: 500,
        maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {peer.displayName}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────

function GroupCallOverlay({
  callState, peers, localStream,
  isMuted, isVideoOff, isScreenSharing = false, canFlipCamera = true, canShareScreen = false,
  onLeave, onToggleMute, onToggleVideo, onFlipCamera, onToggleScreenShare,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerList = [...peers.values()];
  const isVideo  = callState.callType === 'video';

  /* Attache le stream local */
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  /* Grille adaptative */
  const cols =
    peerList.length <= 1 ? 1 :
    peerList.length <= 3 ? 2 : 3;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      background: '#060f1e',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Barre supérieure ─────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(0,0,0,.35)',
        backdropFilter: 'blur(8px)',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
            Appel de groupe
          </div>
          <div style={{
            color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 2,
          }}>
            {callState.status === 'joining' ? 'Connexion…' : `${peerList.length + 1} participants`}
            {' · '}
            <i className={`fas ${isVideo ? 'fa-video' : 'fa-phone'}`}
               style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }} />
            {isScreenSharing && (
              <span style={{ color: '#67e8f9', marginLeft: 8 }}>
                <i className="fas fa-desktop" style={{ fontSize: 10 }} /> Partage d'écran actif
              </span>
            )}
          </div>
        </div>

        {/* Raccrocher (barre supérieure — accès rapide) */}
        <button
          type="button"
          onClick={onLeave}
          title="Raccrocher"
          aria-label="Raccrocher"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#ef4444', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <i className="fas fa-phone-slash" />
        </button>
      </div>

      {/* ── Zone vidéo ───────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: 12,
      }}>
        {peerList.length === 0 ? (
          /* Aucun pair — on attend */
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,.35)',
          }}>
            <i className={`fas ${isVideo ? 'fa-video' : 'fa-phone-volume'}`}
               style={{ fontSize: 40, marginBottom: 16 }} />
            <div style={{ fontSize: 15, fontWeight: 500 }}>En attente des participants…</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Les autres membres recevront une notification
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 10,
          }}>
            {peerList.map(peer => (
              <PeerTile key={peer.userId} peer={peer} />
            ))}
          </div>
        )}
      </div>

      {/* ── PiP local ────────────────────────────────────────── */}
      {/* Masqué pendant un partage d'écran — l'utilisateur voit déjà son
          propre écran, un mini aperçu caméra n'apporte rien (cohérent avec
          le comportement 1:1, voir CallOverlay.tsx). */}
      {isVideo && !isScreenSharing && (
        <div style={{
          position: 'fixed', bottom: 90, right: 16,
          width: 96, height: 128,
          borderRadius: 12, overflow: 'hidden',
          border: '2px solid rgba(255,255,255,.2)',
          background: '#0d1f3c',
          boxShadow: '0 4px 20px rgba(0,0,0,.6)',
          zIndex: 1501,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isVideoOff ? (
            <i className="fas fa-video-slash" style={{ color: 'rgba(255,255,255,.4)', fontSize: 20 }} />
          ) : (
            <video
              ref={localVideoRef}
              autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          <div style={{
            position: 'absolute', bottom: 4, left: 0, right: 0,
            textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.5)',
          }}>
            Vous
          </div>
        </div>
      )}

      {/* ── Barre de contrôles ───────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: '14px 24px calc(14px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(0,0,0,.45)',
        backdropFilter: 'blur(10px)',
        flexShrink: 0,
        /* partie 8 : jusqu'à 5 contrôles possibles (partage d'écran ajouté
           partie 7) — wrap plutôt que déborder sur un écran étroit. */
        flexWrap: 'wrap',
        rowGap: 10,
      }}>

        {/* Micro */}
        <CtrlBtn
          icon={isMuted ? 'fa-microphone-slash' : 'fa-microphone'}
          label={isMuted ? 'Muet' : 'Micro'}
          active={isMuted}
          activeColor="rgba(239,68,68,.25)"
          activeBorder="rgba(239,68,68,.5)"
          onClick={onToggleMute}
        />

        {/* Caméra */}
        {isVideo && (
          <CtrlBtn
            icon={isVideoOff ? 'fa-video-slash' : 'fa-video'}
            label={isVideoOff ? 'Caméra off' : 'Caméra'}
            active={isVideoOff}
            activeColor="rgba(239,68,68,.25)"
            activeBorder="rgba(239,68,68,.5)"
            onClick={onToggleVideo}
          />
        )}

        {/* Basculer caméra avant/arrière (mobile) — masqué si un seul
            périphérique vidéo détecté (enumerateDevices, partie 7). */}
        {isVideo && !isVideoOff && canFlipCamera && (
          <CtrlBtn
            icon="fa-rotate"
            label="Retourner"
            active={false}
            activeColor="rgba(255,255,255,.1)"
            activeBorder="rgba(255,255,255,.15)"
            onClick={onFlipCamera}
          />
        )}

        {/* Partage d'écran — remplace la piste vidéo sur TOUS les pairs du mesh. */}
        {canShareScreen && onToggleScreenShare && (
          <CtrlBtn
            icon={isScreenSharing ? 'fa-stop' : 'fa-desktop'}
            label={isScreenSharing ? 'Arrêter' : 'Partager'}
            active={isScreenSharing}
            activeColor="rgba(14,116,144,.35)"
            activeBorder="rgba(103,232,249,.5)"
            onClick={onToggleScreenShare}
          />
        )}

        {/* Raccrocher */}
        <button
          type="button"
          onClick={onLeave}
          aria-label="Quitter l'appel de groupe"
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#ef4444', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            color: '#fff',
            boxShadow: '0 4px 20px rgba(239,68,68,.4)',
          }}
        >
          <i className="fas fa-phone-slash" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* React.memo : mêmes bénéfices que CallOverlay (voir son commentaire) —
 * évite un re-rendu de l'overlay complet (grille de pairs, PiP local)
 * quand GroupCallProvider re-rend pour une raison sans rapport avec
 * l'appel en cours. */
export default memo(GroupCallOverlay);

// ── Bouton de contrôle réutilisable ───────────────────────────

interface CtrlBtnProps {
  icon:         string;
  label:        string;
  active:       boolean;
  activeColor:  string;
  activeBorder: string;
  onClick:      () => void;
}

function CtrlBtn({ icon, label, active, activeColor, activeBorder, onClick }: CtrlBtnProps) {
  /* Styles 100% inline dans ce fichier (pas de CSS module) — :focus-visible
     n'est pas exprimable en style inline, d'où cet état local pour piloter
     l'anneau de focus clavier (partie 8). */
  const [isFocused, setIsFocused] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      aria-pressed={active}
      aria-label={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        background: active ? activeColor : 'rgba(255,255,255,.1)',
        border: `1.5px solid ${active ? activeBorder : 'rgba(255,255,255,.15)'}`,
        borderRadius: 16, padding: '12px 18px',
        cursor: 'pointer', color: active ? '#f87171' : '#fff',
        minWidth: 64,
        transition: 'background .2s, border-color .2s',
        outline: isFocused ? '2px solid #34d399' : 'none',
        outlineOffset: 2,
      }}
    >
      <i className={`fas ${icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </button>
  );
}
