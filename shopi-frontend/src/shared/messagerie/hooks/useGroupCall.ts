/**
 * src/shared/messagerie/hooks/useGroupCall.ts
 *
 * Hook WebRTC pour les appels audio/vidéo de groupe (mesh).
 * Gère N×(N-1)/2 RTCPeerConnections — une par pair.
 *
 * MACHINE À ÉTATS : idle → joining → connected → idle
 *
 * SIGNALING (via Socket.IO /messaging) :
 *   Initiateur   → group_call:initiate → tous reçoivent group_call:incoming
 *   Accepteur    → group_call:join     → reçoit group_call:joined (liste des présents)
 *                                      → les présents reçoivent group_call:participant_joined
 *   Présent      → group_call:offer   → nouvel arrivant
 *   Arrivant     → group_call:answer  → présent
 *   ICE échangés des deux côtés
 *
 * USAGE : à utiliser UNIQUEMENT depuis GroupCallContext (global, survit la navigation).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveSocket }                           from './useSocket';
import { getIceServers, getFreshIceServers, prefetchIceServers, watchIceConnectivity } from './iceServers';
import { describeMediaError } from './mediaErrors';
import { hasMultipleCameras } from './deviceCapabilities';
import { callError } from './callErrors';
import type { CallErrorInfo } from './callErrors';
import type { GroupCallInvite, GroupCallPeer, GroupCallState } from '../data/messagerieTypes';

interface UseGroupCallProps {
  /**
   * Erreur/évènement d'appel à afficher (partie 8) — le hook délègue
   * l'affichage à GroupCallContext.tsx (accès à useToast(), système UI
   * Shoneya existant), symétrique à useAudioCall.ts.
   */
  onError?: (error: CallErrorInfo) => void;
}

// ── Types internes ────────────────────────────────────────────

interface JoinedPayload {
  callId:       string;
  groupId:      string;
  callType:     'audio' | 'video';
  participants: Array<{ userId: string; displayName: string }>;
}

interface ParticipantJoinedPayload {
  callId:      string;
  userId:      string;
  displayName: string;
}

interface ParticipantLeftPayload {
  callId:  string;
  userId:  string;
  reason?: string;
}

interface SignalPayload {
  callId:     string;
  fromUserId: string;
  sdp?:       RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface MediaToggledPayload {
  callId:        string;
  userId:        string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}

/* Bornes de la stratégie de reprise réseau — un pair à la fois, le reste
   du mesh n'est jamais affecté (voir handlePeerDisruption). Constantes de
   module (pas de re-création à chaque rendu). */
const ICE_RESTART_MAX_ATTEMPTS  = 2;
const ICE_RESTART_BACKOFF_MS    = [1200, 2500];
const PEER_RECONNECT_TIMEOUT_MS = 20_000;

// ── Hook ──────────────────────────────────────────────────────

export function useGroupCall(props?: UseGroupCallProps) {
  const onErrorRef = useRef(props?.onError);
  useEffect(() => { onErrorRef.current = props?.onError; });
  /* useCallback([]) — ne lit que la ref onErrorRef (toujours stable),
     listable sans risque dans les deps des autres useCallback (satisfait
     exhaustive-deps sans provoquer de ré-créations inutiles). */
  const reportCallError = useCallback((error: CallErrorInfo): void => {
    onErrorRef.current?.(error);
  }, []);
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

  const [incomingCall, setIncomingCall] = useState<GroupCallInvite | null>(null);
  const [callState,    setCallState]    = useState<GroupCallState   | null>(null);
  const [peers,        setPeers]        = useState<Map<string, GroupCallPeer>>(new Map());
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isVideoOff,   setIsVideoOff]   = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [canFlipCamera,   setCanFlipCamera]   = useState(false);

