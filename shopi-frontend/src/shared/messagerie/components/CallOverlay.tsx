/**
 * src/shared/messagerie/components/CallOverlay.tsx
 *
 * Overlay d'appel (audio & vidéo) — style WhatsApp / Telegram.
 *
 * MODES :
 *   calling / ringing / ended → carte glass centrée (audio + vidéo)
 *   connected + audio          → carte glass + contrôles audio
 *   connected + vidéo          → plein écran vidéo + PiP local + contrôles
 *
 * LAYOUT VIDÉO connecté :
 *   ┌──────────────────────────────────┐
 *   │  [nom] [durée]           [×]     │ ← barre supérieure
 *   │                                  │
 *   │   FLUX VIDÉO DISTANT             │
 *   │        (plein écran)             │
 *   │                      ┌────────┐  │
 *   │                      │ LOCAL  │  │ ← PiP cliquable (flip)
 *   │                      └────────┘  │
 *   │  [Mic] [Caméra] [Flip] [Raccr.] │ ← barre inférieure
 *   └──────────────────────────────────┘
 */
import { useEffect, useRef } from 'react';
import type { CallStatus, CallInfo, ReconnectPhase } from '../hooks/useAudioCall';
import s from '../styles/CallOverlay.module.css';

interface Props {
  status:            CallStatus;
  callInfo:          CallInfo;
  duration:          number;
  isMuted:           boolean;
  isVideoOff:        boolean;
  isSpeakerOn:       boolean;
  localMediaStream:  MediaStream | null;
  remoteMediaStream: MediaStream | null;
  /** null hors coupure réseau — affiche un petit bandeau non-technique pendant l'appel connecté. */
  reconnectPhase?:   ReconnectPhase | null;
  isScreenSharing?:  boolean;
  /** false = un seul périphérique vidéo détecté (enumerateDevices) — ne pas afficher "Retourner". */
  canFlipCamera?:    boolean;
  /** false = navigateur sans support getDisplayMedia (mobile, essentiellement). */
  canShareScreen?:   boolean;
  /** Le flux distant contient une piste vidéo — vrai pour un appel vidéo normal
   *  OU un appel audio dont l'autre participant a démarré un partage d'écran. */
  hasRemoteVideo?:   boolean;
  onAccept:          () => void;
  onReject:          () => void;
  onHangUp:          () => void;
  onToggleMute:      () => void;
  onToggleVideo:     () => void;
  onToggleSpeaker:   () => void;
  onFlipCamera:      () => void;
  onToggleScreenShare?: () => void;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s2 = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s2).padStart(2,'0')}`;
}

const RECONNECT_LABEL: Record<ReconnectPhase, string> = {
  unstable:  'Connexion instable…',
  restoring: 'Reconnexion…',
  restored:  'Connexion rétablie',
  failed:    'Impossible de reconnecter',
};

export default function CallOverlay({
  status, callInfo, duration, isMuted, isVideoOff, isSpeakerOn,
  localMediaStream, remoteMediaStream, reconnectPhase,
  isScreenSharing = false, canFlipCamera = true, canShareScreen = false, hasRemoteVideo = false,
  onAccept, onReject, onHangUp, onToggleMute, onToggleVideo, onToggleSpeaker, onFlipCamera, onToggleScreenShare,
}: Props) {
  const isVideo    = callInfo.callType === 'video';
  const isImgAva   = callInfo.remoteAvatar?.startsWith('http');
  const isConnected = status === 'connected';
  /* Plein écran dès qu'il y a quelque chose à montrer côté distant — un
     appel vidéo normal OU un appel audio dont l'autre participant a
     démarré un partage d'écran (callInfo.callType reste 'audio' dans ce
     cas, d'où hasRemoteVideo plutôt que isVideo seul). */
  const showFullscreenVideo = (isVideo || hasRemoteVideo) && isConnected;

  /* Refs pour les éléments <video> */
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  /*
   * Attache les streams aux éléments <video>.
   * ⚠️ Dépend aussi de `status` : les <video> ne sont montés (donc les refs
   * non-null) qu'en mode plein écran (isVideo && isConnected). Le stream,
   * lui, existe déjà bien avant (dès 'calling'/'connecting'). Sans `status`
   * dans les deps, cet effet s'exécute une fois avec une ref encore null
   * et ne se redéclenche jamais une fois le <video> réellement monté —
   * la caméra tourne mais rien ne s'affiche jamais à l'écran.
   */
  useEffect(() => {
    if (localVideoRef.current && localMediaStream) {
      localVideoRef.current.srcObject = localMediaStream;
    }
  }, [localMediaStream, status]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteMediaStream) {
      remoteVideoRef.current.srcObject = remoteMediaStream;
    }
  }, [remoteMediaStream, status]);

  /* Vibration sur appel entrant (mobile) */
  useEffect(() => {
    if (status === 'ringing' && 'vibrate' in navigator) {
      const id = setInterval(() => navigator.vibrate([300, 200, 300]), 1500);
      return () => { clearInterval(id); navigator.vibrate(0); };
    }
  }, [status]);

  if (status === 'idle') return null;

  /* ── Avatar (utilisé hors mode vidéo connecté) ── */
  const avatar = (
    <div className={s.avatarWrap}>
      {(status === 'ringing' || status === 'calling') && (
        <><div className={s.ring} /><div className={s.ring} /><div className={s.ring} /></>
      )}
      <div
        className={s.avatar}
        style={{ background: isImgAva ? undefined : 'linear-gradient(135deg,#0E7490,#112648)' }}
      >
        {isImgAva
          ? <img src={callInfo.remoteAvatar} alt={callInfo.remoteName}
              style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
          : callInfo.remoteName.slice(0,2).toUpperCase()
        }
      </div>
    </div>
  );

  /* ── Bandeau de reconnexion (uniquement pendant un appel connecté) ── */
  const reconnectBanner = reconnectPhase && (
    <div className={s.reconnectBanner} data-phase={reconnectPhase}>
      <span className={s.statusDot} />{RECONNECT_LABEL[reconnectPhase]}
    </div>
  );

  /* ── Barre de contrôles partagée (audio + vidéo connecté) ── */
  const controls = (
    <div className={`${s.actions} ${isVideo ? s.actionsVideo : ''}`}>
      <button
        className={`${s.btn} ${isMuted ? s.btnMuteOn : s.btnMute}`}
        onClick={onToggleMute}
      >
        <div className={s.btnIcon}>
          <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`} />
        </div>
        <span className={s.btnLabel}>{isMuted ? 'Muet' : 'Micro'}</span>
      </button>

      {isVideo && (
        <>
          <button
            className={`${s.btn} ${isVideoOff ? s.btnVideoOff : s.btnVideo}`}
            onClick={onToggleVideo}
          >
            <div className={s.btnIcon}>
              <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`} />
            </div>
            <span className={s.btnLabel}>{isVideoOff ? 'Caméra off' : 'Caméra'}</span>
          </button>

          {canFlipCamera && (
            <button className={`${s.btn} ${s.btnFlip}`} onClick={onFlipCamera} title="Retourner caméra">
              <div className={s.btnIcon}><i className="fas fa-rotate" /></div>
              <span className={s.btnLabel}>Retourner</span>
            </button>
          )}
        </>
      )}

      {canShareScreen && onToggleScreenShare && (
        <button
          className={`${s.btn} ${isScreenSharing ? s.btnScreenShareOn : s.btnScreenShare}`}
          onClick={onToggleScreenShare}
          title={isScreenSharing ? "Arrêter le partage d'écran" : "Partager l'écran"}
        >
          <div className={s.btnIcon}>
            <i className={`fas ${isScreenSharing ? 'fa-stop' : 'fa-desktop'}`} />
          </div>
          <span className={s.btnLabel}>{isScreenSharing ? 'Arrêter' : 'Partager écran'}</span>
        </button>
      )}

      <button className={`${s.btn} ${s.btnHangup}`} onClick={onHangUp}>
        <div className={s.btnIcon}><i className="fas fa-phone-slash" /></div>
        <span className={s.btnLabel}>Raccrocher</span>
      </button>

      {!isVideo && (
        <button
          className={`${s.btn} ${isSpeakerOn ? s.btnSpeakerOn : s.btnSpeaker}`}
          onClick={onToggleSpeaker}
        >
          <div className={s.btnIcon}>
            <i className={`fas ${isSpeakerOn ? 'fa-volume-high' : 'fa-volume-low'}`} />
          </div>
          <span className={s.btnLabel}>Haut-parleur</span>
        </button>
      )}
    </div>
  );

  /* ════════════════════════════════════
     MODE VIDÉO CONNECTÉ → plein écran
     (appel vidéo normal OU appel audio avec partage d'écran distant)
  ════════════════════════════════════ */
  if (showFullscreenVideo) {
    return (
      <div className={s.videoOverlay}>
        {/* Flux distant (plein écran) */}
        <video
          ref={remoteVideoRef}
          className={s.remoteVideo}
          autoPlay playsInline
        />

        {reconnectPhase && (
          <div className={`${s.reconnectBanner} ${s.reconnectBannerVideo}`} data-phase={reconnectPhase}>
            <span className={s.statusDot} />{RECONNECT_LABEL[reconnectPhase]}
          </div>
        )}

        {/* Fond de secours si pas encore de flux */}
        {!remoteMediaStream && (
          <div className={s.videoPlaceholder}>
            <div className={s.avatar} style={{ width: 100, height: 100, fontSize: 36,
              background: isImgAva ? undefined : 'linear-gradient(135deg,#0E7490,#112648)' }}>
              {isImgAva
                ? <img src={callInfo.remoteAvatar} alt={callInfo.remoteName}
                    style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                : callInfo.remoteName.slice(0,2).toUpperCase()
              }
            </div>
            <p style={{ color:'rgba(255,255,255,.6)', fontSize:13, marginTop:12 }}>
              Connexion vidéo…
            </p>
          </div>
        )}

        {/* Barre supérieure : nom + durée + fermer */}
        <div className={s.videoTopBar}>
          <div>
            <div className={s.videoName}>{callInfo.remoteName}</div>
            <div className={s.videoDuration}>{fmt(duration)}</div>
          </div>
          <button className={s.videoClose} onClick={onHangUp} title="Raccrocher">
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Indicateur partage d'écran actif (mode plein écran) */}
        {isScreenSharing && (
          <div className={`${s.reconnectBanner} ${s.reconnectBannerVideo}`} style={{ background: 'rgba(14,116,144,.35)', color: '#67e8f9', top: reconnectPhase ? 130 : 90 }}>
            <i className="fas fa-desktop" style={{ fontSize: 11 }} /> Vous partagez votre écran
          </div>
        )}

        {/* Flux local (PiP) — caméra uniquement, cliquable pour flip caméra.
            Masqué pendant un partage d'écran (rien de pertinent à montrer :
            l'utilisateur voit déjà son propre écran) ou sur un appel audio
            (pas de caméra locale à prévisualiser). */}
        {isVideo && !isScreenSharing && (
          <div
            className={s.localVideoPip}
            onClick={canFlipCamera ? onFlipCamera : undefined}
            title={canFlipCamera ? 'Retourner caméra' : undefined}
            style={canFlipCamera ? undefined : { cursor: 'default' }}
          >
            {isVideoOff ? (
              <div className={s.localVideoOff}><i className="fas fa-video-slash" /></div>
            ) : (
              <video ref={localVideoRef} className={s.localVideoEl} autoPlay playsInline muted />
            )}
          </div>
        )}

        {/* Barre de contrôles inférieure */}
        <div className={s.videoControls}>
          {controls}
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════
     MODE CARTE GLASS (tous les autres états)
  ════════════════════════════════════ */
  return (
    <div className={s.overlay}>
      <div className={s.card}>
        {avatar}
        <div className={s.name}>{callInfo.remoteName}</div>

        {/* Sous-titre type d'appel */}
        <div className={s.callTypeBadge}>
          <i className={`fas ${isVideo ? 'fa-video' : 'fa-phone'}`} />
          {isVideo ? ' Appel vidéo' : ' Appel audio'}
        </div>

        {/* Appel sortant */}
        {status === 'calling' && (
          <>
            <div className={s.status}><span className={s.statusDot} />En attente…</div>
            <div className={s.actions}>
              <button className={`${s.btn} ${s.btnHangup}`} onClick={onHangUp}>
                <div className={s.btnIcon}><i className="fas fa-phone-slash" /></div>
                <span className={s.btnLabel}>Annuler</span>
              </button>
            </div>
          </>
        )}

        {/* Appel entrant */}
        {status === 'ringing' && (
          <>
            <div className={s.status}>Appel entrant</div>
            <div className={s.actionsIncoming}>
              <button className={`${s.btn} ${s.btnReject}`} onClick={onReject}>
                <div className={s.btnIcon}><i className="fas fa-phone-slash" /></div>
                <span className={s.btnLabel}>Refuser</span>
              </button>
              <button className={`${s.btn} ${s.btnAccept}`} onClick={onAccept}>
                <div className={s.btnIcon}>
                  <i className={`fas ${isVideo ? 'fa-video' : 'fa-phone'}`} />
                </div>
                <span className={s.btnLabel}>Accepter</span>
              </button>
            </div>
          </>
        )}

        {/* Décroché — négociation WebRTC (ICE) en cours */}
        {status === 'connecting' && (
          <>
            <div className={s.status}><span className={s.statusDot} />Connexion…</div>
            <div className={s.actions}>
              <button className={`${s.btn} ${s.btnHangup}`} onClick={onHangUp}>
                <div className={s.btnIcon}><i className="fas fa-phone-slash" /></div>
                <span className={s.btnLabel}>Annuler</span>
              </button>
            </div>
          </>
        )}

        {/* Appel connecté (audio uniquement ici — vidéo/partage distant = plein écran) */}
        {status === 'connected' && !showFullscreenVideo && (
          <>
            {reconnectBanner}
            {isScreenSharing && (
              <div className={s.status} style={{ color: '#67e8f9' }}>
                <i className="fas fa-desktop" style={{ fontSize: 11 }} /> Partage d'écran en cours
              </div>
            )}
            <div className={s.duration}>{fmt(duration)}</div>
            {controls}
          </>
        )}

        {/* Terminé */}
        {status === 'ended' && (
          <>
            <div className={s.endedBadge}>Appel terminé</div>
            <div className={s.status}>{fmt(duration)}</div>
          </>
        )}
      </div>
    </div>
  );
}
