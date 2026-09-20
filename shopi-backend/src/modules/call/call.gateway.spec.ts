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
 *   ✅ flood-guard en mémoire sur offer/answer/ice-candidate (une connexion
 *      qui flood est ignorée sans casser les autres connexions)
 *
 * NOTE DE COUVERTURE : ce fichier instancie CallGateway directement
 * (new CallGateway(...)) et appelle ses handlers comme des méthodes
 * normales — cela exerce toute la LOGIQUE MÉTIER du gateway, mais PAS le
 * pipeline NestJS lui-même (le @UsePipes(ValidationPipe)/@UseFilters réel
 * n'intervient qu'au runtime, via le dispatch Socket.IO de Nest). La
 * validation des DTOs a son propre test dédié (call-socket.dto.spec.ts,
 * class-validator direct) ET a été vérifiée en direct contre un vrai socket
 * connecté au serveur réel (payload incomplet/SDP trop volumineux/champ
 * inconnu — tous rejetés, jamais relayés, message d'erreur clair côté
 * client via WsValidationExceptionFilter).
 * ============================================================ */

import { CallGateway } from './call.gateway';
import { CallService } from './call.service';
import { CallStatus, CallType } from 'src/database/entities/call/call.entity';
import type { AuthenticatedSocket } from '../messagerie/interfaces/messaging.interfaces';

let socketIdCounter = 0;
function makeSocket(userId: string): AuthenticatedSocket & { emit: jest.Mock } {
  return {
    id: `socket-${++socketIdCounter}`, data: { userId }, emit: jest.fn(),
  } as unknown as AuthenticatedSocket & { emit: jest.Mock };
}

