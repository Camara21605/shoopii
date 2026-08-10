/* ============================================================
 * FICHIER      : src/modules/dashboard/super-admin/services/utilisateurs.service.spec.ts
 * MODULE       : Super-admin — gestion des comptes utilisateurs
 * RÔLE         : Tests unitaires ciblés sur PARTIE 4 (bannissement/
 *                suspension — coupure des appels actifs en temps réel).
 *
 * PÉRIMÈTRE VOLONTAIREMENT RESTREINT : UtilisateursService n'avait aucune
 * couverture de tests avant cette partie (service large : listUsers,
 * getUser, verifyUser, stats...). Écrire une suite exhaustive du service
 * entier dépasse le périmètre de la partie 4 (bannissement/suspension
 * pendant un appel) — cette suite couvre spécifiquement toggleBlock() et
 * suspendUser(), et leur nouvelle intégration avec CallService pour
 * terminer les appels actifs (y compris RINGING) au moment du bannissement.
 * ============================================================ */

import { UtilisateursService } from './utilisateurs.service';
import { User, UserStatus } from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'target-uuid',
    email: 'cible@shopi.test',
    firstName: 'Jean',
    lastName: 'Dupont',
    role: UserRole.CLIENT,
    status: UserStatus.ACTIVE,
    ...overrides,
  } as User;
}

function makeCaller(overrides: Partial<User> = {}): User {
  return {
    id: 'admin-uuid',
    email: 'admin@shopi.test',
    role: UserRole.SUPER_ADMIN,
    ...overrides,
  } as User;
}

describe('UtilisateursService — partie 4 (bannissement/suspension pendant appel)', () => {
  let service: UtilisateursService;
  let userRepo: { findOne: jest.Mock; save: jest.Mock; manager: { findOne: jest.Mock } };
  let auditLog: { log: jest.Mock };
  let notifEventSvc: { notifyAccountStatusChanged: jest.Mock };
  let broadcast: { disconnectUser: jest.Mock; emitToUser: jest.Mock };
  let callService: { endAllCallsForUser: jest.Mock };

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      save:    jest.fn(x => Promise.resolve(x)),
      manager: { findOne: jest.fn().mockResolvedValue(null) },
    };
    auditLog       = { log: jest.fn().mockResolvedValue(undefined) };
    notifEventSvc  = { notifyAccountStatusChanged: jest.fn() };
    broadcast      = { disconnectUser: jest.fn().mockResolvedValue(undefined), emitToUser: jest.fn() };
    callService    = { endAllCallsForUser: jest.fn().mockResolvedValue([]) };

    service = new UtilisateursService(
      userRepo as any,
      {} as any, // produitRepo — non utilisé par toggleBlock/suspendUser
      {} as any, // commandeRepo — idem
      auditLog as any,
      notifEventSvc as any,
      broadcast as any,
      callService as any,
    );
  });

  // Laisse le temps aux `void this.endActiveCallsAndDisconnect(...)` (fire-and-forget) de s'exécuter.
  const flush = () => new Promise(process.nextTick);

  describe('toggleBlock — bannissement', () => {
    it('bannit un compte ACTIVE et termine tous ses appels actifs (y compris RINGING)', async () => {
      const target = makeUser({ status: UserStatus.ACTIVE });
      userRepo.findOne.mockResolvedValue(target);
      callService.endAllCallsForUser.mockResolvedValue([
        { otherUserId: 'caller-uuid', conversationId: 'conv-1' },
      ]);

      const result = await service.toggleBlock('target-uuid', makeCaller());
      await flush();

      expect(target.status).toBe(UserStatus.BANNED);
      expect(result.status).toBeDefined();
      expect(callService.endAllCallsForUser).toHaveBeenCalledWith('target-uuid');
      expect(broadcast.emitToUser).toHaveBeenCalledWith(
        'caller-uuid', 'call:ended', expect.objectContaining({ conversationId: 'conv-1' }),
      );
      expect(broadcast.disconnectUser).toHaveBeenCalledWith('target-uuid', 'account_banned');
    });

    it('endAllCallsForUser AVANT disconnectUser — pour ne pas dépendre du timing de la déconnexion socket', async () => {
      const target = makeUser({ status: UserStatus.ACTIVE });
      userRepo.findOne.mockResolvedValue(target);
      const order: string[] = [];
      callService.endAllCallsForUser.mockImplementation(async () => { order.push('endAllCalls'); return []; });
      broadcast.disconnectUser.mockImplementation(async () => { order.push('disconnect'); });

      await service.toggleBlock('target-uuid', makeCaller());
      await flush();

      expect(order).toEqual(['endAllCalls', 'disconnect']);
    });

    it('un échec de endAllCallsForUser ne fait pas échouer le bannissement lui-même', async () => {
      const target = makeUser({ status: UserStatus.ACTIVE });
      userRepo.findOne.mockResolvedValue(target);
      callService.endAllCallsForUser.mockRejectedValue(new Error('DB down'));

      await expect(service.toggleBlock('target-uuid', makeCaller())).resolves.toBeDefined();
      await flush();

      // La déconnexion forcée du socket doit quand même avoir lieu malgré l'échec.
      expect(broadcast.disconnectUser).toHaveBeenCalledWith('target-uuid', 'account_banned');
    });

    it('débloquer un compte BANNED ne touche à aucun appel (uniquement au blocage)', async () => {
      const target = makeUser({ status: UserStatus.BANNED });
      userRepo.findOne.mockResolvedValue(target);

      await service.toggleBlock('target-uuid', makeCaller());
      await flush();

      expect(target.status).toBe(UserStatus.ACTIVE);
      expect(callService.endAllCallsForUser).not.toHaveBeenCalled();
      expect(broadcast.disconnectUser).not.toHaveBeenCalled();
    });
  });

  describe('suspendUser — suspension', () => {
    it('suspend un compte et termine tous ses appels actifs (y compris RINGING)', async () => {
      const target = makeUser({ status: UserStatus.ACTIVE });
      userRepo.findOne.mockResolvedValue(target);
      callService.endAllCallsForUser.mockResolvedValue([
        { otherUserId: 'callee-uuid', conversationId: 'conv-2' },
      ]);

      const result = await service.suspendUser('target-uuid', makeCaller(), 'comportement abusif');
      await flush();

      expect(target.status).toBe(UserStatus.SUSPENDED);
      expect(result.message).toContain('suspendu');
      expect(callService.endAllCallsForUser).toHaveBeenCalledWith('target-uuid');
      expect(broadcast.emitToUser).toHaveBeenCalledWith(
        'callee-uuid', 'call:ended', expect.objectContaining({ conversationId: 'conv-2' }),
      );
      expect(broadcast.disconnectUser).toHaveBeenCalledWith('target-uuid', 'account_suspended');
    });

    it('refuse de suspendre un compte déjà suspendu', async () => {
      const target = makeUser({ status: UserStatus.SUSPENDED });
      userRepo.findOne.mockResolvedValue(target);

      await expect(service.suspendUser('target-uuid', makeCaller())).rejects.toThrow();
      expect(callService.endAllCallsForUser).not.toHaveBeenCalled();
    });
  });
});
