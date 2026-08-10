/* ============================================================
 * FICHIER      : src/modules/auth/auth.service.login.spec.ts
 * MODULE       : Auth — Connexion (comptes liés pro↔client)
 * RÔLE         : Tests unitaires d'AuthService.login() / loginChooseAccount().
 *
 * CONTEXTE : depuis le passage de users.email à UNIQUE(email, role), un
 * même email peut correspondre à DEUX lignes `users` (compte pro + son
 * compte client lié "Mon espace"). login() doit gérer :
 *   - le cas normal (1 seul compte),
 *   - le cas où le même mot de passe correspond aux deux comptes liés
 *     (choix explicite demandé, jamais de connexion automatique),
 *   - et ne JAMAIS révéler, via le nombre d'appels bcrypt (donc le temps
 *     de réponse), combien de comptes existent pour un identifiant donné.
 *
 * Comme le reste de la suite, tout est mocké — pas de DB réelle.
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }  from '@nestjs/typeorm';
import { JwtService }          from '@nestjs/jwt';
import { ConfigService }       from '@nestjs/config';
import { DataSource }          from 'typeorm';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { CodeCreationService } from './code-creation/code-creation.service';
import { MailService }         from '../email/email.service';
import { TwoFaService }        from './twofa/twofa.service';

import { User, UserStatus }     from '../../database/entities/user.entity';
import { Admin }                from '../../database/entities/profiles/admin-profile.entity';
import { Partner }              from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }              from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }             from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }        from '../../database/entities/profiles/correspondant-profile.entity';
import { Client }               from '../../database/entities/profiles/client-profile.entity';
import { Wallet }               from '../../database/entities/wallet.entity';
import { CompanyTeamMember }    from '../../database/entities/company-team/company-team-member.entity';
import { RefreshToken }         from '../../database/entities/refresh-token.entity';
import { AuthLog }              from '../../database/entities/auth-log.entity';
import { UserRole }             from 'src/common/enums/user-role.enum';

/* ── Helpers ── */
const REAL_PASSWORD_HASH = bcrypt.hashSync('CorrectPassword1!', 4); // rounds bas pour la vitesse des tests

function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: 'user-uuid', firstName: 'Jean', lastName: 'Dupont',
    email: 'jean.dupont@test.com', phone: '+224600000000',
    role: UserRole.CLIENT, status: UserStatus.ACTIVE,
    failedLoginAttempts: 0, lockedUntil: null,
    password: REAL_PASSWORD_HASH,
    ...overrides,
  });
}

/* ── Factory repository mock générique ── */
const mockRepo = () => ({
  find:          jest.fn().mockResolvedValue([]),
  findOne:       jest.fn().mockResolvedValue(null),
  findOneOrFail: jest.fn(),
  create:        jest.fn((x) => x),
  save:          jest.fn((x) => Promise.resolve(x)),
  update:        jest.fn().mockResolvedValue({}),
  count:         jest.fn().mockResolvedValue(0),
  createQueryBuilder: jest.fn(),
});

