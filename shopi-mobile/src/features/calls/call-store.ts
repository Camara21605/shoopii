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
import { AppState } from 'react-native';
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
import { connectRealtime, getSocket } from '@/lib/realtime/socket';

import { cancelIncomingNotification, setShowOverLockScreen } from '../../../modules/shopi-calls';
import { getIceServers, type RTCIceServerInit } from './api';
import { candidateType, explainFailure, hasTurn, newIceDiag, reportIceFailure, type IceDiag } from './ice-diagnostic';

registerGlobals();

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'reconnecting' | 'ended';

export interface CallInfo {
  conversationId: string;
  remoteUserId: string;
  remoteName: string;
  remoteAvatar?: string | null;
  direction: 'outgoing' | 'incoming';
  callType: 'audio' | 'video';
  /** Appel à plusieurs sans appel 1:1 (j'ai été ajouté, ou la personne de départ a raccroché). */
  roomOnly?: boolean;
  /** Invitation à rejoindre un appel à plusieurs (sonnerie : Rejoindre / Refuser). */
  roomInviteId?: string;
}

/* ── Points d'accroche vers l'appel à plusieurs (room-store.ts) ──────────
 * Enregistrés par room-store au chargement : évite un import circulaire. */
interface RoomHooks {
  hasPeers(): boolean;
  join(roomId: string): void;
  decline(roomId: string): void;
  leave(): void;
  onLocalTrack(track: any): void;
}
let roomHooks: RoomHooks | null = null;
export function registerRoomHooks(h: RoomHooks) { roomHooks = h; }

/* Appel de GROUPE en cours (group-call-store.ts) : la ligne est occupée pour
 * les appels 1:1 aussi — un seul appel à la fois. Enregistré par group-call-store. */
let externalBusy: () => boolean = () => false;
export function registerExternalBusy(fn: () => boolean) { externalBusy = fn; }
const lineBusy = () => useCallStore.getState().status !== 'idle' || externalBusy();

interface CallState {
  status: CallStatus;
  callInfo: CallInfo | null;
  localStreamURL: string | null;
  remoteStreamURL: string | null;
  muted: boolean;
  speakerOn: boolean;
  /** Ma caméra envoie de la vidéo. */
  videoEnabled: boolean;
  /** L'autre envoie de la vidéo (piste vidéo reçue et caméra non coupée). */
  remoteVideo: boolean;
  /** Passage en vidéo en cours (caméra en train de s'ouvrir / renégociation). */
  upgrading: boolean;
  durationSec: number;
  errorMessage: string | null;
  /** Appel sortant : le téléphone de l'autre sonne (signal call:ringing du serveur). */
  remoteRinging: boolean;
}

const initialState: CallState = {
  status: 'idle',
  callInfo: null,
  localStreamURL: null,
  remoteStreamURL: null,
  muted: false,
  speakerOn: false,
  videoEnabled: true,
  remoteVideo: false,
  upgrading: false,
  durationSec: 0,
  errorMessage: null,
  remoteRinging: false,
};

export const useCallStore = create<CallState>(() => ({ ...initialState }));

// ── Objets natifs & timers (hors du store — voir en-tête) ────────────────

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let pendingCandidates: RTCIceCandidate[] = []; // reçus avant setRemoteDescription
let iceDiag: IceDiag = newIceDiag();          // chemins réseau vus — pour expliquer un échec
let mediaReadyPromise: Promise<boolean> | null = null;
let ringTimeout: ReturnType<typeof setTimeout> | null = null;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;
let iceRestartTimer: ReturnType<typeof setTimeout> | null = null;
let makingOffer = false;      // renégociation en cours de MON côté (collision d'offres)
let remoteVideoTrack = false; // piste vidéo distante reçue
let remoteCameraOff = false;  // l'autre a coupé sa caméra (call:media-state)
let callSeq = 0; // incrémenté à chaque reset() — ignore les callbacks d'un appel déjà abandonné
let listenersAttached = false;

function emit(event: string, payload: object) {
  getSocket()?.emit(event, payload);
}

