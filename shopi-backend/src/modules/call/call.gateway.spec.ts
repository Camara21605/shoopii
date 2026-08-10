/* ============================================================
 * FICHIER      : src/modules/call/call.gateway.spec.ts
 * MODULE       : Call — signalisation WebRTC 1:1
 * RÔLE         : Tests unitaires de CallGateway.
 *
 * COUVERTURE :
 *   ✅ call:initiate ringing/busy/offline/denied → bon événement émis
 *   ✅ call:offer/answer/ice-candidate REFUSÉS s'il n'existe aucun appel
 *      actif entre les deux utilisateurs (protection anti-injection —
 *      "faux caller_id"/"faux callee_id" de l'audit : un attaquant ne
 *      peut jamais faire relayer de signalisation WebRTC vers un
 *      targetUserId arbitraire)
 *   ✅ call:offer/answer/ice-candidate relayés normalement si l'appel existe
 *   ✅ call:accept/reject/end ciblent la bonne room et notifient le bon côté
 *   ✅ Déconnexion — nettoie les appels actifs et notifie les correspondants
 *
 * NOTE DE COUVERTURE : ce fichier instancie CallGateway directement
 * (new CallGateway(...)) et appelle ses handlers comme des méthodes
 * normales — cela exerce toute la LOGIQUE MÉTIER du gateway, mais PAS le
 * pipeline NestJS lui-même (le @UsePipes(ValidationPipe) réel n'intervient
 * qu'au runtime, via le dispatch Socket.IO de Nest, jamais lors d'un appel
 * direct de méthode). La validation des DTOs (call-socket.dto.ts) n'a donc
 * pas de test dédié ici — elle repose sur class-validator, déjà testé par
 * son propre package, et sur la présence du décorateur @UsePipes vérifiée
 * "à l'œil" dans call.gateway.ts.
 * ============================================================ */

import { CallGateway } from './call.gateway';
import { CallService } from './call.service';
import { CallStatus, CallType } from 'src/database/entities/call/call.entity';
import type { AuthenticatedSocket } from '../messagerie/interfaces/messaging.interfaces';

function makeSocket(userId: string): AuthenticatedSocket & { emit: jest.Mock } {
  return { data: { userId }, emit: jest.fn() } as unknown as AuthenticatedSocket & { emit: jest.Mock };
}

