/**
 * src/features/calls/group-call-store.ts
 *
 * Appels audio/vidéo d'un GROUPE de la messagerie (groupes libres et groupes
 * de commande) — même contrat que le site (useGroupCall.ts) et le serveur
 * (group-call.gateway.ts), sur le socket /messaging déjà ouvert :
 *
 *   Lancer     → group_call:initiate { groupId, callType }  ← group_call:joined
 *   Les autres ← group_call:incoming (sonnerie : Rejoindre / Refuser)
 *   Rejoindre  → group_call:join     ← group_call:joined { participants déjà là }
 *   Les présents ← group_call:participant_joined → chacun envoie une OFFRE au
 *                  nouvel arrivant, qui RÉPOND (pas d'offres croisées)
 *   Signalisation ↔ group_call:offer / answer / ice_candidate (ciblée par userId)
 *   Quitter    → group_call:leave · Refuser → group_call:decline
 *   Fin        ← group_call:ended (sonnerie 30 s sans réponse, plus personne)
 *
 * Mesh WebRTC : une connexion par participant, la voix et l'image vont
 * directement d'un téléphone à l'autre (chiffrées), le serveur ne relaie que
 * la signalisation. Au-delà de quelques personnes en vidéo, le réseau du
 * téléphone devient la limite : la vidéo reste donc au choix de chacun.
 *
 * Un appel en cours dans un groupe est retenu (activeByGroup) même si la
 * sonnerie a été manquée ou refusée : la discussion du groupe propose alors
 * « Rejoindre l'appel » tant qu'il n'est pas terminé.
 *
 * Coexistence avec l'appel 1:1 (call-store.ts) : un seul appel à la fois —
 * occupé dans un sens comme dans l'autre (registerExternalBusy).
 */
import { AppState } from 'react-native';
import { create } from 'zustand';
import {
  mediaDevices, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, type MediaStream,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';

import { useSession } from '@/features/auth/session-store';
import { connectRealtime, getSocket } from '@/lib/realtime/socket';

import { getIceServers } from './api';
import { registerExternalBusy, useCallStore } from './call-store';

export type GroupCallStatus = 'idle' | 'ringing' | 'joining' | 'connected';

export interface GroupPeer {
  userId: string;
  name: string;
  streamURL: string | null;
  video: boolean;
  muted: boolean;
  state: 'connecting' | 'connected' | 'lost';
}

export interface ActiveGroupCallRef { callId: string; callType: 'audio' | 'video'; initiatorName: string }

interface GroupCallState {
  status: GroupCallStatus;
  groupId: string | null;
  groupName: string;
  groupPhoto: string | null;
  callId: string | null;
  callType: 'audio' | 'video';
  /** Qui appelle (sonnerie) */
  initiatorName: string;
  /** Je suis celui qui a lancé l'appel (« Ça sonne… » tant que personne n'a rejoint) */
  outgoing: boolean;
  peers: Record<string, GroupPeer>;
  localStreamURL: string | null;
  muted: boolean;
  speakerOn: boolean;
  videoEnabled: boolean;
  upgrading: boolean;
  durationSec: number;
  notice: string | null;
  /** Appels en cours connus, par groupe (bandeau « Rejoindre l'appel ») */
  activeByGroup: Record<string, ActiveGroupCallRef>;
}

const initial: Omit<GroupCallState, 'activeByGroup'> = {
  status: 'idle', groupId: null, groupName: '', groupPhoto: null, callId: null, callType: 'audio',
  initiatorName: '', outgoing: false, peers: {}, localStreamURL: null,
  muted: false, speakerOn: false, videoEnabled: false, upgrading: false, durationSec: 0, notice: null,
};

export const useGroupCallStore = create<GroupCallState>(() => ({ ...initial, activeByGroup: {} }));

/* ── Objets natifs (hors du store) ──────────────────────────────────── */

interface Link { pc: RTCPeerConnection; pending: RTCIceCandidate[] }
const links = new Map<string, Link>();
let localStream: MediaStream | null = null;
let durationTimer: ReturnType<typeof setInterval> | null = null;
let ringTimer: ReturnType<typeof setTimeout> | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
let ringing = false;
let seq = 0;
/** Noms des groupes connus (pour l'écran d'appel quand l'appel arrive par le socket) */
const groupNames = new Map<string, { name: string; photo: string | null }>();

const patch = (p: Partial<GroupCallState>) => useGroupCallStore.setState(p);
const me = () => useSession.getState().user?.id ?? '';
const emit = (event: string, payload: object) => getSocket()?.emit(event, payload);

registerExternalBusy(() => useGroupCallStore.getState().status !== 'idle');

function showNotice(text: string) {
  patch({ notice: text });
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => patch({ notice: null }), 4000);
}

