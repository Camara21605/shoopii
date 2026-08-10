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
import { getIceServers, prefetchIceServers }         from './iceServers';
import type { GroupCallInvite, GroupCallPeer, GroupCallState } from '../data/messagerieTypes';

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

// ── Hook ──────────────────────────────────────────────────────

export function useGroupCall() {
  const [incomingCall, setIncomingCall] = useState<GroupCallInvite | null>(null);
  const [callState,    setCallState]    = useState<GroupCallState   | null>(null);
  const [peers,        setPeers]        = useState<Map<string, GroupCallPeer>>(new Map());
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isVideoOff,   setIsVideoOff]   = useState(false);

  // Refs internes (pas de re-render)
  const callStateRef   = useRef<GroupCallState | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  /** userId → RTCPeerConnection */
  const pcMapRef       = useRef<Map<string, RTCPeerConnection>>(new Map());
  /** userId → ICE candidates reçus avant setRemoteDescription */
  const icePendingRef  = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  /** Mirror de peers pour éviter la stale-closure dans les callbacks socket */
  const peersRef       = useRef<Map<string, GroupCallPeer>>(new Map());
  /** userId → nombre de tentatives d'ICE-restart déjà faites pour ce pair */
  const iceRestartAttemptsRef = useRef<Map<string, number>>(new Map());
  /** Sens de la caméra courante (mobile) — partagé par tous les pairs du mesh */
  const facingModeRef = useRef<'user' | 'environment'>('user');

  /* Préchauffe le cache des serveurs ICE dès le montage. */
  useEffect(() => { prefetchIceServers(); }, []);

  // ── Helpers ───────────────────────────────────────────────────

  function emit(event: string, data: object) {
    getActiveSocket()?.emit(event, data);
  }

  const updatePeers = useCallback((fn: (prev: Map<string, GroupCallPeer>) => Map<string, GroupCallPeer>) => {
    const next = fn(new Map(peersRef.current));
    peersRef.current = next;
    setPeers(new Map(next));
  }, []);

  /** Ferme et supprime le PeerConnection d'un pair. */
  const closePeer = useCallback((userId: string) => {
    pcMapRef.current.get(userId)?.close();
    pcMapRef.current.delete(userId);
    icePendingRef.current.delete(userId);
    updatePeers(prev => { prev.delete(userId); return prev; });
  }, [updatePeers]);

  /** Libère toutes les ressources (local stream + toutes les PCs). */
  const cleanupAll = useCallback(() => {
    for (const [uid] of pcMapRef.current) closePeer(uid);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setIsMuted(false);
    setIsVideoOff(false);
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
   * connexion du mesh, pas tout l'appel. Limité à 2 tentatives par pair.
   */
  const attemptIceRestart = useCallback(async (pc: RTCPeerConnection, userId: string) => {
    try {
      const attempts = iceRestartAttemptsRef.current.get(userId) ?? 0;
      const cs = callStateRef.current;
      if (attempts >= 2 || !localStreamRef.current || !cs) {
        closePeer(userId);
        return;
      }
      iceRestartAttemptsRef.current.set(userId, attempts + 1);
      console.warn(`[GroupCall] connexion ICE échouée avec ${userId} — tentative de reprise ${attempts + 1}/2`);

      await attachLocalTracks(pc, localStreamRef.current);
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
      closePeer(userId);
    }
  }, [closePeer, attachLocalTracks]);

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
      if (pc.connectionState === 'connected') {
        setCallState(s => s ? { ...s, status: 'connected' } : s);
        iceRestartAttemptsRef.current.set(userId, 0);
      } else if (pc.connectionState === 'failed') {
        void attemptIceRestart(pc, userId);
      } else if (pc.connectionState === 'closed') {
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

    pcMapRef.current.set(userId, pc);
    icePendingRef.current.set(userId, []);
    iceRestartAttemptsRef.current.set(userId, 0);
    return pc;
  }, [updatePeers, closePeer, attemptIceRestart]);

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
    };
  }, [
    onIncoming, onJoined, onParticipantJoined, onParticipantLeft,
    onDeclined, onCallEnded, onOffer, onAnswer, onIceCandidate, onMediaToggled,
    onAccountStatusChanged,
  ]);

  // ── API publique ──────────────────────────────────────────────

  /** Lance un appel dans le groupe. */
  const initiateCall = useCallback(async (groupId: string, callType: 'audio' | 'video') => {
    if (callStateRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      emit('group_call:initiate', { groupId, callType });
    } catch {
      alert(callType === 'video' ? 'Accès à la caméra ou au micro refusé.' : 'Accès au micro refusé.');
    }
  }, []);

  /** Rejoint l'appel entrant (après réception de group_call:incoming). */
  const joinCall = useCallback(async (invite: GroupCallInvite) => {
    if (callStateRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: invite.callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      emit('group_call:join', { groupId: invite.groupId, callId: invite.callId });
    } catch {
      alert('Accès au micro refusé.');
    }
  }, []);

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
    if (!localStreamRef.current) return;
    facingModeRef.current = facingModeRef.current === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facingModeRef.current },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      for (const pc of pcMapRef.current.values()) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          try { await sender.replaceTrack(newTrack); } catch { /* best-effort */ }
        }
      }

      localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current?.removeTrack(t); });
      localStreamRef.current.addTrack(newTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch { /* silencieux si l'appareil n'a pas de caméra arrière */ }
  }, []);

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
    initiateCall,
    joinCall,
    declineCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    flipCamera,
  };
}

export type UseGroupCallReturn = ReturnType<typeof useGroupCall>;
