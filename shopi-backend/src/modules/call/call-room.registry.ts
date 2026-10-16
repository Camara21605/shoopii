/* ============================================================
 * FICHIER : src/modules/call/call-room.registry.ts
 *
 * RÔLE : État en mémoire des appels à plusieurs (jusqu'à 4 personnes).
 *
 * Un appel 1:1 en cours devient une « salle » dès que l'un des deux invite
 * une 3e personne. Chaque téléphone/navigateur se connecte directement à
 * chacun des autres (mesh WebRTC) : le serveur ne fait que relayer la
 * signalisation et ne voit jamais passer la voix ni l'image.
 *
 * Logique pure (aucune dépendance Nest / socket / base) : testée seule dans
 * call-room.registry.spec.ts. En mémoire, comme les autres états d'appel
 * (CallGateway.callBindings) : perdue au redémarrage du serveur, ce qui ne
 * coupe pas les appels déjà établis (les flux ne passent pas par lui).
 * ============================================================ */

import { randomUUID } from 'crypto';

/** Participants maximum (moi compris) — au-delà, il faudrait un serveur média. */
export const ROOM_MAX_PARTICIPANTS = 4;
/** Une invitation non répondue expire comme une sonnerie. */
export const ROOM_INVITE_TTL_MS = 45_000;

export interface RoomMember {
  userId: string;
  name:   string;
  avatar: string | null;
}

interface PendingInvite extends RoomMember {
  invitedBy: string;
  expiresAt: number;
}

export interface CallRoom {
  id:           string;
  /** Appel 1:1 d'origine (null si la salle survit à sa fin). */
  callId:       string | null;
  callType:     'audio' | 'video';
  participants: Map<string, RoomMember>;
  invited:      Map<string, PendingInvite>;
  createdAt:    number;
}

export interface RoomSnapshot {
  roomId:       string;
  callType:     'audio' | 'video';
  participants: RoomMember[];
  invited:      RoomMember[];
}

export type InviteRefusal = 'full' | 'already-in' | 'already-invited' | 'self';

export class CallRoomRegistry {
  private readonly rooms  = new Map<string, CallRoom>();
  private readonly byCall = new Map<string, string>();

  get(roomId: string): CallRoom | undefined {
    return this.rooms.get(roomId);
  }

  roomForCall(callId: string): CallRoom | undefined {
    const id = this.byCall.get(callId);
    return id ? this.rooms.get(id) : undefined;
  }

  /** Crée la salle à partir d'un appel 1:1 (les deux personnes déjà en ligne). */
  createFromCall(callId: string, callType: 'audio' | 'video', members: RoomMember[]): CallRoom {
    const existing = this.roomForCall(callId);
    if (existing) return existing;
    const room: CallRoom = {
      id: randomUUID(), callId, callType,
      participants: new Map(members.map(m => [m.userId, m])),
      invited: new Map(),
      createdAt: Date.now(),
    };
    this.rooms.set(room.id, room);
    this.byCall.set(callId, room.id);
    return room;
  }

  isParticipant(room: CallRoom, userId: string): boolean {
    return room.participants.has(userId);
  }

  /** Salles où cet utilisateur est présent ou invité. */
  roomsOf(userId: string): CallRoom[] {
    return [...this.rooms.values()].filter(r => r.participants.has(userId) || r.invited.has(userId));
  }

  isInAnyRoom(userId: string): boolean {
    return [...this.rooms.values()].some(r => r.participants.has(userId));
  }

  /** Pourquoi cette invitation est impossible (null = possible). Les invitations en attente comptent dans la limite. */
  checkInvite(room: CallRoom, inviterId: string, inviteeId: string): InviteRefusal | null {
    if (inviteeId === inviterId) return 'self';
    if (room.participants.has(inviteeId)) return 'already-in';
    if (room.invited.has(inviteeId)) return 'already-invited';
    if (room.participants.size + room.invited.size >= ROOM_MAX_PARTICIPANTS) return 'full';
    return null;
  }

  invite(room: CallRoom, member: RoomMember, invitedBy: string, now = Date.now()): void {
    room.invited.set(member.userId, { ...member, invitedBy, expiresAt: now + ROOM_INVITE_TTL_MS });
  }

  /** L'invité rejoint : renvoie son profil, ou null (pas invité, invitation expirée, salle pleine). */
  accept(room: CallRoom, userId: string, now = Date.now()): RoomMember | null {
    const inv = room.invited.get(userId);
    if (!inv) return null;
    room.invited.delete(userId);
    if (inv.expiresAt < now || room.participants.size >= ROOM_MAX_PARTICIPANTS) return null;
    const member: RoomMember = { userId: inv.userId, name: inv.name, avatar: inv.avatar };
    room.participants.set(userId, member);
    return member;
  }

  removeInvite(room: CallRoom, userId: string): RoomMember | null {
    const inv = room.invited.get(userId);
    if (!inv) return null;
    room.invited.delete(userId);
    return { userId: inv.userId, name: inv.name, avatar: inv.avatar };
  }

  /** Départ d'un participant. `closed` = il reste moins de 2 personnes : la salle est supprimée. */
  leave(room: CallRoom, userId: string): { left: boolean; closed: boolean; remaining: string[] } {
    const left = room.participants.delete(userId);
    room.invited.delete(userId);
    const remaining = [...room.participants.keys()];
    if (remaining.length < 2) {
      this.delete(room);
      return { left, closed: true, remaining };
    }
    return { left, closed: false, remaining };
  }

  /** Invitations expirées, retirées de leur salle. */
  expireInvites(now = Date.now()): Array<{ room: CallRoom; member: RoomMember }> {
    const out: Array<{ room: CallRoom; member: RoomMember }> = [];
    for (const room of this.rooms.values()) {
      for (const [userId, inv] of room.invited) {
        if (inv.expiresAt <= now) {
          room.invited.delete(userId);
          out.push({ room, member: { userId, name: inv.name, avatar: inv.avatar } });
        }
      }
    }
    return out;
  }

  /** L'appel 1:1 d'origine est fini : la salle continue sans lui être rattachée. */
  detachCall(callId: string): void {
    const room = this.roomForCall(callId);
    this.byCall.delete(callId);
    if (room) room.callId = null;
  }

  snapshot(room: CallRoom): RoomSnapshot {
    return {
      roomId: room.id,
      callType: room.callType,
      participants: [...room.participants.values()],
      invited: [...room.invited.values()].map(({ userId, name, avatar }) => ({ userId, name, avatar })),
    };
  }

  private delete(room: CallRoom): void {
    this.rooms.delete(room.id);
    if (room.callId) this.byCall.delete(room.callId);
  }
}
