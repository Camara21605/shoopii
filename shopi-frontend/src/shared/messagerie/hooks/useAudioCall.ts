/**
 * src/shared/messagerie/hooks/useAudioCall.ts
 *
 * Hook WebRTC pour les appels audio 1:1.
 * Gère la machine à états complète : idle → calling/ringing → connected → ended.
 *
 * SIGNALING (via Socket.IO /messaging) :
 *   Caller  → call:initiate → Callee reçoit call:incoming
 *   Callee  → call:accept   → Caller reçoit call:accepted
 *   Caller  crée l'offer SDP → call:offer → Callee
 *   Callee  crée l'answer   → call:answer → Caller
 *   ICE candidates échangés des deux côtés
 *   Raccrocher → call:end → l'autre reçoit call:ended
 *
 * STUN : serveurs Google publics (fallback)
 * TURN : identifiants dynamiques Metered.ca récupérés via GET /calls/ice-servers
 *        (voir shared/messagerie/hooks/iceServers.ts) — obligatoire en
 *        production pour les NAT mobiles stricts/CGNAT.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveSocket } from './useSocket';
import type { WsCallIncoming, WsCallSignal } from './useSocket';
import { getIceServers, getFreshIceServers, prefetchIceServers, watchIceConnectivity } from './iceServers';
import { apiFetch } from '../../services/apiFetch';

// ── Types ─────────────────────────────────────────────────────

export type CallStatus =
  | 'idle'        // aucun appel
  | 'calling'     // appel sortant en attente de réponse
  | 'ringing'     // appel entrant non décroché
  | 'connecting'  // décroché, négociation WebRTC (ICE) en cours
  | 'connected'   // appel en cours
  | 'ended';      // appel terminé (transition rapide → idle)

export interface CallInfo {
  conversationId: string;
  remoteUserId:   string;
  remoteName:     string;
  remoteAvatar?:  string;
  direction:      'outgoing' | 'incoming';
  callType:       'audio' | 'video';
}

// ── Types ─────────────────────────────────────────────────────

export type CallEndStatus =
  | 'completed'  // appel terminé normalement
  | 'missed'     // pas de réponse (timeout)
  | 'rejected'   // appelé a refusé
  | 'cancelled'  // appelant a annulé avant réponse
  | 'busy';      // appelé était occupé

export type ReconnectPhase =
  | 'unstable'   // connexion coupée, on attend de voir si ça se rétablit seul
  | 'restoring'  // tentative active de reprise ICE en cours
  | 'restored'   // reprise réussie (message bref avant de redisparaître)
  | 'failed';    // reprise abandonnée — l'appel va se terminer

export interface CallEventPayload {
  conversationId: string;
  status:         CallEndStatus;
  direction:      'outgoing' | 'incoming';
  duration?:      number;
  callType:       'audio' | 'video';
}

// ── Props ─────────────────────────────────────────────────────

interface UseAudioCallProps {
  /**
   * Appelé quand un appel se termine (par l'appelant uniquement).
   * Permet à MessagerieCore d'enregistrer l'événement dans la conversation.
   */
  onCallEvent?: (event: CallEventPayload) => void;
}

/* Bornes de la stratégie de reprise réseau — voir attemptIceRestart/
   handleConnectionDisruption plus bas. Constantes de module (pas de re-
   création à chaque rendu, contrairement à un tableau littéral déclaré
   dans le corps du hook). */
const ICE_RESTART_MAX_ATTEMPTS   = 2;
const ICE_RESTART_BACKOFF_MS     = [1200, 2500]; // délai avant chaque tentative (indexé par nb de tentatives déjà faites)
const RECONNECT_TOTAL_TIMEOUT_MS = 20_000;       // durée maximale totale d'une tentative de reprise

// ── Hook ─────────────────────────────────────────────────────