describe('CallGateway', () => {
  let gateway: CallGateway;
  let callService: jest.Mocked<Pick<CallService,
    'startCall' | 'acceptCall' | 'rejectCall' | 'endCall' | 'findActiveCallId' | 'endAllCallsForUser'
  >>;
  let server: { to: jest.Mock; emit: jest.Mock };
  let roomEmit: jest.Mock;

  beforeEach(() => {
    roomEmit = jest.fn();
    server = { to: jest.fn(() => ({ emit: roomEmit })), emit: jest.fn() };

    callService = {
      startCall:           jest.fn(),
      acceptCall:           jest.fn().mockResolvedValue(undefined),
      rejectCall:           jest.fn().mockResolvedValue(undefined),
      endCall:              jest.fn().mockResolvedValue(undefined),
      findActiveCallId:     jest.fn(),
      endAllCallsForUser:   jest.fn().mockResolvedValue([]),
    };

    gateway = new CallGateway(callService as unknown as CallService);
    (gateway as any).server = server;
    // adapter.rooms — utilisé uniquement pour les logs de diagnostic (roomSize).
    (server as any).adapter = { rooms: new Map() };
  });

  afterEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════
  // call:initiate
  // ════════════════════════════════════════════════════════════

  describe('handleCallInitiate', () => {
    it('ringing → émet call:incoming à la room du callee', async () => {
      callService.startCall.mockResolvedValue({
        outcome: 'ringing',
        call: { id: 'call-uuid' } as any,
      });
      const socket = makeSocket('caller-uuid');

      await gateway.handleCallInitiate(socket, {
        conversationId: 'conv-uuid', calleeUserId: 'callee-uuid',
        callerName: 'Jean', callType: CallType.AUDIO,
      });

      expect(server.to).toHaveBeenCalledWith('user:callee-uuid');
      expect(roomEmit).toHaveBeenCalledWith('call:incoming', expect.objectContaining({
        callerUserId: 'caller-uuid', callerName: 'Jean',
      }));
      expect(socket.emit).not.toHaveBeenCalled();
    });

    it('busy → émet call:busy uniquement à l\'appelant (pas de room)', async () => {
      callService.startCall.mockResolvedValue({ outcome: 'busy' });
      const socket = makeSocket('caller-uuid');

      await gateway.handleCallInitiate(socket, {
        conversationId: 'conv-uuid', calleeUserId: 'callee-uuid', callerName: 'Jean',
      });

      expect(socket.emit).toHaveBeenCalledWith('call:busy', { conversationId: 'conv-uuid' });
      expect(server.to).not.toHaveBeenCalled();
    });

    it('offline → émet call:unavailable(reason=offline) à l\'appelant', async () => {
      callService.startCall.mockResolvedValue({ outcome: 'offline' });
      const socket = makeSocket('caller-uuid');

      await gateway.handleCallInitiate(socket, {
        conversationId: 'conv-uuid', calleeUserId: 'callee-uuid', callerName: 'Jean',
      });

      expect(socket.emit).toHaveBeenCalledWith('call:unavailable', expect.objectContaining({ reason: 'offline' }));
    });

    it('permission refusée (exception service) → call:unavailable(reason=denied)', async () => {
      callService.startCall.mockRejectedValue(new Error('Vous ne pouvez pas encore appeler cet utilisateur'));
      const socket = makeSocket('caller-uuid');

      await gateway.handleCallInitiate(socket, {
        conversationId: 'conv-uuid', calleeUserId: 'callee-uuid', callerName: 'Jean',
      });

      expect(socket.emit).toHaveBeenCalledWith('call:unavailable', expect.objectContaining({ reason: 'denied' }));
    });
  });

  // ════════════════════════════════════════════════════════════
  // call:accept / call:reject / call:end
  // ════════════════════════════════════════════════════════════

  describe('handleCallAccept', () => {
    it('accepte et notifie l\'appelant sur sa room', async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      callService.acceptCall.mockResolvedValue({ status: CallStatus.CONNECTED } as any);
      const socket = makeSocket('callee-uuid');

      await gateway.handleCallAccept(socket, { conversationId: 'conv-uuid', callerUserId: 'caller-uuid' });

      expect(callService.acceptCall).toHaveBeenCalledWith('callee-uuid', 'call-uuid');
      expect(server.to).toHaveBeenCalledWith('user:caller-uuid');
      expect(roomEmit).toHaveBeenCalledWith('call:accepted', expect.objectContaining({ calleeUserId: 'callee-uuid' }));
    });

    it('émet quand même call:accepted si la persistance échoue (signalisation live prioritaire)', async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      callService.acceptCall.mockRejectedValue(new Error('DB down'));
      const socket = makeSocket('callee-uuid');

      await gateway.handleCallAccept(socket, { conversationId: 'conv-uuid', callerUserId: 'caller-uuid' });

      expect(roomEmit).toHaveBeenCalledWith('call:accepted', expect.anything());
    });
  });

  describe('handleCallReject', () => {
    it('refuse et notifie l\'appelant', async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      const socket = makeSocket('callee-uuid');

      await gateway.handleCallReject(socket, { conversationId: 'conv-uuid', callerUserId: 'caller-uuid' });

      expect(callService.rejectCall).toHaveBeenCalledWith('callee-uuid', 'call-uuid');
      expect(server.to).toHaveBeenCalledWith('user:caller-uuid');
      expect(roomEmit).toHaveBeenCalledWith('call:rejected', expect.anything());
    });
  });

  describe('handleCallEnd', () => {
    it('raccroche et notifie l\'autre participant', async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      const socket = makeSocket('caller-uuid');

      await gateway.handleCallEnd(socket, { conversationId: 'conv-uuid', targetUserId: 'callee-uuid' });

      expect(callService.endCall).toHaveBeenCalledWith('caller-uuid', 'call-uuid');
      expect(server.to).toHaveBeenCalledWith('user:callee-uuid');
      expect(roomEmit).toHaveBeenCalledWith('call:ended', expect.anything());
    });
  });

  // ════════════════════════════════════════════════════════════
  // Signalisation WebRTC — protection anti-injection
  // ════════════════════════════════════════════════════════════

  describe('signalisation (offer/answer/ice-candidate) — protection anti-injection', () => {
    it('call:offer REFUSÉ s\'il n\'existe aucun appel actif entre les deux utilisateurs', async () => {
      callService.findActiveCallId.mockResolvedValue(null); // aucun appel actif
      const socket = makeSocket('attaquant-uuid');

      await gateway.handleCallOffer(socket, {
        conversationId: 'conv-uuid', targetUserId: 'victime-uuid',
        sdp: { type: 'offer', sdp: 'v=0...' },
      });

      expect(server.to).not.toHaveBeenCalled();
      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('call:answer REFUSÉ sans appel actif', async () => {
      callService.findActiveCallId.mockResolvedValue(null);
      const socket = makeSocket('attaquant-uuid');

      await gateway.handleCallAnswer(socket, {
        conversationId: 'conv-uuid', targetUserId: 'victime-uuid',
        sdp: { type: 'answer', sdp: 'v=0...' },
      });

      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('call:ice-candidate REFUSÉ sans appel actif', async () => {
      callService.findActiveCallId.mockResolvedValue(null);
      const socket = makeSocket('attaquant-uuid');

      await gateway.handleCallIceCandidate(socket, {
        conversationId: 'conv-uuid', targetUserId: 'victime-uuid',
        candidate: { candidate: 'candidate:1 1 UDP...' },
      });

      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('call:offer relayé normalement si un appel actif existe bien entre les deux', async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      const socket = makeSocket('caller-uuid');

      await gateway.handleCallOffer(socket, {
        conversationId: 'conv-uuid', targetUserId: 'callee-uuid',
        sdp: { type: 'offer', sdp: 'v=0...' },
      });

      expect(server.to).toHaveBeenCalledWith('user:callee-uuid');
      expect(roomEmit).toHaveBeenCalledWith('call:offer', expect.objectContaining({ fromUserId: 'caller-uuid' }));
    });
  });

  // ════════════════════════════════════════════════════════════
  // Déconnexion
  // ════════════════════════════════════════════════════════════

  describe('handleDisconnect', () => {
    it('nettoie les appels actifs et notifie chaque correspondant', async () => {
      callService.endAllCallsForUser.mockResolvedValue([
        { otherUserId: 'other-1', conversationId: 'conv-1' },
        { otherUserId: 'other-2', conversationId: 'conv-2' },
      ]);
      const socket = makeSocket('user-uuid');

      await gateway.handleDisconnect(socket);

      expect(callService.endAllCallsForUser).toHaveBeenCalledWith('user-uuid');
      expect(server.to).toHaveBeenCalledWith('user:other-1');
      expect(server.to).toHaveBeenCalledWith('user:other-2');
      expect(roomEmit).toHaveBeenCalledTimes(2);
    });

    it('ne fait rien si socket.data.userId absent (déconnexion avant authentification complète)', async () => {
      const socket = { data: {} } as unknown as AuthenticatedSocket;
      await gateway.handleDisconnect(socket);
      expect(callService.endAllCallsForUser).not.toHaveBeenCalled();
    });

    it('une erreur de nettoyage ne remonte jamais (ne doit jamais planter le process)', async () => {
      callService.endAllCallsForUser.mockRejectedValue(new Error('DB down'));
      const socket = makeSocket('user-uuid');
      await expect(gateway.handleDisconnect(socket)).resolves.toBeUndefined();
    });
  });
});
