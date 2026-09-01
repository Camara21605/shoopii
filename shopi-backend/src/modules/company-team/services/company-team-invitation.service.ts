/* ============================================================
 * FICHIER      : src/modules/company-team/services/company-team-invitation.service.ts
 * MODULE       : Company Team
 * ROLE         : Gestion du cycle de vie des invitations de collaborateurs.
 *
 * RESPONSABILITES :
 *   - Créer une invitation avec un jeton sécurisé.
 *   - Envoyer la notification (email / notification interne).
 *   - Valider et accepter une invitation (création du compte).
 *   - Annuler / renvoyer une invitation.
 *   - Expirer automatiquement les invitations dépassées.
 *
 * SÉCURITÉ :
 *   - Le jeton est 64 hex (crypto.randomBytes — non prévisible).
 *   - Un jeton expiré ou annulé est rejeté avec BadRequestException.
 *   - L'email invité ne doit pas déjà posséder un compte Shopi actif.
 *   - La limite de membres est vérifiée AVANT d'accepter l'invitation.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { TeamEventBusService } from './team-event-bus.service';

import {
  CompanyTeamInvitation,
  InvitationStatus,
} from '../../../database/entities/company-team/company-team-invitation.entity';
import { CompanyTeamMember, TeamMemberStatus } from '../../../database/entities/company-team/company-team-member.entity';
import { User, UserStatus } from '../../../database/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';
import { Wallet } from '../../../database/entities/wallet.entity';

import { CreateInvitationDto, AcceptInvitationDto } from '../dto/invitation.dto';
import { CompanyTeamPermissionService } from './company-team-permission.service';
import { CompanyTeamAuditService }      from './company-team-audit.service';
import { TeamPlanConfigService }        from './team-plan-config.service';
import { TeamPermissionTemplateService } from './team-permission-template.service';

/** Durée de validité d'une invitation en millisecondes (48 heures) */
const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
const BCRYPT_ROUNDS     = 12;

@Injectable()
export class CompanyTeamInvitationService {

  private readonly logger = new Logger(CompanyTeamInvitationService.name);

  constructor(
    @InjectRepository(CompanyTeamInvitation)
    private readonly invitationRepo: Repository<CompanyTeamInvitation>,

    @InjectRepository(CompanyTeamMember)
    private readonly memberRepo: Repository<CompanyTeamMember>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    private readonly permissionService: CompanyTeamPermissionService,
    private readonly auditService:      CompanyTeamAuditService,
    private readonly planConfigService: TeamPlanConfigService,
    private readonly templateService:   TeamPermissionTemplateService,

    private readonly eventEmitter: TeamEventBusService,
    private readonly dataSource:   DataSource,
  ) {}

  // ════════════════════════════════════════════════════════════
  // CRÉER UNE INVITATION
  // ════════════════════════════════════════════════════════════

