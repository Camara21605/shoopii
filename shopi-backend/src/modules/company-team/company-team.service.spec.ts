/* ============================================================
 * FICHIER      : src/modules/company-team/company-team.service.spec.ts
 * MODULE       : Company Team
 * ROLE         : Tests unitaires du CompanyTeamService.
 *
 * COUVERTURE :
 *   ✅ Création d'un membre
 *   ✅ Respect de la limite maximale
 *   ✅ Unicité de l'email
 *   ✅ Attribution des permissions
 *   ✅ Suspension d'un membre
 *   ✅ Réactivation d'un membre
 *   ✅ Suppression (soft) d'un membre
 *   ✅ Réinitialisation du mot de passe
 *   ✅ Mise à jour des permissions
 *   ✅ Protection contre la réactivation si limite atteinte
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }  from '@nestjs/typeorm';
import { TeamEventBusService }  from './services/team-event-bus.service';
import { DataSource }          from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { CompanyTeamService }           from './services/company-team.service';
import { CompanyTeamPermissionService } from './services/company-team-permission.service';
import { CompanyTeamActivityService }   from './services/company-team-activity.service';
import { CompanyTeamAuditService }      from './services/company-team-audit.service';

import { User, UserStatus }             from '../../database/entities/user.entity';
import { Wallet }                       from '../../database/entities/wallet.entity';
import { PlatformSettings }             from '../../database/entities/platform-settings.entity';
import { CompanyTeamMember, TeamMemberStatus } from '../../database/entities/company-team/company-team-member.entity';

/* ── Helpers ── */
function makeUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id:        'user-uuid',
    firstName: 'Jean',
    lastName:  'Dupont',
    email:     'jean.dupont@test.com',
    status:    UserStatus.ACTIVE,
    ...overrides,
  });
}

function makeMember(overrides: Partial<CompanyTeamMember> = {}): CompanyTeamMember {
  return Object.assign(new CompanyTeamMember(), {
    id:        'member-uuid',
    userId:    'user-uuid',
    companyId: 'company-uuid',
    status:    TeamMemberStatus.ACTIVE,
    ...overrides,
  });
}

function makeSettings(max = 5): PlatformSettings {
  return Object.assign(new PlatformSettings(), {
    id: 1,
    maxTeamMembersPerCompany: max,
  });
}

/* ── Factory repositories mock ── */
const mockRepo = () => ({
  findOne:     jest.fn(),
  find:        jest.fn(),
  findAndCount: jest.fn(),
  count:       jest.fn(),
  create:      jest.fn((x) => x),
  save:        jest.fn((x) => Promise.resolve(x)),
  update:      jest.fn(),
  softDelete:  jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where:             jest.fn().mockReturnThis(),
    andWhere:          jest.fn().mockReturnThis(),
    orderBy:           jest.fn().mockReturnThis(),
    skip:              jest.fn().mockReturnThis(),
    take:              jest.fn().mockReturnThis(),
    getManyAndCount:   jest.fn().mockResolvedValue([[], 0]),
  })),
});

/* ── QueryRunner mock ── */
const mockQR = {
  connect:             jest.fn(),
  startTransaction:    jest.fn(),
  commitTransaction:   jest.fn(),
  rollbackTransaction: jest.fn(),
  release:             jest.fn(),
  manager: {
    save: jest.fn((_, x) => Promise.resolve({ ...x, id: 'new-user-uuid' })),
  },
};