export function useAudioCall(props?: UseAudioCallProps) {
  const onCallEventRef = useRef(props?.onCallEvent);
  useEffect(() => { onCallEventRef.current = props?.onCallEvent; });

  /* Préchauffe le cache des serveurs ICE dès le montage — évite d'attendre
     l'aller-retour réseau au moment précis où l'appel démarre. */
  useEffect(() => { prefetchIceServers(); }, []);

  const [status,            setStatus]            = useState<CallStatus>('idle');
  const [callInfo,          setCallInfo]          = useState<CallInfo | null>(null);
  const [isMuted,           setIsMuted]           = useState(false);
  const [isVideoOff,        setIsVideoOff]        = useState(false);
  const [isSpeakerOn,       setIsSpeakerOn]       = useState(true);
  const [duration,          setDuration]          = useState(0);
  /** Streams exposés à CallOverlay pour les éléments <video> */
  const [localMediaStream,  setLocalMediaStream]  = useState<MediaStream | null>(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState<MediaStream | null>(null);

  /* Refs internes */
  const callInfoRef    = useRef<CallInfo | null>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStream    = useRef<MediaStream | null>(null);
  const remoteAudio    = useRef<HTMLAudioElement | null>(null);
  const icePendingQ    = useRef<RTCIceCandidateInit[]>([]);
  const durationRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const wasConnected   = useRef(false);
  const connectedSince = useRef(0);
  const facingMode     = useRef<'user' | 'environment'>('user'); // flip caméra mobile
  const isSpeakerOnRef = useRef(true); // miroir de isSpeakerOn, lu dans pc.ontrack (closure stable)
  /** Nombre de tentatives d'ICE-restart déjà faites pour la connexion en cours. */
  const iceRestartAttempts = useRef(0);
  /** Phase de reprise réseau affichée à l'utilisateur (null = rien à signaler). */
  const [reconnectPhase, setReconnectPhase] = useState<ReconnectPhase | null>(null);
  const reconnectPhaseRef      = useRef<ReconnectPhase | null>(null);
  const reconnectBackoffTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDeadlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Miroir de `status`, lu dans onCallIncoming (closure stable — voir plus bas).
     SANS cette ref, onCallIncoming devait dépendre de [status] pour rester à
     jour, ce qui obligeait le useEffect d'enregistrement des listeners socket
     (tout en bas du fichier) à se désinscrire/ré-inscrire sur LES 8 événements
     d'appel à CHAQUE changement de statut (idle→ringing→connecting→connected→
     ended→idle) — plusieurs fois par appel — au lieu d'une seule fois au montage. */
  const statusRef      = useRef<CallStatus>('idle');
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Utilitaires internes ──────────────────────────────────────

  /**
   * Applique l'état haut-parleur à l'élément <audio> distant.
   * Le volume change toujours (effet garanti sur tous navigateurs).
   * setSinkId() (changement de périphérique de sortie) n'est tenté
   * qu'en best-effort : non supporté sur Firefox/Safari, et inutile
   * s'il n'y a qu'un seul périphérique audiooutput disponible.
   */
  async function applySpeaker(audioEl: HTMLAudioElement, on: boolean): Promise<void> {
    audioEl.volume = on ? 1 : 0.4;

    const setSinkId = (audioEl as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId;
    if (typeof setSinkId !== 'function') return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      console.debug('[Call] audiooutput devices disponibles :', outputs.map(d => ({ id: d.deviceId, label: d.label })));
      if (outputs.length < 2) return;

      /* Chrome/Android bascule l'audio en mode "communication" (écouteur,
         volume physiquement plus faible que le haut-parleur principal) dès
         qu'un flux micro WebRTC est actif — d'où la nécessité de forcer
         explicitement la sortie "haut-parleur" via setSinkId, le volume
         seul (ci-dessus) ne suffisant pas à compenser la différence
         matérielle entre les deux transducteurs. Les libellés exacts
         varient selon les fabricants (ex: "Haut-parleur du téléphone",
         "Speakerphone", "Loudspeaker"…) — on élargit la détection et on
         exclut explicitement l'écouteur plutôt que de deviner un index. */
      const SPEAKER_RE  = /speaker|haut.?parleur|loud/i;
      const EARPIECE_RE = /earpiece|receiver|écouteur|ecouteur|handset/i;

      const target = on
        ? outputs.find(d => SPEAKER_RE.test(d.label))
          ?? outputs.find(d => !EARPIECE_RE.test(d.label))
          ?? outputs[0]
        : outputs.find(d => EARPIECE_RE.test(d.label) || /default/i.test(d.label))
          ?? outputs[outputs.length - 1];

      if (target) {
        console.debug(`[Call] setSinkId → "${target.label || target.deviceId}" (speaker=${on})`);
        await setSinkId.call(audioEl, target.deviceId);
      }
    } catch (e) {
      /* setSinkId refusé/non supporté — le volume ci-dessus reste le fallback. */
      console.debug('[Call] setSinkId a échoué, fallback volume seul :', (e as Error)?.message);
    }
  }

  function emit(event: string, data: object) {
    const socket = getActiveSocket();
    if (!socket || !socket.connected) {
      /* Diagnostic — un socket absent/pas-encore-connecté échouait
         silencieusement jusqu'ici : rien côté appelé, rien côté serveur,
         aucune erreur visible nulle part. On garde le comportement existant
         (socket.io bufferise l'emit tant que non connecté) mais on le
         signale désormais dans la console. */
      console.warn(`[Call] emit('${event}') sur un socket ${socket ? 'non connecté (mis en file par socket.io)' : 'absent'}.`, data);
    }
    socket?.emit(event, data);
  }

  function startDurationTimer() {
    wasConnected.current   = true;
    connectedSince.current = Date.now();
    durationRef.current    = setInterval(() => setDuration(d => d + 1), 1000);
  }

  function clearTimers() {
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
  }

  /** Annule toute tentative de reprise réseau en cours (backoff + délai maximal). */
  function clearReconnectTimers() {
    if (reconnectBackoffTimer.current)  { clearTimeout(reconnectBackoffTimer.current);  reconnectBackoffTimer.current  = null; }
    if (reconnectDeadlineTimer.current) { clearTimeout(reconnectDeadlineTimer.current); reconnectDeadlineTimer.current = null; }
    reconnectPhaseRef.current = null;
  }

  /** Nettoie TOUT : streams, PeerConnection, timers, audio element. */
  const cleanup = useCallback(() => {
    clearTimers();
    clearReconnectTimers();
    setReconnectPhase(null);
    iceRestartAttempts.current = 0;
    pcRef.current?.close();
    pcRef.current = null;
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    icePendingQ.current = [];
    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
      remoteAudio.current.pause();
      if (document.body.contains(remoteAudio.current))
        document.body.removeChild(remoteAudio.current);
      remoteAudio.current = null;
    }
    setLocalMediaStream(null);
    setRemoteMediaStream(null);
    setIsVideoOff(false);
    facingMode.current = 'user';
    callInfoRef.current = null;
  }, []);

  /**
   * Termine l'appel.
   * @param notify  Si true, notifie l'autre participant via socket.
   * @param status  Raison de la fin (pour l'historique des appels).
   */
  const endCall = useCallback((
    notify: boolean,
    status: CallEndStatus = 'completed',
  ) => {
    const info = callInfoRef.current;

    if (notify && info) {
      emit('call:end', {
        conversationId: info.conversationId,
        targetUserId:   info.remoteUserId,
      });
    }

    /* Calcule la durée réelle si l'appel était connecté */
    const realDuration = wasConnected.current
      ? Math.floor((Date.now() - connectedSince.current) / 1000)
      : 0;

    /* Seul l'APPELANT enregistre l'événement dans la conversation.
       Cela évite les doublons — le destinataire le verra via Socket.IO. */
    if (info && info.direction === 'outgoing') {
      const finalStatus: CallEndStatus = wasConnected.current ? 'completed' : status;
      onCallEventRef.current?.({
        conversationId: info.conversationId,
        status:         finalStatus,
        direction:      'outgoing',
        duration:       wasConnected.current ? realDuration : undefined,
        callType:       info.callType,
      });
    }

    /* Réinitialise les refs de tracking */
    wasConnected.current   = false;
    connectedSince.current = 0;

    cleanup();
    setCallInfo(null);
    setDuration(0);
    setIsMuted(false);
    setStatus('ended');
    setTimeout(() => setStatus('idle'), 1500);
  }, [cleanup]);

  /**
   * Attache les pistes locales à la PeerConnection en réutilisant un
   * sender existant (replaceTrack) au lieu d'en ajouter un nouveau —
   * nécessaire pour l'ICE-restart : addTrack dupliquerait la piste déjà
   * envoyée et casserait la négociation.
   */
  const attachLocalTracks = useCallback(async (pc: RTCPeerConnection, stream: MediaStream) => {
    for (const track of stream.getTracks()) {
      const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
      if (sender) {
        try { await sender.replaceTrack(track); } catch { /* best-effort */ }
      } else {
        try { pc.addTrack(track, stream); } catch { /* ignore doublon éventuel */ }
      }
    }
  }, []);

  /**
   * Tente de lancer la lecture du flux distant — si bloquée par la
   * politique autoplay du navigateur (fréquent sur mobile hors interaction
   * utilisateur directe), affiche un petit bouton de secours plutôt que de
   * laisser l'appel silencieux sans aucune explication.
   */
  const playRemoteAudioWithFallback = useCallback(async (audioEl: HTMLAudioElement) => {
    try {
      await audioEl.play();
    } catch {
      console.warn('[Call] Lecture audio distante bloquée par le navigateur (autoplay) — bouton de secours affiché.');
      const id = 'shopi-call-enable-audio-btn';
      if (document.getElementById(id)) return;
      const btn = document.createElement('button');
      btn.id = id;
      btn.textContent = 'Activer le son';
      Object.assign(btn.style, {
        position: 'fixed', right: '16px', bottom: '16px', zIndex: '10050',
        padding: '10px 16px', background: '#0B1F3A', color: '#fff',
        border: 'none', borderRadius: '8px', cursor: 'pointer',
        fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,.25)',
      });
      btn.onclick = async () => {
        try { await audioEl.play(); } catch { /* toujours bloqué — laisse le bouton visible */ }
        btn.remove();
      };
      document.body.appendChild(btn);
    }
  }, []);

  /**
   * Abandonne la reprise réseau et termine proprement l'appel — dernier
   * recours quand les tentatives d'ICE-restart sont épuisées OU que le
   * délai maximal de reprise (RECONNECT_TOTAL_TIMEOUT_MS) est dépassé.
   * `notify: true` : même si la connexion média locale est morte, le canal
   * de signalisation Socket.IO est probablement toujours vivant — autant
   * prévenir l'autre participant tout de suite plutôt que de le laisser
   * découvrir la coupure via son propre timeout.
   */
  const giveUpReconnecting = useCallback(() => {
    clearReconnectTimers();
    setReconnectPhase('failed');
    setTimeout(() => {
      setReconnectPhase(null);
      endCall(true, wasConnected.current ? 'completed' : 'missed');
    }, 1500);
  }, [endCall]);

  /**
   * Tente de relancer la négociation ICE avant d'abandonner l'appel.
   * 'failed'/'disconnected' peuvent survenir sur une coupure réseau
   * transitoire (perte Wi-Fi de quelques secondes, bascule Wi-Fi↔4G) —
   * raccrocher immédiatement dans ce cas coupait des appels qui auraient
   * pu se rétablir tout seuls.
   *
   * Idempotent (reconnectBackoffTimer sert de verrou) : peut être appelée
   * plusieurs fois de suite (ex. 'disconnected' puis 'failed' juste après)
   * sans programmer deux tentatives en parallèle. Un backoff précède
   * chaque tentative — le temps d'attente sert aussi de fenêtre pour
   * laisser une reprise spontanée se produire (si le state repasse à
   * 'connected' avant l'échéance, le callback se retire sans rien faire).
   * Limité à ICE_RESTART_MAX_ATTEMPTS pour ne pas boucler indéfiniment sur
   * un échec définitif (aucun chemin réseau trouvé, STUN/TURN injoignables).
   */
  const attemptIceRestart = useCallback((pc: RTCPeerConnection) => {
    if (reconnectBackoffTimer.current) return; // une tentative est déjà programmée

    if (iceRestartAttempts.current >= ICE_RESTART_MAX_ATTEMPTS || !localStream.current || !callInfoRef.current) {
      giveUpReconnecting();
      return;
    }

    const backoffMs = ICE_RESTART_BACKOFF_MS[Math.min(iceRestartAttempts.current, ICE_RESTART_BACKOFF_MS.length - 1)];
    reconnectBackoffTimer.current = setTimeout(async () => {
      reconnectBackoffTimer.current = null;

      /* Reprise spontanée pendant le backoff, ou appel déjà terminé/remplacé
         entre-temps → rien à faire. */
      if (pcRef.current !== pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') return;

      reconnectPhaseRef.current = 'restoring';
      setReconnectPhase('restoring');
      iceRestartAttempts.current += 1;
      console.warn(`[Call] connexion ICE échouée — tentative de reprise ${iceRestartAttempts.current}/${ICE_RESTART_MAX_ATTEMPTS}`);

      try {
        /* Rafraîchit les serveurs ICE (ignore le cache 30 min) AVANT de
           relancer la négociation — une RTCPeerConnection garde pour
           toujours les serveurs fournis à sa construction ; sans ce
           setConfiguration(), un appel qui dure plus longtemps que le
           cache pourrait retenter la reprise avec des identifiants TURN
           déjà expirés (partie 6). setConfiguration() peut échouer sur de
           très vieux navigateurs — la reprise se poursuit alors avec les
           serveurs déjà en place plutôt que d'échouer entièrement. */
        try {
          const freshIceServers = await getFreshIceServers();
          pc.setConfiguration({ iceServers: freshIceServers });
        } catch (e) {
          console.warn('[Call] Rafraîchissement des serveurs ICE échoué avant reprise — on continue avec les serveurs déjà en place :', e);
        }

        await attachLocalTracks(pc, localStream.current!);
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        emit('call:offer', {
          conversationId: callInfoRef.current!.conversationId,
          targetUserId:   callInfoRef.current!.remoteUserId,
          sdp:            offer,
        });
        /* On attend la nouvelle négociation — un nouvel échec relancera
           attemptIceRestart (via 'failed'), le délai maximal global tranchera
           sinon. */
      } catch (e) {
        console.error('[Call] Échec de la tentative de reprise ICE :', e);
        giveUpReconnecting();
      }
    }, backoffMs);
  }, [giveUpReconnecting, attachLocalTracks]);

  /**
   * Point d'entrée commun à 'disconnected' et 'failed' — arme (une seule
   * fois) le délai maximal global de reprise, puis délègue à
   * attemptIceRestart. Ne s'active que si l'appel avait déjà été connecté
   * au moins une fois : avant ça, 'disconnected'/'failed' pendant la
   * négociation initiale sont couverts par les timeouts 20s existants
   * d'acceptCall/onCallAccepted, pas par cette logique de RE-connexion.
   */
  const handleConnectionDisruption = useCallback((pc: RTCPeerConnection) => {
    if (!wasConnected.current) return;

    if (reconnectPhaseRef.current === null) {
      reconnectPhaseRef.current = 'unstable';
      setReconnectPhase('unstable');
      reconnectDeadlineTimer.current = setTimeout(giveUpReconnecting, RECONNECT_TOTAL_TIMEOUT_MS);
    }
    attemptIceRestart(pc);
  }, [attemptIceRestart, giveUpReconnecting]);

  // ── Création du RTCPeerConnection ─────────────────────────────

  const createPeerConnection = useCallback((iceServers: RTCIceServer[]): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers });

    /* Envoie les candidats ICE au fur et à mesure */
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate || !callInfoRef.current) return;
      emit('call:ice-candidate', {
        conversationId: callInfoRef.current.conversationId,
        targetUserId:   callInfoRef.current.remoteUserId,
        candidate:      candidate.toJSON(),
      });
    };

    /* Reçoit le flux distant (audio seul ou audio+vidéo) */
    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      setRemoteMediaStream(stream);

      /* Pour les appels audio, on utilise un élément <audio> caché.
         Pour la vidéo, l'overlay règle srcObject sur l'élément <video>. */
      if (callInfoRef.current?.callType !== 'video') {
        if (!remoteAudio.current) {
          remoteAudio.current = document.createElement('audio');
          remoteAudio.current.autoplay = true;
          document.body.appendChild(remoteAudio.current);
        }
        remoteAudio.current.srcObject = stream;
        void applySpeaker(remoteAudio.current, isSpeakerOnRef.current);
        void playRemoteAudioWithFallback(remoteAudio.current);
      }
    };

    /* Surveille l'état de la connexion */
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;

      if (state === 'connected') {
        clearTimers();
        const isFirstConnection = !wasConnected.current;
        setStatus('connected');
        if (isFirstConnection) {
          startDurationTimer();
        } else {
          /* Reprise après coupure — NE PAS réinitialiser connectedSince
             (sinon la durée affichée repart de 0 à chaque micro-coupure) ;
             juste relancer l'intervalle d'affichage que clearTimers()
             vient d'arrêter. */
          durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
        iceRestartAttempts.current = 0; // repart de zéro pour une future coupure

        const wasReconnecting = reconnectPhaseRef.current !== null;
        clearReconnectTimers();
        if (wasReconnecting) {
          setReconnectPhase('restored');
          setTimeout(() => setReconnectPhase(null), 1500);
        }
      } else if (state === 'failed' || state === 'disconnected') {
        /* Un 'disconnected'/'failed' pendant la négociation INITIALE (avant
           tout premier 'connected') reste couvert par les timeouts 20s
           d'acceptCall/onCallAccepted — handleConnectionDisruption s'auto-
           désactive tant que wasConnected.current est faux. */
        handleConnectionDisruption(pc);
      }
      /* 'closed' est déclenché par notre propre pc.close() dans cleanup()
         — déjà géré par l'appelant de cleanup(), on ne refait rien ici. */
    };

    watchIceConnectivity(pc, '1:1');
    pcRef.current = pc;
    return pc;
  }, [handleConnectionDisruption, playRemoteAudioWithFallback]);

  /** Applique les ICE candidates mis en file avant setRemoteDescription. */
  const flushIcePending = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of icePendingQ.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    icePendingQ.current = [];
  }, []);

  // ── API publique ──────────────────────────────────────────────

  /** Démarre un appel sortant (audio ou vidéo selon info.callType). */
  const startCall = useCallback(async (info: Omit<CallInfo, 'direction'>) => {
    if (status !== 'idle') {
      /* Silencieux jusqu'ici — si `status` reste coincé sur une valeur
         non-idle après un appel précédent mal terminé, CE bouton ne fait
         plus RIEN, pour toujours, sans le moindre signe visible. */
      console.warn(`[Call] startCall ignoré — status="${status}" (attendu "idle")`);
      emit('call:busy', { conversationId: info.conversationId, callerUserId: info.remoteUserId });
      return;
    }

    console.debug('[Call] startCall →', info);
    const isVideo = info.callType === 'video';
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingMode.current } : false,
      });
      setLocalMediaStream(localStream.current);
      console.debug('[Call] getUserMedia OK');
    } catch (err) {
      console.error('[Call] getUserMedia a échoué :', err);
      alert(isVideo ? 'Accès à la caméra ou au microphone refusé.' : 'Accès au microphone refusé.');
      return;
    }

    const ci: CallInfo = { ...info, direction: 'outgoing' };
    callInfoRef.current = ci;
    setCallInfo(ci);
    setStatus('calling');

    emit('call:initiate', {
      conversationId: info.conversationId,
      calleeUserId:   info.remoteUserId,
      callerName:     info.remoteName,
      callerAvatar:   info.remoteAvatar,
      callType:       info.callType,
    });

    /* Timeout 30s sans réponse → appel manqué */
    timeoutRef.current = setTimeout(() => endCall(true, 'missed'), 30_000);
  }, [status, endCall]);

  /** Accepte un appel entrant. */
  const acceptCall = useCallback(async () => {
    if (!callInfoRef.current) return;
    const isVideo = callInfoRef.current.callType === 'video';

    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingMode.current } : false,
      });
    } catch (err: any) {
      if (isVideo && (err?.name === 'NotReadableError' || err?.name === 'AbortError')) {
        /* Caméra déjà utilisée par un autre onglet → fallback audio seul */
        try {
          localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
          /* Avant : rejectCall() silencieux — l'appelé voyait juste la carte
             "Appel entrant" disparaître sans comprendre pourquoi. */
          alert('Accès au microphone refusé.');
          rejectCall();
          return;
        }
      } else {
        alert(isVideo ? 'Accès à la caméra ou au microphone refusé.' : 'Accès au microphone refusé.');
        rejectCall();
        return;
      }
    }
    setLocalMediaStream(localStream.current);

    /* Retour visuel immédiat : la carte "Appel entrant" doit disparaître
       dès le clic sur "Accepter", avant même la fin de la négociation ICE. */
    setStatus('connecting');

    emit('call:accept', {
      conversationId: callInfoRef.current.conversationId,
      callerUserId:   callInfoRef.current.remoteUserId,
    });
    /* Le caller va créer l'offer → on attend call:offer. Filet de sécurité :
       si l'offre (ou la négociation ICE qui suit) n'aboutit jamais — paquet
       perdu, bug de reconnexion, aucun chemin réseau trouvé — on ne doit pas
       rester bloqué sur "Connexion…" indéfiniment avec pour seule option un
       "Annuler" manuel. clearTimers() (déclenché dès state==='connected'
       dans onconnectionstatechange) annule ce timer si tout se passe bien. */
    timeoutRef.current = setTimeout(() => {
      if (!wasConnected.current) {
        alert('La connexion a échoué. Vérifiez votre connexion internet et réessayez.');
        endCall(true, 'missed');
      }
    }, 20_000);
  }, [endCall]);

  /** Refuse un appel entrant. */
  const rejectCall = useCallback(() => {
    if (!callInfoRef.current) return;
    emit('call:reject', {
      conversationId: callInfoRef.current.conversationId,
      callerUserId:   callInfoRef.current.remoteUserId,
    });
    cleanup();
    setCallInfo(null);
    setStatus('idle');
  }, [cleanup]);

  /** Raccroche (appel entrant ou sortant). */
  const hangUp = useCallback(() => {
    const s: CallEndStatus = wasConnected.current ? 'completed' : 'cancelled';
    endCall(true, s);
  }, [endCall]);

  /**
   * Appel bloqué par le serveur AVANT même d'avoir sonné (occupé / hors ligne /
   * permission refusée — voir CallGateway 'call:unavailable'). À ne JAMAIS
   * faire passer par hangUp() : celui-ci écrit toujours 'cancelled', quelle
   * que soit la vraie raison, ce qui masquait le vrai diagnostic (Redis/
   * présence indisponible finissait enregistré comme un simple "annulé").
   */
  const cancelUnavailable = useCallback((reason: 'offline' | 'denied') => {
    if (reason === 'offline') {
      /* Correspond à CallHistoryStatus.MISSED déjà écrit côté serveur
         (recordShortCircuit) — on aligne la bulle locale sur la même valeur. */
      endCall(false, 'missed');
      return;
    }
    /* 'denied' : permission refusée — assertCanCall a rejeté AVANT toute
       création de ligne Call/CallHistory côté serveur. Ne rien persister
       ici créerait une bulle sans contrepartie dans l'historique réel. */
    cleanup();
    setCallInfo(null);
    setDuration(0);
    setIsMuted(false);
    setStatus('ended');
    setTimeout(() => setStatus('idle'), 1500);
  }, [endCall, cleanup]);

  /** Active / coupe la caméra (appel vidéo uniquement). */
  const toggleVideo = useCallback(() => {
    localStream.current?.getVideoTracks().forEach(t => {
      t.enabled = !t.enabled;
    });
    setIsVideoOff(v => !v);
  }, []);

  /**
   * Bascule caméra avant/arrière (mobile).
   * Remplace la piste vidéo sans couper l'appel.
   */
  const flipCamera = useCallback(async () => {
    if (!localStream.current || callInfoRef.current?.callType !== 'video') return;
    facingMode.current = facingMode.current === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facingMode.current },
      });
      const newTrack = newStream.getVideoTracks()[0];
      /* Remplace la piste dans le PeerConnection sans renegocier */
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender && newTrack) await sender.replaceTrack(newTrack);
      /* Met à jour le stream local */
      localStream.current.getVideoTracks().forEach(t => { t.stop(); localStream.current?.removeTrack(t); });
      localStream.current.addTrack(newTrack);
      setLocalMediaStream(new MediaStream(localStream.current.getTracks()));
    } catch { /* silencieux si appareil sans caméra arrière */ }
  }, []);

  /** Active / coupe le micro. */
  const toggleMute = useCallback(() => {
    localStream.current?.getAudioTracks().forEach(t => {
      t.enabled = !t.enabled;
    });
    setIsMuted(m => !m);
  }, []);

  /**
   * Bascule haut-parleur / sortie discrète.
   * Change toujours le volume (effet garanti) et tente en plus de
   * basculer le périphérique de sortie audio si le navigateur le permet.
   */
  const toggleSpeaker = useCallback(() => {
    const next = !isSpeakerOnRef.current;
    isSpeakerOnRef.current = next;
    setIsSpeakerOn(next);
    if (remoteAudio.current) void applySpeaker(remoteAudio.current, next);
  }, []);

  // ── Gestion des événements socket entrants ────────────────────

  /* Appel entrant */
  const onCallIncoming = useCallback((payload: WsCallIncoming) => {
    if (statusRef.current !== 'idle') {
      emit('call:busy', {
        conversationId: payload.conversationId,
        callerUserId:   payload.callerUserId,
      });
      return;
    }
    const ci: CallInfo = {
      conversationId: payload.conversationId,
      remoteUserId:   payload.callerUserId,
      remoteName:     payload.callerName,
      remoteAvatar:   payload.callerAvatar,
      direction:      'incoming',
      callType:       payload.callType ?? 'audio',
    };
    callInfoRef.current = ci;
    setCallInfo(ci);
    setStatus('ringing');
  }, []);

  /* Appelé a accepté → on crée l'offer (caller) */
  const onCallAccepted = useCallback(async () => {
    if (!callInfoRef.current || !localStream.current) return;
    clearTimers();
    setStatus('connecting');

    /* Filet de sécurité symétrique à celui d'acceptCall (côté appelé) —
       SANS ça, un échec de négociation ICE côté APPELANT (offer qui ne
       part jamais, réponse jamais reçue, paquet perdu…) laissait le statut
       bloqué sur "Connexion…" indéfiniment, avec pcRef/callInfoRef jamais
       réinitialisés : aucun moyen de relancer un appel suivant sans
       recharger toute la page. clearTimers() dans onconnectionstatechange
       annule ce timer dès que la connexion aboutit réellement. */
    timeoutRef.current = setTimeout(() => {
      if (!wasConnected.current) {
        alert('La connexion a échoué. Vérifiez votre connexion internet et réessayez.');
        endCall(true, 'missed');
      }
    }, 20_000);

    try {
      const iceServers = await getIceServers();
      const pc = createPeerConnection(iceServers);
      await attachLocalTracks(pc, localStream.current);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      emit('call:offer', {
        conversationId: callInfoRef.current.conversationId,
        targetUserId:   callInfoRef.current.remoteUserId,
        sdp:            offer,
      });
    } catch (err) {
      /* Échec de création de l'offer (accès média perdu, PeerConnection en
         erreur…) — sans ce catch, l'exception restait non gérée et le
         statut ne redescendait jamais à 'idle' tout seul. */
      console.error('[Call] Échec création de l\'offer WebRTC :', err);
      endCall(true, 'missed');
    }
  }, [createPeerConnection, attachLocalTracks, endCall]);

  /* Appelé a refusé — l'appelant reçoit cet événement et enregistre 'rejected' */
  const onCallRejected = useCallback(() => {
    endCall(false, 'rejected');
  }, [endCall]);

  /* L'autre a raccroché — si connecté c'est 'completed', sinon 'missed' */
  const onCallEnded = useCallback(() => {
    endCall(false, wasConnected.current ? 'completed' : 'missed');
  }, [endCall]);

  /* Offer WebRTC reçue (callee) */
  const onCallOffer = useCallback(async (payload: WsCallSignal) => {
    if (!callInfoRef.current || !localStream.current) return;

    try {
      const iceServers = await getIceServers();
      const pc = createPeerConnection(iceServers);
      await attachLocalTracks(pc, localStream.current);

      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp!));
      await flushIcePending();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      emit('call:answer', {
        conversationId: callInfoRef.current.conversationId,
        targetUserId:   callInfoRef.current.remoteUserId,
        sdp:            answer,
      });
    } catch (err) {
      /* SDP distante invalide, média perdu… — sans ce catch, le statut
         restait bloqué sur "Connexion…" indéfiniment (voir acceptCall,
         qui a déjà un timeout 20s en filet, mais autant échouer vite). */
      console.error('[Call] Échec traitement de l\'offer WebRTC reçue :', err);
      endCall(true, 'missed');
    }
  }, [createPeerConnection, attachLocalTracks, flushIcePending, endCall]);

  /* Answer WebRTC reçue (caller) */
  const onCallAnswer = useCallback(async (payload: WsCallSignal) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp!));
      await flushIcePending();
    } catch (err) {
      console.error('[Call] Échec application de l\'answer WebRTC :', err);
      endCall(true, 'missed');
    }
  }, [flushIcePending, endCall]);

  /* Candidat ICE reçu */
  const onCallIceCandidate = useCallback(async (payload: WsCallSignal) => {
    const pc = pcRef.current;
    if (!payload.candidate) return;
    if (pc?.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
    } else {
      icePendingQ.current.push(payload.candidate);
    }
  }, []);

  /* Occupé — l'appelant enregistre 'busy' */
  const onCallBusy = useCallback(() => {
    endCall(false, 'busy');
  }, [endCall]);

  /**
   * Le socket /messaging s'est (re)connecté — si un appel était en cours,
   * vérifie côté serveur qu'il existe toujours. Sans ça, une coupure
   * réseau assez longue pour dépasser le ping-timeout Socket.IO faisait
   * déjà raccrocher l'appel côté serveur (CallGateway.handleDisconnect)
   * PENDANT la coupure — le client, lui, ne le découvrait qu'à l'échéance
   * de son propre délai de reprise ICE (jusqu'à 20s), en restant bloqué sur
   * "Reconnexion…" entre-temps. N'émet jamais rien qui pourrait créer un
   * second appel — lecture seule ; le signaling éventuellement bufferisé
   * par socket.io-client pendant la coupure est réémis automatiquement dès
   * la reconnexion, sans intervention ici.
   */
  const onSocketReconnected = useCallback(() => {
    const info = callInfoRef.current;
    if (!info) return;
    apiFetch<{ callId: string | null }>(`/calls/active-with/${info.remoteUserId}`)
      .then(res => {
        /* L'appel a pu changer (raccroché puis un AUTRE relancé) entre le
           moment de la requête et sa réponse — ne conclure que si on parle
           toujours du même correspondant. */
        if (callInfoRef.current?.remoteUserId !== info.remoteUserId) return;
        if (!res.callId) {
          console.warn('[Call] Reconnexion Socket.IO — le serveur n\'a plus trace de cet appel, fermeture locale.');
          endCall(false, wasConnected.current ? 'completed' : 'missed');
        }
      })
      .catch(() => {
        /* Requête échouée (réseau encore instable) — ne pas couper l'appel
           sur la seule foi d'un échec de vérification ; la reprise ICE
           locale (délai maximal RECONNECT_TOTAL_TIMEOUT_MS) reste le filet
           de sécurité. */
      });
  }, [endCall]);

  // ── Enregistrement des événements socket ─────────────────────
  /*
   * PROBLÈME : le socket est créé par useSocket (dans useMessagerie)
   * mais il ne se CONNECTE qu'après le handshake réseau.
   * Si getActiveSocket() retourne null ou un socket non connecté,
   * les listeners ne seraient jamais enregistrés.
   *
   * SOLUTION : on écoute l'événement 'connect' du socket pour
   * (ré)enregistrer les listeners dès que la connexion est établie.
   * Ainsi même si le socket se reconnecte plus tard, les listeners
   * sont toujours actifs.
   */
  useEffect(() => {
    function unregister(socket: ReturnType<typeof getActiveSocket>) {
      if (!socket) return;
      socket.off('call:incoming',      onCallIncoming);
      socket.off('call:accepted',      onCallAccepted);
      socket.off('call:rejected',      onCallRejected);
      socket.off('call:ended',         onCallEnded);
      socket.off('call:offer',         onCallOffer);
      socket.off('call:answer',        onCallAnswer);
      socket.off('call:ice-candidate', onCallIceCandidate);
      socket.off('call:busy',          onCallBusy);
      socket.off('connect',            onSocketReconnected);
    }

    /*
     * ⚠️ IDEMPOTENT : on désinscrit d'abord (no-op si rien n'était inscrit).
     * Sans ça, l'essai immédiat ci-dessous PUIS le 1er tick du polling de
     * retry (qui voit le même socket déjà connecté) enregistraient chacun
     * leur propre jeu de listeners → chaque event socket (call:offer,
     * call:answer...) déclenchait le handler 2x, 3x... et créait autant
     * d'offres/réponses WebRTC dupliquées, cassant la négociation ICE.
     */
    function register(socket: ReturnType<typeof getActiveSocket>) {
      if (!socket) return;
      unregister(socket);
      socket.on('call:incoming',      onCallIncoming);
      socket.on('call:accepted',      onCallAccepted);
      socket.on('call:rejected',      onCallRejected);
      socket.on('call:ended',         onCallEnded);
      socket.on('call:offer',         onCallOffer);
      socket.on('call:answer',        onCallAnswer);
      socket.on('call:ice-candidate', onCallIceCandidate);
      socket.on('call:busy',          onCallBusy);
      /* 'connect' se déclenche aussi bien pour la 1ère connexion que pour
         chaque reconnexion — onSocketReconnected s'auto-limite au cas où
         un appel est réellement en cours (callInfoRef non-null). */
      socket.on('connect',            onSocketReconnected);
    }

    /* Essai immédiat : si socket déjà disponible, on enregistre tout de suite */
    const socket = getActiveSocket();
    register(socket);

    /*
     * Retry via polling léger : si le socket n'est pas encore prêt
     * (rare — se produit si useAudioCall monte avant useSocket),
     * on réessaie toutes les 300 ms jusqu'à 3 secondes max.
     */
    let retries = 0;
    const retryId = setInterval(() => {
      const s = getActiveSocket();
      if (s) { register(s); clearInterval(retryId); }
      if (++retries >= 10) clearInterval(retryId);
    }, 300);

    return () => {
      clearInterval(retryId);
      unregister(getActiveSocket());
    };
  }, [
    onCallIncoming, onCallAccepted, onCallRejected, onCallEnded,
    onCallOffer, onCallAnswer, onCallIceCandidate, onCallBusy, onSocketReconnected,
  ]);

  /* Best-effort : notifie le correspondant et libère micro/caméra si
   * l'utilisateur ferme l'onglet/le navigateur en pleine communication —
   * sans ça, l'autre participant ne voit l'appel se couper qu'au
   * ping-timeout Socket.IO (délai perceptible), et la caméra/micro locaux
   * restent parfois allumés jusqu'au déchargement complet de la page. */
  useEffect(() => {
    const handler = () => {
      if (statusRef.current !== 'idle') {
        try { endCall(true, wasConnected.current ? 'completed' : 'cancelled'); } catch { /* best-effort */ }
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [endCall]);

  return {
    callStatus:       status,
    callInfo,
    duration,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    localMediaStream,  // pour l'élément <video> local dans CallOverlay
    remoteMediaStream, // pour l'élément <video> distant dans CallOverlay
    reconnectPhase,    // null hors coupure réseau — voir ReconnectPhase
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    cancelUnavailable,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    flipCamera,
  };
}