  // Refs internes (pas de re-render)
  const callStateRef   = useRef<GroupCallState | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  /** Piste caméra mise de côté pendant un partage d'écran, pour la restaurer à l'arrêt. */
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  /** userId → sender vidéo mémorisé — voir le commentaire équivalent dans
      useAudioCall.ts (getVideoSender) : nécessaire dès qu'un sender peut
      avoir son .track à null (arrêt de partage sur un pair audio-only). */
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  /** userId → RTCPeerConnection */
  const pcMapRef       = useRef<Map<string, RTCPeerConnection>>(new Map());
  /** userId → ICE candidates reçus avant setRemoteDescription */
  const icePendingRef  = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  /** Mirror de peers pour éviter la stale-closure dans les callbacks socket */
  const peersRef       = useRef<Map<string, GroupCallPeer>>(new Map());
  /** userId → nombre de tentatives d'ICE-restart déjà faites pour ce pair */
  const iceRestartAttemptsRef = useRef<Map<string, number>>(new Map());
  /** userId → timer de backoff avant la prochaine tentative de reprise ICE */
  const reconnectBackoffTimers  = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** userId → délai maximal global de reprise pour ce pair (donne l'ordre d'abandon) */
  const reconnectDeadlineTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Sens de la caméra courante (mobile) — partagé par tous les pairs du mesh */
  const facingModeRef = useRef<'user' | 'environment'>('user');

  /* Préchauffe le cache des serveurs ICE dès le montage. */
  useEffect(() => { prefetchIceServers(); }, []);

  /** Ne jamais supposer plusieurs caméras (partie 7) — recalculé sur 'devicechange'. */
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

  // ── Helpers ───────────────────────────────────────────────────

  function emit(event: string, data: object) {
    getActiveSocket()?.emit(event, data);
  }

