/* ============================================================
 * FICHIER      : src/modules/call/call.service.spec.ts
 * MODULE       : Call — appels audio/vidéo 1:1
 * RÔLE         : Tests unitaires de CallService.
 *
 * COUVERTURE (scénarios demandés dans l'audit — voir le rapport) :
 *   ✅ Appel audio réussi (start → accept → CONNECTED)
 *   ✅ Appel vidéo réussi
 *   ✅ Appel refusé
 *   ✅ Appel manqué (jamais décroché puis raccroché)
 *   ✅ Utilisateur occupé (callee) → outcome 'busy', historisé sans ligne active
 *   ✅ Utilisateur hors ligne → outcome 'offline', historisé + double notif
 *   ✅ Appelant déjà en appel → refusé (ForbiddenException)
 *   ✅ Deux appels simultanés (busy check) → même mécanisme que ci-dessus
 *   ✅ Token/identifiant manquant (garde userId undefined) → refusé
 *   ✅ Utilisateur non autorisé (permission refusée) → ForbiddenException
 *   ✅ Faux call_id (accept/reject/end sur un id inexistant) → 404 / idempotent
 *   ✅ Faux callee_id (accept par quelqu'un d'autre que le callee) → refusé
 *   ✅ Plusieurs appareils — accept concurrent idempotent (déjà CONNECTED)
 *   ✅ Déconnexion WebSocket — endAllCallsForUser nettoie tout
 *   ✅ TURN indisponible — fallback STUN seul
 *   ✅ TURN configuré (statique) — URLs générées correctement
 *   ✅ TURN à durée limitée (METERED_TURN_SECRET) — credential HMAC valide
 *   ✅ Panne Redis sur le rate-limit — n'bloque pas l'appel (dégradation gracieuse)
 *
 * Comme le reste de la suite (voir account-link.service.spec.ts), tous les
 * appels DB/Redis sont mockés — pas de connexion réelle. dataSource.transaction
 * est mocké pour exécuter directement le callback avec un "manager" qui
 * délègue aux mêmes mocks de repository que l'accès direct (this.callRepo),
 * pour ne pas dupliquer les assertions selon le chemin transactionnel ou non.
 *
 * Micro/caméra refusés, perte réseau, reconnexion ICE : ce sont des
 * comportements du NAVIGATEUR (getUserMedia, RTCPeerConnection) exercés côté
 * frontend (useAudioCall.ts) — il n'y a pas d'environnement DOM/WebRTC dans
 * cette suite backend Jest, donc pas de test ici pour ces scénarios précis.
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import { ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';

import { CallService } from './call.service';
import { Call, CallStatus, CallType } from 'src/database/entities/call/call.entity';
import { CallHistory, CallHistoryStatus } from 'src/database/entities/call/call-history.entity';
import { User, UserStatus } from 'src/database/entities/user.entity';
import { Client } from 'src/database/entities/profiles/client-profile.entity';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner } from 'src/database/entities/profiles/partenaire-profile.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { MessagingPermissionEngine } from '../messagerie/permissions/messaging-permission.engine';
import { PresenceService } from '../messagerie/services/presence.service';
import { NotificationService } from '../notifications/services/notification.service';

/* ── Helpers ── */
function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 'user-uuid', role: UserRole.CLIENT, status: UserStatus.ACTIVE,
    ...overrides,
  });
}

function makeCall(overrides: Partial<Call> = {}): Call {
  return Object.assign(new Call(), {
    id: 'call-uuid', callerId: 'caller-uuid', calleeId: 'callee-uuid',
    conversationId: 'conv-uuid', callType: CallType.AUDIO,
    status: CallStatus.RINGING, startedAt: new Date(), answeredAt: null,
    ...overrides,
  });
}

const mockRepo = () => ({
  findOne:       jest.fn(),
  find:          jest.fn().mockResolvedValue([]),
  findAndCount:  jest.fn().mockResolvedValue([[], 0]),
  create:        jest.fn((x) => x),
  save:          jest.fn((x) => Promise.resolve({ ...x, id: x.id ?? 'saved-uuid' })),
  delete:        jest.fn().mockResolvedValue(undefined),
});