describe('CompanyTeamService', () => {
  let service: CompanyTeamService;
  let userRepo: ReturnType<typeof mockRepo>;
  let memberRepo: ReturnType<typeof mockRepo>;
  let settingsRepo: ReturnType<typeof mockRepo>;
  let permService: jest.Mocked<CompanyTeamPermissionService>;
  let auditService: jest.Mocked<CompanyTeamAuditService>;
  let eventEmitter: jest.Mocked<TeamEventBusService>;

  beforeEach(async () => {
    userRepo     = mockRepo();
    memberRepo   = mockRepo();
    settingsRepo = mockRepo();

    permService  = { create: jest.fn(), update: jest.fn(), getByMemberId: jest.fn() } as any;
    auditService = { log: jest.fn() } as any;
    eventEmitter = { emit: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyTeamService,
        { provide: getRepositoryToken(User),               useValue: userRepo },
        { provide: getRepositoryToken(Wallet),             useValue: mockRepo() },
        { provide: getRepositoryToken(CompanyTeamMember),  useValue: memberRepo },
        { provide: getRepositoryToken(PlatformSettings),   useValue: settingsRepo },
        { provide: CompanyTeamPermissionService,           useValue: permService },
        { provide: CompanyTeamActivityService,             useValue: { log: jest.fn() } },
        { provide: CompanyTeamAuditService,                useValue: auditService },
        { provide: TeamEventBusService,                    useValue: eventEmitter },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn(() => mockQR) },
        },
      ],
    }).compile();

    service = module.get(CompanyTeamService);
  });

  afterEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════
  // getTeamStats
  // ════════════════════════════════════════════════════════════

  describe('getTeamStats', () => {
    it('retourne les statistiques correctes', async () => {
      memberRepo.count
        .mockResolvedValueOnce(3)   // active
        .mockResolvedValueOnce(1);  // suspended
      settingsRepo.findOne.mockResolvedValue(makeSettings(5));

      const stats = await service.getTeamStats('company-uuid');

      expect(stats.activeCount).toBe(3);
      expect(stats.suspendedCount).toBe(1);
      expect(stats.maxAllowed).toBe(5);
      expect(stats.canAddMore).toBe(true);
      expect(stats.remainingSlots).toBe(2);
    });

    it('canAddMore = false quand la limite est atteinte', async () => {
      memberRepo.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
      settingsRepo.findOne.mockResolvedValue(makeSettings(5));

      const stats = await service.getTeamStats('company-uuid');
      expect(stats.canAddMore).toBe(false);
      expect(stats.remainingSlots).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════
  // addMember
  // ════════════════════════════════════════════════════════════

  describe('addMember', () => {
    const dto = {
      firstName: 'Marie',
      lastName:  'Cissé',
      email:     'marie.cisse@test.com',
    };

    beforeEach(() => {
      /* Limite non atteinte */
      memberRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
      settingsRepo.findOne.mockResolvedValue(makeSettings(5));
      /* Email disponible */
      userRepo.findOne.mockResolvedValueOnce(null);
      /* Username unique */
      userRepo.findOne.mockResolvedValueOnce(null);
      /* User créé dans la transaction */
      mockQR.manager.save.mockResolvedValueOnce(makeUser({ id: 'new-uuid', email: dto.email }));
      mockQR.manager.save.mockResolvedValueOnce(makeMember({ id: 'new-member-uuid' }));
      mockQR.manager.save.mockResolvedValueOnce({});
      /* Permissions créées */
      permService.create.mockResolvedValue({} as any);
      /* Audit */
      userRepo.findOne.mockResolvedValueOnce(makeUser({ email: dto.email }));
    });

    it('crée un membre avec un mot de passe temporaire', async () => {
      const result = await service.addMember('company-uuid', 'owner-uuid', dto);

      expect(result.temporaryPassword).toBeDefined();
      expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(12);
      expect(result.member).toBeDefined();
      expect(permService.create).toHaveBeenCalledWith('new-member-uuid', undefined);
      expect(auditService.log).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('lève BadRequestException si la limite est atteinte', async () => {
      /* Réinitialiser les mocks pour ce cas */
      jest.clearAllMocks();
      memberRepo.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
      settingsRepo.findOne.mockResolvedValue(makeSettings(5));

      await expect(
        service.addMember('company-uuid', 'owner-uuid', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève ConflictException si l\'email est déjà utilisé', async () => {
      jest.clearAllMocks();
      memberRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
      settingsRepo.findOne.mockResolvedValue(makeSettings(5));
      userRepo.findOne.mockResolvedValueOnce(makeUser({ email: dto.email })); // email exists

      await expect(
        service.addMember('company-uuid', 'owner-uuid', dto),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ════════════════════════════════════════════════════════════
  // suspendMember
  // ════════════════════════════════════════════════════════════

  describe('suspendMember', () => {
    it('suspend un membre actif', async () => {
      const member = makeMember({ status: TeamMemberStatus.ACTIVE });
      const user   = makeUser();
      memberRepo.findOne.mockResolvedValue(member);
      userRepo.findOne.mockResolvedValue(user);
      memberRepo.save.mockResolvedValue({ ...member, status: TeamMemberStatus.SUSPENDED });

      const result = await service.suspendMember('company-uuid', 'member-uuid', 'owner-uuid', { reason: 'Absence non justifiée' });

      expect(result.message).toContain('suspendu');
      expect(member.status).toBe(TeamMemberStatus.SUSPENDED);
      expect(userRepo.update).toHaveBeenCalledWith(user.id, { status: UserStatus.SUSPENDED });
    });

    it('lève BadRequestException si déjà suspendu', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember({ status: TeamMemberStatus.SUSPENDED }));
      userRepo.findOne.mockResolvedValue(makeUser());

      await expect(
        service.suspendMember('company-uuid', 'member-uuid', 'owner-uuid', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ════════════════════════════════════════════════════════════
  // reactivateMember
  // ════════════════════════════════════════════════════════════

  describe('reactivateMember', () => {
    it('réactive un membre suspendu si des places sont disponibles', async () => {
      const member = makeMember({ status: TeamMemberStatus.SUSPENDED });
      memberRepo.findOne.mockResolvedValue(member);
      memberRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      settingsRepo.findOne.mockResolvedValue(makeSettings(5));
      userRepo.findOne.mockResolvedValue(makeUser());

      const result = await service.reactivateMember('company-uuid', 'member-uuid', 'owner-uuid');
      expect(result.message).toContain('réactivé');
      expect(member.status).toBe(TeamMemberStatus.ACTIVE);
    });

    it('lève BadRequestException si la limite est atteinte lors de la réactivation', async () => {
      const member = makeMember({ status: TeamMemberStatus.SUSPENDED });
      memberRepo.findOne.mockResolvedValue(member);
      memberRepo.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);
      settingsRepo.findOne.mockResolvedValue(makeSettings(5));

      await expect(
        service.reactivateMember('company-uuid', 'member-uuid', 'owner-uuid'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ════════════════════════════════════════════════════════════
  // removeMember
  // ════════════════════════════════════════════════════════════

  describe('removeMember', () => {
    it('soft-delete un membre et désactive son compte', async () => {
      const member = makeMember();
      const user   = makeUser();
      memberRepo.findOne.mockResolvedValue(member);
      userRepo.findOne.mockResolvedValue(user);
      memberRepo.save.mockResolvedValue(member);

      const result = await service.removeMember('company-uuid', 'member-uuid', 'owner-uuid');

      expect(result.message).toContain('révoqué');
      expect(memberRepo.softDelete).toHaveBeenCalledWith('member-uuid');
      expect(userRepo.update).toHaveBeenCalledWith(user.id, { status: UserStatus.SUSPENDED });
    });

    it('lève NotFoundException si le membre n\'existe pas', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.removeMember('company-uuid', 'bad-uuid', 'owner-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ════════════════════════════════════════════════════════════
  // resetMemberPassword
  // ════════════════════════════════════════════════════════════

  describe('resetMemberPassword', () => {
    it('génère un mot de passe temporaire de 12 caractères', async () => {
      memberRepo.findOne.mockResolvedValue(makeMember());
      userRepo.findOne.mockResolvedValue(makeUser());
      memberRepo.save.mockResolvedValue(makeMember());

      const result = await service.resetMemberPassword('company-uuid', 'member-uuid', 'owner-uuid');

      expect(result.temporaryPassword).toBeDefined();
      expect(result.temporaryPassword.length).toBe(12);
      expect(userRepo.update).toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════
  // updatePermissions
  // ════════════════════════════════════════════════════════════

  describe('updatePermissions', () => {
    it('met à jour les permissions d\'un membre', async () => {
      const member = makeMember();
      const user   = makeUser();
      memberRepo.findOne.mockResolvedValueOnce(member).mockResolvedValueOnce(member);
      userRepo.findOne.mockResolvedValue(user);
      permService.getByMemberId.mockResolvedValue({ permissions: { products: { view: false } } } as any);
      permService.update.mockResolvedValue({ permissions: { products: { view: true } } } as any);

      const result = await service.updatePermissions(
        'company-uuid', 'member-uuid', 'owner-uuid',
        { permissions: { products: { view: true } } as any },
      );

      expect(result.permissions).toEqual({ products: { view: true } });
      expect(auditService.log).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });
});
