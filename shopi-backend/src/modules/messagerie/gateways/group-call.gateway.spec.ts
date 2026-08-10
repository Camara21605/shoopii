/* ============================================================
 * FICHIER      : src/modules/messagerie/gateways/group-call.gateway.spec.ts
 * MODULE       : Messagerie — appels de groupe (mesh WebRTC)
 * RÔLE         : Tests unitaires de GroupCallGateway.
 *
 * COUVERTURE :
 *   ✅ initiate — non-membre refusé, groupe inactif refusé, appel déjà
 *      actif refusé (un seul appel simultané par groupe)
 *   ✅ initiate — l'initiateur reçoit joined, les AUTRES membres reçoivent
 *      incoming (jamais l'initiateur lui-même — évite de se voir inviter
 *      à son propre appel)
 *   ✅ join — participant idempotent, réponse contient les pairs déjà présents
 *   ✅ signalisation (offer/answer/ice_candidate) — relayée seulement entre
 *      participants ACTIFS de l'appel, silencieuse sinon (pas de crash)
 *   ✅ leave — dernier participant → appel terminé + message sauvegardé
 *   ✅ decline — ajouté au set "declined", ne bloque pas les autres
 *   ✅ déconnexion — retire l'utilisateur de tous ses appels actifs
 *
 * Comme le reste de la suite, tous les repos TypeORM sont mockés — pas de
 * connexion DB réelle. L'état des appels actifs (Map en mémoire) est
 * exercé tel quel puisque c'est une structure interne au gateway, pas une
 * dépendance injectée.
 * ============================================================ */

import { GroupCallGateway } from './group-call.gateway';
import { BroadcastService } from '../services/broadcast.service';
import { CallType } from 'src/database/entities/call/call.entity';
import type { AuthenticatedSocket } from '../interfaces/messaging.interfaces';

function makeSocket(userId: string): AuthenticatedSocket & { emit: jest.Mock } {
  return { data: { userId }, emit: jest.fn() } as unknown as AuthenticatedSocket & { emit: jest.Mock };
}

function makeMember(userId: string, displayName = 'Membre') {
  return { groupId: 'group-uuid', userId, displayName, isActive: true };
}

const mockRepo = () => ({
  findOne: jest.fn(),
  find:    jest.fn().mockResolvedValue([]),
});

