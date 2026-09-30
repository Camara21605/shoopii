/**
 * src/features/calls/call-store.ts
 *
 * Moteur d'appel audio/vidéo 1:1 (WebRTC natif, react-native-webrtc) + état
 * réactif (zustand — même pattern que session-store.ts) consommé par
 * CallProvider.tsx (l'overlay plein écran) et par n'importe quel écran qui
 * veut démarrer un appel (messages/[id].tsx).
 *
 * SIGNALING — exactement le même contrat que le site (call.gateway.ts),
 * sur le même socket /messaging déjà connecté pour toute la session
 * (voir lib/realtime/socket.ts) :
 *   Appelant → call:initiate → Appelé reçoit call:incoming
 *   Appelé   → call:accept   → Appelant reçoit call:accepted
 *   Appelant crée l'offre SDP → call:offer → Appelé
 *   Appelé   crée la réponse  → call:answer → Appelant
 *   Candidats ICE échangés des deux côtés → call:ice-candidate
 *   Raccrocher → call:end → l'autre reçoit call:ended
 *
 * Les objets natifs (RTCPeerConnection, MediaStream, timers) vivent en
 * variables de module — PAS dans le store zustand (non sérialisables, et
 * un composant n'a jamais besoin d'en être notifié directement) — seul
 * l'état dérivé utile à l'affichage (statut, urls de flux pour RTCView,
 * muet/haut-parleur/caméra, durée) est publié dans le store.
 */
