/* ============================================================
 * FICHIER : src/modules/call/call-room.registry.spec.ts
 * Appels à plusieurs : limites, invitations, départs (logique pure).
 * ============================================================ */

import { CallRoomRegistry, ROOM_INVITE_TTL_MS, ROOM_MAX_PARTICIPANTS } from './call-room.registry';

const m = (userId: string) => ({ userId, name: userId.toUpperCase(), avatar: null });

function roomAB() {
  const reg = new CallRoomRegistry();
  const room = reg.createFromCall('call-1', 'audio', [m('a'), m('b')]);
  return { reg, room };
}

describe('CallRoomRegistry', () => {
  it('une seule salle par appel 1:1 (les deux personnes partagent la même)', () => {
    const { reg, room } = roomAB();
    expect(reg.createFromCall('call-1', 'audio', [m('b'), m('a')])).toBe(room);
    expect(reg.roomForCall('call-1')).toBe(room);
  });

  it(`${ROOM_MAX_PARTICIPANTS} personnes maximum, invitations en attente comprises`, () => {
    const { reg, room } = roomAB();
    reg.invite(room, m('c'), 'a');
    reg.invite(room, m('d'), 'a');
    expect(reg.checkInvite(room, 'a', 'e')).toBe('full');
  });

  it('refuse de réinviter quelqu’un déjà présent ou déjà invité, ou soi-même', () => {
    const { reg, room } = roomAB();
    reg.invite(room, m('c'), 'a');
    expect(reg.checkInvite(room, 'a', 'b')).toBe('already-in');
    expect(reg.checkInvite(room, 'b', 'c')).toBe('already-invited');
    expect(reg.checkInvite(room, 'a', 'a')).toBe('self');
    expect(reg.checkInvite(room, 'a', 'd')).toBeNull();
  });

  it('seule une personne invitée peut rejoindre, et seulement avant expiration', () => {
    const { reg, room } = roomAB();
    expect(reg.accept(room, 'intrus')).toBeNull();
    reg.invite(room, m('c'), 'a', 1_000);
    expect(reg.accept(room, 'c', 1_000 + ROOM_INVITE_TTL_MS + 1)).toBeNull();
    expect(room.participants.has('c')).toBe(false);

    reg.invite(room, m('d'), 'a', 5_000);
    expect(reg.accept(room, 'd', 6_000)).toEqual(m('d'));
    expect(room.participants.has('d')).toBe(true);
  });

  it('les invitations expirées sont retirées', () => {
    const { reg, room } = roomAB();
    reg.invite(room, m('c'), 'a', 0);
    expect(reg.expireInvites(ROOM_INVITE_TTL_MS + 1)).toEqual([{ room, member: m('c') }]);
    expect(room.invited.size).toBe(0);
  });

  it('la salle se ferme quand il reste moins de 2 personnes', () => {
    const { reg, room } = roomAB();
    reg.invite(room, m('c'), 'a');
    reg.accept(room, 'c');
    expect(reg.leave(room, 'a')).toEqual({ left: true, closed: false, remaining: ['b', 'c'] });
    expect(reg.leave(room, 'b')).toEqual({ left: true, closed: true, remaining: ['c'] });
    expect(reg.get(room.id)).toBeUndefined();
    expect(reg.roomForCall('call-1')).toBeUndefined();
  });

  it('isInAnyRoom ne compte que les présents (pas les invités)', () => {
    const { reg, room } = roomAB();
    reg.invite(room, m('c'), 'a');
    expect(reg.isInAnyRoom('a')).toBe(true);
    expect(reg.isInAnyRoom('c')).toBe(false);
  });
});