function setPeer(userId: string, p: Partial<GroupPeer>) {
  useGroupCallStore.setState((s) => {
    const cur = s.peers[userId] ?? { userId, name: p.name ?? 'Membre', streamURL: null, video: false, muted: false, state: 'connecting' as const };
    return { peers: { ...s.peers, [userId]: { ...cur, ...p } } };
  });
}

function dropPeer(userId: string) {
  const l = links.get(userId);
  if (l) { try { l.pc.close(); } catch { /* déjà fermée */ } }
  links.delete(userId);
  useGroupCallStore.setState((s) => {
    const peers = { ...s.peers };
    delete peers[userId];
    return { peers };
  });
}

function startRing() {
  if (ringing || AppState.currentState !== 'active') return;
  ringing = true;
  try { InCallManager.startRingtone('_DEFAULT_', [0, 1000, 1000], 'default', 30); } catch { ringing = false; }
}
function stopRing() {
  if (!ringing) return;
  ringing = false;
  try { InCallManager.stopRingtone(); } catch { /* ignore */ }
}

/** Fin locale de l'appel (quitté, terminé, refusé). */
function cleanup() {
  seq++;
  stopRing();
  if (durationTimer) clearInterval(durationTimer);
  if (ringTimer) clearTimeout(ringTimer);
  durationTimer = ringTimer = null;
  for (const l of links.values()) { try { l.pc.close(); } catch { /* déjà fermée */ } }
  links.clear();
  localStream?.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
  localStream = null;
  try { InCallManager.stop(); } catch { /* module natif indisponible */ }
  useGroupCallStore.setState((s) => ({ ...initial, activeByGroup: s.activeByGroup }));
}

function markConnected() {
  const s = useGroupCallStore.getState();
  if (s.status === 'connected') return;
  patch({ status: 'connected', outgoing: false });
  const start = Date.now();
  if (durationTimer) clearInterval(durationTimer);
  durationTimer = setInterval(() => patch({ durationSec: Math.floor((Date.now() - start) / 1000) }), 1000);
}

async function openMedia(video: boolean, mySeq: number): Promise<boolean> {
  try {
    const stream = (await mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false })) as unknown as MediaStream;
    if (mySeq !== seq) { stream.getTracks().forEach((t) => t.stop()); return false; }
    localStream = stream;
    patch({ localStreamURL: stream.toURL(), videoEnabled: video });
    return true;
  } catch (err) {
    console.warn('[Appel de groupe] micro/caméra indisponible :', err);
    return false;
  }
}

