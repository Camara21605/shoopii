/**
 * src/shared/messagerie/hooks/callRoom.ts
 *
 * Appels à plusieurs (jusqu'à 4) — ajouter une personne à un appel en cours.
 * Même protocole que l'application mobile (shopi-mobile/src/features/calls/
 * room-store.ts) et que le serveur (call-room.gateway.ts) :
 *
 *   Inviter        → call:room-invite  { peerUserId | roomId, inviteeUserId }
 *   Invité         ← call:room-invite  (sonne : Rejoindre / Refuser)
 *   Rejoindre      → call:room-join    ← call:room-joined (liste des présents)
 *   Le nouvel arrivant envoie une offre à chacun ; les autres répondent.
 *   Signalisation  ↔ call:room-signal  { description | candidate }
 *   Quitter        → call:room-leave   ← call:room-peer-left / call:room-closed
 *
 * Module indépendant de useAudioCall : l'appel 1:1 de départ garde sa propre
 * connexion. La salle utilise des COPIES (clone) des pistes micro/caméra, ce
 * qui lui permet de continuer quand l'appel 1:1 se termine (l'autre personne
 * de départ raccroche) sans couper le son des autres participants.
 *
 * Renégociation (caméra activée en cours d'appel) : « perfect negotiation » —
 * en cas d'offres croisées, celui dont l'identifiant est le plus grand cède.
 */
import { useSyncExternalStore } from 'react';

import { getActiveSocket } from './useSocket';
import { getIceServers } from './iceServers';
import { getUserIdFromToken } from '../../services/authUtils';

export const ROOM_MAX = 4;

export interface RoomMember { userId: string; name: string; avatar: string | null }
export interface RoomPeer extends RoomMember {
  stream: MediaStream | null;
  video: boolean;
  state: 'connecting' | 'connected' | 'lost';
}
export interface RoomInvite { roomId: string; callType: 'audio' | 'video'; inviter: RoomMember; participants: RoomMember[] }

export interface RoomSnapshot {
  roomId: string | null;
  peers: RoomPeer[];
  invited: RoomMember[];
  incomingInvite: RoomInvite | null;
  joining: boolean;
  muted: boolean;
  videoOn: boolean;
  localStream: MediaStream | null;
  notice: string | null;
  /** Début de l'appel à plusieurs (durée affichée quand l'appel 1:1 n'est plus là). */
  startedAt: number | null;
}

/** Appel 1:1 en cours, fourni par GlobalCallContext (useAudioCall). */
export interface DirectCall {
  active: boolean;
  remoteUserId: string | null;
  callType: 'audio' | 'video';
  localStream: MediaStream | null;
  muted: boolean;
}

interface PeerLink { pc: RTCPeerConnection; makingOffer: boolean; pending: RTCIceCandidateInit[] }

// ── État ────────────────────────────────────────────────────────────────

let snap: RoomSnapshot = {
  roomId: null, peers: [], invited: [], incomingInvite: null, joining: false,
  muted: false, videoOn: false, localStream: null, notice: null, startedAt: null,
};
const listeners = new Set<() => void>();
const links = new Map<string, PeerLink>();
let direct: DirectCall = { active: false, remoteUserId: null, callType: 'audio', localStream: null, muted: false };
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

function set(p: Partial<RoomSnapshot>) {
  snap = { ...snap, ...p };
  listeners.forEach(l => l());
}
function setPeer(userId: string, p: Partial<RoomPeer>) {
  const cur = snap.peers.find(x => x.userId === userId);
  if (!cur && !p.name) return;
  const next: RoomPeer = { ...(cur ?? { userId, name: '', avatar: null, stream: null, video: false, state: 'connecting' }), ...p };
  set({ peers: cur ? snap.peers.map(x => (x.userId === userId ? next : x)) : [...snap.peers, next] });
}
function showNotice(text: string) {
  set({ notice: text });
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => set({ notice: null }), 4000);
}
function me(): string { return getUserIdFromToken() ?? ''; }
function emit(event: string, payload: object) { getActiveSocket()?.emit(event, payload); }