  /**
   * Crée une invitation pour un collaborateur potentiel.
   *
   * @param companyId  — identifiant de l'entreprise
   * @param ownerUserId — identifiant du propriétaire qui invite
   * @param dto        — données de l'invitation
   * @returns L'invitation créée (sans le token pour sécurité)
   */
  async create(
    companyId: string,
    ownerUserId: string,
    dto: CreateInvitationDto,
  ): Promise<Omit<CompanyTeamInvitation, 'token'> & { invitationLink: string }> {

    /* Vérifier que l'email n'est pas déjà utilisé — scopé par rôle
     * (UNIQUE(email, role)) : un compte d'un AUTRE rôle (ex. client)
     * partageant cet email ne doit pas bloquer l'invitation COMPANY. */
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase(), role: UserRole.COMPANY },
    });
    if (existingUser) {
      throw new ConflictException(
        `Un compte Shopi existe déjà pour l'adresse ${dto.email}.`,
      );
    }

    /* Vérifier qu'aucune invitation pending n'est déjà active pour cet email */
    const existingInvitation = await this.invitationRepo.findOne({
      where: { companyId, email: dto.email.toLowerCase(), status: InvitationStatus.PENDING },
    });
    if (existingInvitation && existingInvitation.expiresAt > new Date()) {
      throw new ConflictException(
        `Une invitation est déjà en attente pour ${dto.email}. Utilisez "Renvoyer" pour réinitialiser.`,
      );
    }

    /* Vérifier la limite de membres (actifs + invitations en attente) */
    const [activeMemberCount, pendingInvitationsCount, limit] = await Promise.all([
      this.memberRepo.count({ where: { companyId, status: TeamMemberStatus.ACTIVE } }),
      this.invitationRepo.count({ where: { companyId, status: InvitationStatus.PENDING } }),
      this.planConfigService.getLimitForCompany(companyId),
    ]);

    const totalAllocated = activeMemberCount + pendingInvitationsCount;
    if (isFinite(limit) && totalAllocated >= limit) {
      throw new BadRequestException(
        `Votre plan ne permet pas plus de ${limit} collaborateurs (actifs + invitations en attente inclus).`,
      );
    }

    /* Résoudre les permissions initiales depuis le template si fourni */
    let resolvedPermissions = dto.initialPermissions;
    if (!resolvedPermissions && dto.templateId) {
      try {
        const template = await this.templateService.getById(dto.templateId, companyId);
        resolvedPermissions = template.permissions;
      } catch {
        /* Le templateId est optionnel — on ignore l'erreur */
      }
    }

    /* Générer le jeton sécurisé */
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = this.invitationRepo.create({
      companyId,
      email:              dto.email.toLowerCase(),
      firstName:          dto.firstName,
      lastName:           dto.lastName,
      jobTitle:           dto.jobTitle,
      internalRole:       dto.internalRole,
      token,
      expiresAt,
      status:             InvitationStatus.PENDING,
      initialPermissions: resolvedPermissions,
      templateId:         dto.templateId,
      createdByUserId:    ownerUserId,
    });

    const saved = await this.invitationRepo.save(invitation);

    /* Publier l'événement pour le module notifications */
    this.eventEmitter.emit('team.invitation.created', {
      companyId,
      email:     dto.email,
      firstName: dto.firstName,
      token,
      expiresAt,
    });

    /* Journal d'audit */
    await this.auditService.log({
      companyId,
      performedByUserId: ownerUserId,
      action:            'invitation.created',
      after:             { email: dto.email, expiresAt },
      success:           true,
    });

    /* Construire le lien d'invitation — /login gère déjà tout le mécanisme
     * de pré-remplissage par paramètre d'URL (voir useCollabInviteParams
     * dans Login.tsx, même principe que ?role&code&email pour les
     * invitations livreur/correspondant). Pas de route /invitation/accept
     * dédiée : /login existe déjà et sait afficher directement l'onglet
     * Inscription pré-rempli. */
    const invitationLink = `/login?collabToken=${token}`;

    const safeInvitation = saved as Omit<CompanyTeamInvitation, 'token'>;
    return { ...safeInvitation, invitationLink };
  }

  // ════════════════════════════════════════════════════════════
  // ACCEPTER UNE INVITATION
  // ════════════════════════════════════════════════════════════

  /**
   * Valide le jeton et crée le compte utilisateur + membre.
   * Appelé depuis un endpoint PUBLIC (pas de JWT requis).
   */
  async accept(
    token: string,
    dto: AcceptInvitationDto,
    ip?: string,
  ): Promise<{ message: string; email: string }> {

    /* Charger l'invitation en incluant le champ token (select: false) */
    const invitation = await this.invitationRepo
      .createQueryBuilder('inv')
      .addSelect('inv.token')
      .where('inv.token = :token', { token })
      .getOne();

    if (!invitation) {
      throw new NotFoundException('Lien d\'invitation invalide ou expiré.');
    }

    /* Vérifications */
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Cette invitation a déjà été ${invitation.status === InvitationStatus.ACCEPTED ? 'acceptée' : 'annulée'}.`,
      );
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepo.save(invitation);
      throw new BadRequestException(
        'Cette invitation a expiré. Demandez au propriétaire de vous renvoyer une invitation.',
      );
    }

    /* Vérifier que la limite n'a pas été dépassée entre-temps */
    const [activeCount, limit] = await Promise.all([
      this.memberRepo.count({
        where: { companyId: invitation.companyId, status: TeamMemberStatus.ACTIVE },
      }),
      this.planConfigService.getLimitForCompany(invitation.companyId),
    ]);

    if (isFinite(limit) && activeCount >= limit) {
      throw new BadRequestException(
        'L\'entreprise a atteint sa limite de collaborateurs. Contactez le propriétaire.',
      );
    }

    /* Hacher le mot de passe */
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    /* Créer le compte dans une transaction atomique */
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      /* Créer l'utilisateur */
      const user = await qr.manager.save(User, {
        firstName: dto.firstName,
        lastName:  dto.lastName,
        email:     invitation.email,
        username:  `${invitation.email.split('@')[0]}_${Date.now()}`,
        password:  hashedPassword,
        phone:     dto.phone,
        role:      UserRole.COMPANY,
        status:    UserStatus.ACTIVE,
        isEmailVerified: true,
      } as Partial<User>);

      /* Créer le portefeuille */
      await qr.manager.save(Wallet, {
        userId:   user.id,
        balance:  0,
        currency: 'GNF',
      } as Partial<Wallet>);

      /* Créer le membre d'équipe */
      const member = await qr.manager.save(CompanyTeamMember, {
        userId:       user.id,
        companyId:    invitation.companyId,
        status:       TeamMemberStatus.ACTIVE,
        jobTitle:     invitation.jobTitle,
        internalRole: invitation.internalRole,
        mustChangePassword: false,
      } as Partial<CompanyTeamMember>);

      /* Marquer l'invitation comme acceptée */
      invitation.status     = InvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      await qr.manager.save(CompanyTeamInvitation, invitation);

      await qr.commitTransaction();

      /* Créer les permissions (hors transaction) */
      await this.permissionService.create(member.id, invitation.initialPermissions);

      this.eventEmitter.emit('team.invitation.accepted', {
        companyId: invitation.companyId,
        memberId:  member.id,
        email:     invitation.email,
        ip,
      });

      return { message: 'Invitation acceptée. Votre compte est prêt.', email: invitation.email };

    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error('Erreur lors de l\'acceptation de l\'invitation', err);
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ════════════════════════════════════════════════════════════
  // ANNULER / RENVOYER
  // ════════════════════════════════════════════════════════════

  /** Annule une invitation en attente */
  async cancel(
    invitationId: string,
    companyId: string,
    ownerUserId: string,
  ): Promise<{ message: string }> {
    const invitation = await this.requireInvitation(invitationId, companyId);

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Seules les invitations en attente peuvent être annulées.');
    }

    invitation.status = InvitationStatus.CANCELLED;
    await this.invitationRepo.save(invitation);

    await this.auditService.log({
      companyId,
      performedByUserId: ownerUserId,
      action:            'invitation.cancelled',
      after:             { email: invitation.email },
      success:           true,
    });

    return { message: 'Invitation annulée.' };
  }

  /**
   * Régénère le jeton et remet l'expiration à 48h.
   * Pratique si le collaborateur n'a pas reçu/cliqué dans le délai.
   */
  async resend(
    invitationId: string,
    companyId: string,
    ownerUserId: string,
  ): Promise<{ message: string; invitationLink: string }> {
    const invitation = await this.requireInvitation(invitationId, companyId);

    if (invitation.status !== InvitationStatus.PENDING && invitation.status !== InvitationStatus.EXPIRED) {
      throw new BadRequestException('Impossible de renvoyer une invitation déjà acceptée ou annulée.');
    }

    /* Nouveau jeton + nouvelle expiration */
    const newToken = crypto.randomBytes(32).toString('hex');

    await this.invitationRepo
      .createQueryBuilder()
      .update(CompanyTeamInvitation)
      .set({
        token:     newToken,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        status:    InvitationStatus.PENDING,
      })
      .where('id = :id', { id: invitationId })
      .execute();

    this.eventEmitter.emit('team.invitation.resent', {
      companyId,
      email: invitation.email,
      token: newToken,
    });

    return {
      message:        'Invitation renvoyée.',
      invitationLink: `/login?collabToken=${newToken}`,
    };
  }

  // ════════════════════════════════════════════════════════════
  // CONSULTATION
  // ════════════════════════════════════════════════════════════

  /** Retourne les invitations d'une entreprise (toutes ou filtrées par statut) */
  async getPending(companyId: string): Promise<CompanyTeamInvitation[]> {
    return this.invitationRepo.find({
      where: { companyId, status: InvitationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  async getAll(companyId: string): Promise<CompanyTeamInvitation[]> {
    return this.invitationRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retourne les informations publiques d'une invitation.
   * Utilisé par le frontend pour afficher le formulaire d'acceptation.
   */
  async getPublicInfo(token: string): Promise<{
    email: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    companyId: string;
    expiresAt: Date;
    status: InvitationStatus;
  }> {
    const inv = await this.invitationRepo
      .createQueryBuilder('inv')
      .addSelect('inv.token')
      .where('inv.token = :token', { token })
      .getOne();

    if (!inv) throw new NotFoundException('Invitation introuvable.');

    return {
      email:     inv.email,
      firstName: inv.firstName,
      lastName:  inv.lastName,
      jobTitle:  inv.jobTitle,
      companyId: inv.companyId,
      expiresAt: inv.expiresAt,
      status:    inv.status,
    };
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS PRIVÉS
  // ════════════════════════════════════════════════════════════

  private async requireInvitation(id: string, companyId: string): Promise<CompanyTeamInvitation> {
    const inv = await this.invitationRepo.findOne({ where: { id, companyId } });
    if (!inv) throw new NotFoundException('Invitation introuvable.');
    return inv;
  }
}