describe('CallGateway', () => {
  let gateway: CallGateway;
  let callService: jest.Mocked<Pick<CallService,
    'startCall' | 'acceptCall' | 'acceptCallFast' | 'rejectCall' | 'endCall' | 'findActiveCallId'
    | 'endAllCallsForUser' | 'findActiveCallsForUser' | 'getCallerDisplayInfo'
    | 'findActiveCallsForUsers' | 'findAllActiveCalls' | 'forceEndCalls' | 'markBusy'
  >>;
  let server: { to: jest.Mock; emit: jest.Mock };
  let roomEmit: jest.Mock;
  let exceptEmit: jest.Mock;

  beforeEach(() => {
    roomEmit   = jest.fn();
    exceptEmit = jest.fn();
    server = { to: jest.fn(() => ({ emit: roomEmit, except: jest.fn(() => ({ emit: exceptEmit })) })), emit: jest.fn() };

    callService = {
      startCall:           jest.fn(),
      acceptCall:           jest.fn().mockResolvedValue(undefined),
      acceptCallFast:       jest.fn().mockResolvedValue(null),
      rejectCall:           jest.fn().mockResolvedValue(undefined),
      endCall:              jest.fn().mockResolvedValue(undefined),
      findActiveCallId:        jest.fn(),
      endAllCallsForUser:      jest.fn().mockResolvedValue([]),
      findActiveCallsForUser:  jest.fn().mockResolvedValue([]),
      findActiveCallsForUsers: jest.fn().mockResolvedValue([]),
      findAllActiveCalls:      jest.fn().mockResolvedValue([]),
      forceEndCalls:           jest.fn().mockResolvedValue([]),
      markBusy:                jest.fn().mockResolvedValue(undefined),
      /* Résolu par défaut — appelée en Promise.all avec startCall() dans
       * handleCallInitiate, quel que soit le résultat (ringing/busy/
       * offline) ; non pertinente pour ces tests, qui portent sur startCall. */
      getCallerDisplayInfo:    jest.fn().mockResolvedValue({ name: 'Jean', avatar: null }),
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
    it('accepte (gagnant) → notifie l\'appelant + les AUTRES appareils du callee', async () => {
      callService.acceptCallFast.mockResolvedValue({ call: { id: 'call-uuid', status: CallStatus.CONNECTED } as any, alreadyAccepted: false });
      const socket = makeSocket('callee-uuid');

      await gateway.handleCallAccept(socket, { conversationId: 'conv-uuid', callerUserId: 'caller-uuid' });

      expect(callService.acceptCallFast).toHaveBeenCalledWith('callee-uuid', 'caller-uuid');
      expect(server.to).toHaveBeenCalledWith('user:caller-uuid');
      expect(roomEmit).toHaveBeenCalledWith('call:accepted', expect.objectContaining({ calleeUserId: 'callee-uuid' }));
      // Les autres appareils du callee reçoivent call:accepted-elsewhere (via .except(socket.id))
      expect(server.to).toHaveBeenCalledWith('user:callee-uuid');
      expect(exceptEmit).toHaveBeenCalledWith('call:accepted-elsewhere', expect.anything());
    });

    it('2e appareil (perdant) → PAS de 2e call:accepted à l\'appelant, juste call:accept-superseded à CE socket', async () => {
      callService.acceptCallFast.mockResolvedValue({ call: { id: 'call-uuid', status: CallStatus.CONNECTED } as any, alreadyAccepted: true });
      const socket = makeSocket('callee-uuid');

      await gateway.handleCallAccept(socket, { conversationId: 'conv-uuid', callerUserId: 'caller-uuid' });

      expect(roomEmit).not.toHaveBeenCalledWith('call:accepted', expect.anything());
      expect(socket.emit).toHaveBeenCalledWith('call:accept-superseded', expect.objectContaining({ conversationId: 'conv-uuid' }));
    });

    it('n\'émet PAS call:accepted si la persistance échoue — sinon un échec (Forbidden, DB down...) sur UN des deux appareils en course serait traité comme une victoire par défaut, provoquant un 2e call:accepted au caller', async () => {
      callService.acceptCallFast.mockRejectedValue(new Error('DB down'));
      const socket = makeSocket('callee-uuid');

      await gateway.handleCallAccept(socket, { conversationId: 'conv-uuid', callerUserId: 'caller-uuid' });

      expect(roomEmit).not.toHaveBeenCalledWith('call:accepted', expect.anything());
      expect(exceptEmit).not.toHaveBeenCalledWith('call:accepted-elsewhere', expect.anything());
      expect(socket.emit).toHaveBeenCalledWith('call:accept-failed', expect.objectContaining({ conversationId: 'conv-uuid' }));
    });

    it('n\'émet rien si aucun appel actif n\'est trouvé (acceptCallFast → null)', async () => {
      callService.acceptCallFast.mockResolvedValue(null);
      const socket = makeSocket('callee-uuid');

      await gateway.handleCallAccept(socket, { conversationId: 'conv-uuid', callerUserId: 'caller-uuid' });

      expect(roomEmit).not.toHaveBeenCalledWith('call:accepted', expect.anything());
      expect(socket.emit).toHaveBeenCalledWith('call:accept-failed', expect.objectContaining({ conversationId: 'conv-uuid' }));
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
    it('ne fait rien si socket.data.userId absent (déconnexion avant authentification complète)', async () => {
      const socket = { data: {} } as unknown as AuthenticatedSocket;
      await gateway.handleDisconnect(socket);
      expect(callService.findActiveCallsForUser).not.toHaveBeenCalled();
    });

    it('une erreur de nettoyage ne remonte jamais (ne doit jamais planter le process)', async () => {
      callService.findActiveCallsForUser.mockRejectedValue(new Error('DB down'));
      const socket = makeSocket('user-uuid');
      await expect(gateway.handleDisconnect(socket)).resolves.toBeUndefined();
    });

    it('aucun appel actif → endAllCallsForUser jamais appelé', async () => {
      callService.findActiveCallsForUser.mockResolvedValue([]);
      await gateway.handleDisconnect(makeSocket('user-uuid'));
      expect(callService.endAllCallsForUser).not.toHaveBeenCalled();
    });

    it('caller dont l\'appel n\'a jamais été accepté (RINGING, aucun binding) → termine cet appel', async () => {
      /* PARTIE 9.5 : la diffusion part désormais directement des données déjà
         lues (activeCalls), sans attendre le retour d'endAllCallsForUser()
         (persistance en arrière-plan) — conversationId doit donc être présent
         sur la ligne lue, pas seulement sur le retour mocké de la persistance. */
      callService.findActiveCallsForUser.mockResolvedValue([
        { id: 'call-uuid', callerId: 'user-uuid', calleeId: 'callee-uuid', status: CallStatus.RINGING, conversationId: 'conv-1' } as any,
      ]);
      callService.endAllCallsForUser.mockResolvedValue([{ otherUserId: 'callee-uuid', conversationId: 'conv-1' }]);

      await gateway.handleDisconnect(makeSocket('user-uuid'));

      expect(callService.endAllCallsForUser).toHaveBeenCalledWith('user-uuid', ['call-uuid']);
      expect(server.to).toHaveBeenCalledWith('user:callee-uuid');
      expect(roomEmit).toHaveBeenCalledWith('call:ended', { conversationId: 'conv-1' });
    });

    it('callee en RINGING (aucun appareil n\'a encore accepté) → NE PAS terminer l\'appel : une autre session peut encore répondre', async () => {
      callService.findActiveCallsForUser.mockResolvedValue([
        { id: 'call-uuid', callerId: 'caller-uuid', calleeId: 'user-uuid', status: CallStatus.RINGING } as any,
      ]);

      await gateway.handleDisconnect(makeSocket('user-uuid'));

      expect(callService.endAllCallsForUser).not.toHaveBeenCalled();
    });

    it('plusieurs appareils — le socket qui a RÉELLEMENT accepté se déconnecte → l\'appel se termine', async () => {
      // Le callee accepte depuis un socket précis : le binding se pose via handleCallAccept.
      callService.acceptCallFast.mockResolvedValue({ call: { id: 'call-uuid' } as any, alreadyAccepted: false });
      const acceptingSocket = makeSocket('user-uuid');
      await gateway.handleCallAccept(acceptingSocket, { conversationId: 'conv-1', callerUserId: 'caller-uuid' });

      callService.findActiveCallsForUser.mockResolvedValue([
        { id: 'call-uuid', callerId: 'caller-uuid', calleeId: 'user-uuid', status: CallStatus.CONNECTED } as any,
      ]);
      callService.endAllCallsForUser.mockResolvedValue([{ otherUserId: 'caller-uuid', conversationId: 'conv-1' }]);

      jest.useFakeTimers();
      try {
        await gateway.handleDisconnect(acceptingSocket); // LE MÊME socket qui a accepté se déconnecte
        /* Appel CONNECTÉ : délai de grâce avant de couper (micro-coupure réseau). */
        expect(callService.endAllCallsForUser).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(10_000);
      } finally {
        jest.useRealTimers();
      }

      expect(callService.endAllCallsForUser).toHaveBeenCalledWith('user-uuid', ['call-uuid']);
    });

    it("appel CONNECTÉ : le client se reconnecte dans le délai de grâce → l'appel est conservé", async () => {
      callService.acceptCallFast.mockResolvedValue({ call: { id: 'call-uuid' } as any, alreadyAccepted: false });
      const acceptingSocket = makeSocket('user-uuid');
      await gateway.handleCallAccept(acceptingSocket, { conversationId: 'conv-1', callerUserId: 'caller-uuid' });
      callService.findActiveCallsForUser.mockResolvedValue([
        { id: 'call-uuid', callerId: 'caller-uuid', calleeId: 'user-uuid', status: CallStatus.CONNECTED } as any,
      ]);
      /* Une nouvelle connexion du même utilisateur est présente dans sa room. */
      (server as any).adapter.rooms.set('user:user-uuid', new Set(['socket-new']));

      jest.useFakeTimers();
      try {
        await gateway.handleDisconnect(acceptingSocket);
        await jest.advanceTimersByTimeAsync(10_000);
      } finally {
        jest.useRealTimers();
      }

      expect(callService.endAllCallsForUser).not.toHaveBeenCalled();
    });

    it('plusieurs appareils — un AUTRE appareil du même callee se déconnecte → l\'appel actif N\'EST PAS coupé', async () => {
      callService.acceptCallFast.mockResolvedValue({ call: { id: 'call-uuid' } as any, alreadyAccepted: false });
      const acceptingSocket = makeSocket('user-uuid');
      await gateway.handleCallAccept(acceptingSocket, { conversationId: 'conv-1', callerUserId: 'caller-uuid' });

      callService.findActiveCallsForUser.mockResolvedValue([
        { id: 'call-uuid', callerId: 'caller-uuid', calleeId: 'user-uuid', status: CallStatus.CONNECTED } as any,
      ]);

      const otherDeviceSocket = makeSocket('user-uuid'); // même utilisateur, AUTRE connexion
      await gateway.handleDisconnect(otherDeviceSocket);

      expect(callService.endAllCallsForUser).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Occupé relayé, keepalive, appels fantômes
  // ════════════════════════════════════════════════════════════

  describe("call:busy (relayé par l'appelé)", () => {
    it("ferme la ligne d'appel ET prévient l'appelant", async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      await gateway.handleCallBusy(makeSocket('callee-uuid'), { conversationId: 'conv-1', callerUserId: 'caller-uuid' });

      expect(server.to).toHaveBeenCalledWith('user:caller-uuid');
      expect(roomEmit).toHaveBeenCalledWith('call:busy', { conversationId: 'conv-1' });
      expect(callService.markBusy).toHaveBeenCalledWith('callee-uuid', 'call-uuid');
    });

    it('aucun appel actif entre eux → ignoré (rien relayé)', async () => {
      callService.findActiveCallId.mockResolvedValue(null);
      await gateway.handleCallBusy(makeSocket('callee-uuid'), { conversationId: 'conv-1', callerUserId: 'caller-uuid' });
      expect(roomEmit).not.toHaveBeenCalled();
      expect(callService.markBusy).not.toHaveBeenCalled();
    });
  });

  describe('call:keepalive', () => {
    it("aucun appel côté serveur → dit au client que l'appel est terminé (débloque un état local fantôme)", async () => {
      callService.findActiveCallId.mockResolvedValue(null);
      const socket = makeSocket('user-uuid');
      await gateway.handleCallKeepalive(socket, { conversationId: 'conv-1', targetUserId: 'peer-uuid' });
      expect(socket.emit).toHaveBeenCalledWith('call:ended', { conversationId: 'conv-1' });
    });

    it("appel existant → rien n'est émis", async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      const socket = makeSocket('user-uuid');
      await gateway.handleCallKeepalive(socket, { conversationId: 'conv-1', targetUserId: 'peer-uuid' });
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe('annulation immédiate après call:initiate (sérialisation par utilisateur)', () => {
    it("call:end envoyé juste après call:initiate est traité APRÈS l'insertion de la ligne", async () => {
      const order: string[] = [];
      callService.startCall.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 20));
        order.push('startCall');
        return { outcome: 'ringing', call: { id: 'call-uuid' } as any };
      });
      callService.findActiveCallId.mockImplementation(async () => { order.push('findActiveCallId'); return 'call-uuid'; });
      const socket = makeSocket('caller-uuid');

      const p1 = gateway.handleCallInitiate(socket, { conversationId: 'c', calleeUserId: 'callee-uuid', callerName: 'x' });
      const p2 = gateway.handleCallEnd(socket, { conversationId: 'c', targetUserId: 'callee-uuid' });
      await Promise.all([p1, p2]);

      expect(order.indexOf('startCall')).toBeLessThan(order.indexOf('findActiveCallId'));
      expect(callService.endCall).toHaveBeenCalledWith('caller-uuid', 'call-uuid');
    });
  });

  describe('appels fantômes', () => {
    const ghost = (over: object = {}) => ({
      id: 'ghost-1', callerId: 'a', calleeId: 'b', conversationId: 'conv-g',
      status: CallStatus.CONNECTED, startedAt: new Date(Date.now() - 5 * 60_000), ...over,
    }) as any;
    const withSockets = (sockets: unknown[]) => {
      (server as any).in = jest.fn(() => ({ fetchSockets: jest.fn().mockResolvedValue(sockets) }));
      /* La ligne est connue de ce process depuis plus que le délai de grâce post-redémarrage. */
      (gateway as any).firstSeen.set('ghost-1', Date.now() - 120_000);
    };

    it('ligne CONNECTED sans aucun signe de vie, sans connexion → fermée avant de répondre « occupé »', async () => {
      withSockets([]);
      callService.findActiveCallsForUsers.mockResolvedValue([ghost()]);
      callService.forceEndCalls.mockResolvedValue([{ callerId: 'a', calleeId: 'b', conversationId: 'conv-g', wasConnected: true }]);
      callService.startCall.mockResolvedValue({ outcome: 'ringing', call: { id: 'new' } as any });

      await gateway.handleCallInitiate(makeSocket('a'), { conversationId: 'conv-1', calleeUserId: 'b', callerName: 'x' });

      expect(callService.forceEndCalls).toHaveBeenCalledWith(['ghost-1']);
      expect(callService.forceEndCalls.mock.invocationCallOrder[0])
        .toBeLessThan(callService.startCall.mock.invocationCallOrder[0]);
    });

    it('client récent connecté mais SANS keepalive (se croit hors appel) → ligne fantôme fermée', async () => {
      withSockets([{ data: { callKeepalive: true } }]);
      callService.findActiveCallsForUsers.mockResolvedValue([ghost()]);
      callService.forceEndCalls.mockResolvedValue([]);
      callService.startCall.mockResolvedValue({ outcome: 'ringing', call: { id: 'new' } as any });

      await gateway.handleCallInitiate(makeSocket('a'), { conversationId: 'conv-1', calleeUserId: 'b', callerName: 'x' });
      expect(callService.forceEndCalls).toHaveBeenCalledWith(['ghost-1']);
    });

    it("ancien client (sans keepalive) encore connecté → son appel N'EST PAS coupé", async () => {
      withSockets([{ data: {} }]);
      callService.findActiveCallsForUsers.mockResolvedValue([ghost()]);
      callService.startCall.mockResolvedValue({ outcome: 'busy' });

      await gateway.handleCallInitiate(makeSocket('a'), { conversationId: 'conv-1', calleeUserId: 'b', callerName: 'x' });
      expect(callService.forceEndCalls).not.toHaveBeenCalled();
    });

    it('appel réel (keepalive récent des deux côtés) → jamais fermé', async () => {
      withSockets([{ data: { callKeepalive: true } }]);
      callService.findActiveCallId.mockResolvedValue('ghost-1');
      await gateway.handleCallKeepalive(makeSocket('a'), { conversationId: 'conv-g', targetUserId: 'b' });
      await gateway.handleCallKeepalive(makeSocket('b'), { conversationId: 'conv-g', targetUserId: 'a' });
      callService.findActiveCallsForUsers.mockResolvedValue([ghost()]);
      callService.startCall.mockResolvedValue({ outcome: 'busy' });

      await gateway.handleCallInitiate(makeSocket('c'), { conversationId: 'conv-1', calleeUserId: 'a', callerName: 'x' });
      expect(callService.forceEndCalls).not.toHaveBeenCalled();
    });

    it('sonnerie de plus de 40 s → fermée comme manquée', async () => {
      callService.findActiveCallsForUsers.mockResolvedValue([ghost({ status: CallStatus.RINGING, startedAt: new Date(Date.now() - 60_000) })]);
      callService.forceEndCalls.mockResolvedValue([]);
      callService.startCall.mockResolvedValue({ outcome: 'ringing', call: { id: 'new' } as any });
      await gateway.handleCallInitiate(makeSocket('a'), { conversationId: 'conv-1', calleeUserId: 'b', callerName: 'x' });
      expect(callService.forceEndCalls).toHaveBeenCalledWith(['ghost-1']);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Flood-guard — signalisation (offer/answer/ice-candidate)
  // ════════════════════════════════════════════════════════════

  describe('flood-guard signalisation', () => {
    it('un flood soutenu depuis UNE connexion finit par être ignoré silencieusement (seuil 100/10s)', async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      const socket = makeSocket('caller-uuid');

      for (let i = 0; i < 105; i++) {
        await gateway.handleCallIceCandidate(socket, {
          conversationId: 'conv-uuid', targetUserId: 'callee-uuid',
          candidate: { candidate: `candidate:${i} 1 UDP 1 1.1.1.1 1 typ host` },
        });
      }

      expect(roomEmit).toHaveBeenCalledTimes(100);
    });

    it('un flood sur une connexion ne pénalise pas une AUTRE connexion (isolée par socket.id)', async () => {
      callService.findActiveCallId.mockResolvedValue('call-uuid');
      const floodingSocket = makeSocket('caller-uuid');
      const otherSocket     = makeSocket('caller-uuid'); // même utilisateur, 2e appareil

      for (let i = 0; i < 105; i++) {
        await gateway.handleCallIceCandidate(floodingSocket, {
          conversationId: 'conv-uuid', targetUserId: 'callee-uuid',
          candidate: { candidate: `candidate:${i} 1 UDP 1 1.1.1.1 1 typ host` },
        });
      }
      roomEmit.mockClear();

      await gateway.handleCallIceCandidate(otherSocket, {
        conversationId: 'conv-uuid', targetUserId: 'callee-uuid',
        candidate: { candidate: 'candidate:1 1 UDP 1 1.1.1.1 1 typ host' },
      });

      expect(roomEmit).toHaveBeenCalledWith('call:ice-candidate', expect.anything());
    });
  });
});