export function useCallRoom(): RoomSnapshot {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => snap,
  );
}

export function roomIsActive(): boolean {
  return !!snap.roomId && (snap.peers.length > 0 || snap.invited.length > 0);
}

// ── Micro / caméra de la salle ──────────────────────────────────────────

/** Copie des pistes de l'appel 1:1 si possible, sinon ouverture du micro (invité). */
async function ensureLocalStream(callType: 'audio' | 'video'): Promise<MediaStream | null> {
  if (snap.localStream) return snap.localStream;
  let stream: MediaStream;
  if (direct.localStream) {
    stream = new MediaStream(direct.localStream.getTracks().filter(t => t.readyState === 'live').map(t => t.clone()));
  } else {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
    } catch {
      showNotice('Impossible d’accéder au micro.');
      return null;
    }
  }
  stream.getAudioTracks().forEach(t => { t.enabled = !snap.muted; });
  set({ localStream: stream, videoOn: stream.getVideoTracks().length > 0 });
  return stream;
}

function stopLocal() {
  snap.localStream?.getTracks().forEach(t => t.stop());
  set({ localStream: null, videoOn: false });
}

// ── Connexions ──────────────────────────────────────────────────────────

async function linkTo(member: RoomMember): Promise<PeerLink | null> {
  const roomId = snap.roomId;
  const local = snap.localStream ?? await ensureLocalStream(direct.callType);
  if (!roomId || !local || snap.roomId !== roomId) return null;
  const existing = links.get(member.userId);
  if (existing) return existing;

  setPeer(member.userId, { ...member, state: 'connecting' });
  const iceServers = await getIceServers();
  if (snap.roomId !== roomId) return null;
  const again = links.get(member.userId);
  if (again) return again;

  const pc = new RTCPeerConnection({ iceServers });
  const link: PeerLink = { pc, makingOffer: false, pending: [] };
  links.set(member.userId, link);
  local.getTracks().forEach(t => pc.addTrack(t, local));

  pc.onicecandidate = (e) => {
    if (e.candidate) emit('call:room-signal', { roomId, targetUserId: member.userId, candidate: e.candidate.toJSON() });
  };
  pc.ontrack = (e) => {
    const stream = e.streams[0];
    if (!stream) return;
    // Nouvel objet à chaque piste : React voit le changement (vidéo arrivée en cours d'appel).
    setPeer(member.userId, { stream: new MediaStream(stream.getTracks()), video: stream.getVideoTracks().length > 0 });
  };
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState;
    if (st === 'connected') {
      setPeer(member.userId, { state: 'connected' });
      if (!snap.startedAt) set({ startedAt: Date.now() });
    }
    else if (st === 'failed' || st === 'disconnected') setPeer(member.userId, { state: 'lost' });
  };
  return link;
}

async function sendOffer(userId: string) {
  const roomId = snap.roomId;
  const link = links.get(userId);
  if (!roomId || !link || link.makingOffer) return;
  link.makingOffer = true;
  try {
    await link.pc.setLocalDescription(await link.pc.createOffer());
    const d = link.pc.localDescription;
    if (d) emit('call:room-signal', { roomId, targetUserId: userId, description: { type: d.type, sdp: d.sdp } });
  } catch (err) {
    console.warn('[Salle] offre impossible :', err);
  } finally {
    link.makingOffer = false;
  }
}

function dropPeer(userId: string) {
  const link = links.get(userId);
  if (link) { try { link.pc.close(); } catch { /* déjà fermé */ } }
  links.delete(userId);
  set({ peers: snap.peers.filter(p => p.userId !== userId) });
}

function clearRoom() {
  for (const link of links.values()) { try { link.pc.close(); } catch { /* déjà fermé */ } }
  links.clear();
  stopLocal();
  set({ roomId: null, peers: [], invited: [], joining: false, startedAt: null });
}

