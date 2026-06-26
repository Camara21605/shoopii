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
 * STUN : serveurs Google publics (gratuits, suffisants pour les tests)
 * TURN : à ajouter en production pour les NAT stricts
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveSocket } from './useSocket';
import type { WsCallIncoming, WsCallSignal } from './useSocket';

// ── Serveurs ICE ──────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302'  },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// ── Types ─────────────────────────────────────────────────────

export type CallStatus =
  | 'idle'       // aucun appel
  | 'calling'    // appel sortant en attente de réponse
  | 'ringing'    // appel entrant non décroché
  | 'connected'  // appel en cours
  | 'ended';     // appel terminé (transition rapide → idle)

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

// ── Hook ─────────────────────────────────────────────────────

export function useAudioCall(props?: UseAudioCallProps) {
  const onCallEventRef = useRef(props?.onCallEvent);
  useEffect(() => { onCallEventRef.current = props?.onCallEvent; });

  const [status,            setStatus]            = useState<CallStatus>('idle');
  const [callInfo,          setCallInfo]          = useState<CallInfo | null>(null);
  const [isMuted,           setIsMuted]           = useState(false);
  const [isVideoOff,        setIsVideoOff]        = useState(false);
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

  // ── Utilitaires internes ──────────────────────────────────────

  function emit(event: string, data: object) {
    getActiveSocket()?.emit(event, data);
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

  /** Nettoie TOUT : streams, PeerConnection, timers, audio element. */
  const cleanup = useCallback(() => {
    clearTimers();
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

  // ── Création du RTCPeerConnection ─────────────────────────────

  const createPeerConnection = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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
      }
    };

    /* Surveille l'état de la connexion */
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        clearTimers();
        setStatus('connected');
        startDurationTimer();
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        endCall(false);
      }
    };

    pcRef.current = pc;
    return pc;
  }, [endCall]);

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
      emit('call:busy', { conversationId: info.conversationId, callerUserId: info.remoteUserId });
      return;
    }

    const isVideo = info.callType === 'video';
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingMode.current } : false,
      });
      setLocalMediaStream(localStream.current);
    } catch {
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
          rejectCall();
          return;
        }
      } else {
        rejectCall();
        return;
      }
    }
    setLocalMediaStream(localStream.current);

    emit('call:accept', {
      conversationId: callInfoRef.current.conversationId,
      callerUserId:   callInfoRef.current.remoteUserId,
    });
    /* Le caller va créer l'offer → on attend call:offer */
  }, []);

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

  // ── Gestion des événements socket entrants ────────────────────

  /* Appel entrant */
  const onCallIncoming = useCallback((payload: WsCallIncoming) => {
    if (status !== 'idle') {
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
  }, [status]);

  /* Appelé a accepté → on crée l'offer (caller) */
  const onCallAccepted = useCallback(async () => {
    if (!callInfoRef.current || !localStream.current) return;
    clearTimers();

    const pc = createPeerConnection();
    localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current!));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    emit('call:offer', {
      conversationId: callInfoRef.current.conversationId,
      targetUserId:   callInfoRef.current.remoteUserId,
      sdp:            offer,
    });
  }, [createPeerConnection]);

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

    const pc = createPeerConnection();
    localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current!));

    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp!));
    await flushIcePending();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    emit('call:answer', {
      conversationId: callInfoRef.current.conversationId,
      targetUserId:   callInfoRef.current.remoteUserId,
      sdp:            answer,
    });
  }, [createPeerConnection, flushIcePending]);

  /* Answer WebRTC reçue (caller) */
  const onCallAnswer = useCallback(async (payload: WsCallSignal) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp!));
    await flushIcePending();
  }, [flushIcePending]);

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
    function register(socket: ReturnType<typeof getActiveSocket>) {
      if (!socket) return;
      socket.on('call:incoming',      onCallIncoming);
      socket.on('call:accepted',      onCallAccepted);
      socket.on('call:rejected',      onCallRejected);
      socket.on('call:ended',         onCallEnded);
      socket.on('call:offer',         onCallOffer);
      socket.on('call:answer',        onCallAnswer);
      socket.on('call:ice-candidate', onCallIceCandidate);
      socket.on('call:busy',          onCallBusy);
    }

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
    onCallOffer, onCallAnswer, onCallIceCandidate, onCallBusy,
  ]);

  return {
    callStatus:       status,
    callInfo,
    duration,
    isMuted,
    isVideoOff,
    localMediaStream,  // pour l'élément <video> local dans CallOverlay
    remoteMediaStream, // pour l'élément <video> distant dans CallOverlay
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    toggleMute,
    toggleVideo,
    flipCamera,
  };
}
