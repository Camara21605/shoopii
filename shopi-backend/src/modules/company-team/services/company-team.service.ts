/* ============================================================
 * FICHIER      : src/modules/company-team/services/company-team.service.ts
 * MODULE       : Company Team
 * ROLE         : Service principal de gestion des membres de l'équipe entreprise.
 *
 * RESPONSABILITES :
 *   - Créer, modifier, suspendre, réactiver et supprimer des membres.
 *   - Vérifier la limite maximale de collaborateurs (PlatformSettings).
 *   - Générer et envoyer des mots de passe temporaires.
 *   - Publier les événements pour les modules notification/reporting.
 *   - Écrire dans les journaux d'activité et d'audit.
 *
 * RÈGLES MÉTIER :
 *   - Le propriétaire ne compte pas dans la limite de membres.
 *   - Un collaborateur ne peut pas modifier ses propres permissions.
 *   - Un collaborateur ne peut pas supprimer le propriétaire.
 *   - Seul le propriétaire (TeamOwnerGuard) peut gérer l'équipe.
 *   - La limite par défaut est PlatformSettings.maxTeamMembersPerCompany.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull } from 'typeorm';
import { TeamEventBusService } from './team-event-bus.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { User, UserStatus } from '../../../database/entities/user.entity';
import { Wallet }           from '../../../database/entities/wallet.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { CompanyTeamMember, TeamMemberStatus } from '../../../database/entities/company-team/company-team-member.entity';

import { CreateTeamMemberDto }     from '../dto/create-member.dto';
import { UpdateTeamMemberDto, SuspendMemberDto } from '../dto/update-member.dto';
import { UpdatePermissionDto }     from '../dto/update-permission.dto';
import { QueryTeamDto }            from '../dto/query-team.dto';
import { CompanyTeamPermissionService } from './company-team-permission.service';
import { CompanyTeamActivityService }   from './company-team-activity.service';
import { CompanyTeamAuditService }      from './company-team-audit.service';
import { TeamPlanConfigService }        from './team-plan-config.service';
import { MailService }                  from '../../email/email.service';
import { UserRole }                from '../../../common/enums/user-role.enum';
import {
  TEAM_EVENTS,
  TeamMemberCreatedEvent,
  TeamMemberUpdatedEvent,
  TeamMemberSuspendedEvent,
  TeamMemberReactivatedEvent,
  TeamMemberDeletedEvent,
  TeamPermissionUpdatedEvent,
  TeamPasswordResetEvent,
} from '../events/company-team.events';

const BCRYPT_ROUNDS         = 12;
/** Longueur du mot de passe temporaire généré */
const TEMP_PASSWORD_LENGTH  = 12;
/** Limite globale par défaut si PlatformSettings est inaccessible */
const DEFAULT_MAX_MEMBERS   = 5;

@Injectable()
export class CompanyTeamService {