function patch(p: Partial<CallState>) {
  useCallStore.setState(p);
}

/**
 * Fin de l'appel 1:1. Si d'autres personnes restent dans l'appel à plusieurs,
 * on ferme seulement la connexion avec la personne de départ (micro, caméra et
 * durée continuent) ; sinon remise à zéro complète.
 */
function reset(force = false) {
  if (!force && roomHooks?.hasPeers() && localStream) {
    endDirectOnly();
    return;
  }
  roomHooks?.leave();
  fullReset();
}

function endDirectOnly() {
  if (ringTimeout) clearTimeout(ringTimeout);
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  if (connectTimer) clearTimeout(connectTimer);
  if (iceRestartTimer) clearTimeout(iceRestartTimer);
  ringTimeout = keepaliveTimer = connectTimer = iceRestartTimer = null;
  try { pc?.close(); } catch { /* déjà fermé */ }
  pc = null;
  pendingCandidates = [];
  iceDiag = newIceDiag();
  remoteVideoTrack = false;
  remoteCameraOff = false;
  const info = useCallStore.getState().callInfo;
  patch({
    remoteStreamURL: null, remoteVideo: false,
    callInfo: info ? { ...info, roomOnly: true } : info,
  });
}

/** Remise à zéro complète — appelée à la fin de TOUT appel, quel qu'en soit le motif. */
function fullReset() {
  callSeq++;
  if (ringTimeout) clearTimeout(ringTimeout);
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  if (durationTimer) clearInterval(durationTimer);
  if (connectTimer) clearTimeout(connectTimer);
  if (iceRestartTimer) clearTimeout(iceRestartTimer);
  ringTimeout = keepaliveTimer = durationTimer = connectTimer = iceRestartTimer = null;
  makingOffer = false;
  remoteVideoTrack = false;
  remoteCameraOff = false;

  try { pc?.close(); } catch { /* déjà fermé */ }
  pc = null;

  localStream?.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
  localStream = null;
  pendingCandidates = [];
  iceDiag = newIceDiag();
  mediaReadyPromise = null;

  stopRingtone();
  stopRingback();
  try { InCallManager.stop(); } catch { /* module natif indisponible (dev client pas encore rebuild) */ }
  cancelIncomingNotification();
  setShowOverLockScreen(false);

  useCallStore.setState({ ...initialState });
}

// ── Sonnerie (application ouverte) ─────────────────────────────────────
/* Application à l'écran : l'appel entrant joue la SONNERIE DU TÉLÉPHONE
 * (« _DEFAULT_ » = sonnerie choisie dans les réglages, au volume sonnerie ;
 * silencieux/vibreur respectés par incall-manager). Application fermée ou en
 * arrière-plan, c'est la notification native qui sonne (modules/shopi-calls). */
let ringing = false;

function startRingtone() {
  if (ringing || AppState.currentState !== 'active') return;
  ringing = true;
  try { InCallManager.startRingtone('_DEFAULT_', [0, 1000, 1000], 'default', 45); } catch { ringing = false; }
}

function stopRingtone() {
  if (!ringing) return;
  ringing = false;
  try { InCallManager.stopRingtone(); } catch { /* ignore */ }
}

// ── Sonnerie de retour (appel sortant) ─────────────────────────────────
/* Quand le serveur confirme que ça sonne chez l'autre (call:ringing),
 * l'appelant entend LA SONNERIE DE SON TÉLÉPHONE (« _DEFAULT_ » = sonnerie
 * choisie dans les réglages), jouée comme le son d'un appel : dans
 * l'écouteur, ou le haut-parleur s'il est activé. Arrêtée dès que l'autre
 * décroche, refuse, ou que l'on raccroche. */
let ringback = false;

function startRingback() {
  if (ringback) return;
  ringback = true;
  try { InCallManager.startRingback('_DEFAULT_'); } catch { ringback = false; }
}

function stopRingback() {
  if (!ringback) return;
  ringback = false;
  try { InCallManager.stopRingback(); } catch { /* ignore */ }
}

