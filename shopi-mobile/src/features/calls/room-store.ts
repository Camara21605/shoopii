/**
 * src/features/calls/room-store.ts
 *
 * Appels à plusieurs (jusqu'à 4) — ajouter une personne à un appel en cours.
 *
 * Chaque téléphone se connecte directement à chacun des autres (mesh WebRTC) ;
 * le serveur (call-room.gateway.ts) ne fait que relayer la signalisation, et
 * seulement entre membres d'une même salle. La connexion 1:1 de départ
 * (call-store.ts) n'est pas touchée : une salle ajoute des connexions à côté.
 *
 *   Inviter        → call:room-invite  { peerUserId | roomId, inviteeUserId }
 *   Invité         ← call:room-invite  (sonne comme un appel : Rejoindre / Refuser)
 *   Rejoindre      → call:room-join    ← call:room-joined (liste des présents)
 *   Le nouvel arrivant envoie une offre à chacun ; les autres répondent.
 *   Signalisation  ↔ call:room-signal  { description | candidate }
 *   Quitter        → call:room-leave   ← call:room-peer-left / call:room-closed
 *
 * Renégociation (caméra activée en cours d'appel) : « perfect negotiation » —
 * en cas d'offres croisées, celui dont l'identifiant est le plus grand cède.
 */
import { create } from 'zustand';
import {
  RTCIceCandidate, RTCPeerConnection, RTCSessionDescription, type MediaStream,
} from 'react-native-webrtc';

import { useSession } from '@/features/auth/session-store';
import { connectRealtime, getSocket } from '@/lib/realtime/socket';

import { getIceServers } from './api';
import {
  cancelRoomInvite, getLocalStream, markRoomConnected, onRoomEmpty, registerRoomHooks,
  surfaceRoomInvite, useCallStore,
} from './call-store';

export const ROOM_MAX = 4;

export interface RoomMember { userId: string; name: string; avatar: string | null }

export interface RoomPeer extends RoomMember {
  streamURL: string | null;
  video: boolean;
  state: 'connecting' | 'connected' | 'lost';
}

interface RoomState {
  roomId: string | null;
  peers: Record<string, RoomPeer>;
  invited: RoomMember[];
  /** Petit message passager (« X n'a pas répondu », refus du serveur…). */
  notice: string | null;
}

export const useRoomStore = create<RoomState>(() => ({ roomId: null, peers: {}, invited: [], notice: null }));

interface PeerLink {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  pending: RTCIceCandidate[];
}
const links = new Map<string, PeerLink>();
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

function me(): string { return useSession.getState().user?.id ?? ''; }
function emit(event: string, payload: object) { getSocket()?.emit(event, payload); }
function setPeer(userId: string, p: Partial<RoomPeer>) {
  useRoomStore.setState(s => {
    const cur = s.peers[userId];
    if (!cur && !p.name) return s;
    return { peers: { ...s.peers, [userId]: { ...(cur ?? { userId, name: '', avatar: null, streamURL: null, video: false, state: 'connecting' }), ...p } } };
  });
}
function showNotice(text: string) {
  useRoomStore.setState({ notice: text });
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => useRoomStore.setState({ notice: null }), 4000);
}

// ── Connexions ────────────────────────────────────────────────────────