async function linkTo(userId: string, name: string): Promise<Link | null> {
  const existing = links.get(userId);
  if (existing) return existing;
  const { callId, groupId } = useGroupCallStore.getState();
  if (!callId || !groupId || !localStream) return null;
  const mySeq = seq;
  setPeer(userId, { name, state: 'connecting' });
  const iceServers = await getIceServers();
  if (mySeq !== seq) return null;
  const again = links.get(userId);
  if (again) return again;

  const pc = new RTCPeerConnection({ iceServers: iceServers as any });
  const link: Link = { pc, pending: [] };
  links.set(userId, link);
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream as MediaStream));

  pc.onicecandidate = ((e: any) => {
    if (!e.candidate) return;
    emit('group_call:ice_candidate', { groupId, callId, targetUserId: userId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
  }) as any;
  pc.ontrack = ((e: any) => {
    const stream = e.streams?.[0] as MediaStream | undefined;
    if (!stream || mySeq !== seq) return;
    setPeer(userId, { streamURL: stream.toURL(), video: e.track?.kind === 'video' || stream.getVideoTracks().length > 0 });
  }) as any;
  pc.onconnectionstatechange = (() => {
    if (mySeq !== seq) return;
    const st = pc.connectionState;
    if (st === 'connected') { setPeer(userId, { state: 'connected' }); markConnected(); }
    else if (st === 'failed' || st === 'disconnected') setPeer(userId, { state: 'lost' });
  }) as any;
  return link;
}

async function offerTo(userId: string) {
  const { callId, groupId } = useGroupCallStore.getState();
  const link = links.get(userId);
  if (!link || !callId || !groupId) return;
  try {
    const offer = await link.pc.createOffer({});
    await link.pc.setLocalDescription(offer);
    emit('group_call:offer', { groupId, callId, targetUserId: userId, sdp: { type: offer.type, sdp: offer.sdp } });
  } catch (err) {
    console.warn('[Appel de groupe] offre impossible :', err);
  }
}

function sendMediaState() {
  const { callId, groupId, muted, videoEnabled } = useGroupCallStore.getState();
  if (!callId || !groupId) return;
  emit('group_call:toggle_media', { groupId, callId, audioEnabled: !muted, videoEnabled: videoEnabled && !!localStream?.getVideoTracks().length });
}

/* ── Actions ────────────────────────────────────────────────────────── */

/** Mémorise le nom/la photo d'un groupe (affichés si un appel y arrive). */
export function rememberGroup(groupId: string, name: string, photo: string | null) {
  groupNames.set(groupId, { name, photo });
}

/** Lancer un appel dans le groupe. Renvoie un message d'erreur, ou null. */
export async function startGroupCall(groupId: string, groupName: string, groupPhoto: string | null, callType: 'audio' | 'video'): Promise<string | null> {
  if (useGroupCallStore.getState().status !== 'idle' || useCallStore.getState().status !== 'idle') return 'Vous êtes déjà en appel.';
  const known = useGroupCallStore.getState().activeByGroup[groupId];
  if (known) { void joinGroupCall(groupId, known.callId, known.callType); return null; }
  rememberGroup(groupId, groupName, groupPhoto);
  const mySeq = ++seq;
  patch({ status: 'joining', groupId, groupName, groupPhoto, callType, outgoing: true, speakerOn: callType === 'video', muted: false, notice: null });
  try { InCallManager.start({ media: callType, auto: true }); } catch { /* ignore */ }
  if (!(await openMedia(callType === 'video', mySeq))) {
    if (mySeq === seq) cleanup();
    return 'Impossible d’accéder au micro ou à la caméra.';
  }
  connectRealtime();
  emit('group_call:initiate', { groupId, callType });
  return null;
}

/** Rejoindre (sonnerie ou bandeau « Rejoindre l'appel »). */
export async function joinGroupCall(groupId: string, callId: string, callType: 'audio' | 'video'): Promise<void> {
  const s = useGroupCallStore.getState();
  if (s.status !== 'idle' && s.status !== 'ringing') return;
  if (useCallStore.getState().status !== 'idle') { showNotice('Terminez d’abord votre appel en cours.'); return; }
  stopRing();
  if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
  const info = groupNames.get(groupId);
  const mySeq = ++seq;
  patch({
    status: 'joining', groupId, callId, callType, outgoing: false,
    groupName: s.groupName || info?.name || 'Groupe', groupPhoto: s.groupPhoto ?? info?.photo ?? null,
    speakerOn: callType === 'video', muted: false,
  });
  try { InCallManager.start({ media: callType, auto: true }); } catch { /* ignore */ }
  if (!(await openMedia(callType === 'video', mySeq))) { if (mySeq === seq) cleanup(); return; }
  connectRealtime();
  emit('group_call:join', { groupId, callId });
}

export function declineGroupCall(): void {
  const { groupId, callId } = useGroupCallStore.getState();
  if (groupId && callId) emit('group_call:decline', { groupId, callId });
  cleanup();
}

export function leaveGroupCall(): void {
  const { groupId, callId } = useGroupCallStore.getState();
  if (groupId && callId) emit('group_call:leave', { groupId, callId });
  cleanup();
}

export function toggleGroupMute(): void {
  const next = !useGroupCallStore.getState().muted;
  localStream?.getAudioTracks().forEach((t) => { t.enabled = !next; });
  patch({ muted: next });
  sendMediaState();
}

export function toggleGroupSpeaker(): void {
  const next = !useGroupCallStore.getState().speakerOn;
  try { InCallManager.setForceSpeakerphoneOn(next); } catch { /* ignore */ }
  patch({ speakerOn: next });
}

/** Caméra : coupe/rallume, ou l'ouvre dans un appel audio (nouvelle piste + nouvelle offre à chacun). */
export async function toggleGroupVideo(): Promise<void> {
  const s = useGroupCallStore.getState();
  if (localStream?.getVideoTracks().length) {
    const next = !s.videoEnabled;
    localStream.getVideoTracks().forEach((t) => { t.enabled = next; });
    patch({ videoEnabled: next });
    sendMediaState();
    return;
  }
  if (s.upgrading || !localStream || s.status === 'idle' || s.status === 'ringing') return;
  const mySeq = seq;
  patch({ upgrading: true });
  try {
    const cam = (await mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } })) as unknown as MediaStream;
    const track = cam.getVideoTracks()[0];
    if (mySeq !== seq || !track || !localStream) { cam.getTracks().forEach((t) => t.stop()); return; }
    localStream.addTrack(track);
    for (const [userId, link] of links) {
      try { link.pc.addTrack(track, localStream); } catch { /* déjà présente */ }
      void offerTo(userId);
    }
    try { InCallManager.setForceSpeakerphoneOn(true); } catch { /* ignore */ }
    patch({ localStreamURL: localStream.toURL(), videoEnabled: true, speakerOn: true });
    sendMediaState();
  } catch {
    if (mySeq === seq) showNotice('Impossible d’ouvrir la caméra.');
  } finally {
    if (mySeq === seq) patch({ upgrading: false });
  }
}