/* Revenue à l'écran pendant que ça sonne : la notification s'efface, la sonnerie de l'appli prend le relais. */
AppState.addEventListener('change', next => {
  if (next === 'active' && useCallStore.getState().status === 'ringing' && useCallStore.getState().callInfo?.direction === 'incoming') {
    cancelIncomingNotification();
    startRingtone();
  }
});

/** Termine proprement l'appel EN COURS et prévient l'autre participant (sauf s'il a raccroché le premier). */
function endCall(notifyRemote: boolean) {
  const info = useCallStore.getState().callInfo;
  if (notifyRemote && info && !info.roomOnly && !info.roomInviteId) {
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
  iceDiag.turnConfigured = hasTurn(iceServers);
  if (!iceDiag.turnConfigured) console.warn('[Call] aucun relais TURN reçu du serveur (METERED_TURN_* absent ?) — les appels site ↔ téléphone et 4G échoueront');

  localStream?.getTracks().forEach(track => conn.addTrack(track, localStream as MediaStream));

  /* .on<event> = ... plutôt que addEventListener — même API que côté web
   * (useAudioCall.ts), et le typage généré pour cette classe (EventTarget
   * générique du shim) ne déclare addEventListener nulle part d'utilisable
   * alors que les propriétés on<event> le sont explicitement. */
  conn.onicecandidate = ((e: any) => {
    if (!e.candidate) return;
    const t = candidateType(e.candidate.candidate);
    if (t) iceDiag.local.add(t);
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
    /* Une piste vidéo peut arriver EN COURS d'appel audio (l'autre active sa caméra) :
     * on décide sur le contenu réel du flux, pas sur le type d'appel de départ. */
    if (e.track?.kind === 'video' || stream.getVideoTracks().length > 0) remoteVideoTrack = true;
    patch({ remoteStreamURL: stream.toURL(), remoteVideo: remoteVideoTrack && !remoteCameraOff });
  }) as any;

  conn.onconnectionstatechange = (() => {
    if (seq !== callSeq) return;
    const state = conn.connectionState;
    iceDiag.lastState = state;
    if (state === 'connected') {
      if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
      if (iceRestartTimer) { clearTimeout(iceRestartTimer); iceRestartTimer = null; }
      if (useCallStore.getState().status !== 'connected') startDurationTimer();
      patch({ status: 'connected', errorMessage: null });
    } else if (state === 'disconnected' || state === 'failed') {
      /* Coupure réseau (passage Wi-Fi ↔ 4G, tunnel…) : on tente de reprendre au lieu de
       * raccrocher. Seul l'APPELANT relance la négociation (ICE restart) pour éviter que les
       * deux téléphones s'envoient une offre en même temps ; au-delà de 20 s, on raccroche. */
      if (useCallStore.getState().status === 'connected') patch({ status: 'reconnecting' });
      if (state === 'failed' && info.direction === 'outgoing') void renegotiate(seq, true);
      if (!iceRestartTimer) {
        iceRestartTimer = setTimeout(() => {
          iceRestartTimer = null;
          if (seq === callSeq && conn.connectionState !== 'connected') {
            patch({ errorMessage: 'Connexion perdue.' });
            endCall(true);
          }
        }, 20_000);
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

/**
 * Nouvelle offre sur la connexion EXISTANTE : passage en vidéo, ou reprise
 * après une coupure réseau (iceRestart). L'autre côté (site ou appli) répond
 * par call:answer, traité par onAnswer.
 */
async function renegotiate(seq: number, iceRestart = false): Promise<void> {
  const info = useCallStore.getState().callInfo;
  if (!pc || !info || seq !== callSeq || makingOffer) return;
  makingOffer = true;
  try {
    const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : {});
    if (seq !== callSeq) return;
    await pc.setLocalDescription(offer);
    emit('call:offer', { conversationId: info.conversationId, targetUserId: info.remoteUserId, sdp: { type: offer.type, sdp: offer.sdp } });
  } catch (err) {
    console.warn('[Call] renégociation échouée :', err);
  } finally {
    makingOffer = false;
  }
}

/* Filet de sécurité : si la connexion n'aboutit pas, on le DIT au lieu de rester
 * indéfiniment sur « Connexion… » (réseau trop faible, pare-feu de l'opérateur…). */
function startConnectTimer(seq: number) {
  if (connectTimer) clearTimeout(connectTimer);
  connectTimer = setTimeout(() => {
    connectTimer = null;
    if (seq !== callSeq || useCallStore.getState().status === 'connected') return;
    /* Dire POURQUOI (relais absent, relais muet, correspondant injoignable…) et le noter côté serveur. */
    const info = useCallStore.getState().callInfo;
    patch({ errorMessage: pc ? explainFailure(iceDiag) : 'Connexion impossible. Vérifiez votre réseau et réessayez.' });
    if (pc && info) reportIceFailure(iceDiag, info.direction);
    setTimeout(() => { if (seq === callSeq) endCall(true); }, 2500);
  }, 30_000);
}

/** L'autre peut voir si ma caméra est coupée (avatar au lieu d'une image noire). */
function sendMediaState() {
  const { callInfo, videoEnabled, muted } = useCallStore.getState();
  if (!callInfo || callInfo.roomOnly || !pc) return;
  emit('call:media-state', {
    conversationId: callInfo.conversationId, targetUserId: callInfo.remoteUserId,
    videoEnabled: videoEnabled && !!localStream?.getVideoTracks().length, muted,
  });
}

// ── API publique — démarrer / répondre / refuser / raccrocher ──────────

export async function startCall(
  conversationId: string,
  calleeUserId: string,
  calleeName: string,
  calleeAvatar: string | null | undefined,
  callType: 'audio' | 'video',
): Promise<void> {
  if (lineBusy()) return; // déjà en appel (1:1 ou groupe)
  const seq = ++callSeq;
  const info: CallInfo = { conversationId, remoteUserId: calleeUserId, remoteName: calleeName, remoteAvatar: calleeAvatar, direction: 'outgoing', callType };
  patch({ status: 'calling', callInfo: info, muted: false, speakerOn: callType === 'video', videoEnabled: callType === 'video', durationSec: 0, errorMessage: null, remoteRinging: false });

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
  stopRingback();
  patch({ status: 'connecting', remoteRinging: false });
  startKeepalive(info);
  startConnectTimer(seq);

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

  /* Invitation à un appel à plusieurs : micro (et caméra) d'abord, puis on rejoint. */
  if (info.roomInviteId) {
    const roomId = info.roomInviteId;
    if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
    stopRingtone();
    patch({ status: 'connecting', callInfo: { ...info, roomOnly: true, roomInviteId: undefined }, speakerOn: info.callType === 'video', videoEnabled: info.callType === 'video' });
    try { InCallManager.start({ media: info.callType, auto: true }); } catch { /* ignore */ }
    mediaReadyPromise = acquireMedia(info.callType === 'video', seq);
    if (!(await mediaReadyPromise) || seq !== callSeq) { if (seq === callSeq) reset(true); return; }
    connectRealtime();
    roomHooks?.join(roomId);
    startConnectTimer(seq);
    return;
  }

  if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
  patch({ status: 'connecting', speakerOn: info.callType === 'video', videoEnabled: info.callType === 'video' });
  stopRingtone();
  cancelIncomingNotification();
  try { InCallManager.start({ media: info.callType, auto: true }); } catch { /* ignore */ }

  /* Décroché depuis la notification, application fermée : le socket est peut-être
   * encore en train de se connecter — socket.io garde l'envoi en file et le part
   * dès la connexion, et le micro/la caméra s'ouvrent EN PARALLÈLE (pas après). */
  connectRealtime();
  emit('call:accept', { conversationId: info.conversationId, callerUserId: info.remoteUserId });
  startKeepalive(info);
  startConnectTimer(seq);

  mediaReadyPromise = acquireMedia(info.callType === 'video', seq);
  const ready = await mediaReadyPromise;
  if (!ready || seq !== callSeq) { if (seq === callSeq) endCall(true); return; }

  // L'offre de l'appelant peut être arrivée pendant l'acquisition du micro — onCallOffer() la gère aussi.
}

export function rejectCall(): void {
  const info = useCallStore.getState().callInfo;
  if (info?.roomInviteId) roomHooks?.decline(info.roomInviteId);
  else if (info) emit('call:reject', { conversationId: info.conversationId, callerUserId: info.remoteUserId });
  reset(true);
}

/** Raccrocher : je quitte tout (appel 1:1 ET appel à plusieurs). */
export function hangUp(): void {
  const info = useCallStore.getState().callInfo;
  if (info && !info.roomOnly && !info.roomInviteId) {
    emit('call:end', { conversationId: info.conversationId, targetUserId: info.remoteUserId });
  }
  reset(true);
}

// ── Accès pour l'appel à plusieurs (room-store.ts) ───────────────────────

export function getLocalStream(): MediaStream | null {
  return localStream;
}

/** Une connexion de l'appel à plusieurs vient d'aboutir. */
export function markRoomConnected(): void {
  const { status } = useCallStore.getState();
  if (status === 'connected') return;
  if (connectTimer) { clearTimeout(connectTimer); connectTimer = null; }
  if (status !== 'reconnecting') startDurationTimer();
  patch({ status: 'connected', errorMessage: null });
}

/** Plus personne dans l'appel à plusieurs : si je n'ai pas d'appel 1:1, l'appel est fini. */
export function onRoomEmpty(): void {
  const info = useCallStore.getState().callInfo;
  if (info?.roomOnly) fullReset();
}

/** Invitation reçue : sonne comme un appel entrant (Rejoindre / Refuser). */
export function surfaceRoomInvite(invite: { roomId: string; callType: 'audio' | 'video'; inviter: { userId: string; name: string; avatar: string | null } }): boolean {
  if (lineBusy()) return false;
  const seq = ++callSeq;
  patch({
    status: 'ringing', muted: false, durationSec: 0, errorMessage: null,
    callInfo: {
      conversationId: '', remoteUserId: invite.inviter.userId, remoteName: invite.inviter.name,
      remoteAvatar: invite.inviter.avatar, direction: 'incoming', callType: invite.callType,
      roomInviteId: invite.roomId,
    },
  });
  ringTimeout = setTimeout(() => { if (seq === callSeq && useCallStore.getState().status === 'ringing') fullReset(); }, 45_000);
  startRingtone();
  return true;
}

/** Invitation annulée (expirée, prise sur un autre appareil, appel fini). */
export function cancelRoomInvite(roomId: string): void {
  const { status, callInfo } = useCallStore.getState();
  if (status === 'ringing' && callInfo?.roomInviteId === roomId) fullReset();
}

/**
 * Appel entrant connu autrement que par le socket : push reçu, notification
 * touchée (application fermée), ou appel en attente relu au démarrage.
 * `autoAccept` = « Répondre » déjà touché sur la notification → on décroche
 * tout de suite, sans redemander.
 */
export function surfaceIncoming(info: Omit<CallInfo, 'direction'>, autoAccept: boolean): void {
  const state = useCallStore.getState();
  const same = state.callInfo?.direction === 'incoming' && state.callInfo.remoteUserId === info.remoteUserId;

  if (state.status === 'idle' && !externalBusy()) {
    const seq = ++callSeq;
    patch({ status: 'ringing', callInfo: { ...info, direction: 'incoming' }, muted: false, durationSec: 0, errorMessage: null });
    ringTimeout = setTimeout(() => { if (seq === callSeq && useCallStore.getState().status === 'ringing') reset(); }, 30_000);
    if (!autoAccept) startRingtone();
  } else if (!same || state.status === 'idle') {
    return;   // déjà en appel avec quelqu'un d'autre (ou dans un appel de groupe)
  }

  if (autoAccept && useCallStore.getState().status === 'ringing') void acceptCall();
}

/** « Refuser » touché sur la notification, ou appel arrêté côté serveur, pendant que l'appli sonnait aussi. */
export function dismissIncomingLocally(): void {
  const { status, callInfo } = useCallStore.getState();
  if (status === 'ringing' && callInfo?.direction === 'incoming') reset();
}

// ── Contrôles en appel ───────────────────────────────────────────────────

export function toggleMute(): void {
  const next = !useCallStore.getState().muted;
  localStream?.getAudioTracks().forEach(t => { t.enabled = !next; });
  patch({ muted: next });
  sendMediaState();
}

export function toggleSpeaker(): void {
  const next = !useCallStore.getState().speakerOn;
  try { InCallManager.setForceSpeakerphoneOn(next); } catch { /* ignore */ }
  patch({ speakerOn: next });
}

/**
 * Caméra : la coupe / la rallume — et, dans un appel AUDIO, ouvre la caméra et
 * passe l'appel en vidéo (nouvelle piste + renégociation), sans raccrocher.
 */
export async function toggleVideo(): Promise<void> {
  const state = useCallStore.getState();
  const hasTrack = !!localStream?.getVideoTracks().length;

  if (hasTrack) {
    const next = !state.videoEnabled;
    localStream?.getVideoTracks().forEach(t => { t.enabled = next; });
    patch({ videoEnabled: next });
    sendMediaState();
    return;
  }

  const inRoom = !!roomHooks?.hasPeers();
  if (state.upgrading || (!pc && !inRoom) || !localStream || (state.status !== 'connected' && state.status !== 'reconnecting')) return;
  const seq = callSeq;
  patch({ upgrading: true });
  try {
    const camera = (await mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } })) as unknown as MediaStream;
    const track = camera.getVideoTracks()[0];
    if (seq !== callSeq || !track || !localStream) { camera.getTracks().forEach(t => t.stop()); return; }
    localStream.addTrack(track);
    pc?.addTrack(track, localStream);
    roomHooks?.onLocalTrack(track);   // les autres participants reçoivent aussi l'image
    // Vidéo : le son passe sur le haut-parleur, comme dans tout appel vidéo.
    try { InCallManager.setForceSpeakerphoneOn(true); } catch { /* ignore */ }
    patch({
      localStreamURL: localStream.toURL(), videoEnabled: true, speakerOn: true,
      callInfo: state.callInfo ? { ...state.callInfo, callType: 'video' } : state.callInfo,
    });
    if (pc) await renegotiate(seq);
    sendMediaState();
  } catch (err) {
    console.warn('[Call] ouverture de la caméra échouée :', err);
    if (seq === callSeq) patch({ errorMessage: "Impossible d'ouvrir la caméra." });
    setTimeout(() => { if (seq === callSeq) patch({ errorMessage: null }); }, 3000);
  } finally {
    if (seq === callSeq) patch({ upgrading: false });
  }
}

/** Bascule caméra avant/arrière — react-native-webrtc expose _switchCamera sur la piste vidéo. */
export function flipCamera(): void {
  const track = localStream?.getVideoTracks()[0] as unknown as { _switchCamera?: () => void } | undefined;
  try { track?._switchCamera?.(); } catch { /* caméra unique ou plateforme non supportée */ }
}

// ── Écouteurs socket — installés une seule fois par CallProvider ───────

export function attachCallListeners(): () => void {
  /* connectRealtime() et non getSocket() : l'effet de CallProvider (enfant) s'exécute
   * AVANT celui de app/_layout.tsx (parent) qui ouvre le socket — getSocket() valait
   * encore null et les appels entrants n'étaient jamais écoutés. connectRealtime()
   * renvoie le socket existant s'il est déjà ouvert. */
  const socket = connectRealtime();
  if (listenersAttached) return () => {};
  listenersAttached = true;

  const onIncoming = (payload: { conversationId: string; callerUserId: string; callerName: string; callerAvatar?: string | null; callType?: 'audio' | 'video' }) => {
    if (lineBusy()) {
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
    startRingtone();
    ringTimeout = setTimeout(() => { if (seq === callSeq) reset(); }, 30_000);
  };

  const onAccepted = () => { void onCallAccepted(callSeq); };

  const onOffer = async (payload: { conversationId: string; fromUserId: string; sdp: { type: string; sdp: string } }) => {
    const info = useCallStore.getState().callInfo;
    /* Sécurité : on n'accepte une offre QUE de la personne avec qui on est en appel. */
    if (!info || payload.fromUserId !== info.remoteUserId || info.conversationId !== payload.conversationId) return;
    if (payload.sdp?.type !== 'offer' || typeof payload.sdp.sdp !== 'string') return;
    /* Le serveur relaie l'offre à TOUS les appareils de l'appelé. Un appareil qui sonne
     * encore (l'appel a été pris sur le site ou un autre téléphone) ne doit SURTOUT pas
     * répondre : sa réponse, sans micro, arrivait parfois la première chez l'appelant,
     * qui se connectait alors au mauvais appareil et restait sur « Connexion… ». */
    const st = useCallStore.getState().status;
    if (st === 'ringing' || st === 'idle' || st === 'calling') return;
    const seq = callSeq;

    // L'offre peut arriver avant la fin de l'acquisition micro côté appelé — on attend.
    if (mediaReadyPromise) await mediaReadyPromise;
    if (seq !== callSeq) return;

    const iceServers = await getIceServers();
    if (seq !== callSeq) return;
    if (!pc) pc = createPeerConnection(iceServers, info, seq);

    /* Les deux côtés ont proposé en même temps (ex. caméra activée des deux côtés) :
     * l'appelant garde son offre, l'appelé annule la sienne et répond. */
    if (makingOffer || pc.signalingState !== 'stable') {
      if (info.direction === 'outgoing') return;
      try { await pc.setLocalDescription({ type: 'rollback' } as any); } catch { /* rien à annuler */ }
    }

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
    const info = useCallStore.getState().callInfo;
    if (!pc || !info || payload.fromUserId !== info.remoteUserId || payload.sdp?.type !== 'answer') return;
    if (pc.signalingState !== 'have-local-offer') return;   // réponse en double ou périmée
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as any));
      await flushPendingCandidates(callSeq);
    } catch (err) {
      console.error('[Call] setRemoteDescription(answer) échoué :', err);
    }
  };

  const onIceCandidate = async (payload: { conversationId: string; fromUserId: string; candidate: any }) => {
    const info = useCallStore.getState().callInfo;
    if (!info || payload.fromUserId !== info.remoteUserId || !payload.candidate?.candidate) return;
    const t = candidateType(payload.candidate.candidate);
    if (t) iceDiag.remote.add(t);
    const candidate = new RTCIceCandidate(payload.candidate);
    if (!pc || !pc.remoteDescription) { pendingCandidates.push(candidate); return; }
    try { await pc.addIceCandidate(candidate); } catch { /* candidat périmé */ }
  };

  /* Événements de l'appel 1:1 : sans objet quand je ne suis plus que dans l'appel à plusieurs. */
  const onEndedLike = () => { if (!useCallStore.getState().callInfo?.roomOnly) reset(); };

  /* L'autre a coupé / rallumé sa caméra : avatar au lieu d'une image figée. */
  const onMediaState = (payload: { fromUserId?: string; videoEnabled?: boolean }) => {
    const info = useCallStore.getState().callInfo;
    if (!info || payload.fromUserId !== info.remoteUserId) return;
    remoteCameraOff = payload.videoEnabled === false;
    patch({ remoteVideo: remoteVideoTrack && !remoteCameraOff });
  };
  /* Ça sonne chez l'autre : « Ça sonne… » + sonnerie de retour (seulement pour MON appel sortant en cours). */
  const onRinging = (p: { conversationId?: string }) => {
    const { status, callInfo } = useCallStore.getState();
    if (status !== 'calling' || callInfo?.direction !== 'outgoing' || callInfo.conversationId !== p?.conversationId) return;
    patch({ remoteRinging: true });
    startRingback();
  };
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
  socket.on('call:ringing', onRinging);
  socket.on('call:busy', onBusy);
  socket.on('call:unavailable', onUnavailable);
  socket.on('call:media-state', onMediaState);

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
    socket.off('call:ringing', onRinging);
    socket.off('call:busy', onBusy);
    socket.off('call:unavailable', onUnavailable);
    socket.off('call:media-state', onMediaState);
  };
}