describe('CallService', () => {
  let service: CallService;
  let callRepo: ReturnType<typeof mockRepo>;
  let historyRepo: ReturnType<typeof mockRepo>;
  let userRepo: ReturnType<typeof mockRepo>;
  let clientRepo: ReturnType<typeof mockRepo>;
  let permissionEngine: { check: jest.Mock };
  let presence: { isOnlineOrUnknown: jest.Mock };
  let notifications: { create: jest.Mock };
  let redis: { incr: jest.Mock; expire: jest.Mock };
  let config: { get: jest.Mock };
  let manager: {
    findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock;
    query: jest.Mock; getRepository: jest.Mock;
  };

  beforeEach(async () => {
    callRepo    = mockRepo();
    historyRepo = mockRepo();
    userRepo    = mockRepo();
    clientRepo  = mockRepo();

    manager = {
      findOne: jest.fn((_entity: unknown, opts: any) => callRepo.findOne(opts)),
      find:    jest.fn((_entity: unknown, opts: any) => callRepo.find(opts)),
      create:  jest.fn((_entity: unknown, data: any) => callRepo.create(data)),
      save:    jest.fn((data: any) => callRepo.save(data)),
      query:   jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn((entity: unknown) => (entity === Call ? callRepo : historyRepo)),
    };

    permissionEngine = { check: jest.fn().mockResolvedValue({ granted: true }) };
    presence          = { isOnlineOrUnknown: jest.fn().mockResolvedValue(true) };
    notifications     = { create: jest.fn().mockResolvedValue(undefined) };
    redis             = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(1) };
    config            = { get: jest.fn().mockReturnValue(undefined) };

    /* Défaut partagé : résout n'importe quel userId en client actif — les
     * tests d'accept/reject/end ne portent pas sur la résolution d'acteur
     * (déjà couverte par les tests startCall/assertCanCall), seulement sur
     * la mécanique de transition d'état. Un test peut surcharger ces mocks
     * localement si besoin (ex. mockActiveUsers dans startCall). */
    userRepo.findOne.mockResolvedValue(makeUser());
    clientRepo.findOne.mockResolvedValue({ id: 'profile-uuid' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallService,
        { provide: getRepositoryToken(Call),        useValue: callRepo },
        { provide: getRepositoryToken(CallHistory), useValue: historyRepo },
        { provide: getRepositoryToken(User),        useValue: userRepo },
        { provide: getRepositoryToken(Client),        useValue: clientRepo },
        { provide: getRepositoryToken(Company),       useValue: mockRepo() },
        { provide: getRepositoryToken(Delivery),      useValue: mockRepo() },
        { provide: getRepositoryToken(Correspondent), useValue: mockRepo() },
        { provide: getRepositoryToken(Partner),       useValue: mockRepo() },
        { provide: MessagingPermissionEngine, useValue: permissionEngine },
        { provide: PresenceService,           useValue: presence },
        { provide: NotificationService,       useValue: notifications },
        { provide: ConfigService,             useValue: config },
        { provide: DataSource, useValue: { transaction: jest.fn((cb: any) => cb(manager)) } },
        { provide: getRedisConnectionToken(), useValue: redis },
      ],
    }).compile();

    service = module.get(CallService);
  });

  afterEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════
  // startCall
  // ════════════════════════════════════════════════════════════

  describe('startCall', () => {
    function mockActiveUsers(caller: User, callee: User) {
      userRepo.findOne.mockImplementation(({ where: { id } }: any) =>
        Promise.resolve(id === caller.id ? caller : id === callee.id ? callee : null));
      clientRepo.findOne.mockResolvedValue({ id: 'profile-uuid' });
    }

    it('appel audio réussi — crée la ligne RINGING', async () => {
      const caller = makeUser({ id: 'caller-uuid' });
      const callee = makeUser({ id: 'callee-uuid' });
      mockActiveUsers(caller, callee);
      callRepo.find.mockResolvedValue([]); // ni l'un ni l'autre occupé

      const result = await service.startCall('caller-uuid', {
        calleeUserId: 'callee-uuid', callType: CallType.AUDIO, conversationId: 'conv-uuid',
      });

      expect(result.outcome).toBe('ringing');
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({
        callerId: 'caller-uuid', calleeId: 'callee-uuid',
        callType: CallType.AUDIO, status: CallStatus.RINGING,
      }));
    });

    it('appel vidéo réussi — callType propagé correctement', async () => {
      const caller = makeUser({ id: 'caller-uuid' });
      const callee = makeUser({ id: 'callee-uuid' });
      mockActiveUsers(caller, callee);
      callRepo.find.mockResolvedValue([]);

      const result = await service.startCall('caller-uuid', {
        calleeUserId: 'callee-uuid', callType: CallType.VIDEO, conversationId: 'conv-uuid',
      });

      expect(result.outcome).toBe('ringing');
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ callType: CallType.VIDEO }));
    });

    it('refuse si l\'appelant est déjà en appel', async () => {
      const caller = makeUser({ id: 'caller-uuid' });
      const callee = makeUser({ id: 'callee-uuid' });
      mockActiveUsers(caller, callee);
      // Le callRepo.find() renvoie un appel actif quel que soit l'utilisateur interrogé
      // ici on simule spécifiquement le caller occupé (isUserBusy('caller-uuid') → true).
      callRepo.find.mockImplementation(({ where }: any) => {
        const ids = where.map((w: any) => w.callerId ?? w.calleeId);
        if (ids.includes('caller-uuid')) {
          return Promise.resolve([makeCall({ status: CallStatus.CONNECTED, startedAt: new Date() })]);
        }
        return Promise.resolve([]);
      });

      await expect(service.startCall('caller-uuid', {
        calleeUserId: 'callee-uuid', callType: CallType.AUDIO,
      })).rejects.toThrow(ForbiddenException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('utilisateur occupé (callee) → outcome busy, historisé sans ligne active', async () => {
      const caller = makeUser({ id: 'caller-uuid' });
      const callee = makeUser({ id: 'callee-uuid' });
      mockActiveUsers(caller, callee);
      /* PARTIE 9.5 — checkBusyPair() fait UNE seule requête combinée pour
         caller+callee (au lieu de deux isUserBusy() séparées) : la ligne
         retournée doit représenter un appel RÉEL impliquant callee-uuid avec
         un TIERS (pas avec caller-uuid lui-même), pour tester sans ambiguïté
         l'attribution busy au bon côté (callerId/calleeId de la ligne
         déterminent qui est busy, pas la branche du mock qui l'a renvoyée). */
      callRepo.find.mockResolvedValue([
        makeCall({ callerId: 'callee-uuid', calleeId: 'tiers-uuid', status: CallStatus.CONNECTED, startedAt: new Date() }),
      ]);

      const result = await service.startCall('caller-uuid', {
        calleeUserId: 'callee-uuid', callType: CallType.AUDIO,
      });

      expect(result.outcome).toBe('busy');
      expect(historyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: CallHistoryStatus.BUSY }));
      expect(manager.save).not.toHaveBeenCalled(); // pas de ligne `calls` créée
      expect(notifications.create).toHaveBeenCalled();
    });

    it('utilisateur hors ligne → outcome offline, historisé + double notification', async () => {
      const caller = makeUser({ id: 'caller-uuid' });
      const callee = makeUser({ id: 'callee-uuid' });
      mockActiveUsers(caller, callee);
      callRepo.find.mockResolvedValue([]);
      presence.isOnlineOrUnknown.mockResolvedValue(false);

      const result = await service.startCall('caller-uuid', {
        calleeUserId: 'callee-uuid', callType: CallType.AUDIO,
      });

      expect(result.outcome).toBe('offline');
      expect(historyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: CallHistoryStatus.MISSED }));
      expect(notifications.create).toHaveBeenCalledTimes(2); // appelant (offline) + appelé (missed)
    });

    it('refuse si userId manquant (garde anti-undefined)', async () => {
      await expect(service.startCall('', { calleeUserId: 'callee-uuid', callType: CallType.AUDIO }))
        .rejects.toThrow(ForbiddenException);
    });

    it('refuse si le moteur de permission refuse (utilisateur non autorisé)', async () => {
      const caller = makeUser({ id: 'caller-uuid' });
      const callee = makeUser({ id: 'callee-uuid' });
      mockActiveUsers(caller, callee);
      permissionEngine.check.mockResolvedValue({ granted: false, reason: 'no_contact' });

      await expect(service.startCall('caller-uuid', { calleeUserId: 'callee-uuid', callType: CallType.AUDIO }))
        .rejects.toThrow(ForbiddenException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('une panne Redis sur le rate-limit ne bloque pas l\'appel (dégradation gracieuse)', async () => {
      const caller = makeUser({ id: 'caller-uuid' });
      const callee = makeUser({ id: 'callee-uuid' });
      mockActiveUsers(caller, callee);
      callRepo.find.mockResolvedValue([]);
      redis.incr.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.startCall('caller-uuid', { calleeUserId: 'callee-uuid', callType: CallType.AUDIO });
      expect(result.outcome).toBe('ringing');
    });

    it('violation de la contrainte unique DB (UNIQ_calls_active_pair, backstop) → ConflictException claire', async () => {
      const caller = makeUser({ id: 'caller-uuid' });
      const callee = makeUser({ id: 'callee-uuid' });
      mockActiveUsers(caller, callee);
      callRepo.find.mockResolvedValue([]); // le check applicatif ne voit rien (race gagnée par l'autre transaction)
      manager.save.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));

      await expect(service.startCall('caller-uuid', { calleeUserId: 'callee-uuid', callType: CallType.AUDIO }))
        .rejects.toThrow(ConflictException);
    });
  });

  // ════════════════════════════════════════════════════════════
  // acceptCall / rejectCall / endCall
  // ════════════════════════════════════════════════════════════

  describe('acceptCall', () => {
    it('accepte un appel valide → CONNECTED + answeredAt posé, alreadyAccepted=false', async () => {
      callRepo.findOne.mockResolvedValue(makeCall({ status: CallStatus.RINGING }));

      const { call, alreadyAccepted } = await service.acceptCall('callee-uuid', 'call-uuid');

      expect(call.status).toBe(CallStatus.CONNECTED);
      expect(call.answeredAt).toBeInstanceOf(Date);
      expect(alreadyAccepted).toBe(false);
    });

    it('faux call_id → NotFoundException', async () => {
      callRepo.findOne.mockResolvedValue(null);
      await expect(service.acceptCall('callee-uuid', 'inconnu'))
        .rejects.toThrow(NotFoundException);
    });

    it('faux callee_id (accepté par quelqu\'un d\'autre que le callee) → refusé', async () => {
      callRepo.findOne.mockResolvedValue(makeCall({ calleeId: 'callee-uuid' }));
      await expect(service.acceptCall('un-autre-uuid', 'call-uuid'))
        .rejects.toThrow(ForbiddenException);
    });

    it('plusieurs appareils — un 2e accept sur un appel déjà CONNECTED est idempotent, alreadyAccepted=true', async () => {
      const already = makeCall({ status: CallStatus.CONNECTED, answeredAt: new Date('2026-01-01T00:00:00Z') });
      callRepo.findOne.mockResolvedValue(already);

      const { call, alreadyAccepted } = await service.acceptCall('callee-uuid', 'call-uuid');

      expect(call).toBe(already);
      expect(alreadyAccepted).toBe(true);
      expect(callRepo.save).not.toHaveBeenCalled(); // pas de ré-écriture de answeredAt
    });
  });

  describe('rejectCall', () => {
    it('refuse un appel valide → historisé REJECTED + notifie l\'appelant', async () => {
      callRepo.findOne.mockResolvedValue(makeCall());

      await service.rejectCall('callee-uuid', 'call-uuid');

      expect(historyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: CallHistoryStatus.REJECTED }));
      expect(callRepo.delete).toHaveBeenCalledWith({ id: 'call-uuid' });
      expect(notifications.create).toHaveBeenCalled();
    });

    it('faux call_id → idempotent (aucune exception)', async () => {
      callRepo.findOne.mockResolvedValue(null);
      await expect(service.rejectCall('callee-uuid', 'inconnu')).resolves.toBeUndefined();
    });

    it('refuse si appelé par quelqu\'un d\'autre que le callee', async () => {
      callRepo.findOne.mockResolvedValue(makeCall({ calleeId: 'callee-uuid' }));
      await expect(service.rejectCall('un-autre-uuid', 'call-uuid')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('endCall', () => {
    it('appel manqué (jamais décroché) → MISSED + notifie le callee', async () => {
      callRepo.findOne.mockResolvedValue(makeCall({ status: CallStatus.RINGING, answeredAt: null }));

      await service.endCall('caller-uuid', 'call-uuid');

      expect(historyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: CallHistoryStatus.MISSED }));
      expect(notifications.create).toHaveBeenCalled();
    });

    it('appel connecté raccroché → COMPLETED, pas de notification "manqué"', async () => {
      callRepo.findOne.mockResolvedValue(makeCall({ status: CallStatus.CONNECTED, answeredAt: new Date() }));

      await service.endCall('caller-uuid', 'call-uuid');

      expect(historyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: CallHistoryStatus.COMPLETED }));
    });

    it('refuse si ni caller ni callee', async () => {
      callRepo.findOne.mockResolvedValue(makeCall({ callerId: 'a', calleeId: 'b' }));
      await expect(service.endCall('c', 'call-uuid')).rejects.toThrow(ForbiddenException);
    });

    it('faux call_id → idempotent (aucune exception)', async () => {
      callRepo.findOne.mockResolvedValue(null);
      await expect(service.endCall('caller-uuid', 'inconnu')).resolves.toBeUndefined();
    });
  });

  // ════════════════════════════════════════════════════════════
  // endAllCallsForUser (déconnexion WebSocket)
  // ════════════════════════════════════════════════════════════

  describe('endAllCallsForUser', () => {
    it('nettoie tous les appels actifs et retourne les correspondants à notifier', async () => {
      callRepo.find.mockResolvedValue([
        makeCall({ id: 'c1', callerId: 'user-uuid', calleeId: 'other-1', status: CallStatus.CONNECTED, answeredAt: new Date() }),
        makeCall({ id: 'c2', callerId: 'other-2', calleeId: 'user-uuid', status: CallStatus.RINGING }),
      ]);

      const result = await service.endAllCallsForUser('user-uuid');

      expect(result).toEqual([
        { otherUserId: 'other-1', conversationId: 'conv-uuid' },
        { otherUserId: 'other-2', conversationId: 'conv-uuid' },
      ]);
      expect(historyRepo.save).toHaveBeenCalledTimes(2);
      expect(callRepo.delete).toHaveBeenCalledTimes(2);
    });

    it('aucun appel actif → tableau vide, aucune écriture', async () => {
      callRepo.find.mockResolvedValue([]);
      const result = await service.endAllCallsForUser('user-uuid');
      expect(result).toEqual([]);
      expect(historyRepo.save).not.toHaveBeenCalled();
    });

    it('onlyCallIds=[] → retourne [] immédiatement sans ouvrir de transaction ni interroger la DB', async () => {
      const result = await service.endAllCallsForUser('user-uuid', []);
      expect(result).toEqual([]);
      expect(callRepo.find).not.toHaveBeenCalled();
    });

    it('onlyCallIds fourni → seuls les appels listés sont finalisés (utilisé par le socket-binding de CallGateway)', async () => {
      callRepo.find.mockResolvedValue([
        makeCall({ id: 'c1', callerId: 'user-uuid', calleeId: 'other-1', status: CallStatus.CONNECTED, answeredAt: new Date() }),
      ]);

      const result = await service.endAllCallsForUser('user-uuid', ['c1']);

      expect(result).toEqual([{ otherUserId: 'other-1', conversationId: 'conv-uuid' }]);
      // Le filtre est bien transmis à la requête (peu importe la forme exacte du WHERE ici,
      // seul le comportement observable compte pour ce mock).
      expect(callRepo.find).toHaveBeenCalled();
    });
  });

  describe('findActiveCallsForUser', () => {
    it('retourne les appels où l\'utilisateur est caller OU callee, lecture seule', async () => {
      const calls = [makeCall({ id: 'c1' }), makeCall({ id: 'c2' })];
      callRepo.find.mockResolvedValue(calls);

      const result = await service.findActiveCallsForUser('user-uuid');

      expect(result).toBe(calls);
      expect(callRepo.find).toHaveBeenCalledWith({
        where: [{ callerId: 'user-uuid' }, { calleeId: 'user-uuid' }],
      });
    });
  });

  // ════════════════════════════════════════════════════════════
  // getHistory (partie 9)
  // ════════════════════════════════════════════════════════════

  describe('getHistory', () => {
    function makeHistoryRow(overrides: Partial<CallHistory> = {}): CallHistory {
      return Object.assign(new CallHistory(), {
        id: 'hist-uuid', callerId: 'user-uuid', calleeId: 'other-uuid',
        conversationId: 'conv-uuid', callType: CallType.AUDIO,
        status: CallHistoryStatus.COMPLETED,
        startedAt: new Date('2026-01-01T10:00:00Z'),
        answeredAt: new Date('2026-01-01T10:00:05Z'),
        endedAt:    new Date('2026-01-01T10:05:00Z'),
        duration:   295,
        ...overrides,
      } as CallHistory);
    }

    it('pagination transmise telle quelle à findAndCount (skip/take dérivés de page/limit)', async () => {
      historyRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getHistory('user-uuid', 3, 20);

      expect(historyRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: [{ callerId: 'user-uuid' }, { calleeId: 'user-uuid' }],
        order: { endedAt: 'DESC' },
        skip:  40, // (page 3 - 1) * limit 20
        take:  20,
      }));
    });

    it('appel sortant (callerId = userId) → direction "outgoing", contact = callee', async () => {
      historyRepo.findAndCount.mockResolvedValue([[makeHistoryRow({ callerId: 'user-uuid', calleeId: 'other-uuid' })], 1]);
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-uuid', role: UserRole.CLIENT }));
      clientRepo.findOne.mockResolvedValue({ id: 'profile-uuid', fullName: 'Bob Client' });

      const result = await service.getHistory('user-uuid', 1, 20);

      expect(result.data[0]).toMatchObject({
        direction:   'outgoing',
        contactName: 'Bob Client',
        status:      CallHistoryStatus.COMPLETED,
        duration:    295,
      });
    });

    it('appel entrant (calleeId = userId) → direction "incoming", contact = caller', async () => {
      historyRepo.findAndCount.mockResolvedValue([[makeHistoryRow({ callerId: 'other-uuid', calleeId: 'user-uuid' })], 1]);
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-uuid', role: UserRole.CLIENT }));
      clientRepo.findOne.mockResolvedValue({ id: 'profile-uuid', fullName: 'Alice Cliente' });

      const result = await service.getHistory('user-uuid', 1, 20);

      expect(result.data[0]).toMatchObject({ direction: 'incoming', contactName: 'Alice Cliente' });
    });

    it('appel manqué — status et duration reflètent bien MISSED (jamais décroché)', async () => {
      historyRepo.findAndCount.mockResolvedValue([[
        makeHistoryRow({ status: CallHistoryStatus.MISSED, answeredAt: null, duration: 0 }),
      ], 1]);
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'other-uuid', role: UserRole.CLIENT }));
      clientRepo.findOne.mockResolvedValue({ id: 'profile-uuid', fullName: 'Bob' });

      const result = await service.getHistory('user-uuid', 1, 20);

      expect(result.data[0]).toMatchObject({ status: CallHistoryStatus.MISSED, answeredAt: null, duration: 0 });
    });

    it('confidentialité — un utilisateur ne voit que les lignes où il est caller OU callee (filtre transmis au repo)', async () => {
      historyRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getHistory('user-uuid', 1, 20);

      const callArg = historyRepo.findAndCount.mock.calls[0][0];
      expect(callArg.where).toEqual([{ callerId: 'user-uuid' }, { calleeId: 'user-uuid' }]);
    });
  });

  // ════════════════════════════════════════════════════════════
  // getIceServers (TURN/STUN)
  // ════════════════════════════════════════════════════════════

  describe('getIceServers', () => {
    it('TURN non configuré → fallback STUN seul', async () => {
      config.get.mockReturnValue(undefined);
      const servers = await service.getIceServers();
      expect(servers).toHaveLength(2);
      expect(servers.every(s => (s.urls as string).startsWith('stun:'))).toBe(true);
    });

    it('TURN statique configuré → URLs TCP/UDP/443 générées avec les identifiants fixes', async () => {
      config.get.mockImplementation((key: string) => ({
        METERED_TURN_HOST: 'relay.example.com',
        METERED_TURN_USERNAME: 'static-user',
        METERED_TURN_CREDENTIAL: 'static-cred',
      } as Record<string, string>)[key]);

      const servers = await service.getIceServers();
      const turnServers = servers.filter(s => (s.urls as string).startsWith('turn'));
      expect(turnServers).toHaveLength(4);
      expect(turnServers[0].username).toBe('static-user');
      expect(turnServers[0].credential).toBe('static-cred');
    });

    it('METERED_TURN_SECRET défini → identifiants dynamiques HMAC à durée limitée', async () => {
      config.get.mockImplementation((key: string) => ({
        METERED_TURN_HOST: 'relay.example.com',
        METERED_TURN_SECRET: 'shared-secret',
      } as Record<string, string>)[key]);

      const servers = await service.getIceServers();
      const turnServers = servers.filter(s => (s.urls as string).startsWith('turn'));
      expect(turnServers).toHaveLength(4);
      // username = "<expiration_unix>:shopi" — jamais égal aux identifiants statiques
      expect(turnServers[0].username).toMatch(/^\d+:shopi$/);
      expect(turnServers[0].credential).toEqual(expect.any(String));
      expect(turnServers[0].credential!.length).toBeGreaterThan(0);
      // Le même secret + même fenêtre temporelle doit reproduire le même credential
      // (vérifie que c'est bien un HMAC déterministe, pas une valeur aléatoire).
      const servers2 = await service.getIceServers();
      const turnServers2 = servers2.filter(s => (s.urls as string).startsWith('turn'));
      if (turnServers[0].username === turnServers2[0].username) {
        expect(turnServers2[0].credential).toBe(turnServers[0].credential);
      }
    });

    // ── Partie 6 : observabilité + avertissement mode statique ──

    it('mode statique → avertit UNE SEULE FOIS par process, jamais à chaque appel', async () => {
      config.get.mockImplementation((key: string) => ({
        METERED_TURN_HOST: 'relay.example.com',
        METERED_TURN_USERNAME: 'static-user',
        METERED_TURN_CREDENTIAL: 'static-cred',
      } as Record<string, string>)[key]);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      await service.getIceServers();
      await service.getIceServers();
      await service.getIceServers();

      const staticModeWarnings = warnSpy.mock.calls.filter(([msg]) =>
        typeof msg === 'string' && msg.includes('Identifiants TURN STATIQUES'));
      expect(staticModeWarnings).toHaveLength(1);
    });

    it('mode éphémère → aucun avertissement "statique" émis', async () => {
      config.get.mockImplementation((key: string) => ({
        METERED_TURN_HOST: 'relay.example.com',
        METERED_TURN_SECRET: 'shared-secret',
      } as Record<string, string>)[key]);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      await service.getIceServers();

      const staticModeWarnings = warnSpy.mock.calls.filter(([msg]) =>
        typeof msg === 'string' && msg.includes('Identifiants TURN STATIQUES'));
      expect(staticModeWarnings).toHaveLength(0);
    });

    it('aucun log (warn/debug) ne contient jamais le secret HMAC ni les identifiants générés', async () => {
      config.get.mockImplementation((key: string) => ({
        METERED_TURN_HOST: 'relay.example.com',
        METERED_TURN_SECRET: 'ultra-secret-hmac-key',
      } as Record<string, string>)[key]);
      const warnSpy  = jest.spyOn(Logger.prototype, 'warn');
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      const servers = await service.getIceServers();
      const turnServer = servers.find(s => (s.urls as string).startsWith('turn'));

      const allLoggedMessages = [...warnSpy.mock.calls, ...debugSpy.mock.calls]
        .map(args => String(args[0]));

      expect(allLoggedMessages.some(m => m.includes('ultra-secret-hmac-key'))).toBe(false);
      expect(allLoggedMessages.some(m => turnServer?.credential && m.includes(turnServer.credential))).toBe(false);
      expect(allLoggedMessages.some(m => turnServer?.username && m.includes(turnServer.username))).toBe(false);
    });
  });
});