  /**
   * Détecte un périphérique débranché/révoqué EN COURS D'APPEL — `onended`
   * ne se déclenche que sur une fin INATTENDUE, jamais sur un track.stop()
   * de notre propre code (voir le commentaire équivalent dans
   * useAudioCall.ts). Aucune tentative de reconnexion automatique du
   * périphérique — juste refléter l'état honnêtement.
   */
  function attachLocalTrackEndedHandlers(stream: MediaStream | null): void {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      track.onended = () => {
        console.warn(`[GroupCall] piste locale "${track.kind}" terminée de façon inattendue (périphérique débranché/permission révoquée).`);
        if (track.kind === 'video') setIsVideoOff(true);
        if (track.kind === 'audio') setIsMuted(true);
      };
    }
  }

  const updatePeers = useCallback((fn: (prev: Map<string, GroupCallPeer>) => Map<string, GroupCallPeer>) => {
    const next = fn(new Map(peersRef.current));
    peersRef.current = next;
    setPeers(new Map(next));
  }, []);

  /** Annule toute tentative de reprise réseau programmée pour ce pair. */
  function clearPeerReconnectTimers(userId: string) {
    const b = reconnectBackoffTimers.current.get(userId);
    if (b) { clearTimeout(b); reconnectBackoffTimers.current.delete(userId); }
    const d = reconnectDeadlineTimers.current.get(userId);
    if (d) { clearTimeout(d); reconnectDeadlineTimers.current.delete(userId); }
  }

  /**
   * Retrouve le sender vidéo d'un pair, en le mémorisant — voir le
   * commentaire de videoSendersRef ci-dessus.
   */
  function getVideoSender(userId: string, pc: RTCPeerConnection): RTCRtpSender | null {
    const cached = videoSendersRef.current.get(userId);
    if (cached) return cached;
    const sender = pc.getSenders().find(s => s.track?.kind === 'video') ?? null;
    if (sender) videoSendersRef.current.set(userId, sender);
    return sender;
  }

  /** Ferme et supprime le PeerConnection d'un pair. */
  const closePeer = useCallback((userId: string) => {
    clearPeerReconnectTimers(userId);
    iceRestartAttemptsRef.current.delete(userId);
    videoSendersRef.current.delete(userId);
    pcMapRef.current.get(userId)?.close();
    pcMapRef.current.delete(userId);
    icePendingRef.current.delete(userId);
    updatePeers(prev => { prev.delete(userId); return prev; });
  }, [updatePeers]);

  /** Affiche/efface l'état de connexion réseau d'un pair (bandeau UI). */
  const setPeerConnectionState = useCallback((userId: string, connState: 'unstable' | 'reconnecting' | undefined) => {
    updatePeers(prev => {
      const p = prev.get(userId);
      if (!p) return prev;
      prev.set(userId, { ...p, connectionState: connState });
      return prev;
    });
  }, [updatePeers]);

  /** Libère toutes les ressources (local stream + toutes les PCs). */
  const cleanupAll = useCallback(() => {
    for (const [uid] of pcMapRef.current) closePeer(uid);
    localStreamRef.current?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    localStreamRef.current = null;
    /* Libère le partage d'écran s'il était en cours — sans ça, l'onglet/la
       fenêtre reste "en cours de partage" côté navigateur après la fin
       de l'appel de groupe. */
    screenStreamRef.current?.getTracks().forEach(t => { t.onended = null; t.stop(); });
    screenStreamRef.current = null;
    cameraTrackRef.current = null;
    videoSendersRef.current.clear(); // déjà vidée pair par pair via closePeer() ci-dessus — filet de sécurité
    setLocalStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    callStateRef.current = null;
    peersRef.current = new Map();
    setPeers(new Map());
    setCallState(null);
  }, [closePeer]);

  /** Applique les ICE candidates mis en attente pour un userId. */
  const flushIcePending = useCallback(async (userId: string) => {
    const pc      = pcMapRef.current.get(userId);
    const pending = icePendingRef.current.get(userId) ?? [];
    if (!pc) return;
    for (const c of pending) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    icePendingRef.current.set(userId, []);
  }, []);

  /**
   * Attache les pistes locales à une PeerConnection en réutilisant un
   * sender existant (replaceTrack) plutôt que d'en ajouter un nouveau —
   * nécessaire pour l'ICE-restart : addTrack dupliquerait la piste déjà
   * envoyée à ce pair et casserait la négociation.
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
   * Tente de relancer la négociation ICE avec CE pair avant de fermer sa
   * connexion — une coupure réseau transitoire ne doit fermer qu'UNE
   * connexion du mesh, pas tout l'appel. Limité à ICE_RESTART_MAX_ATTEMPTS
   * tentatives par pair, chacune précédée d'un backoff (laisse une chance
   * à une reprise spontanée avant de renégocier pour de vrai).
   */
  const attemptIceRestart = useCallback((pc: RTCPeerConnection, userId: string) => {
    if (reconnectBackoffTimers.current.has(userId)) return; // déjà programmé

    const attempts = iceRestartAttemptsRef.current.get(userId) ?? 0;
    const cs = callStateRef.current;
    if (attempts >= ICE_RESTART_MAX_ATTEMPTS || !localStreamRef.current || !cs) {
      clearPeerReconnectTimers(userId);
      setPeerConnectionState(userId, undefined);
      closePeer(userId);
      return;
    }

    setPeerConnectionState(userId, 'reconnecting');
    const backoffMs = ICE_RESTART_BACKOFF_MS[Math.min(attempts, ICE_RESTART_BACKOFF_MS.length - 1)];
    const timer = setTimeout(async () => {
      reconnectBackoffTimers.current.delete(userId);
      if (pcMapRef.current.get(userId) !== pc || pc.connectionState === 'connected' || pc.connectionState === 'closed') return;

      iceRestartAttemptsRef.current.set(userId, attempts + 1);
      console.warn(`[GroupCall] connexion ICE échouée avec ${userId} — tentative de reprise ${attempts + 1}/${ICE_RESTART_MAX_ATTEMPTS}`);
      try {
        /* Rafraîchit les serveurs ICE (ignore le cache) avant de relancer —
           voir le commentaire équivalent dans useAudioCall.ts (partie 6) :
           un mesh de groupe peut durer bien plus longtemps que le cache
           30 min, et chaque PeerConnection garde pour toujours les
           serveurs fournis à sa construction. */
        try {
          const freshIceServers = await getFreshIceServers();
          pc.setConfiguration({ iceServers: freshIceServers });
        } catch (e) {
          console.warn(`[GroupCall] Rafraîchissement des serveurs ICE échoué avant reprise avec ${userId} — on continue avec les serveurs déjà en place :`, e);
        }

        await attachLocalTracks(pc, localStreamRef.current!);
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        emit('group_call:offer', {
          groupId:      cs.groupId,
          callId:       cs.callId,
          targetUserId: userId,
          sdp:          offer,
        });
      } catch (e) {
        console.error(`[GroupCall] Échec de la reprise ICE avec ${userId} :`, e);
        clearPeerReconnectTimers(userId);
        setPeerConnectionState(userId, undefined);
        closePeer(userId);
      }
    }, backoffMs);
    reconnectBackoffTimers.current.set(userId, timer);
  }, [closePeer, attachLocalTracks, setPeerConnectionState]);

  /**
   * Point d'entrée commun à 'disconnected' et 'failed' pour un pair du
   * mesh — arme (une seule fois) le délai maximal de reprise pour CE pair
   * précis, puis délègue à attemptIceRestart. Les autres connexions du
   * mesh ne sont jamais touchées.
   */
  const handlePeerDisruption = useCallback((pc: RTCPeerConnection, userId: string) => {
    if (!reconnectDeadlineTimers.current.has(userId)) {
      setPeerConnectionState(userId, 'unstable');
      const deadline = setTimeout(() => {
        clearPeerReconnectTimers(userId);
        setPeerConnectionState(userId, undefined);
        closePeer(userId);
      }, PEER_RECONNECT_TIMEOUT_MS);
      reconnectDeadlineTimers.current.set(userId, deadline);
    }
    attemptIceRestart(pc, userId);
  }, [attemptIceRestart, closePeer, setPeerConnectionState]);

  // ── Création RTCPeerConnection ────────────────────────────────

  const createPeerConnection = useCallback((
    userId: string,
    displayName: string,
    iceServers: RTCIceServer[],
  ): RTCPeerConnection => {
    const existing = pcMapRef.current.get(userId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate || !callStateRef.current) return;
      emit('group_call:ice_candidate', {
        groupId:      callStateRef.current.groupId,
        callId:       callStateRef.current.callId,
        targetUserId: userId,
        candidate:    candidate.toJSON(),
      });
    };

    pc.ontrack = ({ streams }) => {
      const stream = streams[0] ?? new MediaStream([streams[0]?.getTracks()[0] ?? pc.getReceivers()[0]?.track].filter(Boolean));
      updatePeers(prev => {
        const peer = prev.get(userId) ?? {
          userId, displayName, stream: null, audioEnabled: true, videoEnabled: true,
        };
        prev.set(userId, { ...peer, stream });
        return prev;
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setCallState(s => s ? { ...s, status: 'connected' } : s);
        iceRestartAttemptsRef.current.set(userId, 0);
        clearPeerReconnectTimers(userId);
        setPeerConnectionState(userId, undefined);
      } else if (state === 'failed' || state === 'disconnected') {
        handlePeerDisruption(pc, userId);
      } else if (state === 'closed') {
        clearPeerReconnectTimers(userId);
        closePeer(userId);
      }
    };

    /* Ajouter entrée dans peers map si absent */
    updatePeers(prev => {
      if (!prev.has(userId)) {
        prev.set(userId, { userId, displayName, stream: null, audioEnabled: true, videoEnabled: true });
      }
      return prev;
    });

    watchIceConnectivity(pc, `group:${userId}`);
    pcMapRef.current.set(userId, pc);
    icePendingRef.current.set(userId, []);
    iceRestartAttemptsRef.current.set(userId, 0);
    return pc;
  }, [updatePeers, closePeer, handlePeerDisruption, setPeerConnectionState]);

  // ── Handlers événements socket ────────────────────────────────

  const onIncoming = useCallback((payload: GroupCallInvite) => {
    /* Ignorer si on est déjà dans un appel groupe */
    if (callStateRef.current) return;
    setIncomingCall(payload);
  }, []);

  /** Reçu par nous après group_call:join — liste des participants déjà présents. */
  const onJoined = useCallback(async (payload: JoinedPayload) => {
    const cs: GroupCallState = {
      callId:   payload.callId,
      groupId:  payload.groupId,
      callType: payload.callType,
      status:   'joining',
    };
    callStateRef.current = cs;
    setCallState(cs);
    setIncomingCall(null);

    /* Les participants déjà présents nous enverront des offers — on attend. */
    const iceServers = await getIceServers();
    for (const p of payload.participants) {
      createPeerConnection(p.userId, p.displayName, iceServers);
    }
  }, [createPeerConnection]);

  /** Reçu par les participants existants quand quelqu'un de nouveau rejoint. */
  const onParticipantJoined = useCallback(async (payload: ParticipantJoinedPayload) => {
    const cs = callStateRef.current;
    if (!cs || cs.callId !== payload.callId) return;
    if (!localStreamRef.current) return;

    const iceServers = await getIceServers();
    const pc = createPeerConnection(payload.userId, payload.displayName, iceServers);
    await attachLocalTracks(pc, localStreamRef.current);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    emit('group_call:offer', {
      groupId:      cs.groupId,
      callId:       cs.callId,
      targetUserId: payload.userId,
      sdp:          offer,
    });
  }, [createPeerConnection, attachLocalTracks]);

  const onParticipantLeft = useCallback((payload: ParticipantLeftPayload) => {
    const cs = callStateRef.current;
    if (!cs || cs.callId !== payload.callId) return;
    closePeer(payload.userId);
  }, [closePeer]);

  const onDeclined = useCallback((payload: { callId: string; userId: string }) => {
    const cs = callStateRef.current;
    if (!cs || cs.callId !== payload.callId) return;
    closePeer(payload.userId);
  }, [closePeer]);

  const onCallEnded = useCallback(() => {
    setIncomingCall(null);
    cleanupAll();
  }, [cleanupAll]);

  /**
   * Erreur de groupe — seul CALL_NOT_FOUND nous intéresse ici : signifie
   * que le serveur n'a plus trace de l'appel qu'on croit encore actif
   * (le plus souvent après resync post-reconnexion, voir
   * onSocketReconnected ci-dessous — le ping-timeout Socket.IO a dépassé
   * la durée de la coupure et GroupCallGateway.handleDisconnect nous a
   * déjà retiré de l'appel PENDANT qu'on était injoignable).
   */
  const onGroupCallError = useCallback((payload: { code: string; message: string }) => {
    if (payload.code === 'CALL_NOT_FOUND' && callStateRef.current) {
      console.warn('[GroupCall] Reconnexion Socket.IO — appel introuvable côté serveur, fermeture locale.');
      cleanupAll();
      return;
    }
    /* Tous les autres codes (NOT_MEMBER/GROUP_INACTIVE/CALL_ALREADY_ACTIVE/
       RATE_LIMITED/ACCOUNT_DISABLED…) restaient jusqu'ici silencieux côté
       client — le serveur fournit déjà un message clair en français
       (payload.message), on le relaie simplement au lieu de le perdre. */
    reportCallError(callError('unknown', payload.message));
  }, [cleanupAll, reportCallError]);

  /**
   * Le socket /messaging s'est (re)connecté — si un appel de groupe est en
   * cours, on re-signale notre présence. handleJoin (serveur) est
   * idempotent pour un participant déjà présent (aucun doublon créé) ; si
   * le serveur a déjà terminé l'appel pendant la coupure, il répond
   * group_call:error CALL_NOT_FOUND (voir onGroupCallError) plutôt que de
   * nous laisser croire à tort que l'appel est toujours actif. Le
   * signaling par-pair (offer/answer/ice) éventuellement bufferisé par
   * socket.io-client pendant la coupure est réémis automatiquement.
   */
  const onSocketReconnected = useCallback(() => {
    const cs = callStateRef.current;
    if (!cs) return;
    emit('group_call:join', { groupId: cs.groupId, callId: cs.callId });
  }, []);

  const onOffer = useCallback(async (payload: SignalPayload) => {
    const cs = callStateRef.current;
    if (!cs || cs.callId !== payload.callId) return;
    if (!localStreamRef.current) return;

    const pc = pcMapRef.current.get(payload.fromUserId);
    if (!pc) return;

    await attachLocalTracks(pc, localStreamRef.current);
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp!));
    await flushIcePending(payload.fromUserId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    emit('group_call:answer', {
      groupId:      cs.groupId,
      callId:       cs.callId,
      targetUserId: payload.fromUserId,
      sdp:          answer,
    });
  }, [flushIcePending, attachLocalTracks]);

  const onAnswer = useCallback(async (payload: SignalPayload) => {
    const pc = pcMapRef.current.get(payload.fromUserId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp!));
    await flushIcePending(payload.fromUserId);
  }, [flushIcePending]);

  const onIceCandidate = useCallback(async (payload: SignalPayload) => {
    if (!payload.candidate) return;
    const pc = pcMapRef.current.get(payload.fromUserId);
    if (pc?.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
    } else {
      const q = icePendingRef.current.get(payload.fromUserId) ?? [];
      q.push(payload.candidate);
      icePendingRef.current.set(payload.fromUserId, q);
    }
  }, []);

  const onMediaToggled = useCallback((payload: MediaToggledPayload) => {
    updatePeers(prev => {
      const p = prev.get(payload.userId);
      if (!p) return prev;
      prev.set(payload.userId, {
        ...p,
        audioEnabled: payload.audioEnabled ?? p.audioEnabled,
        videoEnabled: payload.videoEnabled ?? p.videoEnabled,
      });
      return prev;
    });
  }, [updatePeers]);

  // ── Écoute socket ─────────────────────────────────────────────

  /*
   * Compte banni/suspendu PENDANT un appel de groupe — émis par
   * BroadcastService.disconnectUser() juste avant de forcer la
   * déconnexion. Le serveur retire déjà ce participant de l'appel côté
   * GroupCallGateway (handleDisconnect, inconditionnel) et notifie les
   * AUTRES participants via group_call:participant_left — mais CE socket
   * étant sur le point de mourir, il ne recevra jamais cet événement lui-
   * même. Sans ce listener, ses RTCPeerConnection/pistes locales
   * restaient ouvertes côté client jusqu'à la mort silencieuse du socket.
   * cleanupAll() ne notifie pas le serveur (inutile, le retrait est déjà
   * fait) — juste le nettoyage local.
   */
  const onAccountStatusChanged = useCallback(() => {
    cleanupAll();
  }, [cleanupAll]);

  useEffect(() => {
    function register(socket: ReturnType<typeof getActiveSocket>) {
      if (!socket) return;
      socket.off('group_call:incoming',            onIncoming);
      socket.off('group_call:joined',              onJoined);
      socket.off('group_call:participant_joined',  onParticipantJoined);
      socket.off('group_call:participant_left',    onParticipantLeft);
      socket.off('group_call:participant_declined',onDeclined);
      socket.off('group_call:ended',               onCallEnded);
      socket.off('group_call:offer',               onOffer);
      socket.off('group_call:answer',              onAnswer);
      socket.off('group_call:ice_candidate',       onIceCandidate);
      socket.off('group_call:media_toggled',       onMediaToggled);
      socket.off('account_status_changed',         onAccountStatusChanged);
      socket.off('group_call:error',               onGroupCallError);
      socket.off('connect',                        onSocketReconnected);

      socket.on('group_call:incoming',            onIncoming);
      socket.on('group_call:joined',              onJoined);
      socket.on('group_call:participant_joined',  onParticipantJoined);
      socket.on('group_call:participant_left',    onParticipantLeft);
      socket.on('group_call:participant_declined',onDeclined);
      socket.on('group_call:ended',               onCallEnded);
      socket.on('group_call:offer',               onOffer);
      socket.on('group_call:answer',              onAnswer);
      socket.on('group_call:ice_candidate',       onIceCandidate);
      socket.on('group_call:media_toggled',       onMediaToggled);
      socket.on('account_status_changed',         onAccountStatusChanged);
      socket.on('group_call:error',               onGroupCallError);
      /* 'connect' se déclenche pour la 1ère connexion ET chaque reconnexion —
         onSocketReconnected s'auto-limite au cas où un appel est en cours. */
      socket.on('connect',                        onSocketReconnected);
    }

    const socket = getActiveSocket();
    register(socket);

    /* Retry jusqu'à 60 s (120 × 500 ms) pour couvrir le cas où
     * le socket est créé APRÈS le montage (login SPA sans rechargement). */
    let retries = 0;
    const retryId = setInterval(() => {
      const s = getActiveSocket();
      if (s) { register(s); clearInterval(retryId); }
      if (++retries >= 120) clearInterval(retryId);
    }, 500);

    return () => {
      clearInterval(retryId);
      const s = getActiveSocket();
      if (!s) return;
      s.off('group_call:incoming',            onIncoming);
      s.off('group_call:joined',              onJoined);
      s.off('group_call:participant_joined',  onParticipantJoined);
      s.off('group_call:participant_left',    onParticipantLeft);
      s.off('group_call:participant_declined',onDeclined);
      s.off('group_call:ended',               onCallEnded);
      s.off('group_call:offer',               onOffer);
      s.off('group_call:answer',              onAnswer);
      s.off('group_call:ice_candidate',       onIceCandidate);
      s.off('group_call:media_toggled',       onMediaToggled);
      s.off('account_status_changed',         onAccountStatusChanged);
      s.off('group_call:error',               onGroupCallError);
      s.off('connect',                        onSocketReconnected);
    };
  }, [
    onIncoming, onJoined, onParticipantJoined, onParticipantLeft,
    onDeclined, onCallEnded, onOffer, onAnswer, onIceCandidate, onMediaToggled,
    onAccountStatusChanged, onGroupCallError, onSocketReconnected,
  ]);

  // ── API publique ──────────────────────────────────────────────

  /**
   * Lance un appel dans le groupe.
   *
   * PARTIE 9.5 — signaling D'ABORD, acquisition média EN PARALLÈLE :
   * group_call:initiate ne dépend d'aucune donnée média — les autres
   * membres doivent être notifiés ("appel entrant") dès que possible,
   * sans attendre que l'initiateur ait fini d'acquérir son propre flux.
   * Si l'acquisition échoue APRÈS l'émission, l'appel existe déjà côté
   * serveur : on le quitte proprement dès que son callId est connu
   * (callStateRef, posé par onJoined juste après group_call:joined). Si
   * onJoined n'a pas encore eu le temps de s'exécuter, la sonnerie 30s
   * côté serveur (GroupCallGateway) nettoie de toute façon l'appel si
   * personne d'autre ne rejoint jamais — aucun appel fantôme durable.
   */
  const initiateCall = useCallback(async (groupId: string, callType: 'audio' | 'video') => {
    if (callStateRef.current) return;
    emit('group_call:initiate', { groupId, callType });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      attachLocalTrackEndedHandlers(stream);
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (err) {
      reportMediaError(err, callType === 'video');
      /* Cast nécessaire : TS étroit callStateRef.current à `null` après le
         garde précoce `if (callStateRef.current) return;` en tête de cette
         fonction, et ne réévalue pas ce type au-delà d'un `await` — alors
         qu'onJoined (un AUTRE handler) a très bien pu le réassigner entre
         temps (c'est précisément le cas qu'on veut détecter ici). */
      const cs = callStateRef.current as GroupCallState | null;
      if (cs) {
        emit('group_call:leave', { groupId: cs.groupId, callId: cs.callId });
        cleanupAll();
      }
    }
  }, [reportMediaError, cleanupAll]);

  /**
   * Rejoint l'appel entrant (après réception de group_call:incoming).
   *
   * PARTIE 9.5 — même principe qu'initiateCall : group_call:join part
   * immédiatement (groupId/callId déjà connus depuis l'invitation reçue),
   * l'acquisition média suit. Échec après coup → on quitte proprement
   * (callId déjà connu ici, pas de fenêtre d'incertitude comme pour
   * initiateCall).
   */
  const joinCall = useCallback(async (invite: GroupCallInvite) => {
    if (callStateRef.current) return;
    emit('group_call:join', { groupId: invite.groupId, callId: invite.callId });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: invite.callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      attachLocalTrackEndedHandlers(stream);
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (err) {
      reportMediaError(err, invite.callType === 'video');
      emit('group_call:leave', { groupId: invite.groupId, callId: invite.callId });
      cleanupAll();
    }
  }, [reportMediaError, cleanupAll]);

  /** Décline l'appel entrant sans rejoindre. */
  const declineCall = useCallback((invite: GroupCallInvite) => {
    emit('group_call:decline', { groupId: invite.groupId, callId: invite.callId });
    setIncomingCall(null);
  }, []);

  /** Quitte l'appel en cours. */
  const leaveCall = useCallback(() => {
    const cs = callStateRef.current;
    if (cs) emit('group_call:leave', { groupId: cs.groupId, callId: cs.callId });
    cleanupAll();
  }, [cleanupAll]);

  /** Active / coupe le micro. */
  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    const next = !isMuted;
    setIsMuted(next);
    const cs = callStateRef.current;
    if (cs) emit('group_call:toggle_media', { groupId: cs.groupId, callId: cs.callId, audioEnabled: !next });
  }, [isMuted]);

  /** Active / coupe la caméra. */
  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    const next = !isVideoOff;
    setIsVideoOff(next);
    const cs = callStateRef.current;
    if (cs) emit('group_call:toggle_media', { groupId: cs.groupId, callId: cs.callId, videoEnabled: !next });
  }, [isVideoOff]);

  /**
   * Bascule caméra avant/arrière (mobile) — remplace la piste vidéo envoyée
   * à CHAQUE pair du mesh sans renégocier (replaceTrack), contrairement au
   * 1:1 où il n'y a qu'une seule PeerConnection à mettre à jour.
   */
  const flipCamera = useCallback(async () => {
    /* Sans effet pendant un partage d'écran : chaque sender vidéo du mesh
       porte alors la piste écran, pas la caméra — la remplacer casserait
       le partage sans jamais mettre à jour isScreenSharing. */
    if (!localStreamRef.current || screenStreamRef.current) return;
    facingModeRef.current = facingModeRef.current === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facingModeRef.current },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      for (const [userId, pc] of pcMapRef.current.entries()) {
        const sender = getVideoSender(userId, pc);
        if (sender) {
          try { await sender.replaceTrack(newTrack); } catch { /* best-effort */ }
        }
      }

      localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current?.removeTrack(t); });
      localStreamRef.current.addTrack(newTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch (err) {
      facingModeRef.current = facingModeRef.current === 'user' ? 'environment' : 'user';
      const { reason, message } = describeMediaError(err, 'la caméra arrière');
      console.warn('[GroupCall] flipCamera a échoué :', message, err);
      reportCallError(reason === 'not-allowed' ? callError('camera-permission-denied')
        : reason === 'not-readable' ? callError('device-busy')
        : callError('unknown', message));
    }
  }, [reportCallError]);

  /** Arrête le partage d'écran et restaure la caméra sur chaque pair du mesh. */
  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach(t => { t.onended = null; t.stop(); });
    screenStreamRef.current = null;
    setIsScreenSharing(false);

    for (const [userId, pc] of pcMapRef.current.entries()) {
      const sender = getVideoSender(userId, pc);
      if (sender) {
        try { await sender.replaceTrack(cameraTrackRef.current); } catch { /* best-effort pour ce pair */ }
      }
    }
    cameraTrackRef.current = null;
  }, []);

  /**
   * Démarre le partage d'écran — remplace la piste vidéo de CHAQUE
   * PeerConnection du mesh (jamais de PeerConnection supplémentaire). Pour
   * un pair dont l'appel était audio uniquement (aucun sender vidéo
   * existant), ajoute une piste et renégocie avec CE pair précisément —
   * onOffer côté groupe réutilise déjà la pc existante (pas de recréation),
   * donc cette renégociation est sûre.
   */
  const startScreenShare = useCallback(async () => {
    const cs = callStateRef.current;
    if (!cs || screenStreamRef.current) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;

      for (const [userId, pc] of pcMapRef.current.entries()) {
        const sender = getVideoSender(userId, pc);
        if (sender) {
          if (!cameraTrackRef.current) cameraTrackRef.current = sender.track;
          try { await sender.replaceTrack(screenTrack); } catch { /* best-effort pour ce pair */ }
        } else {
          try {
            const newSender = pc.addTrack(screenTrack, display);
            videoSendersRef.current.set(userId, newSender);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            emit('group_call:offer', { groupId: cs.groupId, callId: cs.callId, targetUserId: userId, sdp: offer });
          } catch { /* best-effort pour ce pair — les autres continuent */ }
        }
      }

      screenStreamRef.current = display;
      /* Arrêt depuis le contrôle natif du navigateur — un seul listener sur
         la piste suffit pour arrêter le partage envoyé à TOUS les pairs. */
      screenTrack.onended = () => { void stopScreenShare(); };
      setIsScreenSharing(true);
    } catch (err) {
      const { message, reason } = describeMediaError(err, "le partage d'écran");
      if (reason !== 'aborted') reportCallError(callError('unknown', message));
    }
  }, [stopScreenShare, reportCallError]);

  /** Bascule marche/arrêt — pratique pour un bouton unique dans l'UI. */
  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) await stopScreenShare();
    else await startScreenShare();
  }, [startScreenShare, stopScreenShare]);

  /* Best-effort : quitte proprement l'appel si l'utilisateur ferme
   * l'onglet/le navigateur — libère micro/caméra et prévient les autres
   * participants immédiatement plutôt que d'attendre le ping-timeout. */
  useEffect(() => {
    const handler = () => {
      if (callStateRef.current) {
        try { leaveCall(); } catch { /* best-effort */ }
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [leaveCall]);

  return {
    /** Invitation d'appel entrant (null si aucune) */
    incomingCall,
    /** Appel en cours (null si idle) */
    callState,
    /** Map userId → état du pair (stream + media flags) */
    peers,
    /** Stream local de l'utilisateur courant */
    localStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    canFlipCamera,  // false = un seul périphérique vidéo détecté
    canShareScreen, // false = navigateur sans support getDisplayMedia
    initiateCall,
    joinCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    flipCamera,
    toggleScreenShare,
  };
}

export type UseGroupCallReturn = ReturnType<typeof useGroupCall>;