import { create } from 'zustand';
import {
  mediaDevices,
  registerGlobals,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';

import { useSession } from '@/features/auth/session-store';
import { getSocket } from '@/lib/realtime/socket';
import { getIceServers, type RTCIceServerInit } from './api';

registerGlobals();

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'reconnecting' | 'ended';

export interface CallInfo {
  conversationId: string;
  remoteUserId: string;
  remoteName: string;
  remoteAvatar?: string | null;
  direction: 'outgoing' | 'incoming';
  callType: 'audio' | 'video';
}

interface CallState {
  status: CallStatus;
  callInfo: CallInfo | null;
  localStreamURL: string | null;
  remoteStreamURL: string | null;
  muted: boolean;
  speakerOn: boolean;
  videoEnabled: boolean;
  durationSec: number;
  errorMessage: string | null;
}

const initialState: CallState = {
  status: 'idle',
  callInfo: null,
  localStreamURL: null,
  remoteStreamURL: null,
  muted: false,
  speakerOn: false,
  videoEnabled: true,
  durationSec: 0,
  errorMessage: null,
};

export const useCallStore = create<CallState>(() => ({ ...initialState }));

// ── Objets natifs & timers (hors du store — voir en-tête) ────────────────

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let pendingCandidates: RTCIceCandidate[] = []; // reçus avant setRemoteDescription
let mediaReadyPromise: Promise<boolean> | null = null;
let ringTimeout: ReturnType<typeof setTimeout> | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;
let callSeq = 0; // incrémenté à chaque reset() — ignore les callbacks d'un appel déjà abandonné
let listenersAttached = false;

function emit(event: string, payload: object) {
  getSocket()?.emit(event, payload);
}

function patch(p: Partial<CallState>) {
  useCallStore.setState(p);
}

/** Remise à zéro complète — appelée à la fin de TOUT appel, quel qu'en soit le motif. */
function reset() {
  callSeq++;
  if (ringTimeout) clearTimeout(ringTimeout);
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  if (durationTimer) clearInterval(durationTimer);
  ringTimeout = keepaliveTimer = durationTimer = null;

  try { pc?.close(); } catch { /* déjà fermé */ }
  pc = null;

  localStream?.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
  localStream = null;
  pendingCandidates = [];
  mediaReadyPromise = null;

  try { InCallManager.stop(); } catch { /* module natif indisponible (dev client pas encore rebuild) */ }

  useCallStore.setState({ ...initialState });
}

/** Termine proprement l'appel EN COURS et prévient l'autre participant (sauf s'il a raccroché le premier). */
function endCall(notifyRemote: boolean) {
  const info = useCallStore.getState().callInfo;
  if (notifyRemote && info) {
    emit('call:end', { conversationId: info.conversationId, targetUserId: info.remoteUserId });
  }
  reset();
}

// ── Acquisition média ──────────────────────────────────────────────────

async function acquireMedia(isVideo: boolean, seq: number): Promise<boolean> {
  try {
    const stream = (await mediaDevices.getUserMedia({
      audio: true,
      video: isVideo ? { facingMode: 'user' } : false,
    })) as unknown as MediaStream;
    if (seq !== callSeq) {
      stream.getTracks().forEach(t => t.stop());
      return false;
    }
    localStream = stream;
    patch({ localStreamURL: stream.toURL(), videoEnabled: isVideo });
    return true;
  } catch (err) {
    console.error('[Call] getUserMedia a échoué :', err);
    if (seq === callSeq) patch({ errorMessage: "Impossible d'accéder au micro/caméra." });
    return false;
  }
}

// ── RTCPeerConnection ──────────────────────────────────────────────────

function createPeerConnection(iceServers: RTCIceServerInit[], info: CallInfo, seq: number): RTCPeerConnection {
  const conn = new RTCPeerConnection({ iceServers: iceServers as any });

  localStream?.getTracks().forEach(track => conn.addTrack(track, localStream as MediaStream));

  /* .on<event> = ... plutôt que addEventListener — même API que côté web
   * (useAudioCall.ts), et le typage généré pour cette classe (EventTarget
   * générique du shim) ne déclare addEventListener nulle part d'utilisable
   * alors que les propriétés on<event> le sont explicitement. */
  conn.onicecandidate = ((e: any) => {
    if (!e.candidate) return;
    emit('call:ice-candidate', {
      conversationId: info.conversationId,
      targetUserId:   info.remoteUserId,
      candidate:      e.candidate.toJSON ? e.candidate.toJSON() : e.candidate,
    });
  }) as any;

  conn.ontrack = ((e: any) => {
    if (seq !== callSeq) return;
    const stream = e.streams?.[0] as MediaStream | undefined;
    if (!stream) return;
    patch({ remoteStreamURL: stream.toURL() });
  }) as any;

  conn.onconnectionstatechange = (() => {
    if (seq !== callSeq) return;
    const state = conn.connectionState;
    if (state === 'connected') {
      if (useCallStore.getState().status !== 'connected') startDurationTimer();
      patch({ status: 'connected', errorMessage: null });
    } else if (state === 'disconnected') {
      patch({ status: 'reconnecting' });
    } else if (state === 'failed') {
      /* Reprise simple : une seule tentative d'ICE restart — si ça échoue aussi,
       * on raccroche proprement plutôt que de laisser l'appel bloqué en silence. */
      try {
        conn.restartIce();
      } catch {
        endCall(true);
      }
    }
  }) as any;

  return conn;
}

function startDurationTimer() {
  const start = Date.now();
  if (durationTimer) clearInterval(durationTimer);
  durationTimer = setInterval(() => {
    patch({ durationSec: Math.floor((Date.now() - start) / 1000) });
  }, 1000);
}

function startKeepalive(info: CallInfo) {
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  keepaliveTimer = setInterval(() => {
    emit('call:keepalive', { conversationId: info.conversationId, targetUserId: info.remoteUserId });
  }, 10_000);
}

async function flushPendingCandidates(seq: number) {
  if (!pc || seq !== callSeq) return;
  for (const c of pendingCandidates) {
    try { await pc.addIceCandidate(c); } catch { /* candidat périmé — sans conséquence */ }
  }
  pendingCandidates = [];
}

// ── API publique — démarrer / répondre / refuser / raccrocher ──────────

export async function startCall(
  conversationId: string,
  calleeUserId: string,
  calleeName: string,
  calleeAvatar: string | null | undefined,
  callType: 'audio' | 'video',
): Promise<void> {
  if (useCallStore.getState().status !== 'idle') return; // déjà en appel
  const seq = ++callSeq;
  const info: CallInfo = { conversationId, remoteUserId: calleeUserId, remoteName: calleeName, remoteAvatar: calleeAvatar, direction: 'outgoing', callType };
  patch({ status: 'calling', callInfo: info, muted: false, speakerOn: callType === 'video', videoEnabled: callType === 'video', durationSec: 0, errorMessage: null });

  try { InCallManager.start({ media: callType, auto: true }); } catch { /* module natif indisponible */ }

  const user = useSession.getState().user;
  const callerName = user ? `${user.firstName} ${user.lastName}`.trim() || user.username : 'Utilisateur';

  mediaReadyPromise = acquireMedia(callType === 'video', seq);

  emit('call:initiate', { conversationId, calleeUserId, callerName, callType });

  ringTimeout = setTimeout(() => {
    if (seq !== callSeq) return;
    patch({ status: 'ended', errorMessage: 'Pas de réponse.' });
    endCall(true);
  }, 30_000);

  const ok = await mediaReadyPromise;
  if (!ok && seq === callSeq) endCall(true);
}

/** Appelé par le socket quand l'appelé a accepté (côté appelant) — crée l'offre. */
async function onCallAccepted(seq: number) {
  const info = useCallStore.getState().callInfo;
  if (!info || seq !== callSeq) return;
  if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
  patch({ status: 'connecting' });
  startKeepalive(info);

  const ready = await mediaReadyPromise;
  if (!ready || seq !== callSeq) return;

  const iceServers = await getIceServers();
  if (seq !== callSeq) return;
  pc = createPeerConnection(iceServers, info, seq);

  try {
    const offer = await pc.createOffer({});
    if (seq !== callSeq) return;
    await pc.setLocalDescription(offer);
    emit('call:offer', { conversationId: info.conversationId, targetUserId: info.remoteUserId, sdp: { type: offer.type, sdp: offer.sdp } });
  } catch (err) {
    console.error('[Call] createOffer a échoué :', err);
    endCall(true);
  }
}

export async function acceptCall(): Promise<void> {
  const info = useCallStore.getState().callInfo;
  if (!info || info.direction !== 'incoming') return;
  const seq = callSeq; // pas de nouvel appel — on continue celui déjà en cours (ringing)

  if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
  patch({ status: 'connecting', speakerOn: info.callType === 'video', videoEnabled: info.callType === 'video' });
  try { InCallManager.start({ media: info.callType, auto: true }); } catch { /* ignore */ }

  emit('call:accept', { conversationId: info.conversationId, callerUserId: info.remoteUserId });
  startKeepalive(info);

  mediaReadyPromise = acquireMedia(info.callType === 'video', seq);
  const ready = await mediaReadyPromise;
  if (!ready || seq !== callSeq) { if (seq === callSeq) endCall(true); return; }

  // L'offre de l'appelant peut être arrivée pendant l'acquisition du micro — onCallOffer() la gère aussi.
}

export function rejectCall(): void {
  const info = useCallStore.getState().callInfo;
  if (info) emit('call:reject', { conversationId: info.conversationId, callerUserId: info.remoteUserId });
  reset();
}

export function hangUp(): void {
  endCall(true);
}

// ── Contrôles en appel ───────────────────────────────────────────────────

export function toggleMute(): void {
  const next = !useCallStore.getState().muted;
  localStream?.getAudioTracks().forEach(t => { t.enabled = !next; });
  patch({ muted: next });
}

export function toggleSpeaker(): void {
  const next = !useCallStore.getState().speakerOn;
  try { InCallManager.setForceSpeakerphoneOn(next); } catch { /* ignore */ }
  patch({ speakerOn: next });
}

export function toggleVideo(): void {
  const next = !useCallStore.getState().videoEnabled;
  localStream?.getVideoTracks().forEach(t => { t.enabled = next; });
  patch({ videoEnabled: next });
}

/** Bascule caméra avant/arrière — react-native-webrtc expose _switchCamera sur la piste vidéo. */
export function flipCamera(): void {
  const track = localStream?.getVideoTracks()[0] as unknown as { _switchCamera?: () => void } | undefined;
  try { track?._switchCamera?.(); } catch { /* caméra unique ou plateforme non supportée */ }
}

// ── Écouteurs socket — installés une seule fois par CallProvider ───────

export function attachCallListeners(): () => void {
  const socket = getSocket();
  if (!socket || listenersAttached) return () => {};
  listenersAttached = true;

  const onIncoming = (payload: { conversationId: string; callerUserId: string; callerName: string; callerAvatar?: string | null; callType?: 'audio' | 'video' }) => {
    if (useCallStore.getState().status !== 'idle') {
      // Déjà en appel — informe l'appelant que la ligne est occupée (même logique que le site).
      emit('call:busy', { conversationId: payload.conversationId, callerUserId: payload.callerUserId });
      return;
    }
    const seq = ++callSeq;
    const info: CallInfo = {
      conversationId: payload.conversationId, remoteUserId: payload.callerUserId,
      remoteName: payload.callerName, remoteAvatar: payload.callerAvatar,
      direction: 'incoming', callType: payload.callType ?? 'audio',
    };
    patch({ status: 'ringing', callInfo: info, muted: false, durationSec: 0, errorMessage: null });
    try { InCallManager.start({ media: info.callType, auto: false, ringback: '' }); } catch { /* ignore */ }
    ringTimeout = setTimeout(() => { if (seq === callSeq) reset(); }, 30_000);
  };

  const onAccepted = () => { void onCallAccepted(callSeq); };

  const onOffer = async (payload: { conversationId: string; fromUserId: string; sdp: { type: string; sdp: string } }) => {
    const info = useCallStore.getState().callInfo;
    if (!info || info.conversationId !== payload.conversationId) return;
    const seq = callSeq;

    // L'offre peut arriver avant la fin de l'acquisition micro côté appelé — on attend.
    if (mediaReadyPromise) await mediaReadyPromise;
    if (seq !== callSeq) return;

    const iceServers = await getIceServers();
    if (seq !== callSeq) return;
    if (!pc) pc = createPeerConnection(iceServers, info, seq);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as any));
      await flushPendingCandidates(seq);
      const answer = await pc.createAnswer();
      if (seq !== callSeq) return;
      await pc.setLocalDescription(answer);
      emit('call:answer', { conversationId: info.conversationId, targetUserId: info.remoteUserId, sdp: { type: answer.type, sdp: answer.sdp } });
    } catch (err) {
      console.error('[Call] traitement de l’offre échoué :', err);
      endCall(true);
    }
  };

  const onAnswer = async (payload: { conversationId: string; fromUserId: string; sdp: { type: string; sdp: string } }) => {
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as any));
      await flushPendingCandidates(callSeq);
    } catch (err) {
      console.error('[Call] setRemoteDescription(answer) échoué :', err);
    }
  };

  const onIceCandidate = async (payload: { conversationId: string; fromUserId: string; candidate: any }) => {
    if (!payload.candidate?.candidate) return;
    const candidate = new RTCIceCandidate(payload.candidate);
    if (!pc || !pc.remoteDescription) { pendingCandidates.push(candidate); return; }
    try { await pc.addIceCandidate(candidate); } catch { /* candidat périmé */ }
  };

  const onEndedLike = () => reset();
  const onBusy = () => { patch({ errorMessage: 'Cette personne est déjà en appel.' }); reset(); };
  const onUnavailable = (payload: { message?: string }) => { patch({ errorMessage: payload?.message ?? 'Appel impossible pour le moment.' }); reset(); };

  socket.on('call:incoming', onIncoming);
  socket.on('call:accepted', onAccepted);
  socket.on('call:offer', onOffer);
  socket.on('call:answer', onAnswer);
  socket.on('call:ice-candidate', onIceCandidate);
  socket.on('call:ended', onEndedLike);
  socket.on('call:rejected', onEndedLike);
  socket.on('call:accept-failed', onEndedLike);
  socket.on('call:accept-superseded', onEndedLike);
  socket.on('call:accepted-elsewhere', onEndedLike);
  socket.on('call:busy', onBusy);
  socket.on('call:unavailable', onUnavailable);

  return () => {
    listenersAttached = false;
    socket.off('call:incoming', onIncoming);
    socket.off('call:accepted', onAccepted);
    socket.off('call:offer', onOffer);
    socket.off('call:answer', onAnswer);
    socket.off('call:ice-candidate', onIceCandidate);
    socket.off('call:ended', onEndedLike);
    socket.off('call:rejected', onEndedLike);
    socket.off('call:accept-failed', onEndedLike);
    socket.off('call:accept-superseded', onEndedLike);
    socket.off('call:accepted-elsewhere', onEndedLike);
    socket.off('call:busy', onBusy);
    socket.off('call:unavailable', onUnavailable);
  };
}