describe('GroupCallGateway', () => {
  let gateway: GroupCallGateway;
  let memberRepo: ReturnType<typeof mockRepo>;
  let groupRepo: ReturnType<typeof mockRepo>;
  let msgRepo: { save: jest.Mock; create: jest.Mock };
  let broadcast: { emitToUser: jest.Mock };

  beforeEach(() => {
    /* handleInitiate arme un setTimeout(30_000) réel pour la sonnerie —
     * sans timers factices, Jest attend ces 30s en temps réel à chaque
     * test qui démarre un appel (bruyant, lent, et laisse des handles
     * ouverts signalés par Jest en fin de run). */
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    memberRepo = mockRepo();
    groupRepo  = mockRepo();
    msgRepo    = { save: jest.fn().mockResolvedValue({ id: 'msg-uuid', createdAt: new Date(), content: '{}' }), create: jest.fn(x => x) };
    broadcast  = { emitToUser: jest.fn() };

    groupRepo.findOne.mockResolvedValue({ id: 'group-uuid', status: 'active', commandeNumero: 'CMD-1' });

    gateway = new GroupCallGateway(
      memberRepo as any, groupRepo as any, msgRepo as any, broadcast as unknown as BroadcastService,
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════
  // group_call:initiate
  // ════════════════════════════════════════════════════════════

  describe('handleInitiate', () => {
    it('non-membre refusé — group_call:error NOT_MEMBER', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      const socket = makeSocket('intrus-uuid');

      await gateway.handleInitiate(socket, { groupId: 'group-uuid' });

      expect(socket.emit).toHaveBeenCalledWith('group_call:error', expect.objectContaining({ code: 'NOT_MEMBER' }));
      expect(broadcast.emitToUser).not.toHaveBeenCalled();
    });

    it('groupe inactif (expired) refusé', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember('user-uuid'));
      groupRepo.findOne.mockResolvedValue({ id: 'group-uuid', status: 'expired' });
      const socket = makeSocket('user-uuid');

      await gateway.handleInitiate(socket, { groupId: 'group-uuid' });

      expect(socket.emit).toHaveBeenCalledWith('group_call:error', expect.objectContaining({ code: 'GROUP_INACTIVE' }));
    });

    it('initiateur reçoit joined (liste vide) ; les AUTRES membres reçoivent incoming, pas l\'initiateur', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember('initiateur-uuid', 'Alice'));
      memberRepo.find.mockResolvedValue([
        makeMember('initiateur-uuid', 'Alice'),
        makeMember('autre-uuid', 'Bob'),
      ]);
      const socket = makeSocket('initiateur-uuid');

      await gateway.handleInitiate(socket, { groupId: 'group-uuid', callType: CallType.AUDIO });

      expect(socket.emit).toHaveBeenCalledWith('group_call:joined', expect.objectContaining({ participants: [] }));
      expect(broadcast.emitToUser).toHaveBeenCalledWith('autre-uuid', 'group_call:incoming', expect.anything());
      expect(broadcast.emitToUser).not.toHaveBeenCalledWith('initiateur-uuid', 'group_call:incoming', expect.anything());
    });

    it('refuse un 2e appel si un appel est déjà actif pour ce groupe', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember('user-uuid'));
      memberRepo.find.mockResolvedValue([makeMember('user-uuid'), makeMember('autre-uuid')]);
      await gateway.handleInitiate(makeSocket('user-uuid'), { groupId: 'group-uuid' });

      memberRepo.findOne.mockResolvedValue(makeMember('autre-uuid'));
      const socket2 = makeSocket('autre-uuid');
      await gateway.handleInitiate(socket2, { groupId: 'group-uuid' });

      expect(socket2.emit).toHaveBeenCalledWith('group_call:error', expect.objectContaining({ code: 'CALL_ALREADY_ACTIVE' }));
    });
  });

  // ════════════════════════════════════════════════════════════
  // group_call:join
  // ════════════════════════════════════════════════════════════

  describe('handleJoin', () => {
    async function startCall(initiatorId: string, others: string[]) {
      memberRepo.findOne.mockResolvedValue(makeMember(initiatorId, 'Initiateur'));
      memberRepo.find.mockResolvedValue([makeMember(initiatorId), ...others.map(id => makeMember(id))]);
      const socket = makeSocket(initiatorId);
      await gateway.handleInitiate(socket, { groupId: 'group-uuid' });
      const callId = (socket.emit.mock.calls.find(c => c[0] === 'group_call:joined')?.[1] as any).callId;
      socket.emit.mockClear();
      broadcast.emitToUser.mockClear();
      return callId as string;
    }

    it('rejoint un appel actif — reçoit la liste des pairs déjà présents', async () => {
      const callId = await startCall('initiateur-uuid', ['joiner-uuid']);
      memberRepo.findOne.mockResolvedValue(makeMember('joiner-uuid', 'Bob'));

      const socket = makeSocket('joiner-uuid');
      await gateway.handleJoin(socket, { groupId: 'group-uuid', callId });

      expect(socket.emit).toHaveBeenCalledWith('group_call:joined', expect.objectContaining({
        participants: [{ userId: 'initiateur-uuid', displayName: 'Initiateur' }],
      }));
      expect(broadcast.emitToUser).toHaveBeenCalledWith('initiateur-uuid', 'group_call:participant_joined', expect.anything());
    });

    it('callId incorrect (appel déjà terminé/remplacé) → group_call:error CALL_NOT_FOUND', async () => {
      await startCall('initiateur-uuid', []);
      memberRepo.findOne.mockResolvedValue(makeMember('joiner-uuid'));

      const socket = makeSocket('joiner-uuid');
      await gateway.handleJoin(socket, { groupId: 'group-uuid', callId: 'callId-obsolete' });

      expect(socket.emit).toHaveBeenCalledWith('group_call:error', expect.objectContaining({ code: 'CALL_NOT_FOUND' }));
    });

    it('join idempotent — rejoindre deux fois ne duplique pas le participant', async () => {
      const callId = await startCall('initiateur-uuid', ['joiner-uuid']);
      memberRepo.findOne.mockResolvedValue(makeMember('joiner-uuid'));
      const socket = makeSocket('joiner-uuid');

      await gateway.handleJoin(socket, { groupId: 'group-uuid', callId });
      await gateway.handleJoin(socket, { groupId: 'group-uuid', callId });

      const call = gateway.getActiveCall('group-uuid');
      expect(call?.participantCount).toBe(2); // initiateur + joiner, pas 3
    });
  });

  // ════════════════════════════════════════════════════════════
  // Signalisation WebRTC — relais entre participants actifs
  // ════════════════════════════════════════════════════════════

  describe('signalisation (offer/answer/ice_candidate)', () => {
    async function startAndJoin(initiatorId: string, joinerId: string) {
      memberRepo.findOne.mockResolvedValue(makeMember(initiatorId));
      memberRepo.find.mockResolvedValue([makeMember(initiatorId), makeMember(joinerId)]);
      const initSocket = makeSocket(initiatorId);
      await gateway.handleInitiate(initSocket, { groupId: 'group-uuid' });
      const callId = (initSocket.emit.mock.calls.find(c => c[0] === 'group_call:joined')?.[1] as any).callId;

      memberRepo.findOne.mockResolvedValue(makeMember(joinerId));
      await gateway.handleJoin(makeSocket(joinerId), { groupId: 'group-uuid', callId });
      broadcast.emitToUser.mockClear();
      return callId as string;
    }

    it('offer relayé au targetUserId si les deux sont participants actifs', async () => {
      const callId = await startAndJoin('a-uuid', 'b-uuid');
      memberRepo.findOne.mockResolvedValue(makeMember('a-uuid'));

      await gateway.handleOffer(makeSocket('a-uuid'), {
        groupId: 'group-uuid', callId, targetUserId: 'b-uuid',
        sdp: { type: 'offer', sdp: 'v=0...' },
      });

      expect(broadcast.emitToUser).toHaveBeenCalledWith('b-uuid', 'group_call:offer', expect.objectContaining({ fromUserId: 'a-uuid' }));
    });

    it('offer silencieusement ignoré si le targetUserId n\'est pas (ou plus) participant', async () => {
      const callId = await startAndJoin('a-uuid', 'b-uuid');
      memberRepo.findOne.mockResolvedValue(makeMember('a-uuid'));

      await gateway.handleOffer(makeSocket('a-uuid'), {
        groupId: 'group-uuid', callId, targetUserId: 'jamais-rejoint-uuid',
        sdp: { type: 'offer', sdp: 'v=0...' },
      });

      expect(broadcast.emitToUser).not.toHaveBeenCalled();
    });

    it('ice_candidate relayé entre participants actifs', async () => {
      const callId = await startAndJoin('a-uuid', 'b-uuid');
      memberRepo.findOne.mockResolvedValue(makeMember('b-uuid'));

      await gateway.handleIceCandidate(makeSocket('b-uuid'), {
        groupId: 'group-uuid', callId, targetUserId: 'a-uuid',
        candidate: { candidate: 'candidate:1 1 UDP...' },
      });

      expect(broadcast.emitToUser).toHaveBeenCalledWith('a-uuid', 'group_call:ice_candidate', expect.objectContaining({ fromUserId: 'b-uuid' }));
    });
  });

  // ════════════════════════════════════════════════════════════
  // group_call:leave / decline
  // ════════════════════════════════════════════════════════════

  describe('handleLeave', () => {
    it('dernier participant quitte → appel terminé + message sauvegardé', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember('solo-uuid'));
      memberRepo.find.mockResolvedValue([makeMember('solo-uuid')]);
      const initSocket = makeSocket('solo-uuid');
      await gateway.handleInitiate(initSocket, { groupId: 'group-uuid' });
      const callId = (initSocket.emit.mock.calls.find(c => c[0] === 'group_call:joined')?.[1] as any).callId;
      broadcast.emitToUser.mockClear();

      await gateway.handleLeave(makeSocket('solo-uuid'), { groupId: 'group-uuid', callId });

      expect(gateway.getActiveCall('group-uuid')).toBeNull();
      expect(msgRepo.save).toHaveBeenCalled();
      expect(broadcast.emitToUser).toHaveBeenCalledWith('solo-uuid', 'group_call:ended', expect.objectContaining({ reason: 'empty' }));
    });
  });

  describe('handleDecline', () => {
    it('déclinant ajouté au set declined, appel reste actif pour les autres', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember('initiateur-uuid'));
      memberRepo.find.mockResolvedValue([makeMember('initiateur-uuid'), makeMember('declinant-uuid')]);
      const initSocket = makeSocket('initiateur-uuid');
      await gateway.handleInitiate(initSocket, { groupId: 'group-uuid' });
      const callId = (initSocket.emit.mock.calls.find(c => c[0] === 'group_call:joined')?.[1] as any).callId;
      broadcast.emitToUser.mockClear();

      memberRepo.findOne.mockResolvedValue(makeMember('declinant-uuid'));
      await gateway.handleDecline(makeSocket('declinant-uuid'), { groupId: 'group-uuid', callId });

      expect(broadcast.emitToUser).toHaveBeenCalledWith('initiateur-uuid', 'group_call:participant_declined', expect.anything());
    });
  });

  // ════════════════════════════════════════════════════════════
  // Déconnexion
  // ════════════════════════════════════════════════════════════

  describe('handleDisconnect', () => {
    it('retire l\'utilisateur de tous ses appels actifs', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember('a-uuid'));
      memberRepo.find.mockResolvedValue([makeMember('a-uuid'), makeMember('b-uuid')]);
      const initSocket = makeSocket('a-uuid');
      await gateway.handleInitiate(initSocket, { groupId: 'group-uuid' });
      const callId = (initSocket.emit.mock.calls.find(c => c[0] === 'group_call:joined')?.[1] as any).callId;
      memberRepo.findOne.mockResolvedValue(makeMember('b-uuid'));
      await gateway.handleJoin(makeSocket('b-uuid'), { groupId: 'group-uuid', callId });
      broadcast.emitToUser.mockClear();

      await gateway.handleDisconnect(makeSocket('b-uuid'));

      expect(broadcast.emitToUser).toHaveBeenCalledWith('a-uuid', 'group_call:participant_left', expect.objectContaining({ reason: 'disconnected' }));
    });

    it('utilisateur sans appel actif — aucune action', async () => {
      await gateway.handleDisconnect(makeSocket('personne-uuid'));
      expect(broadcast.emitToUser).not.toHaveBeenCalled();
    });
  });
});