// ── Actions ─────────────────────────────────────────────────────────────

export function setDirectCall(d: DirectCall) {
  const wasActive = direct.active;
  direct = d;
  if (d.active) set({ muted: d.muted });
  // Copie déjà faite : on suit le micro coupé / rallumé de l'appel 1:1.
  snap.localStream?.getAudioTracks().forEach(t => { t.enabled = !(d.active ? d.muted : snap.muted); });
  /* L'appel 1:1 vient de finir et plus personne d'autre : la salle n'a plus lieu d'être. */
  if (wasActive && !d.active && snap.roomId && snap.peers.length === 0) leaveRoom();
}

export function inviteToCall(inviteeUserId: string) {
  const inCall = 1 + (direct.active ? 1 : 0) + snap.peers.length;
  if (inCall + snap.invited.length >= ROOM_MAX) { showNotice('L’appel est complet (4 personnes maximum).'); return; }
  if (!snap.roomId && !direct.remoteUserId) return;
  emit('call:room-invite', {
    ...(snap.roomId ? { roomId: snap.roomId } : { peerUserId: direct.remoteUserId }),
    inviteeUserId,
    callType: direct.callType,
  });
}

export async function acceptInvite() {
  const inv = snap.incomingInvite;
  if (!inv) return;
  set({ incomingInvite: null, joining: true, roomId: inv.roomId, peers: [], invited: [] });
  const local = await ensureLocalStream(inv.callType);
  if (!local) { emit('call:room-decline', { roomId: inv.roomId }); clearRoom(); return; }
  emit('call:room-join', { roomId: inv.roomId });
}

export function declineInvite() {
  const inv = snap.incomingInvite;
  if (inv) emit('call:room-decline', { roomId: inv.roomId });
  set({ incomingInvite: null });
}

export function leaveRoom() {
  if (snap.roomId) emit('call:room-leave', { roomId: snap.roomId });
  clearRoom();
}

/** Micro de la salle (quand il n'y a plus d'appel 1:1 ; sinon c'est celui-ci qui commande). */
export function toggleRoomMute() {
  const muted = !snap.muted;
  snap.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  set({ muted });
}

/** Caméra : coupe / rallume, ou l'ouvre et l'envoie à tous (renégociation). */
export async function toggleRoomVideo() {
  const local = snap.localStream;
  if (!local) return;
  const tracks = local.getVideoTracks();
  if (tracks.length) {
    const on = !tracks.some(t => t.enabled);
    tracks.forEach(t => { t.enabled = on; });
    set({ videoOn: on });
    return;
  }
  try {
    const cam = await navigator.mediaDevices.getUserMedia({ video: true });
    const track = cam.getVideoTracks()[0];
    if (!track || snap.localStream !== local) { cam.getTracks().forEach(t => t.stop()); return; }
    local.addTrack(track);
    set({ localStream: local, videoOn: true });
    for (const [userId, link] of links) {
      link.pc.addTrack(track, local);
      void sendOffer(userId);
    }
  } catch {
    showNotice('Impossible d’ouvrir la caméra.');
  }
}

// ── Écouteurs socket ────────────────────────────────────────────────────

type Snap = { roomId: string; participants: RoomMember[]; invited: RoomMember[] };

