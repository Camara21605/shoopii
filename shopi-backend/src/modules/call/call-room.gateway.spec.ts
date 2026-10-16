/* ============================================================
 * FICHIER : src/modules/call/call-room.gateway.spec.ts
 * Appels à plusieurs : qui peut inviter, rejoindre, et recevoir la signalisation.
 * ============================================================ */

import { CallRoomGateway } from './call-room.gateway';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const X = '00000000-0000-4000-8000-0000000000ff';

function setup() {
  const emitted: Array<{ to: string; event: string; payload: any }> = [];
  const server = {
    to: (room: string) => ({
      emit: (event: string, payload: any) => emitted.push({ to: room, event, payload }),
      except: () => ({ emit: (event: string, payload: any) => emitted.push({ to: room, event, payload }) }),
    }),
    in: () => ({ fetchSockets: async () => [] }),
  };
  const callService = {
    findActiveCallId: jest.fn().mockResolvedValue('call-1'),
    assertCanCall:    jest.fn().mockResolvedValue(undefined),
    isUserBusy:       jest.fn().mockResolvedValue(false),
    getCallerDisplayInfo: jest.fn(async (id: string) => ({ name: `nom-${id.slice(-1)}`, avatar: null })),
  };
  const gw = new CallRoomGateway(callService as any);
  (gw as any).server = server;
  const socket = (userId: string) => ({ id: `s-${userId}`, data: { userId }, emit: jest.fn() }) as any;
  const events = (event: string) => emitted.filter(e => e.event === event);
  return { gw, callService, socket, emitted, events };
}

describe('CallRoomGateway', () => {
  it('A invite C pendant un appel avec B : C sonne, A et B voient l’invitation', async () => {
    const { gw, socket, events } = setup();
    await gw.handleInvite(socket(A), { peerUserId: B, inviteeUserId: C });

    const invite = events('call:room-invite')[0];
    expect(invite.to).toBe(`user:${C}`);
    expect(invite.payload.inviter).toEqual({ userId: A, name: 'nom-a', avatar: null });
    expect(events('call:room-state').map(e => e.to).sort()).toEqual([`user:${A}`, `user:${B}`]);
  });

  it('refuse sans appel 1:1 actif avec peerUserId (impossible de fabriquer une salle)', async () => {
    const { gw, callService, socket, events } = setup();
    callService.findActiveCallId.mockResolvedValue(null);
    const s = socket(X);
    await gw.handleInvite(s, { peerUserId: B, inviteeUserId: C });
    expect(events('call:room-invite')).toHaveLength(0);
    expect(s.emit).toHaveBeenCalledWith('call:room-error', expect.any(Object));
  });

  it('respecte les règles d’appel (permissions) et l’occupation de l’invité', async () => {
    const { gw, callService, socket, events } = setup();
    callService.assertCanCall.mockRejectedValueOnce(new Error('Vous ne pouvez pas encore appeler cet utilisateur'));
    await gw.handleInvite(socket(A), { peerUserId: B, inviteeUserId: C });
    callService.isUserBusy.mockResolvedValueOnce(true);
    await gw.handleInvite(socket(A), { peerUserId: B, inviteeUserId: C });
    expect(events('call:room-invite')).toHaveLength(0);
  });

  it('seul l’invité peut rejoindre ; il reçoit la liste des autres pour leur envoyer une offre', async () => {
    const { gw, socket, events } = setup();
    await gw.handleInvite(socket(A), { peerUserId: B, inviteeUserId: C });
    const roomId = events('call:room-invite')[0].payload.roomId;

    const intrus = socket(X);
    gw.handleJoin(intrus, { roomId });
    expect(intrus.emit).toHaveBeenCalledWith('call:room-error', expect.any(Object));

    const c = socket(C);
    gw.handleJoin(c, { roomId });
    const joined = c.emit.mock.calls.find((call: any[]) => call[0] === 'call:room-joined');
    expect(joined[1].participants.map((p: any) => p.userId).sort()).toEqual([A, B]);
  });

  it('la signalisation n’est relayée qu’entre membres de la même salle', async () => {
    const { gw, socket, events } = setup();
    await gw.handleInvite(socket(A), { peerUserId: B, inviteeUserId: C });
    const roomId = events('call:room-invite')[0].payload.roomId;
    gw.handleJoin(socket(C), { roomId });

    const sdp = { type: 'offer' as const, sdp: 'v=0' };
    gw.handleSignal(socket(C), { roomId, targetUserId: A, description: sdp });
    gw.handleSignal(socket(X), { roomId, targetUserId: A, description: sdp });   // pas membre
    gw.handleSignal(socket(C), { roomId, targetUserId: X, description: sdp });   // cible pas membre

    const relayed = events('call:room-signal');
    expect(relayed).toHaveLength(1);
    expect(relayed[0]).toMatchObject({ to: `user:${A}`, payload: { fromUserId: C, description: sdp } });
  });

  it('quand il ne reste qu’une personne, la salle se ferme', async () => {
    const { gw, socket, events } = setup();
    await gw.handleInvite(socket(A), { peerUserId: B, inviteeUserId: C });
    const roomId = events('call:room-invite')[0].payload.roomId;
    gw.handleJoin(socket(C), { roomId });

    gw.handleLeave(socket(A), { roomId });
    expect(events('call:room-closed')).toHaveLength(0);
    gw.handleLeave(socket(B), { roomId });
    expect(events('call:room-closed').map(e => e.to)).toEqual([`user:${C}`]);
  });

  it('une invitation non répondue expire et prévient les participants', async () => {
    const { gw, socket, events } = setup();
    await gw.handleInvite(socket(A), { peerUserId: B, inviteeUserId: C });
    gw.sweepInvites(Date.now() + 60_000);
    expect(events('call:room-declined').map(e => e.payload.reason)).toEqual(['timeout', 'timeout']);
    expect(events('call:room-invite-cancelled').map(e => e.to)).toEqual([`user:${C}`]);
  });
});
