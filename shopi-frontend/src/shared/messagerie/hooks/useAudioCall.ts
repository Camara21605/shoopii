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
import { describeMediaError } from './mediaErrors';
import { hasMultipleCameras } from './deviceCapabilities';
import { callError } from './callErrors';
import type { CallErrorInfo } from './callErrors';

// ── Types ─────────────────────────────────────────────────────

export type CallStatus =
  | 'idle'         // aucun appel
  | 'calling'      // appel sortant en attente de réponse
  | 'ringing'      // appel entrant non décroché
  | 'connecting'   // décroché, négociation WebRTC (ICE) en cours
  | 'connected'    // appel en cours, connexion stable
  | 'reconnecting' // appel en cours mais connexion perturbée — voir reconnectPhase pour le détail (instable/reprise active)
  | 'failed'       // reprise réseau abandonnée — transition brève avant 'ended' (partie 8)
  | 'ended';       // appel terminé (transition rapide → idle)

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
  /**
   * Erreur/évènement d'appel à afficher à l'utilisateur (partie 8) — le hook
   * ne sait pas afficher de toast (pas de contexte React ici), il délègue à
   * GlobalCallContext.tsx qui, lui, a accès à useToast() (système UI Shoneya
   * existant, jamais un nouvel alert()).
   */
  onError?: (error: CallErrorInfo) => void;
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
  const onErrorRef = useRef(props?.onError);
  useEffect(() => { onErrorRef.current = props?.onError; });
  /**
   * Raccourci — reportCallError(callError('mic-permission-denied')) etc.
   * useCallback([]) plutôt qu'une fonction simple : ne lit que la ref
   * onErrorRef (toujours stable), donc peut être listée sans risque dans
   * les tableaux de dépendances des autres useCallback qui l'utilisent
   * (satisfait exhaustive-deps sans provoquer de ré-créations inutiles).
   */
  const reportCallError = useCallback((error: CallErrorInfo): void => {
    onErrorRef.current?.(error);
  }, []);

  /** Traduit une erreur getUserMedia (DOMException) vers la taxonomie centralisée (partie 8). */
  const reportMediaError = useCallback((err: unknown, isVideo: boolean): void => {
    const device = isVideo ? 'la caméra ou le microphone' : 'le microphone';
    const { reason, message } = describeMediaError(err, device);
    switch (reason) {
      case 'not-found':    reportCallError(callError(isVideo ? 'no-camera' : 'no-microphone')); break;
      case 'not-allowed':  reportCallError(callError(isVideo ? 'camera-permission-denied' : 'mic-permission-denied')); break;
      case 'not-readable': reportCallError(callError('device-busy')); break;
      case 'security':     reportCallError(callError('permission-blocked')); break;
      default:             reportCallError(callError('unknown', message));
    }
  }, [reportCallError]);

  /* Préchauffe le cache des serveurs ICE dès le montage — évite d'attendre
     l'aller-retour réseau au moment précis où l'appel démarre. */
  useEffect(() => { prefetchIceServers(); }, []);

  /**
   * Capacité "plusieurs caméras" (partie 7) — ne JAMAIS supposer qu'un
   * appareil a une caméra avant/arrière ; recalculé sur 'devicechange' pour
   * suivre un branchement/débranchement en cours de session (webcam USB…).
   */
  const [canFlipCamera, setCanFlipCamera] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { hasMultipleCameras().then(v => { if (!cancelled) setCanFlipCamera(v); }); };
    refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
    };
  }, []);

  /** Support navigateur du partage d'écran — absent sur certains mobiles. */
  const canShareScreen = typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  const [status,            setStatus]            = useState<CallStatus>('idle');
  const [callInfo,          setCallInfo]          = useState<CallInfo | null>(null);
  const [isMuted,           setIsMuted]           = useState(false);
  const [isVideoOff,        setIsVideoOff]        = useState(false);
  const [isSpeakerOn,       setIsSpeakerOn]       = useState(true);
  const [isScreenSharing,   setIsScreenSharing]   = useState(false);
  /** true = lecture audio distante bloquée par l'autoplay du navigateur — CallOverlay affiche un bouton "Activer le son" (partie 8). */
  const [needsAudioUnlock,  setNeedsAudioUnlock]   = useState(false);
  const [duration,          setDuration]          = useState(0);
  /** Streams exposés à CallOverlay pour les éléments <video> */
  const [localMediaStream,  setLocalMediaStream]  = useState<MediaStream | null>(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState<MediaStream | null>(null);

  /* Refs internes */
  const callInfoRef    = useRef<CallInfo | null>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStream    = useRef<MediaStream | null>(null);
  /** Piste caméra mise de côté pendant un partage d'écran, pour la restaurer à l'arrêt. */
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  /* Référence directe au sender vidéo, indépendante de son track courant —
     `sender.track` devient null après replaceTrack(null) (cas d'un appel
     AUDIO-ONLY dont on arrête le partage d'écran) ; chercher par
     `.track?.kind==='video'` échouerait alors sur un 2e partage d'écran
     (le sender existant, track=null, ne matcherait plus la recherche, et
     un nouveau sender serait ajouté par erreur au lieu de réutiliser
     l'existant). */
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const screenStream   = useRef<MediaStream | null>(null);
  const remoteAudio    = useRef<HTMLAudioElement | null>(null);
  const icePendingQ    = useRef<RTCIceCandidateInit[]>([]);
  /** Sérialise le traitement des 'call:offer' reçus — voir onCallOffer. */
  const offerChainRef  = useRef<Promise<void>>(Promise.resolve());
  const durationRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  /** Horodatage (Date.now()) auquel le timeout 30s de sonnerie sortante doit
   *  expirer, 0 si aucune sonnerie en cours — voir l'effet visibilitychange
   *  plus bas : un onglet mis en arrière-plan fait dériver setTimeout de
   *  plusieurs dizaines de secondes (throttling navigateur), ce qui laissait
   *  la ligne "occupée" côté serveur bien après les 30s annoncées et
   *  bloquait les tentatives suivantes avec "Vous êtes déjà en appel". */
  const ringDeadlineRef = useRef(0);
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

  /**
   * Détecte un périphérique débranché/révoqué EN COURS D'APPEL — `onended`
   * ne se déclenche que sur une fin INATTENDUE (le navigateur ne l'émet
   * jamais pour un simple track.stop() appelé par notre propre code, voir
   * MDN MediaStreamTrack : "ended" event). Aucune tentative de reconnexion
   * automatique du périphérique ici (hors-scope, risque de boucle) — juste
   * refléter l'état honnêtement plutôt que de laisser l'UI mentir
   * (caméra/micro affichés "actifs" alors que la source a disparu).
   */
  function attachLocalTrackEndedHandlers(stream: MediaStream | null): void {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      track.onended = () => {
        console.warn(`[Call] piste locale "${track.kind}" terminée de façon inattendue (périphérique débranché/permission révoquée).`);
        if (track.kind === 'video') setIsVideoOff(true);
        if (track.kind === 'audio') setIsMuted(true);
      };
    }
  }

  /**
   * Retrouve le sender vidéo d'une pc, en le mémorisant — indispensable dès
   * qu'un partage d'écran peut avoir mis son `.track` à null (replaceTrack
   * (null), cas d'un appel audio-only sans piste de repli) : chercher par
   * `.track?.kind==='video'` échouerait alors sur un 2e appel. Repose sur
   * l'invariant qu'une seule RTCPeerConnection vit à la fois pour cet appel
   * (jamais recréée pendant l'ICE-restart, voir attemptIceRestart) — la ref
   * est réinitialisée dans cleanup() à chaque fin d'appel.
   */
  function getVideoSender(pc: RTCPeerConnection): RTCRtpSender | null {
    if (videoSenderRef.current) return videoSenderRef.current;
    const sender = pc.getSenders().find(s => s.track?.kind === 'video') ?? null;
    videoSenderRef.current = sender;
    return sender;
  }

  function startDurationTimer() {
    wasConnected.current   = true;
    connectedSince.current = Date.now();
    durationRef.current    = setInterval(() => setDuration(d => d + 1), 1000);
  }

  function clearTimers() {
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
    ringDeadlineRef.current = 0;
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
    localStream.current?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    localStream.current = null;
    /* Libère le partage d'écran s'il était en cours — sans ça, l'onglet/la
       fenêtre partagée reste "en cours de partage" (bordure navigateur,
       icône d'enregistrement) après la fin de l'appel. */
    screenStream.current?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    screenStream.current = null;
    cameraTrackRef.current = null;
    videoSenderRef.current = null; // la pc qui le portait vient d'être fermée
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
    setIsScreenSharing(false);
    setNeedsAudioUnlock(false);
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
   * Filet de sécurité pour le timeout 30s de sonnerie sortante (voir
   * startCall) : un onglet mis en arrière-plan fait throttler setTimeout par
   * le navigateur (Chrome ne le déclenche parfois qu'après ~1 minute), donc
   * un appel jamais décroché pouvait rester "en attente" côté serveur bien
   * au-delà des 30s annoncées — bloquant toute nouvelle tentative avec
   * "Vous êtes déjà en appel" alors que rien n'est réellement en cours. Au
   * retour de l'onglet au premier plan, on vérifie l'horloge murale plutôt
   * que de faire confiance au timer : si l'échéance est dépassée, on
   * termine l'appel immédiatement au lieu d'attendre le timer en retard. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (ringDeadlineRef.current && Date.now() >= ringDeadlineRef.current) {
        ringDeadlineRef.current = 0;
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        reportCallError(callError('call-expired'));
        endCall(true, 'missed');
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [endCall, reportCallError]);

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
   * utilisateur directe), signale needsAudioUnlock=true : CallOverlay
   * affiche un vrai bouton du design system Shoneya (partie 8 — avant : bouton
   * DOM brut créé à la main, hors système UI, sans aria-label).
   */
  const playRemoteAudioWithFallback = useCallback(async (audioEl: HTMLAudioElement) => {
    try {
      await audioEl.play();
      setNeedsAudioUnlock(false);
    } catch {
      console.warn('[Call] Lecture audio distante bloquée par le navigateur (autoplay) — action utilisateur requise.');
      setNeedsAudioUnlock(true);
    }
  }, []);

  /** Relance la lecture suite au clic utilisateur sur "Activer le son" (CallOverlay). */
  const enableAudio = useCallback(async () => {
    if (!remoteAudio.current) return;
    try {
      await remoteAudio.current.play();
      setNeedsAudioUnlock(false);
    } catch {
      /* Toujours bloqué (rare — le clic lui-même est normalement suffisant
         pour lever la restriction autoplay) — le bouton reste affiché. */
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
    setStatus('failed');
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
      setStatus('reconnecting');
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
      /* Nouvel objet MediaStream à chaque événement (même si `stream` est la
         même référence sous-jacente WebRTC) — sans ça, l'ajout d'une piste
         vidéo à un flux déjà existant (ex. partage d'écran démarré en cours
         d'appel AUDIO, voir startScreenShare) ne déclenche aucun re-render :
         React ignore un setState avec la même référence d'objet. */
      setRemoteMediaStream(new MediaStream(stream.getTracks()));

      /* Décidé sur le contenu RÉEL du flux, pas sur callInfo.callType figé à
         l'établissement de l'appel — un appel audio peut acquérir une piste
         vidéo en cours de route (partage d'écran, partie 7) sans jamais
         changer de callType. */
      const hasVideo = stream.getVideoTracks().length > 0;
      if (!hasVideo) {
        if (!remoteAudio.current) {
          remoteAudio.current = document.createElement('audio');
          remoteAudio.current.autoplay = true;
          document.body.appendChild(remoteAudio.current);
        }
        remoteAudio.current.srcObject = stream;
        void applySpeaker(remoteAudio.current, isSpeakerOnRef.current);
        void playRemoteAudioWithFallback(remoteAudio.current);
      } else if (remoteAudio.current) {
        /* Une piste vidéo vient d'apparaître sur ce flux — le <video> de
           l'overlay va désormais porter l'audio ET la vidéo du MÊME flux ;
           garder l'élément <audio> caché doublerait le son. */
        remoteAudio.current.srcObject = null;
        remoteAudio.current.pause();
        if (document.body.contains(remoteAudio.current)) document.body.removeChild(remoteAudio.current);
        remoteAudio.current = null;
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
    /* callInfoRef (pas `status`) : endCall() le remet à null IMMÉDIATEMENT
     * (dans cleanup()), avant même de passer par l'état d'affichage 'ended'
     * — qui, lui, reste visible 1,5s ("Appel terminé") avant de repasser à
     * 'idle'. Garder ce garde sur `status` empêchait de rappeler quiconque
     * pendant ces 1,5s purement cosmétiques, alors que rien côté client ni
     * serveur n'empêchait réellement un nouvel appel à ce moment-là. */
    if (callInfoRef.current !== null) {
      /* Silencieux jusqu'ici — si un appel précédent reste coincé sans
         jamais avoir été nettoyé, CE bouton ne fait plus RIEN, pour
         toujours, sans le moindre signe visible. */
      console.warn(`[Call] startCall ignoré — un appel est déjà en cours (status="${status}")`);
      emit('call:busy', { conversationId: info.conversationId, callerUserId: info.remoteUserId });
      return;
    }

    console.debug('[Call] startCall →', info);
    const isVideo = info.callType === 'video';

    /* PARTIE 9.5 — signaling D'ABORD, acquisition média EN PARALLÈLE :
       call:initiate ne dépend d'AUCUNE donnée média (juste calleeUserId/
       callType/nom/avatar) — le faire attendre getUserMedia() (prompt de
       permission navigateur potentiellement long, parfois plusieurs
       secondes, ou initialisation matérielle caméra/micro) retardait
       inutilement le moment où B voit "appel entrant", alors que rien
       n'empêche B de sonner pendant que A finit d'acquérir son propre
       flux local. Si l'acquisition échoue APRÈS que B a commencé à
       sonner, on annule proprement (même chemin que le bouton "Annuler"
       — B voit "Appel annulé", sans timeout à attendre). */
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

    /* Timeout 30s sans réponse → appel manqué (compte à partir du moment
       où B commence réellement à sonner, pas de l'acquisition média locale). */
    ringDeadlineRef.current = Date.now() + 30_000;
    timeoutRef.current = setTimeout(() => {
      ringDeadlineRef.current = 0;
      reportCallError(callError('call-expired'));
      endCall(true, 'missed');
    }, 30_000);

    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingMode.current } : false,
      });
      attachLocalTrackEndedHandlers(localStream.current);
      setLocalMediaStream(localStream.current);
      console.debug('[Call] getUserMedia OK');
    } catch (err) {
      console.error('[Call] getUserMedia a échoué :', err);
      reportMediaError(err, isVideo);
      /* B sonne déjà (call:initiate est déjà parti) — annuler proprement
         plutôt que de le laisser sonner pour un appel qui ne pourra jamais
         aboutir côté A (pas de flux local à envoyer). */
      endCall(true, 'missed');
    }
  }, [status, endCall, reportCallError, reportMediaError]);

  /** Accepte un appel entrant. */
  const acceptCall = useCallback(async () => {
    if (!callInfoRef.current) return;
    const isVideo = callInfoRef.current.callType === 'video';

    /* PARTIE 9.5 — signaling D'ABORD, acquisition média EN PARALLÈLE :
       call:accept ne dépend d'aucune donnée média — A doit apprendre que
       B a accepté (et démarrer sa propre négociation WebRTC) dès le clic,
       sans attendre que B ait fini d'acquérir son flux local. Si
       l'acquisition média échoue APRÈS cet accept, on ne peut plus
       "annuler l'acceptation" (A pense déjà que l'appel est en cours de
       connexion) — on termine proprement l'appel (endCall), même chemin
       que les autres échecs post-accept déjà gérés plus bas
       (onCallAccepted, timeout WebRTC). */
    setStatus('connecting');
    emit('call:accept', {
      conversationId: callInfoRef.current.conversationId,
      callerUserId:   callInfoRef.current.remoteUserId,
    });

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
        } catch (fallbackErr) {
          reportMediaError(fallbackErr, false);
          endCall(true, 'missed');
          return;
        }
      } else {
        reportMediaError(err, isVideo);
        endCall(true, 'missed');
        return;
      }
    }
    attachLocalTrackEndedHandlers(localStream.current);
    setLocalMediaStream(localStream.current);

    /* Le caller va créer l'offer → on attend call:offer. Filet de sécurité :
       si l'offre (ou la négociation ICE qui suit) n'aboutit jamais — paquet
       perdu, bug de reconnexion, aucun chemin réseau trouvé — on ne doit pas
       rester bloqué sur "Connexion…" indéfiniment avec pour seule option un
       "Annuler" manuel. clearTimers() (déclenché dès state==='connected'
       dans onconnectionstatechange) annule ce timer si tout se passe bien. */
    timeoutRef.current = setTimeout(() => {
      if (!wasConnected.current) {
        reportCallError(callError('webrtc-error'));
        endCall(true, 'missed');
      }
    }, 20_000);
  }, [endCall, reportCallError, reportMediaError]);

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
   * Sans effet pendant un partage d'écran : le sender vidéo porte alors la
   * piste écran, pas la caméra — la remplacer casserait le partage sans
   * jamais mettre à jour isScreenSharing (état incohérent).
   */
  const flipCamera = useCallback(async () => {
    if (!localStream.current || callInfoRef.current?.callType !== 'video' || screenStream.current) return;
    facingMode.current = facingMode.current === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facingMode.current },
      });
      const newTrack = newStream.getVideoTracks()[0];
      /* Remplace la piste dans le PeerConnection sans renegocier */
      const sender = pcRef.current ? getVideoSender(pcRef.current) : null;
      if (sender && newTrack) await sender.replaceTrack(newTrack);
      /* Met à jour le stream local */
      localStream.current.getVideoTracks().forEach(t => { t.stop(); localStream.current?.removeTrack(t); });
      localStream.current.addTrack(newTrack);
      setLocalMediaStream(new MediaStream(localStream.current.getTracks()));
    } catch (err) {
      /* Reviens à l'orientation précédente — la bascule a échoué, pas la peine
         de laisser facingMode désynchronisé du flux réellement actif. */
      facingMode.current = facingMode.current === 'user' ? 'environment' : 'user';
      const { reason, message } = describeMediaError(err, 'la caméra arrière');
      console.warn('[Call] flipCamera a échoué :', message, err);
      reportCallError(reason === 'not-allowed' ? callError('camera-permission-denied')
        : reason === 'not-readable' ? callError('device-busy')
        : callError('unknown', message));
    }
  }, [reportCallError]);

  /** Arrête le partage d'écran et restaure la caméra (ou une piste vide si l'appel était audio-only). */
  const stopScreenShare = useCallback(async () => {
    if (!screenStream.current) return;
    screenStream.current.getTracks().forEach(t => { t.onended = null; t.stop(); });
    screenStream.current = null;
    setIsScreenSharing(false);

    const pc = pcRef.current;
    const sender = pc ? getVideoSender(pc) : null;
    if (sender) {
      try { await sender.replaceTrack(cameraTrackRef.current); } catch { /* best-effort */ }
    }
    cameraTrackRef.current = null;
  }, []);

  /**
   * Démarre le partage d'écran — remplace la piste vidéo envoyée sur la
   * PeerConnection existante (jamais de 2e PeerConnection). Si l'appel
   * était audio uniquement (aucun sender vidéo existant), ajoute une piste
   * et renégocie une fois (l'autre côté répond via onCallOffer, qui
   * réutilise désormais la pc existante — voir plus haut).
   */
  const startScreenShare = useCallback(async () => {
    if (!callInfoRef.current || !pcRef.current || screenStream.current) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;

      const pc = pcRef.current;
      const sender = getVideoSender(pc);
      if (sender) {
        /* Piste caméra existante (appel vidéo, caméra active ou coupée —
           ou sender déjà créé par un précédent partage d'écran sur un
           appel audio-only, track actuellement null) — on la met de côté
           pour la restaurer à l'arrêt du partage (null si elle l'était déjà). */
        cameraTrackRef.current = sender.track;
        await sender.replaceTrack(screenTrack);
      } else {
        /* Aucun sender vidéo n'existe encore pour cette pc — 1er partage
           d'écran d'un appel audio uniquement. Ajoute une piste et
           renégocie (seul cas où un 2e aller-retour SDP est nécessaire ;
           replaceTrack seul aurait suffi sinon). getVideoSender() mémorise
           le sender créé ici pour que les prochains toggles réutilisent
           replaceTrack au lieu de rajouter un nouveau sender à chaque fois. */
        videoSenderRef.current = pc.addTrack(screenTrack, display);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit('call:offer', {
          conversationId: callInfoRef.current.conversationId,
          targetUserId:   callInfoRef.current.remoteUserId,
          sdp:            offer,
        });
      }

      screenStream.current = display;
      /* L'utilisateur peut arrêter le partage depuis le contrôle natif du
         navigateur (barre "Vous partagez cet écran" / raccourci système) —
         sans ce listener, l'app resterait bloquée en `isScreenSharing=true`
         alors que la piste réelle est déjà morte côté navigateur. */
      screenTrack.onended = () => { void stopScreenShare(); };

      setIsScreenSharing(true);
    } catch (err) {
      const { reason, message } = describeMediaError(err, "le partage d'écran");
      if (reason !== 'aborted') {
        // aborted = l'utilisateur a fermé la boîte de sélection — pas une erreur à signaler.
        reportCallError(callError('unknown', message));
      }
    }
  }, [stopScreenShare, reportCallError]);

  /** Bascule marche/arrêt — pratique pour un bouton unique dans l'UI. */
  const toggleScreenShare = useCallback(async () => {
    if (screenStream.current) await stopScreenShare();
    else await startScreenShare();
  }, [startScreenShare, stopScreenShare]);

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
        reportCallError(callError('webrtc-error'));
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
  }, [createPeerConnection, attachLocalTracks, endCall, reportCallError]);

  /* Appelé a refusé — l'appelant reçoit cet événement et enregistre 'rejected' */
  const onCallRejected = useCallback(() => {
    reportCallError(callError('call-rejected'));
    endCall(false, 'rejected');
  }, [endCall, reportCallError]);

  /* L'autre a raccroché — si connecté c'est 'completed', sinon 'missed' */
  const onCallEnded = useCallback(() => {
    endCall(false, wasConnected.current ? 'completed' : 'missed');
  }, [endCall]);

  /*
   * Offer WebRTC reçue (callee).
   *
   * ⚠️ SÉRIALISÉ via offerChainRef : sans ça, un 'call:offer' reçu deux fois
   * pour la MÊME négociation (redélivrance socket.io après une micro-
   * coupure réseau réelle — jamais reproduit sur une boucle locale
   * instantanée, mais confirmé en usage réel) déclenchait deux exécutions
   * CONCURRENTES de ce handler. Les deux `await`aient sur la même
   * RTCPeerConnection réutilisée (voir commentaire plus bas) sans jamais se
   * coordonner : la 1ère invocation pouvait tenter setLocalDescription(answer)
   * APRÈS que la 2ème ait déjà fait tout le cycle setRemoteDescription→
   * createAnswer→setLocalDescription et ramené l'état à 'stable' — provoquant
   * `InvalidStateError: Called in wrong state: stable`, jamais rattrapé
   * proprement, qui terminait l'appel sans jamais atteindre 'connected' (le
   * minutaire, affiché uniquement en 'connected', ne s'affichait donc jamais).
   * En chaînant chaque invocation à la précédente, la 2ème attend que la 1ère
   * ait fini d'amener la pc à 'stable' avant de démarrer son propre cycle —
   * une vraie 2ème négociation légitime (partage d'écran, etc.) reste gérée
   * normalement, juste sans jamais chevaucher une négociation en cours.
   */
  const onCallOffer = useCallback((payload: WsCallSignal) => {
    offerChainRef.current = offerChainRef.current.then(async () => {
      if (!callInfoRef.current || !localStream.current) return;

      try {
        /* Réutilise la PeerConnection existante si elle existe déjà —
           un offer peut arriver une 2e fois EN COURS D'APPEL (renégociation,
           ex. l'autre participant démarre un partage d'écran, partie 7), pas
           seulement à l'établissement initial. Recréer systématiquement la pc
           ici (comportement précédent) aurait détruit une connexion média
           déjà établie et fonctionnelle à chaque renégociation. */
        let pc = pcRef.current;
        if (!pc) {
          const iceServers = await getIceServers();
          pc = createPeerConnection(iceServers);
          await attachLocalTracks(pc, localStream.current);
        }

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
    });
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
    reportCallError(callError('user-busy'));
    endCall(false, 'busy');
  }, [endCall, reportCallError]);

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
    isScreenSharing,
    canFlipCamera,   // false = un seul périphérique vidéo détecté, ne pas afficher le bouton "retourner"
    canShareScreen,  // false = navigateur sans support getDisplayMedia (mobile, essentiellement)
    needsAudioUnlock, // true = autoplay bloqué, afficher le bouton "Activer le son"
    enableAudio,
    localMediaStream,  // pour l'élément <video> local dans CallOverlay
    remoteMediaStream, // pour l'élément <video> distant dans CallOverlay
    /* Reflète le contenu RÉEL du flux distant, pas callInfo.callType figé —
       un appel audio dont l'autre participant démarre un partage d'écran
       acquiert une piste vidéo sans jamais changer de callType. */
    hasRemoteVideo: (remoteMediaStream?.getVideoTracks().length ?? 0) > 0,
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
    toggleScreenShare,
  };
}
