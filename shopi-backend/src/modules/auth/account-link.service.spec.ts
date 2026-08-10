/* ============================================================
 * FICHIER      : src/modules/auth/account-link.service.spec.ts
 * MODULE       : Auth — Comptes liés pro↔client ("Mon espace")
 * RÔLE         : Tests unitaires d'AccountLinkService.
 *
 * COUVERTURE :
 *   ✅ createLinkedClient — rôle non-pro refusé
 *   ✅ createLinkedClient — chemin "création rapide" complet (succès)
 *   ✅ createLinkedClient — idempotent si déjà lié (actif)
 *   ✅ createLinkedClient — email du pro déjà pris par le compte client
 *      de QUELQU'UN D'AUTRE → bloqué avec message clair (mirroir
 *      applicatif de UNIQ_user_email_role en base)
 *   ✅ linkExistingClient — chemin "liaison par mot de passe" (succès)
 *   ✅ linkExistingClient — chemin "liaison par OTP/resetToken" (succès)
 *   ✅ linkExistingClient — idempotent si déjà lié (actif)
 *   ✅ linkExistingClient — refuse si le client ciblé a déjà un
 *      lien ACTIF avec un autre pro (mirroir applicatif de l'index
 *      unique partiel UNIQ_account_link_client_active en base —
 *      pas de DB réelle dans ces tests, voir le fichier de migration
 *      pour la partie "contrainte SQL")
 *   ✅ linkExistingClient — un lien RÉVOQUÉ ne bloque pas une
 *      nouvelle liaison (le client redevient "non lié")
 *   ✅ switchAccount — refuse si aucun lien actif
 *   ✅ switchAccount — refuse si le compte cible est banni/suspendu
 *
 * Comme le reste de la suite (voir company-team.service.spec.ts),
 * tous les appels DB sont mockés — pas de connexion Postgres réelle.
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }  from '@nestjs/typeorm';
import { DataSource }          from 'typeorm';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

import { AccountLinkService } from './account-link.service';
import { AuthService }        from './auth.service';
import { TwoFaService }       from './twofa/twofa.service';
import { AccountLink, AccountLinkStatus, AccountLinkMethod, AccountLinkVerification } from '../../database/entities/account-link.entity';
import { User, UserStatus }   from '../../database/entities/user.entity';
import { Client }             from '../../database/entities/profiles/client-profile.entity';
import { Wallet }             from '../../database/entities/wallet.entity';
import { UserRole }           from 'src/common/enums/user-role.enum';

/* ── Helpers ── */
function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 'user-uuid', firstName: 'Jean', lastName: 'Dupont',
    email: 'jean.dupont@test.com', phone: '+224600000000', phoneHash: null,
    role: UserRole.COMPANY, status: UserStatus.ACTIVE,
    ...overrides,
  });
}

function makeLink(overrides: Partial<AccountLink> = {}): AccountLink {
  return Object.assign(new AccountLink(), {
    id: 'link-uuid', proUserId: 'pro-uuid', clientUserId: 'client-uuid',
    status: AccountLinkStatus.ACTIVE, linkedAt: new Date(),
    ...overrides,
  });
}

function mockPasswordQueryBuilder(userRepo: ReturnType<typeof mockRepo>, id: string, password: string) {
  userRepo.createQueryBuilder.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    where:  jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({ id, password }),
  });
}

/* ── Factory repository mock ── */
const mockRepo = () => ({
  findOne:       jest.fn(),
  find:          jest.fn(),
  findOneOrFail: jest.fn(),
  create:        jest.fn((x) => x),
  save:          jest.fn((x) => Promise.resolve(x)),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where:  jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  })),
});

const mockQR = {
  connect:             jest.fn(),
  startTransaction:    jest.fn(),
  commitTransaction:   jest.fn(),
  rollbackTransaction: jest.fn(),
  release:             jest.fn(),
  manager: {
    save: jest.fn((_entity: unknown, x: any) => Promise.resolve({ ...x, id: x.id ?? 'new-uuid' })),
  },
};