  private readonly logger = new Logger(CompanyTeamService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(CompanyTeamMember)
    private readonly memberRepo: Repository<CompanyTeamMember>,

    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,

    private readonly permissionService: CompanyTeamPermissionService,
    private readonly activityService:   CompanyTeamActivityService,
    private readonly auditService:      CompanyTeamAuditService,
    private readonly planConfigService: TeamPlanConfigService,

    private readonly eventEmitter: TeamEventBusService,
    private readonly dataSource:   DataSource,
    private readonly mailService:  MailService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // STATISTIQUES
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne les statistiques de l'équipe : nombre de membres actifs,
   * limite maximale, nombre de suspendus.
   */
  async getTeamStats(companyId: string) {
    const [activeCount, suspendedCount, maxAllowed] = await Promise.all([
      this.memberRepo.count({ where: { companyId, status: TeamMemberStatus.ACTIVE } }),
      this.memberRepo.count({ where: { companyId, status: TeamMemberStatus.SUSPENDED } }),
      this.getMaxMembersLimit(companyId),
    ]);

    return {
      activeCount,
      suspendedCount,
      totalCount:   activeCount + suspendedCount,
      maxAllowed,
      canAddMore:   activeCount < maxAllowed,
      remainingSlots: Math.max(0, maxAllowed - activeCount),
    };
  }

  // ════════════════════════════════════════════════════════════
  // LISTE DES MEMBRES
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne la liste paginée des membres d'une entreprise.
   * Charge les données de l'utilisateur et les permissions associées.
   */
  async getMembers(companyId: string, query: QueryTeamDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.memberRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user',       'u')
      .leftJoinAndSelect('m.permission', 'p')
      .where('m.companyId = :companyId', { companyId })
      .andWhere('m.deletedAt IS NULL')
      .orderBy('m.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('m.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(u.firstName) LIKE :s OR LOWER(u.lastName) LIKE :s OR LOWER(u.email) LIKE :s OR LOWER(m.jobTitle) LIKE :s)',
        { s: `%${query.search.toLowerCase()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map(m => this.toMemberDto(m)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ════════════════════════════════════════════════════════════
  // DÉTAIL D'UN MEMBRE
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne le détail complet d'un membre, avec ses permissions.
   * Vérifie que le membre appartient bien à l'entreprise.
   */
  async getMember(companyId: string, memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, companyId },
      relations: ['user', 'permission'],
    });

    if (!member) {
      throw new NotFoundException(`Membre introuvable.`);
    }

    return this.toMemberDto(member);
  }

  // ════════════════════════════════════════════════════════════
  // CRÉATION D'UN MEMBRE
  // ════════════════════════════════════════════════════════════

  /**
   * Crée un nouveau membre pour l'équipe.
   *
   * Flux :
   *   1. Vérifier la limite de membres actifs
   *   2. Vérifier que l'email n'est pas déjà utilisé
   *   3. Générer un mot de passe temporaire
   *   4. Créer le compte User (transaction)
   *   5. Créer le CompanyTeamMember
   *   6. Créer les permissions (via PermissionService)
   *   7. Créer le Wallet
   *   8. Écrire audit log
   *   9. Publier événement TeamMemberCreated
   *
   * @returns Le membre créé + mot de passe temporaire (affiché une seule fois)
   */
  async addMember(
    companyId:   string,
    ownerUserId: string,
    dto:         CreateTeamMemberDto,
    ipAddress?:  string,
    userAgent?:  string,
  ) {
    /* ── 1. Vérifier la limite de membres ── */
    const stats = await this.getTeamStats(companyId);
    if (!stats.canAddMore) {
      throw new BadRequestException(
        `Limite de collaborateurs atteinte (${stats.maxAllowed} maximum). ` +
        `Contactez l'administrateur Shopi pour augmenter cette limite.`,
      );
    }

    /* ── 2. Vérifier unicité de l'email ── */
    const emailExists = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
      withDeleted: true,
    });
    if (emailExists) {
      throw new ConflictException(
        `L'adresse email "${dto.email}" est déjà associée à un compte Shopi.`,
      );
    }

    /* ── 3. Générer un mot de passe temporaire ── */
    const tempPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
    const username = await this.generateUniqueUsername(dto.firstName, dto.lastName);

    /* ── 4–7. Transaction atomique ── */
    let newMember: CompanyTeamMember;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      /* Créer le compte utilisateur */
      const userEntity = this.userRepo.create({
        firstName:  dto.firstName,
        lastName:   dto.lastName,
        email:      dto.email.toLowerCase().trim(),
        phone:      dto.phone ?? null,
        username,
        password:   hashedPassword,
        role:       UserRole.COMPANY,
        status:     UserStatus.ACTIVE,
        emailVerified: true,
      });
      const savedUser = await queryRunner.manager.save(User, userEntity);

      /* Créer le lien membre → entreprise */
      const memberEntity = this.memberRepo.create({
        userId:           savedUser.id,
        companyId,
        status:           TeamMemberStatus.ACTIVE,
        jobTitle:         dto.jobTitle    ?? null,
        internalRole:     dto.internalRole ?? null,
        mustChangePassword: true,
      });
      newMember = await queryRunner.manager.save(CompanyTeamMember, memberEntity);

      /* Créer le wallet du membre */
      await queryRunner.manager.save(Wallet, this.walletRepo.create({ userId: savedUser.id }));

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[TEAM ADD ❌] companyId=${companyId} email=${dto.email} | ${(err as Error).message}`);
      if (err instanceof BadRequestException || err instanceof ConflictException) throw err;
      throw new BadRequestException('Erreur lors de la création du membre. Veuillez réessayer.');
    } finally {
      await queryRunner.release();
    }

    /* ── Créer les permissions hors transaction (non-critique) ── */
    try {
      await this.permissionService.create(newMember.id, dto.permissions);
    } catch (err) {
      this.logger.warn(`[TEAM PERM ⚠️] memberId=${newMember.id} | Permissions non créées : ${(err as Error).message}`);
    }

    /* ── 8. Journal d'audit ── */
    const memberUser = await this.userRepo.findOne({ where: { id: newMember.userId } });
    await this.auditService.log({
      companyId,
      performedByUserId: ownerUserId,
      targetMemberId:    newMember.id,
      action:            TEAM_EVENTS.MEMBER_CREATED,
      after: {
        email:        memberUser?.email,
        firstName:    memberUser?.firstName,
        lastName:     memberUser?.lastName,
        jobTitle:     newMember.jobTitle,
        internalRole: newMember.internalRole,
      },
      ipAddress,
      userAgent,
    });

    /* ── 9. Événement ── */
    this.eventEmitter.emit(
      TEAM_EVENTS.MEMBER_CREATED,
      new TeamMemberCreatedEvent(
        companyId,
        newMember.id,
        newMember.userId,
        memberUser?.email ?? dto.email,
        `${dto.firstName} ${dto.lastName}`,
        ownerUserId,
      ),
    );

    this.logger.log(`[TEAM ADD ✅] company=${companyId} member=${newMember.id} email=${dto.email}`);

    /* ── Email de bienvenue avec identifiants (non-bloquant) ── */
    this.mailService.sendTeamMemberCredentialsEmail({
      toEmail:   dto.email,
      firstName: dto.firstName,
      lastName:  dto.lastName,
      password:  tempPassword,
      isReset:   false,
    }).catch(err =>
      this.logger.warn(`[TEAM EMAIL ⚠️] Credentials email non envoyé à ${dto.email}: ${(err as Error).message}`),
    );

    return {
      member:            this.toMemberDto(newMember, memberUser ?? undefined),
      temporaryPassword: tempPassword,
      message: 'Membre créé avec succès. Un email avec les identifiants a été envoyé au collaborateur.',
    };
  }

  // ════════════════════════════════════════════════════════════
  // MISE À JOUR D'UN MEMBRE
  // ════════════════════════════════════════════════════════════

  async updateMember(
    companyId:   string,
    memberId:    string,
    ownerUserId: string,
    dto:         UpdateTeamMemberDto,
    ipAddress?:  string,
  ) {
    const member = await this.requireMember(companyId, memberId);
    const user   = await this.requireUser(member.userId);

    const before = { firstName: user.firstName, lastName: user.lastName, jobTitle: member.jobTitle, internalRole: member.internalRole };

    /* Mettre à jour User si des champs identité changent */
    if (dto.firstName || dto.lastName || dto.phone) {
      await this.userRepo.update(user.id, {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName  && { lastName:  dto.lastName  }),
        ...(dto.phone     && { phone:     dto.phone     }),
      });
    }

    /* Mettre à jour CompanyTeamMember */
    if (dto.jobTitle !== undefined)    member.jobTitle    = dto.jobTitle;
    if (dto.internalRole !== undefined) member.internalRole = dto.internalRole;
    await this.memberRepo.save(member);

    const after = { firstName: dto.firstName ?? user.firstName, lastName: dto.lastName ?? user.lastName, jobTitle: member.jobTitle, internalRole: member.internalRole };

    await this.auditService.log({
      companyId, performedByUserId: ownerUserId, targetMemberId: memberId,
      action: TEAM_EVENTS.MEMBER_UPDATED, before, after, ipAddress,
    });

    this.eventEmitter.emit(TEAM_EVENTS.MEMBER_UPDATED, new TeamMemberUpdatedEvent(companyId, memberId, after, ownerUserId));

    return { message: 'Membre mis à jour.' };
  }

  // ════════════════════════════════════════════════════════════
  // SUSPENSION
  // ════════════════════════════════════════════════════════════

  async suspendMember(
    companyId:   string,
    memberId:    string,
    ownerUserId: string,
    dto:         SuspendMemberDto,
    ipAddress?:  string,
  ) {
    const member = await this.requireMember(companyId, memberId);

    if (member.status === TeamMemberStatus.SUSPENDED) {
      throw new BadRequestException('Ce membre est déjà suspendu.');
    }

    const user = await this.requireUser(member.userId);

    member.status           = TeamMemberStatus.SUSPENDED;
    member.suspendedAt      = new Date();
    member.suspensionReason = dto.reason ?? null;
    await this.memberRepo.save(member);

    /* Suspendre le compte utilisateur pour bloquer le login */
    await this.userRepo.update(user.id, { status: UserStatus.SUSPENDED });

    await this.auditService.log({
      companyId, performedByUserId: ownerUserId, targetMemberId: memberId,
      action: TEAM_EVENTS.MEMBER_SUSPENDED,
      after: { status: TeamMemberStatus.SUSPENDED, reason: dto.reason },
      ipAddress,
    });

    this.eventEmitter.emit(TEAM_EVENTS.MEMBER_SUSPENDED, new TeamMemberSuspendedEvent(
      companyId, memberId, user.email, `${user.firstName} ${user.lastName}`, dto.reason ?? null, ownerUserId,
    ));

    this.logger.log(`[TEAM SUSPEND ✅] member=${memberId} by=${ownerUserId}`);
    return { message: `${user.firstName} ${user.lastName} a été suspendu(e).` };
  }

  // ════════════════════════════════════════════════════════════
  // RÉACTIVATION
  // ════════════════════════════════════════════════════════════

  async reactivateMember(
    companyId:   string,
    memberId:    string,
    ownerUserId: string,
    ipAddress?:  string,
  ) {
    const member = await this.requireMember(companyId, memberId);

    if (member.status === TeamMemberStatus.ACTIVE) {
      throw new BadRequestException('Ce membre est déjà actif.');
    }

    /* Vérifier qu'il reste des places disponibles */
    const stats = await this.getTeamStats(companyId);
    if (!stats.canAddMore) {
      throw new BadRequestException(
        `Impossible de réactiver : limite de ${stats.maxAllowed} membres actifs atteinte.`,
      );
    }

    const user = await this.requireUser(member.userId);

    member.status           = TeamMemberStatus.ACTIVE;
    member.suspendedAt      = null;
    member.suspensionReason = null;
    await this.memberRepo.save(member);

    await this.userRepo.update(user.id, { status: UserStatus.ACTIVE });

    await this.auditService.log({
      companyId, performedByUserId: ownerUserId, targetMemberId: memberId,
      action: TEAM_EVENTS.MEMBER_REACTIVATED,
      after: { status: TeamMemberStatus.ACTIVE },
      ipAddress,
    });

    this.eventEmitter.emit(TEAM_EVENTS.MEMBER_REACTIVATED, new TeamMemberReactivatedEvent(
      companyId, memberId, user.email, `${user.firstName} ${user.lastName}`, ownerUserId,
    ));

    this.logger.log(`[TEAM REACTIVATE ✅] member=${memberId} by=${ownerUserId}`);
    return { message: `${user.firstName} ${user.lastName} a été réactivé(e).` };
  }

  // ════════════════════════════════════════════════════════════
  // SUPPRESSION (SOFT DELETE)
  // ════════════════════════════════════════════════════════════

  async removeMember(
    companyId:   string,
    memberId:    string,
    ownerUserId: string,
    ipAddress?:  string,
  ) {
    const member = await this.requireMember(companyId, memberId);
    const user   = await this.requireUser(member.userId);

    /* Soft-delete le membre (historique conservé) */
    member.status = TeamMemberStatus.REVOKED;
    await this.memberRepo.save(member);
    await this.memberRepo.softDelete(memberId);

    /* Désactiver le compte utilisateur */
    await this.userRepo.update(user.id, { status: UserStatus.SUSPENDED });

    await this.auditService.log({
      companyId, performedByUserId: ownerUserId, targetMemberId: memberId,
      action: TEAM_EVENTS.MEMBER_DELETED,
      before: { email: user.email, status: member.status },
      ipAddress,
    });

    this.eventEmitter.emit(TEAM_EVENTS.MEMBER_DELETED, new TeamMemberDeletedEvent(
      companyId, memberId, user.email, ownerUserId,
    ));

    this.logger.log(`[TEAM REMOVE ✅] member=${memberId} by=${ownerUserId}`);
    return { message: `L'accès de ${user.firstName} ${user.lastName} a été révoqué.` };
  }

  // ════════════════════════════════════════════════════════════
  // RÉINITIALISATION DU MOT DE PASSE
  // ════════════════════════════════════════════════════════════

  /**
   * Génère un nouveau mot de passe temporaire pour un membre.
   * Le mot de passe est retourné EN CLAIR une seule fois.
   * Le membre devra le changer à sa prochaine connexion.
   */
  async resetMemberPassword(
    companyId:   string,
    memberId:    string,
    ownerUserId: string,
    ipAddress?:  string,
  ) {
    const member = await this.requireMember(companyId, memberId);
    const user   = await this.requireUser(member.userId);

    const tempPassword   = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    await this.userRepo.update(user.id, {
      password:            hashedPassword,
      lastPasswordChangedAt: new Date(),
    });

    member.mustChangePassword = true;
    await this.memberRepo.save(member);

    await this.auditService.log({
      companyId, performedByUserId: ownerUserId, targetMemberId: memberId,
      action: TEAM_EVENTS.PASSWORD_RESET, ipAddress,
    });

    this.eventEmitter.emit(TEAM_EVENTS.PASSWORD_RESET, new TeamPasswordResetEvent(
      companyId, memberId, user.email, `${user.firstName} ${user.lastName}`, ownerUserId,
    ));

    this.logger.log(`[TEAM RESET PWD ✅] member=${memberId} by=${ownerUserId}`);

    /* ── Email de nouveau MDP (non-bloquant) ── */
    this.mailService.sendTeamMemberCredentialsEmail({
      toEmail:   user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      password:  tempPassword,
      isReset:   true,
    }).catch(err =>
      this.logger.warn(`[TEAM EMAIL ⚠️] Reset credentials email non envoyé à ${user.email}: ${(err as Error).message}`),
    );

    return {
      temporaryPassword: tempPassword,
      message: 'Mot de passe réinitialisé. Un email avec le nouveau mot de passe temporaire a été envoyé au collaborateur.',
    };
  }

  // ════════════════════════════════════════════════════════════
  // MISE À JOUR DES PERMISSIONS
  // ════════════════════════════════════════════════════════════

  async updatePermissions(
    companyId:   string,
    memberId:    string,
    ownerUserId: string,
    dto:         UpdatePermissionDto,
    ipAddress?:  string,
  ) {
    /* Vérifier que le membre appartient bien à cette entreprise */
    await this.requireMember(companyId, memberId);

    const before = (await this.permissionService.getByMemberId(memberId)).permissions;
    const updated = await this.permissionService.update(memberId, dto.permissions);

    const user = await this.requireUser(
      (await this.memberRepo.findOne({ where: { id: memberId } }))!.userId,
    );

    await this.auditService.log({
      companyId, performedByUserId: ownerUserId, targetMemberId: memberId,
      action: TEAM_EVENTS.PERMISSION_UPDATED,
      before: before as unknown as Record<string, unknown>,
      after:  updated.permissions as unknown as Record<string, unknown>,
      ipAddress,
    });

    this.eventEmitter.emit(TEAM_EVENTS.PERMISSION_UPDATED, new TeamPermissionUpdatedEvent(
      companyId, memberId, user.email,
      before as unknown as Record<string, unknown>,
      updated.permissions as unknown as Record<string, unknown>,
      ownerUserId,
    ));

    return { permissions: updated.permissions, message: 'Permissions mises à jour.' };
  }

  // ════════════════════════════════════════════════════════════
  // RÉSOLUTION DE L'ENTREPRISE (pour les collaborateurs)
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne le companyId associé à un userId.
   * Utilisé par AuthService lors du login d'un collaborateur.
   */
  async findCompanyIdByUserId(userId: string): Promise<string | undefined> {
    const member = await this.memberRepo.findOne({
      where: { userId, status: TeamMemberStatus.ACTIVE },
      select: ['companyId'],
    });
    return member?.companyId;
  }

  // ════════════════════════════════════════════════════════════
  // MÉTHODES PRIVÉES
  // ════════════════════════════════════════════════════════════

  /** Charge un membre en vérifiant son appartenance à l'entreprise */
  private async requireMember(companyId: string, memberId: string): Promise<CompanyTeamMember> {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, companyId },
    });
    if (!member) {
      throw new NotFoundException(`Membre introuvable.`);
    }
    return member;
  }

  /** Charge un utilisateur par son ID */
  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Compte utilisateur introuvable.`);
    }
    return user;
  }

  /**
   * Retourne la limite maximale de membres pour une entreprise.
   * Consulte TeamPlanConfigService (plan assigné → config plan → fallback PlatformSettings).
   * Retourne Infinity pour le plan Enterprise (maxMembers = -1).
   */
  private async getMaxMembersLimit(companyId?: string): Promise<number> {
    if (companyId) {
      return this.planConfigService.getLimitForCompany(companyId);
    }
    /* Fallback absolu si companyId non fourni */
    try {
      const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
      return settings?.maxTeamMembersPerCompany ?? DEFAULT_MAX_MEMBERS;
    } catch {
      return DEFAULT_MAX_MEMBERS;
    }
  }

  /**
   * Retourne les permissions du user courant dans le contexte de l'entreprise.
   * - Propriétaire → { isOwner: true, permissions: null }
   * - Collaborateur → { isOwner: false, permissions: <ses permissions> }
   */
  async getMyPermissions(
    companyId: string,
    userId: string,
  ): Promise<{ isOwner: boolean; permissions: Record<string, Record<string, boolean>> | null }> {
    const member = await this.memberRepo.findOne({
      where:    { userId, companyId },
      relations: ['permission'],
    });

    /* Si pas de CompanyTeamMember → c'est le propriétaire */
    if (!member) {
      return { isOwner: true, permissions: null };
    }

    return {
      isOwner:     false,
      permissions: (member.permission?.permissions ?? null) as unknown as Record<string, Record<string, boolean>> | null,
    };
  }

  /** Génère un mot de passe temporaire aléatoire (12 caractères) */
  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: TEMP_PASSWORD_LENGTH })
      .map(() => chars[crypto.randomInt(chars.length)])
      .join('');
  }

  /** Génère un username unique basé sur le prénom/nom */
  private async generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
    const base    = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z.]/g, '');
    let candidate = base;
    let attempt   = 0;
    while (await this.userRepo.findOne({ where: { username: candidate }, withDeleted: true })) {
      attempt++;
      candidate = `${base}${attempt}`;
    }
    return candidate;
  }

  /** Transforme une entité CompanyTeamMember en DTO de réponse (sans données sensibles) */
  private toMemberDto(member: CompanyTeamMember, userOverride?: User) {
    const user = userOverride ?? member.user;
    return {
      id:           member.id,
      userId:       member.userId,
      companyId:    member.companyId,
      status:       member.status,
      jobTitle:     member.jobTitle,
      internalRole: member.internalRole,
      lastLoginAt:  member.lastLoginAt,
      suspendedAt:  member.suspendedAt,
      suspensionReason: member.suspensionReason,
      mustChangePassword: member.mustChangePassword,
      createdAt:    member.createdAt,
      updatedAt:    member.updatedAt,
      /* Données utilisateur */
      firstName:    user?.firstName,
      lastName:     user?.lastName,
      email:        user?.email,
      phone:        user?.phone,
      profilePicture: user?.profilePicture,
      /* Permissions */
      permissions:  member.permission?.permissions ?? null,
    };
  }
}