const handlers = {
  'call:room-invite': (p: RoomInvite) => {
    if (direct.active || snap.roomId || snap.incomingInvite) { emit('call:room-decline', { roomId: p.roomId }); return; }
    set({ incomingInvite: p });
  },
  'call:room-invite-cancelled': (p: { roomId: string }) => {
    if (snap.incomingInvite?.roomId === p.roomId) set({ incomingInvite: null });
  },
  'call:room-state': (p: Snap) => {
    if (!p.participants.some(x => x.userId === me())) return;
    if (snap.roomId && snap.roomId !== p.roomId) return;
    set({ roomId: p.roomId, invited: p.invited });
    for (const m of p.participants) if (snap.peers.some(x => x.userId === m.userId)) setPeer(m.userId, { name: m.name, avatar: m.avatar });
  },
  'call:room-joined': async (p: { roomId: string; participants: RoomMember[] }) => {
    if (snap.roomId !== p.roomId) return;
    set({ joining: false });
    for (const m of p.participants) {
      if (m.userId === me()) continue;
      if (await linkTo(m)) void sendOffer(m.userId);
    }
  },
  'call:room-peer-joined': async (p: { roomId: string; member: RoomMember }) => {
    if (snap.roomId !== p.roomId || p.member.userId === me()) return;
    setPeer(p.member.userId, { ...p.member, state: 'connecting' });
    await ensureLocalStream(direct.callType);   // prêt à répondre à son offre
  },
  'call:room-signal': async (p: { roomId: string; fromUserId: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
    if (snap.roomId !== p.roomId || p.fromUserId === me()) return;
    const known = snap.peers.find(x => x.userId === p.fromUserId);
    const link = links.get(p.fromUserId) ?? (known ? await linkTo(known) : null);
    if (!link) return;   // signal d'un inconnu : ignoré

    if (p.description) {
      const offer = p.description.type === 'offer';
      const polite = me() > p.fromUserId;
      const collision = offer && (link.makingOffer || link.pc.signalingState !== 'stable');
      if (collision && !polite) return;
      try {
        await link.pc.setRemoteDescription(p.description);   // rollback implicite côté navigateur
        for (const c of link.pending) await link.pc.addIceCandidate(c).catch(() => undefined);
        link.pending = [];
        if (offer) {
          await link.pc.setLocalDescription(await link.pc.createAnswer());
          const d = link.pc.localDescription;
          if (d) emit('call:room-signal', { roomId: p.roomId, targetUserId: p.fromUserId, description: { type: d.type, sdp: d.sdp } });
        }
      } catch (err) {
        console.warn('[Salle] négociation échouée :', err);
      }
    } else if (p.candidate?.candidate) {
      if (!link.pc.remoteDescription) link.pending.push(p.candidate);
      else await link.pc.addIceCandidate(p.candidate).catch(() => undefined);
    }
  },
  'call:room-peer-left': (p: { roomId: string; userId: string }) => {
    if (snap.roomId !== p.roomId) return;
    const name = snap.peers.find(x => x.userId === p.userId)?.name;
    dropPeer(p.userId);
    if (name) showNotice(`${name} a quitté l’appel`);
    if (!snap.peers.length && !direct.active) leaveRoom();
  },
  'call:room-closed': (p: { roomId: string }) => {
    if (snap.roomId === p.roomId) clearRoom();
  },
  'call:room-declined': (p: { roomId: string; member: RoomMember; reason: string }) => {
    if (snap.roomId !== p.roomId) return;
    showNotice(p.reason === 'declined' ? `${p.member.name} a refusé` : `${p.member.name} n’a pas répondu`);
  },
  'call:room-error': (p: { message?: string }) => showNotice(p?.message ?? 'Action impossible.'),
} as const;

let boundSocket: ReturnType<typeof getActiveSocket> = null;

/**
 * Branche les écouteurs sur le socket global (idempotent). Le socket peut être
 * créé après le montage ou remplacé à la reconnexion : on revérifie régulièrement.
 */
export function bindCallRoomSocket(): () => void {
  const sync = () => {
    const socket = getActiveSocket();
    if (!socket || socket === boundSocket) return;
    if (boundSocket) for (const [ev, fn] of Object.entries(handlers)) boundSocket.off(ev, fn as never);
    for (const [ev, fn] of Object.entries(handlers)) socket.on(ev, fn as never);
    boundSocket = socket;
  };
  sync();
  const id = setInterval(sync, 1500);
  return () => {
    clearInterval(id);
    if (boundSocket) for (const [ev, fn] of Object.entries(handlers)) boundSocket.off(ev, fn as never);
    boundSocket = null;
  };
}