export function flipGroupCamera(): void {
  const track = localStream?.getVideoTracks()[0] as unknown as { _switchCamera?: () => void } | undefined;
  try { track?._switchCamera?.(); } catch { /* caméra unique */ }
}

/* ── Écouteurs socket (installés une fois par CallProvider) ────────── */

type CallType = 'audio' | 'video';

export function attachGroupCallListeners(): () => void {
  const socket = connectRealtime();

  const forget = (callId: string) => useGroupCallStore.setState((s) => {
    const activeByGroup = Object.fromEntries(Object.entries(s.activeByGroup).filter(([, c]) => c.callId !== callId));
    return { activeByGroup };
  });

  const onIncoming = (p: { callId: string; groupId: string; initiatorId: string; initiatorName: string; callType?: CallType }) => {
    const callType: CallType = p.callType === 'video' ? 'video' : 'audio';
    useGroupCallStore.setState((s) => ({ activeByGroup: { ...s.activeByGroup, [p.groupId]: { callId: p.callId, callType, initiatorName: p.initiatorName } } }));
    if (p.initiatorId === me()) return;
    /* Déjà en appel : l'appel reste visible dans le groupe (« Rejoindre »), sans sonner. */
    if (useGroupCallStore.getState().status !== 'idle' || useCallStore.getState().status !== 'idle') return;
    const info = groupNames.get(p.groupId);
    const mySeq = ++seq;
    patch({
      status: 'ringing', groupId: p.groupId, callId: p.callId, callType, initiatorName: p.initiatorName || 'Un membre',
      groupName: info?.name ?? 'Groupe', groupPhoto: info?.photo ?? null, outgoing: false,
    });
    startRing();
    ringTimer = setTimeout(() => { if (mySeq === seq && useGroupCallStore.getState().status === 'ringing') cleanup(); }, 30_000);
  };

  /* Je suis dans l'appel : je lance (participants vides) ou je rejoins (les présents vont m'offrir). */
  const onJoined = async (p: { callId: string; groupId: string; callType?: CallType; participants: { userId: string; displayName: string }[] }) => {
    const s = useGroupCallStore.getState();
    if (s.groupId !== p.groupId || (s.status !== 'joining' && s.status !== 'connected')) return;
    patch({ callId: p.callId });
    useGroupCallStore.setState((st) => ({ activeByGroup: { ...st.activeByGroup, [p.groupId]: { callId: p.callId, callType: s.callType, initiatorName: s.initiatorName } } }));
    for (const peer of p.participants) {
      if (peer.userId !== me()) await linkTo(peer.userId, peer.displayName);
    }
  };

  /* Quelqu'un arrive : c'est moi (déjà présent) qui lui envoie l'offre. */
  const onParticipantJoined = async (p: { callId: string; userId: string; displayName: string }) => {
    const s = useGroupCallStore.getState();
    if (s.callId !== p.callId || p.userId === me() || !localStream) return;
    const link = await linkTo(p.userId, p.displayName);
    if (link) await offerTo(p.userId);
  };

  const onOffer = async (p: { callId: string; fromUserId: string; sdp: { type: string; sdp: string } }) => {
    const s = useGroupCallStore.getState();
    if (s.callId !== p.callId || p.sdp?.type !== 'offer') return;
    const link = links.get(p.fromUserId) ?? (await linkTo(p.fromUserId, s.peers[p.fromUserId]?.name ?? 'Membre'));
    if (!link) return;
    try {
      if (link.pc.signalingState !== 'stable') {
        try { await link.pc.setLocalDescription({ type: 'rollback' } as any); } catch { /* rien à annuler */ }
      }
      await link.pc.setRemoteDescription(new RTCSessionDescription(p.sdp as any));
      for (const c of link.pending) { try { await link.pc.addIceCandidate(c); } catch { /* périmé */ } }
      link.pending = [];
      const answer = await link.pc.createAnswer();
      await link.pc.setLocalDescription(answer);
      emit('group_call:answer', { groupId: s.groupId, callId: s.callId, targetUserId: p.fromUserId, sdp: { type: answer.type, sdp: answer.sdp } });
    } catch (err) {
      console.warn('[Appel de groupe] offre reçue non traitée :', err);
    }
  };

  const onAnswer = async (p: { callId: string; fromUserId: string; sdp: { type: string; sdp: string } }) => {
    const link = links.get(p.fromUserId);
    if (!link || useGroupCallStore.getState().callId !== p.callId || link.pc.signalingState !== 'have-local-offer') return;
    try {
      await link.pc.setRemoteDescription(new RTCSessionDescription(p.sdp as any));
      for (const c of link.pending) { try { await link.pc.addIceCandidate(c); } catch { /* périmé */ } }
      link.pending = [];
    } catch (err) {
      console.warn('[Appel de groupe] réponse non traitée :', err);
    }
  };

  const onIce = async (p: { callId: string; fromUserId: string; candidate?: any }) => {
    if (useGroupCallStore.getState().callId !== p.callId || !p.candidate?.candidate) return;
    const link = links.get(p.fromUserId);
    if (!link) return;
    const c = new RTCIceCandidate(p.candidate);
    if (!link.pc.remoteDescription) link.pending.push(c);
    else { try { await link.pc.addIceCandidate(c); } catch { /* périmé */ } }
  };

  const onLeft = (p: { callId: string; userId: string }) => {
    const s = useGroupCallStore.getState();
    if (s.callId !== p.callId) return;
    const name = s.peers[p.userId]?.name;
    dropPeer(p.userId);
    if (name && s.status === 'connected') showNotice(`${name} a quitté l’appel`);
  };

  const onDeclined = (p: { callId: string; userId: string }) => {
    const s = useGroupCallStore.getState();
    if (s.callId === p.callId && s.peers[p.userId]) dropPeer(p.userId);
  };

  const onMedia = (p: { callId: string; userId: string; audioEnabled?: boolean; videoEnabled?: boolean }) => {
    const s = useGroupCallStore.getState();
    if (s.callId !== p.callId || !s.peers[p.userId]) return;
    setPeer(p.userId, {
      ...(p.audioEnabled !== undefined ? { muted: !p.audioEnabled } : {}),
      ...(p.videoEnabled !== undefined ? { video: p.videoEnabled } : {}),
    });
  };

  const onEnded = (p: { callId: string; reason?: string }) => {
    forget(p.callId);
    const s = useGroupCallStore.getState();
    if (s.callId !== p.callId) return;
    if (s.status === 'joining' && s.outgoing && p.reason === 'timeout') showNotice('Personne n’a répondu.');
    cleanup();
  };

  const onError = (p: { code?: string; message?: string }) => {
    const s = useGroupCallStore.getState();
    if (s.status === 'joining' || s.status === 'connected') {
      if (p.code === 'CALL_NOT_FOUND' && s.groupId) forget(s.callId ?? '');
      cleanup();
    }
    showNotice(p.message ?? 'Appel de groupe impossible.');
  };

  /* Reconnexion du socket pendant l'appel : on signale de nouveau notre présence (idempotent côté serveur). */
  const onReconnect = () => {
    const { status, groupId, callId } = useGroupCallStore.getState();
    if ((status === 'connected' || status === 'joining') && groupId && callId) emit('group_call:join', { groupId, callId });
  };

  socket.on('group_call:incoming', onIncoming);
  socket.on('group_call:joined', onJoined);
  socket.on('group_call:participant_joined', onParticipantJoined);
  socket.on('group_call:offer', onOffer);
  socket.on('group_call:answer', onAnswer);
  socket.on('group_call:ice_candidate', onIce);
  socket.on('group_call:participant_left', onLeft);
  socket.on('group_call:participant_declined', onDeclined);
  socket.on('group_call:media_toggled', onMedia);
  socket.on('group_call:ended', onEnded);
  socket.on('group_call:error', onError);
  socket.io.on('reconnect', onReconnect);

  return () => {
    socket.off('group_call:incoming', onIncoming);
    socket.off('group_call:joined', onJoined);
    socket.off('group_call:participant_joined', onParticipantJoined);
    socket.off('group_call:offer', onOffer);
    socket.off('group_call:answer', onAnswer);
    socket.off('group_call:ice_candidate', onIce);
    socket.off('group_call:participant_left', onLeft);
    socket.off('group_call:participant_declined', onDeclined);
    socket.off('group_call:media_toggled', onMedia);
    socket.off('group_call:ended', onEnded);
    socket.off('group_call:error', onError);
    socket.io.off('reconnect', onReconnect);
  };
}