describe('AccountLinkService', () => {
  let service: AccountLinkService;
  let userRepo: ReturnType<typeof mockRepo>;
  let linkRepo: ReturnType<typeof mockRepo>;
  let clientRepo: ReturnType<typeof mockRepo>;
  let walletRepo: ReturnType<typeof mockRepo>;
  let authService: jest.Mocked<Pick<AuthService,
    'issueTokensForUser' | 'generateUniqueUsername' | 'verifyResetToken' |
    'isSwitch2faGraced' | 'signSwitchTwoFaChallenge' | 'logEvent' | 'handleFailedLogin'
  >>;
  let twoFaService: { isEnabled: jest.Mock };

  beforeEach(async () => {
    userRepo   = mockRepo();
    linkRepo   = mockRepo();
    clientRepo = mockRepo();
    walletRepo = mockRepo();
    authService = {
      issueTokensForUser:       jest.fn().mockResolvedValue({ accessToken: 'tok', refreshToken: null, refreshTtlMs: 0, user: {} }),
      generateUniqueUsername:   jest.fn().mockResolvedValue('jean.dupont2'),
      verifyResetToken:         jest.fn(),
      isSwitch2faGraced:        jest.fn().mockResolvedValue(false),
      signSwitchTwoFaChallenge: jest.fn().mockReturnValue('challenge.jwt.token'),
      logEvent:                 jest.fn(),
      handleFailedLogin:        jest.fn().mockResolvedValue(undefined),
    };
    twoFaService = { isEnabled: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountLinkService,
        { provide: getRepositoryToken(User),        useValue: userRepo },
        { provide: getRepositoryToken(Client),      useValue: clientRepo },
        { provide: getRepositoryToken(Wallet),      useValue: walletRepo },
        { provide: getRepositoryToken(AccountLink), useValue: linkRepo },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn(() => mockQR) } },
        { provide: AuthService, useValue: authService },
        { provide: TwoFaService, useValue: twoFaService },
      ],
    }).compile();

    service = module.get(AccountLinkService);
  });

  afterEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════
  // createLinkedClient — chemin "création rapide"
  // ════════════════════════════════════════════════════════════

  describe('createLinkedClient', () => {
    it('refuse un compte non-pro (ex. déjà CLIENT)', async () => {
      userRepo.findOneOrFail.mockResolvedValue(makeUser({ role: UserRole.CLIENT }));

      await expect(service.createLinkedClient('pro-uuid', 'Password1!'))
        .rejects.toThrow(ForbiddenException);
    });

    it('crée le compte client + profil + wallet + lien, et connecte dessus (chemin nominal)', async () => {
      const proUser = makeUser({ id: 'pro-uuid' });
      userRepo.findOneOrFail.mockResolvedValue(proUser);
      linkRepo.findOne.mockResolvedValue(null);   // pas de lien existant
      userRepo.findOne.mockResolvedValue(null);   // aucun client existant avec cet email/téléphone

      const result = await service.createLinkedClient('pro-uuid', 'Password1!');

      expect(mockQR.startTransaction).toHaveBeenCalled();
      expect(mockQR.commitTransaction).toHaveBeenCalled();
      expect(mockQR.manager.save).toHaveBeenCalledWith(User, expect.objectContaining({
        email: proUser.email, role: UserRole.CLIENT,
      }));
      expect(mockQR.manager.save).toHaveBeenCalledWith(Client, expect.objectContaining({
        fullName: 'Jean Dupont',
      }));
      expect(mockQR.manager.save).toHaveBeenCalledWith(Wallet, expect.anything());
      expect(mockQR.manager.save).toHaveBeenCalledWith(AccountLink, expect.objectContaining({
        proUserId: 'pro-uuid', linkMethod: AccountLinkMethod.QUICK_CREATE,
        verifiedVia: null, status: AccountLinkStatus.ACTIVE,
      }));
      expect(authService.issueTokensForUser).toHaveBeenCalled();
      expect(result.accessToken).toBe('tok');
    });

    it('est idempotent — un lien ACTIF existant reconnecte sans recréer de compte', async () => {
      userRepo.findOneOrFail
        .mockResolvedValueOnce(makeUser({ id: 'pro-uuid' }))      // proUser
        .mockResolvedValueOnce(makeUser({ id: 'client-uuid', role: UserRole.CLIENT })); // clientUser existant
      linkRepo.findOne.mockResolvedValue(makeLink({ proUserId: 'pro-uuid', clientUserId: 'client-uuid' }));

      await service.createLinkedClient('pro-uuid', 'Password1!');

      // Aucune transaction (queryRunner) ne doit être ouverte — pas de recréation.
      expect(mockQR.startTransaction).not.toHaveBeenCalled();
      expect(authService.issueTokensForUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'client-uuid' }), false, null, null,
      );
    });

    it("bloque avec un message clair si l'email du pro est déjà pris par le compte client de QUELQU'UN D'AUTRE", async () => {
      const proUser = makeUser({ id: 'pro-uuid', email: 'partage@test.com' });
      userRepo.findOneOrFail.mockResolvedValue(proUser);
      linkRepo.findOne.mockResolvedValue(null); // pas de lien pour CE pro
      // Un compte CLIENT avec cet email existe déjà (lié à un AUTRE pro,
      // donc invisible pour findUnlinkedClientMatching — c'est exactement
      // le scénario que UNIQ_user_email_role empêcherait silencieusement
      // de recréer si on ne le détectait pas explicitement ici).
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'autre-client-uuid', role: UserRole.CLIENT, email: 'partage@test.com' }));

      await expect(service.createLinkedClient('pro-uuid', 'Password1!'))
        .rejects.toThrow(ConflictException);
      // Aucune tentative de création — le garde-fou agit AVANT la transaction.
      expect(mockQR.startTransaction).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════
  // linkExistingClient
  // ════════════════════════════════════════════════════════════

  describe('linkExistingClient', () => {
    it('lie un compte client existant via mot de passe (chemin nominal)', async () => {
      const proUser    = makeUser({ id: 'pro-uuid' });
      const clientUser = makeUser({ id: 'client-uuid', role: UserRole.CLIENT });

      userRepo.findOneOrFail.mockResolvedValue(proUser);
      linkRepo.findOne
        .mockResolvedValueOnce(null)  // existingLink (ce pro) — aucun
        .mockResolvedValueOnce(null); // alreadyLinkedElsewhere — aucun
      userRepo.find.mockResolvedValue([clientUser]);
      linkRepo.find.mockResolvedValue([]); // linkedClientIds actifs — vide
      mockPasswordQueryBuilder(userRepo, 'client-uuid', 'hash');

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await service.linkExistingClient('pro-uuid', { password: 'secret' });

      expect(linkRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        proUserId: 'pro-uuid', clientUserId: 'client-uuid',
        linkMethod: AccountLinkMethod.EXISTING_VERIFIED,
        verifiedVia: AccountLinkVerification.PASSWORD,
        status: AccountLinkStatus.ACTIVE,
      }));
      expect(result.accessToken).toBe('tok');
    });

    it('lie un compte client existant via resetToken OTP (chemin nominal)', async () => {
      const proUser    = makeUser({ id: 'pro-uuid' });
      const clientUser = makeUser({ id: 'client-uuid', role: UserRole.CLIENT });

      userRepo.findOneOrFail.mockResolvedValue(proUser);
      linkRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      userRepo.find.mockResolvedValue([clientUser]);
      linkRepo.find.mockResolvedValue([]);
      // La preuve OTP passe par verifyResetToken() — réutilise le flux
      // forgot-password/verify-otp existant, voir AuthService.verifyResetToken.
      authService.verifyResetToken.mockReturnValue({
        sub: 'client-uuid', purpose: 'password-reset', email: clientUser.email,
      });

      const result = await service.linkExistingClient('pro-uuid', { resetToken: 'valid.reset.token' });

      expect(linkRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        clientUserId: 'client-uuid', verifiedVia: AccountLinkVerification.OTP_EMAIL,
      }));
      expect(result.accessToken).toBe('tok');
    });

    it('rejette un resetToken valide mais ciblant un AUTRE compte que le candidat trouvé', async () => {
      const proUser    = makeUser({ id: 'pro-uuid' });
      const clientUser = makeUser({ id: 'client-uuid', role: UserRole.CLIENT });

      userRepo.findOneOrFail.mockResolvedValue(proUser);
      linkRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      userRepo.find.mockResolvedValue([clientUser]);
      linkRepo.find.mockResolvedValue([]);
      // Le token prouve la possession d'un compte DIFFÉRENT — ne doit jamais
      // servir à lier le compte trouvé par email/téléphone.
      authService.verifyResetToken.mockReturnValue({
        sub: 'un-tout-autre-compte', purpose: 'password-reset', email: 'autre@test.com',
      });

      await expect(service.linkExistingClient('pro-uuid', { resetToken: 'valid.but.wrong.target' }))
        .rejects.toThrow(ForbiddenException);
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it('est idempotent — un lien ACTIF existant reconnecte sans re-vérifier de preuve', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ proUserId: 'pro-uuid', clientUserId: 'client-uuid' }));
      userRepo.findOneOrFail
        .mockResolvedValueOnce(makeUser({ id: 'pro-uuid' }))                              // proUser
        .mockResolvedValueOnce(makeUser({ id: 'client-uuid', role: UserRole.CLIENT }));   // clientUser

      await service.linkExistingClient('pro-uuid', { password: 'peu-importe' });

      // Aucune vérification de mot de passe/OTP ne doit avoir lieu.
      expect(linkRepo.save).not.toHaveBeenCalled();
      expect(authService.issueTokensForUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'client-uuid' }), false, null, null,
      );
    });

    it('refuse si le compte client ciblé a déjà un lien ACTIF avec un autre pro', async () => {
      const proUser    = makeUser({ id: 'pro-uuid' });
      const clientUser = makeUser({ id: 'client-uuid', role: UserRole.CLIENT });

      userRepo.findOneOrFail.mockResolvedValue(proUser);
      // Pas de lien actif pour CE pro, mais le candidat trouvé est lié ailleurs.
      linkRepo.findOne
        .mockResolvedValueOnce(null)                                   // existingLink (ce pro)
        .mockResolvedValueOnce(makeLink({ clientUserId: 'client-uuid', proUserId: 'un-autre-pro' })); // alreadyLinkedElsewhere
      userRepo.find.mockResolvedValue([clientUser]);
      linkRepo.find.mockResolvedValue([]); // linkedClientIds (actifs) — le candidat est trouvable ici
      mockPasswordQueryBuilder(userRepo, 'client-uuid', 'hash');

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      await expect(service.linkExistingClient('pro-uuid', { password: 'secret' }))
        .rejects.toThrow(ConflictException);
    });

    it('appelle handleFailedLogin() sur le compte CIBLE quand le mot de passe est incorrect (verrouillage partagé avec /auth/login)', async () => {
      const proUser    = makeUser({ id: 'pro-uuid' });
      const clientUser = makeUser({ id: 'client-uuid', role: UserRole.CLIENT, lockedUntil: null });

      userRepo.findOneOrFail.mockResolvedValue(proUser);
      linkRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      userRepo.find.mockResolvedValue([clientUser]);
      linkRepo.find.mockResolvedValue([]);
      mockPasswordQueryBuilder(userRepo, 'client-uuid', 'hash');

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(service.linkExistingClient('pro-uuid', { password: 'mauvais' }))
        .rejects.toThrow(ForbiddenException);

      expect(authService.handleFailedLogin).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'client-uuid' }),
      );
      expect(linkRepo.save).not.toHaveBeenCalled();
    });

    it('refuse sans même vérifier le mot de passe si le compte CIBLE est déjà verrouillé (6e tentative)', async () => {
      const proUser    = makeUser({ id: 'pro-uuid' });
      const clientUser = makeUser({
        id: 'client-uuid', role: UserRole.CLIENT,
        lockedUntil: new Date(Date.now() + 10 * 60_000), // verrouillé encore 10 min
      });

      userRepo.findOneOrFail.mockResolvedValue(proUser);
      linkRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      userRepo.find.mockResolvedValue([clientUser]);
      linkRepo.find.mockResolvedValue([]);

      await expect(service.linkExistingClient('pro-uuid', { password: 'peu-importe' }))
        .rejects.toThrow(ForbiddenException);

      // Aucune comparaison bcrypt ni compteur d'échec supplémentaire — bloqué en amont.
      expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(authService.handleFailedLogin).not.toHaveBeenCalled();
    });

    it("un lien RÉVOQUÉ ne bloque pas une nouvelle liaison (le client redevient éligible)", async () => {
      const proUser    = makeUser({ id: 'pro-uuid' });
      const clientUser = makeUser({ id: 'client-uuid', role: UserRole.CLIENT });

      userRepo.findOneOrFail.mockResolvedValue(proUser);
      linkRepo.findOne
        .mockResolvedValueOnce(null)  // existingLink (ce pro) — aucun
        .mockResolvedValueOnce(null); // alreadyLinkedElsewhere — aucun lien ACTIF (l'ancien est révoqué)
      userRepo.find.mockResolvedValue([clientUser]);
      // find() sur linkRepo est filtré {status: ACTIVE} dans le service —
      // le lien révoqué du client n'apparaît donc jamais ici.
      linkRepo.find.mockResolvedValue([]);
      mockPasswordQueryBuilder(userRepo, 'client-uuid', 'hash');

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      await service.linkExistingClient('pro-uuid', { password: 'secret' });

      expect(linkRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ clientUserId: 'client-uuid', status: AccountLinkStatus.ACTIVE }),
      );
      expect(authService.issueTokensForUser).toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════
  // switchAccount
  // ════════════════════════════════════════════════════════════

  describe('switchAccount', () => {
    it('refuse si aucun lien actif pour ce compte', async () => {
      linkRepo.findOne.mockResolvedValue(null);

      await expect(service.switchAccount('user-uuid'))
        .rejects.toThrow(BadRequestException);
    });

    it('refuse de basculer vers un compte banni', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ proUserId: 'pro-uuid', clientUserId: 'client-uuid' }));
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'client-uuid', status: UserStatus.BANNED }));

      await expect(service.switchAccount('pro-uuid'))
        .rejects.toThrow(ForbiddenException);
    });

    it('émet des tokens pour le compte lié quand tout est valide (switch normal)', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ proUserId: 'pro-uuid', clientUserId: 'client-uuid' }));
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'client-uuid', role: UserRole.CLIENT, status: UserStatus.ACTIVE }));

      const result = await service.switchAccount('pro-uuid');

      expect(authService.issueTokensForUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'client-uuid' }), false, null, null,
      );
      expect('accessToken' in (result as any)).toBe(true);
      // Journalisé pour audit : qui (cible), quand, et la source encodée
      // dans failureReason (voir commentaire du service).
      expect(authService.logEvent).toHaveBeenCalledWith('account_switch', expect.objectContaining({
        userId: 'client-uuid', success: true, failureReason: 'from=pro-uuid',
      }));
    });

    it('un compte SOURCE banni ne bloque PAS le switch vers une cible saine (pas de contrôle croisé)', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ proUserId: 'pro-uuid', clientUserId: 'client-uuid' }));
      // Le service ne charge/consulte JAMAIS le compte source — seul currentUserId
      // (un simple id) est utilisé pour retrouver le lien. On vérifie juste que
      // le switch aboutit normalement, peu importe le statut réel du compte source.
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'client-uuid', role: UserRole.CLIENT, status: UserStatus.ACTIVE }));

      await expect(service.switchAccount('pro-uuid-banni')).resolves.toBeDefined();
      expect(authService.issueTokensForUser).toHaveBeenCalled();
    });

    it('exige un step-up 2FA si la cible a la 2FA active et aucune grâce récente', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ proUserId: 'pro-uuid', clientUserId: 'client-uuid' }));
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'client-uuid', role: UserRole.CLIENT, status: UserStatus.ACTIVE }));
      twoFaService.isEnabled.mockResolvedValue(true);
      authService.isSwitch2faGraced.mockResolvedValue(false);

      const result = await service.switchAccount('pro-uuid');

      expect('requiresTwoFa' in (result as any)).toBe(true);
      expect((result as any).challengeToken).toBe('challenge.jwt.token');
      expect(authService.signSwitchTwoFaChallenge).toHaveBeenCalledWith('client-uuid', 'pro-uuid');
      // Pas de tokens émis tant que le step-up n'est pas validé.
      expect(authService.issueTokensForUser).not.toHaveBeenCalled();
    });

    it('ne redemande PAS de 2FA si une grâce récente existe pour ce couple source→cible', async () => {
      linkRepo.findOne.mockResolvedValue(makeLink({ proUserId: 'pro-uuid', clientUserId: 'client-uuid' }));
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'client-uuid', role: UserRole.CLIENT, status: UserStatus.ACTIVE }));
      twoFaService.isEnabled.mockResolvedValue(true);
      authService.isSwitch2faGraced.mockResolvedValue(true); // step-up déjà validé récemment

      const result = await service.switchAccount('pro-uuid');

      expect('requiresTwoFa' in (result as any)).toBe(false);
      expect(authService.signSwitchTwoFaChallenge).not.toHaveBeenCalled();
      expect(authService.issueTokensForUser).toHaveBeenCalled();
    });
  });
});