describe('AuthService — login (comptes liés pro↔client)', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockRepo>;

  /** Simule la sélection { id, password } faite par verifyPasswordAgainstCandidates. */
  function mockPasswordLookup(byId: Record<string, string>) {
    userRepo.createQueryBuilder.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where:  function (this: any, _cond: string, params: { id: string }) {
        this.__id = params.id;
        return this;
      },
      getOne: jest.fn(function (this: any) {
        const pwd = byId[this.__id];
        return Promise.resolve(pwd ? { id: this.__id, password: pwd } : null);
      }),
    }));
  }

  beforeEach(async () => {
    userRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User),             useValue: userRepo },
        { provide: getRepositoryToken(Admin),             useValue: mockRepo() },
        { provide: getRepositoryToken(Partner),           useValue: mockRepo() },
        { provide: getRepositoryToken(Company),           useValue: mockRepo() },
        { provide: getRepositoryToken(Delivery),          useValue: mockRepo() },
        { provide: getRepositoryToken(Correspondent),     useValue: mockRepo() },
        { provide: getRepositoryToken(Client),            useValue: mockRepo() },
        { provide: getRepositoryToken(Wallet),            useValue: mockRepo() },
        { provide: getRepositoryToken(CompanyTeamMember), useValue: mockRepo() },
        { provide: getRepositoryToken(RefreshToken),      useValue: mockRepo() },
        { provide: getRepositoryToken(AuthLog),           useValue: mockRepo() },
        { provide: JwtService,          useValue: { sign: jest.fn().mockReturnValue('fake.jwt.token'), verify: jest.fn() } },
        { provide: ConfigService,       useValue: { get: jest.fn().mockReturnValue('x'.repeat(64)) } },
        { provide: DataSource,          useValue: { createQueryRunner: jest.fn() } },
        { provide: CodeCreationService, useValue: {} },
        { provide: MailService,         useValue: { sendWelcomeEmail: jest.fn() } },
        { provide: TwoFaService,        useValue: { isEnabled: jest.fn().mockResolvedValue(false) } },
        { provide: getRedisConnectionToken(), useValue: { incr: jest.fn(), expire: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════
  // Cas normal — un seul compte
  // ════════════════════════════════════════════════════════════

  it('connecte normalement quand un seul compte correspond à l\'identifiant', async () => {
    const user = makeUser();
    userRepo.find.mockResolvedValue([user]);
    mockPasswordLookup({ [user.id]: REAL_PASSWORD_HASH });

    const result = await service.login(
      { identifier: user.email, password: 'CorrectPassword1!' } as any, '127.0.0.1', null,
    );

    expect('accessToken' in result).toBe(true);
    if ('accessToken' in result) {
      expect(result.user.id).toBe(user.id);
    }
  });

  // ════════════════════════════════════════════════════════════
  // Comptes liés — même mot de passe sur les deux
  // ════════════════════════════════════════════════════════════

  it('demande un choix de compte quand le même mot de passe correspond à 2 comptes liés', async () => {
    const pro    = makeUser({ id: 'pro-uuid', role: UserRole.COMPANY });
    const client = makeUser({ id: 'client-uuid', role: UserRole.CLIENT });
    userRepo.find.mockResolvedValue([pro, client]);
    mockPasswordLookup({
      [pro.id]:    REAL_PASSWORD_HASH,
      [client.id]: REAL_PASSWORD_HASH,
    });

    const result = await service.login(
      { identifier: pro.email, password: 'CorrectPassword1!' } as any, '127.0.0.1', null,
    );

    expect('requiresAccountChoice' in result).toBe(true);
    if ('requiresAccountChoice' in result) {
      expect(result.accounts).toHaveLength(2);
      expect(result.accounts.map(a => a.userId).sort()).toEqual([client.id, pro.id].sort());
    }
  });

  it('loginChooseAccount termine la connexion sur le compte explicitement choisi', async () => {
    const pro    = makeUser({ id: 'pro-uuid', role: UserRole.COMPANY });
    const client = makeUser({ id: 'client-uuid', role: UserRole.CLIENT });
    userRepo.find.mockResolvedValue([pro, client]);
    mockPasswordLookup({
      [pro.id]:    REAL_PASSWORD_HASH,
      [client.id]: REAL_PASSWORD_HASH,
    });

    const result = await service.loginChooseAccount(
      pro.email, 'CorrectPassword1!', 'client-uuid', false, '127.0.0.1', null,
    );

    expect('accessToken' in result).toBe(true);
    if ('accessToken' in result) expect(result.user.id).toBe('client-uuid');
  });

  // ════════════════════════════════════════════════════════════
  // Mauvais mot de passe — pas de fuite sur le nombre de comptes
  // ════════════════════════════════════════════════════════════

  describe('mauvais mot de passe — aucune fuite sur le nombre de comptes', () => {
    it('rejette avec un message générique identique, quel que soit le nombre de comptes', async () => {
      // 0 compte
      userRepo.find.mockResolvedValueOnce([]);
      const err0 = await service.login(
        { identifier: 'inconnu@test.com', password: 'wrong' } as any, '127.0.0.1', null,
      ).catch(e => e);

      // 1 compte
      const user = makeUser();
      userRepo.find.mockResolvedValueOnce([user]);
      mockPasswordLookup({ [user.id]: REAL_PASSWORD_HASH });
      const err1 = await service.login(
        { identifier: user.email, password: 'wrong' } as any, '127.0.0.1', null,
      ).catch(e => e);

      // 2 comptes liés
      const pro    = makeUser({ id: 'pro-uuid', role: UserRole.COMPANY });
      const client = makeUser({ id: 'client-uuid', role: UserRole.CLIENT });
      userRepo.find.mockResolvedValueOnce([pro, client]);
      mockPasswordLookup({ [pro.id]: REAL_PASSWORD_HASH, [client.id]: REAL_PASSWORD_HASH });
      const err2 = await service.login(
        { identifier: pro.email, password: 'wrong' } as any, '127.0.0.1', null,
      ).catch(e => e);

      for (const err of [err0, err1, err2]) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(err.message).toBe('Identifiants incorrects. Vérifiez votre email et mot de passe.');
      }
      // Message rigoureusement identique dans les 3 cas — aucune variation
      // observable dans le corps de la réponse selon le nombre de comptes.
      expect(err0.message).toBe(err1.message);
      expect(err1.message).toBe(err2.message);
    });

    it('exécute toujours exactement 2 comparaisons bcrypt (temps constant), 0, 1 ou 2 comptes réels', async () => {
      // require() plutôt que l'import ES en tête de fichier : le helper
      // __importStar de TS gèle l'objet du namespace importé (non
      // reconfigurable), jest.spyOn() échoue dessus avec "Cannot redefine
      // property". Le require() direct renvoie l'objet CommonJS mutable
      // réellement utilisé par auth.service.ts au runtime (même cache module).
      const bcryptModule = require('bcryptjs');
      const compareSpy = jest.spyOn(bcryptModule, 'compare');

      const scenarios: User[][] = [
        [],
        [makeUser()],
        [makeUser({ id: 'pro-uuid', role: UserRole.COMPANY }), makeUser({ id: 'client-uuid', role: UserRole.CLIENT })],
      ];

      for (const candidates of scenarios) {
        compareSpy.mockClear();
        userRepo.find.mockResolvedValueOnce(candidates);
        mockPasswordLookup(Object.fromEntries(candidates.map(c => [c.id, c.password])));

        await service.login(
          { identifier: 'x@test.com', password: 'wrong' } as any, '127.0.0.1', null,
        ).catch(() => {});

        // Peu importe 0, 1 ou 2 comptes réels : toujours 2 appels bcrypt.compare
        // (paddés avec un hachage factice si besoin) — jamais 0, 1 ou 3+.
        expect(compareSpy).toHaveBeenCalledTimes(2);
      }

      compareSpy.mockRestore();
    });
  });
});