async function linkTo(member: RoomMember): Promise<PeerLink | null> {
  const roomId = useRoomStore.getState().roomId;
  const local = getLocalStream();
  if (!roomId || !local) return null;
  const existing = links.get(member.userId);
  if (existing) return existing;

  setPeer(member.userId, { ...member, state: 'connecting' });
  const iceServers = await getIceServers();
  if (useRoomStore.getState().roomId !== roomId) return null;
  const again = links.get(member.userId);
  if (again) return again;

  const pc = new RTCPeerConnection({ iceServers: iceServers as any });
  const link: PeerLink = { pc, makingOffer: false, pending: [] };
  links.set(member.userId, link);
  local.getTracks().forEach(t => pc.addTrack(t, local));

  pc.onicecandidate = ((e: any) => {
    if (!e.candidate) return;
    emit('call:room-signal', { roomId, targetUserId: member.userId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
  }) as any;
  pc.ontrack = ((e: any) => {
    const stream = e.streams?.[0] as MediaStream | undefined;
    if (!stream) return;
    setPeer(member.userId, { streamURL: stream.toURL(), video: e.track?.kind === 'video' || stream.getVideoTracks().length > 0 });
  }) as any;
  pc.onconnectionstatechange = (() => {
    const st = pc.connectionState;
    if (st === 'connected') { setPeer(member.userId, { state: 'connected' }); markRoomConnected(); }
    else if (st === 'failed' || st === 'disconnected') setPeer(member.userId, { state: 'lost' });
  }) as any;
  return link;
}

async function sendOffer(userId: string) {
  const roomId = useRoomStore.getState().roomId;
  const link = links.get(userId);
  if (!roomId || !link || link.makingOffer) return;
  link.makingOffer = true;
  try {
    const offer = await link.pc.createOffer({});
    await link.pc.setLocalDescription(offer);
    emit('call:room-signal', { roomId, targetUserId: userId, description: { type: offer.type, sdp: offer.sdp } });
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
  useRoomStore.setState(s => {
    const peers = { ...s.peers };
    delete peers[userId];
    return { peers };
  });
}

function clearRoom() {
  for (const link of links.values()) { try { link.pc.close(); } catch { /* déjà fermé */ } }
  links.clear();
  useRoomStore.setState({ roomId: null, peers: {}, invited: [] });
}

// ── Actions ───────────────────────────────────────────────────────────

/** Ajouter quelqu'un à l'appel en cours. */
export function inviteToCall(inviteeUserId: string): void {
  const { roomId, peers, invited } = useRoomStore.getState();
  const call = useCallStore.getState();
  const info = call.callInfo;
  if (!info) return;
  const direct = info.roomOnly ? 0 : 1;
  if (1 + direct + Object.keys(peers).length + invited.length >= ROOM_MAX) {
    showNotice('L’appel est complet (4 personnes maximum).');
    return;
  }
  connectRealtime();
  emit('call:room-invite', {
    ...(roomId ? { roomId } : { peerUserId: info.remoteUserId }),
    inviteeUserId,
    callType: info.callType,
  });
}

export function leaveRoom(): void {
  const { roomId } = useRoomStore.getState();
  if (roomId) emit('call:room-leave', { roomId });
  clearRoom();
}

registerRoomHooks({
  hasPeers: () => Object.keys(useRoomStore.getState().peers).length > 0,
  join: (roomId) => {
    useRoomStore.setState({ roomId, peers: {}, invited: [] });
    emit('call:room-join', { roomId });
  },
  decline: (roomId) => emit('call:room-decline', { roomId }),
  leave: leaveRoom,
  onLocalTrack: (track) => {
    const local = getLocalStream();
    if (!local) return;
    for (const [userId, link] of links) {
      try { link.pc.addTrack(track, local); } catch { /* déjà présente */ }
      void sendOffer(userId);
    }
  },
});

// ── Écouteurs socket (installés par CallProvider) ─────────────────────

type Snapshot = { roomId: string; participants: RoomMember[]; invited: RoomMember[] };

export function attachRoomListeners(): () => void {
  const socket = connectRealtime();

  const onInvite = (p: { roomId: string; callType: 'audio' | 'video'; inviter: RoomMember }) => {
    if (!surfaceRoomInvite(p)) emit('call:room-decline', { roomId: p.roomId });   // déjà en appel
  };
  const onInviteCancelled = (p: { roomId: string }) => cancelRoomInvite(p.roomId);

  /* État de la salle : je suis dedans (salle créée par moi ou l'autre personne de mon appel). */
  const onState = (p: Snapshot) => {
    const myId = me();
    if (!p.participants.some(x => x.userId === myId)) return;
    const cur = useRoomStore.getState().roomId;
    if (cur && cur !== p.roomId) return;
    useRoomStore.setState({ roomId: p.roomId, invited: p.invited });
    // Noms à jour pour les tuiles existantes.
    for (const m of p.participants) if (useRoomStore.getState().peers[m.userId]) setPeer(m.userId, { name: m.name, avatar: m.avatar });
  };

  /* Je viens d'arriver : une offre à chaque personne déjà présente. */
  const onJoined = async (p: { roomId: string; participants: RoomMember[] }) => {
    if (useRoomStore.getState().roomId !== p.roomId) return;
    for (const m of p.participants) {
      if (m.userId === me()) continue;
      const link = await linkTo(m);
      if (link) void sendOffer(m.userId);
    }
  };

  /* Quelqu'un arrive : il va m'envoyer une offre ; je prépare sa tuile. */
  const onPeerJoined = (p: { roomId: string; member: RoomMember }) => {
    if (useRoomStore.getState().roomId !== p.roomId || p.member.userId === me()) return;
    setPeer(p.member.userId, { ...p.member, state: 'connecting' });
  };

  const onSignal = async (p: { roomId: string; fromUserId: string; description?: { type: string; sdp: string }; candidate?: any }) => {
    const state = useRoomStore.getState();
    if (state.roomId !== p.roomId || p.fromUserId === me()) return;
    const known = state.peers[p.fromUserId];
    const link = links.get(p.fromUserId) ?? (known ? await linkTo(known) : null);
    if (!link) return;   // signal d'un inconnu : ignoré

    if (p.description) {
      const offer = p.description.type === 'offer';
      const polite = me() > p.fromUserId;
      const collision = offer && (link.makingOffer || link.pc.signalingState !== 'stable');
      if (collision && !polite) return;
      try {
        if (collision) await link.pc.setLocalDescription({ type: 'rollback' } as any);
        await link.pc.setRemoteDescription(new RTCSessionDescription(p.description as any));
        for (const c of link.pending) { try { await link.pc.addIceCandidate(c); } catch { /* périmé */ } }
        link.pending = [];
        if (offer) {
          const answer = await link.pc.createAnswer();
          await link.pc.setLocalDescription(answer);
          emit('call:room-signal', { roomId: p.roomId, targetUserId: p.fromUserId, description: { type: answer.type, sdp: answer.sdp } });
        }
      } catch (err) {
        console.warn('[Salle] négociation échouée :', err);
      }
    } else if (p.candidate?.candidate) {
      const c = new RTCIceCandidate(p.candidate);
      if (!link.pc.remoteDescription) link.pending.push(c);
      else { try { await link.pc.addIceCandidate(c); } catch { /* périmé */ } }
    }
  };

  const onPeerLeft = (p: { roomId: string; userId: string }) => {
    if (useRoomStore.getState().roomId !== p.roomId) return;
    const name = useRoomStore.getState().peers[p.userId]?.name;
    dropPeer(p.userId);
    if (name) showNotice(`${name} a quitté l’appel`);
    if (!Object.keys(useRoomStore.getState().peers).length) onRoomEmpty();
  };

  const onClosed = (p: { roomId: string }) => {
    if (useRoomStore.getState().roomId !== p.roomId) return;
    clearRoom();
    onRoomEmpty();
  };

  const onDeclined = (p: { roomId: string; member: RoomMember; reason: string }) => {
    if (useRoomStore.getState().roomId !== p.roomId) return;
    showNotice(p.reason === 'declined' ? `${p.member.name} a refusé` : `${p.member.name} n’a pas répondu`);
  };
  const onError = (p: { message?: string }) => showNotice(p?.message ?? 'Action impossible.');

  socket.on('call:room-invite', onInvite);
  socket.on('call:room-invite-cancelled', onInviteCancelled);
  socket.on('call:room-state', onState);
  socket.on('call:room-joined', onJoined);
  socket.on('call:room-peer-joined', onPeerJoined);
  socket.on('call:room-signal', onSignal);
  socket.on('call:room-peer-left', onPeerLeft);
  socket.on('call:room-closed', onClosed);
  socket.on('call:room-declined', onDeclined);
  socket.on('call:room-error', onError);

  return () => {
    socket.off('call:room-invite', onInvite);
    socket.off('call:room-invite-cancelled', onInviteCancelled);
    socket.off('call:room-state', onState);
    socket.off('call:room-joined', onJoined);
    socket.off('call:room-peer-joined', onPeerJoined);
    socket.off('call:room-signal', onSignal);
    socket.off('call:room-peer-left', onPeerLeft);
    socket.off('call:room-closed', onClosed);
    socket.off('call:room-declined', onDeclined);
    socket.off('call:room-error', onError);
  };
}
