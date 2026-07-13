/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/services/utilisateurs.service.ts
 *
 * CORRECTIONS :
 *   1. listUsers() → .leftJoinAndSelect('u.localisations','loc')
 *      Sans ça, user.localisations est undefined → country = 'GN' pour tous
 *   2. Filtre pays → 'loc.pays' au lieu de 'u.country' (champ inexistant sur User)
 * ============================================================ */

import {
  BadRequestException, ForbiddenException,
  Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User, UserStatus } from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { FilterUsersDto } from '../dto/utilisateurs.dto';
import { AuditLogService } from './audit-log.service';
import { Client }       from 'src/database/entities/profiles/client-profile.entity';
import { Company }      from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }     from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent} from 'src/database/entities/profiles/correspondant-profile.entity';
import {
  NotificationActorType,
  NotificationType,
} from 'src/database/entities/notification/notification.entitiy';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';
import { Product, ProductVisibility } from 'src/database/entities/entreprise.table/product.entity';
import { Commande, CommandeStatus }   from 'src/database/entities/commande/commande.entity';

/* ── Interfaces ────────────────────────────────────────────── */

export interface UserListItem {
  id: string; name: string; email: string; role: string;
  status: string; country: string; phone: string; date: string; verified: boolean;
}

export interface UserListResponse {
  data: UserListItem[]; total: number; page: number; pages: number; limit: number;
}

export interface UserDetail extends UserListItem {
  username: string | null; city: string | null; address: string | null;
  lastLoginAt: string | null; lastLoginIp: string | null;
  failedLoginAttempts: number; lockedUntil: string | null;
  phoneVerified: boolean; profilePicture: string | null;
  createdAt: string; updatedAt: string;
}

export interface UserStats {
  total: number; parRole: Record<string, number>;
  parStatut: Record<string, number>; parPays: Record<string, number>;
  nouveaux30j: number;
}

export interface PlatformStats {
  totalProduits:    number;
  totalCommandes:   number;
  commandesCeMois:  number;
  commandesEnCours: number;
  inscriptions14j:  { date: string; count: number }[];
}

/* ── Mappings ──────────────────────────────────────────────── */

const ROLE_TO_FRONTEND: Record<string, string> = {
  [UserRole.COMPANY]:      'company',
  [UserRole.DELIVERY]:     'delivery',
  [UserRole.CLIENT]:       'client',
  [UserRole.PARTNER]:      'partner',
  [UserRole.ADMIN]:        'admin',
  [UserRole.SUPER_ADMIN]:  'admin',
  [UserRole.CORRESPONDENT]:'correspondent',
};

const STATUS_TO_FRONTEND: Record<string, string> = {
  [UserStatus.ACTIVE]:    'active',
  [UserStatus.BANNED]:    'blocked',
  [UserStatus.PENDING]:   'pending',
  [UserStatus.SUSPENDED]: 'suspended',
};

/* ── Service ───────────────────────────────────────────────── */

@Injectable()
export class UtilisateursService {

  private readonly logger = new Logger(UtilisateursService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Product)
    private readonly produitRepo: Repository<Product>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    private readonly auditLog: AuditLogService,
    private readonly notifEventSvc: NotificationEventService,
  ) {}

  /* ── 1. LISTE ─────────────────────────────────────────────── */

  async listUsers(dto: FilterUsersDto, caller: User): Promise<UserListResponse> {
    this.assertIsAdminOrSuperAdmin(caller);

    const page  = Math.max(dto.page  ?? 1,  1);
    const limit = Math.min(Math.max(dto.limit ?? 20, 1), 100);

    const qb = this.userRepo
      .createQueryBuilder('u')
      /*
       * ✅ FIX CRITIQUE — charger la relation localisations
       * Sans ce join, user.localisations est undefined dans toUserListItem()
       * → country = 'GN' (fallback) pour tous les utilisateurs
       * → le filtre par pays ne fonctionnait pas non plus
       */
      .leftJoinAndSelect('u.localisations', 'loc')
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    /* Recherche texte */
    if (dto.search?.trim()) {
      const term = `%${dto.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets(sub => {
          sub
            .where(`LOWER(COALESCE(u.firstName, '')) LIKE :term`)
            .orWhere(`LOWER(COALESCE(u.lastName, '')) LIKE :term`)
            .orWhere(`LOWER(COALESCE(u.email, '')) LIKE :term`)
            .orWhere(`LOWER(COALESCE(u.phone, '')) LIKE :term`);
        }),
        { term },
      );
    }

    /* Filtre rôle */
    if (dto.role && dto.role !== 'all') {
      const dbRole = this.frontendRoleToDbRole(dto.role);
      if (dbRole) {
        if (Array.isArray(dbRole)) {
          qb.andWhere('u.role IN (:...roles)', { roles: dbRole });
        } else {
          qb.andWhere('u.role = :role', { role: dbRole });
        }
      }
    }

    /* Filtre statut */
    if (dto.status && dto.status !== 'all') {
      const dbStatus = this.frontendStatusToDbStatus(dto.status);
      if (dbStatus) qb.andWhere('u.status = :status', { status: dbStatus });
    }

    /* Filtre pays : vérifie countryCode (détecté à l'inscription via tél.)
     * OU loc.pays (adresse renseignée par l'utilisateur).
     * countryCode est la source la plus fiable car toujours rempli à la création. */
    if (dto.country && dto.country !== 'all') {
      qb.andWhere(
        new Brackets(sub => {
          sub
            .where('u.countryCode = :country', { country: dto.country })
            .orWhere('loc.pays = :country', { country: dto.country });
        }),
      );
    }

    const [users, total] = await qb.getManyAndCount();

    return {
      data:  users.map(u => this.toUserListItem(u)),
      total, page, limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /* ── 2. DÉTAIL ────────────────────────────────────────────── */

  async getUser(userId: string, caller: User): Promise<UserDetail> {
    this.assertIsAdminOrSuperAdmin(caller);
    const user = await this.findUserOrFail(userId);
    return this.toUserDetail(user);
  }

  /* ── 3. BLOQUER / DÉBLOQUER ───────────────────────────────── */

  async toggleBlock(userId: string, caller: User): Promise<{ message: string; status: string }> {
    this.assertIsAdminOrSuperAdmin(caller);
    const user = await this.findUserOrFail(userId);
    this.assertCanManageUser(user, caller);

    const newStatus = user.status === UserStatus.BANNED ? UserStatus.ACTIVE : UserStatus.BANNED;
    user.status = newStatus;
    await this.userRepo.save(user);

    const action = newStatus === UserStatus.BANNED ? 'bloqué' : 'débloqué';
    this.logger.log(`[TOGGLE BLOCK] ${user.email} -> ${newStatus} | PAR: ${caller.email}`);
    await this.auditLog.log(caller, '🔐', `a ${action} le compte ${user.email}`, { type: 'user', id: user.id });

    void this.notifyUserAccount(user, newStatus === UserStatus.BANNED
      ? { type: NotificationType.ACCOUNT_BANNED, title: 'Compte bloqué 🚫', body: 'Votre compte a été bloqué par l\'administration.' }
      : { type: NotificationType.ACCOUNT_APPROVED, title: 'Compte débloqué ✅', body: 'Votre compte a été débloqué par l\'administration.' }
    );

    return {
      message: `${user.firstName} ${user.lastName} a été ${action}.`,
      status:  STATUS_TO_FRONTEND[newStatus] ?? newStatus,
    };
  }

  /* ── 4. SUSPENDRE ─────────────────────────────────────────── */

  async suspendUser(userId: string, caller: User, raison?: string): Promise<{ message: string }> {
    this.assertIsAdminOrSuperAdmin(caller);
    const user = await this.findUserOrFail(userId);
    this.assertCanManageUser(user, caller);

    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('Cet utilisateur est déjà suspendu.');
    }

    user.status = UserStatus.SUSPENDED;
    await this.userRepo.save(user);
    this.logger.log(`[SUSPEND] ${user.email} | RAISON: ${raison ?? 'non précisée'} | PAR: ${caller.email}`);
    await this.auditLog.log(
      caller, '⏸',
      `a suspendu le compte ${user.email}${raison ? ` (raison : ${raison})` : ''}`,
      { type: 'user', id: user.id },
    );

    void this.notifyUserAccount(user, {
      type:  NotificationType.ACCOUNT_SUSPENDED,
      title: 'Compte suspendu ⚠️',
      body:  raison
        ? `Votre compte a été suspendu. Raison : ${raison}`
        : 'Votre compte a été temporairement suspendu par l\'administration.',
    });

    return { message: `${user.firstName} ${user.lastName} a été suspendu.` };
  }

  /* ── 5. VÉRIFIER ──────────────────────────────────────────── */

  async verifyUser(userId: string, caller: User): Promise<{ message: string }> {
    this.assertIsAdminOrSuperAdmin(caller);
    const user = await this.findUserOrFail(userId);

    if (user.emailVerified) {
      throw new BadRequestException('Cet utilisateur est déjà vérifié.');
    }

    user.emailVerified = true;
    await this.userRepo.save(user);
    this.logger.log(`[VERIFY] ${user.email} vérifié par ${caller.email}`);
    await this.auditLog.log(caller, '✔', `a vérifié le compte ${user.email}`, { type: 'user', id: user.id });

    void this.notifyUserAccount(user, {
      type:  NotificationType.ACCOUNT_VERIFIED,
      title: 'Compte vérifié ✔️',
      body:  'Votre identité a été vérifiée par l\'administration Shopi.',
    });

    return { message: `${user.firstName} ${user.lastName} a été vérifié.` };
  }

  /* ── 5b. SUPPRIMER (soft delete) ──────────────────────────── */

  async deleteUser(userId: string, caller: User): Promise<{ message: string }> {
    this.assertIsAdminOrSuperAdmin(caller);
    const user = await this.findUserOrFail(userId);
    this.assertCanManageUser(user, caller);

    await this.userRepo.softDelete(user.id);
    this.logger.log(`[DELETE] ${user.email} supprimé par ${caller.email}`);
    await this.auditLog.log(caller, '🗑', `a supprimé le compte ${user.email}`, { type: 'user', id: user.id });

    return { message: `${user.firstName} ${user.lastName} a été supprimé.` };
  }

  /* ── 6. EXPORT CSV ────────────────────────────────────────── */

  async exportCsv(dto: FilterUsersDto, caller: User): Promise<string> {
    this.assertIsAdminOrSuperAdmin(caller);

    const response = await this.listUsers({ ...dto, page: 1, limit: 10_000 }, caller);
    const users = response.data;

    const headers = ['ID','Nom','Email','Téléphone','Rôle','Statut','Pays','Vérifié','Date inscription'];

    const rows = users.map(u => [
      this.escapeCsv(u.id),
      this.escapeCsv(u.name),
      this.escapeCsv(u.email),
      this.escapeCsv(u.phone),
      this.escapeCsv(u.role),
      this.escapeCsv(u.status),
      this.escapeCsv(u.country),
      u.verified ? 'Oui' : 'Non',
      this.escapeCsv(new Date(u.date).toLocaleDateString('fr-FR')),
    ].join(','));

    this.logger.log(`[EXPORT CSV] ${rows.length} utilisateurs exportés par ${caller.email}`);
    return '\uFEFF' + [headers.join(','), ...rows].join('\n');
  }

  /* ── 7. STATISTIQUES ──────────────────────────────────────── */

  async getStats(caller: User): Promise<UserStats> {
    this.assertIsAdminOrSuperAdmin(caller);

    const total = await this.userRepo.count();

    const rawRole = await this.userRepo
      .createQueryBuilder('u')
      .select('u.role', 'role').addSelect('COUNT(*)', 'count')
      .groupBy('u.role').getRawMany<{ role: string; count: string }>();

    const parRole: Record<string, number> = {};
    for (const row of rawRole) {
      const k = ROLE_TO_FRONTEND[row.role] ?? row.role;
      parRole[k] = (parRole[k] ?? 0) + Number(row.count);
    }

    const rawStatus = await this.userRepo
      .createQueryBuilder('u')
      .select('u.status', 'status').addSelect('COUNT(*)', 'count')
      .groupBy('u.status').getRawMany<{ status: string; count: string }>();

    const parStatut: Record<string, number> = {};
    for (const row of rawStatus) {
      parStatut[STATUS_TO_FRONTEND[row.status] ?? row.status] = Number(row.count);
    }

    /* ✅ Stats pays depuis la table localisations */
    const rawCountry = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.localisations', 'loc')
      .select('loc.pays', 'country').addSelect('COUNT(DISTINCT u.id)', 'count')
      .where('loc.pays IS NOT NULL')
      .groupBy('loc.pays').orderBy('count', 'DESC')
      .getRawMany<{ country: string; count: string }>();

    const parPays: Record<string, number> = {};
    for (const row of rawCountry) {
      if (row.country) parPays[row.country] = Number(row.count);
    }

    const date30j = new Date();
    date30j.setDate(date30j.getDate() - 30);
    const nouveaux30j = await this.userRepo
      .createQueryBuilder('u')
      .where('u.createdAt >= :date', { date: date30j })
      .getCount();

    return { total, parRole, parStatut, parPays, nouveaux30j };
  }

  /* ── Helpers privés ───────────────────────────────────────── */

  private assertIsAdminOrSuperAdmin(caller: User): void {
    if (caller.role !== UserRole.ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Accès refusé.');
    }
  }

  private assertCanManageUser(target: User, caller: User): void {
    if (target.id === caller.id) {
      throw new BadRequestException('Vous ne pouvez pas effectuer cette action sur votre propre compte.');
    }
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Le compte super-admin est protégé.');
    }
    if (target.role === UserRole.ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Seul le super-admin peut gérer un administrateur.');
    }
  }

  private async findUserOrFail(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['localisations'],
    });
    if (!user) throw new NotFoundException(`Utilisateur introuvable (ID: ${userId}).`);
    return user;
  }

  private frontendRoleToDbRole(role: string): string | string[] | null {
    const map: Record<string, string | string[]> = {
      company:       UserRole.COMPANY,
      delivery:      UserRole.DELIVERY,
      client:        UserRole.CLIENT,
      partner:       UserRole.PARTNER,
      correspondent: UserRole.CORRESPONDENT,
      admin:         [UserRole.ADMIN, UserRole.SUPER_ADMIN],
    };
    return map[role] ?? null;
  }

  /* ── 8. STATS PLATEFORME ──────────────────────────────────── */

  async getPlatformStats(caller: User): Promise<PlatformStats> {
    this.assertIsAdminOrSuperAdmin(caller);

    const debut30j = new Date();
    debut30j.setDate(debut30j.getDate() - 30);

    const debut14j = new Date();
    debut14j.setDate(debut14j.getDate() - 13);
    debut14j.setHours(0, 0, 0, 0);

    const [totalProduits, totalCommandes, commandesCeMois, commandesEnCours] = await Promise.all([
      this.produitRepo.count({ where: { visibilite: ProductVisibility.PUBLIC } }),
      this.commandeRepo.count(),
      this.commandeRepo
        .createQueryBuilder('c')
        .where('c.createdAt >= :debut30j', { debut30j })
        .getCount(),
      this.commandeRepo
        .createQueryBuilder('c')
        .where('c.status IN (:...statuses)', {
          statuses: [CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT, CommandeStatus.PAID],
        })
        .getCount(),
    ]);

    const rawInscrits = await this.userRepo
      .createQueryBuilder('u')
      .select("DATE(u.createdAt)", 'day')
      .addSelect('COUNT(*)', 'count')
      .where('u.createdAt >= :debut14j', { debut14j })
      .groupBy("DATE(u.createdAt)")
      .orderBy("DATE(u.createdAt)", 'ASC')
      .getRawMany<{ day: string; count: string }>();

    const byDay: Record<string, number> = {};
    for (const row of rawInscrits) {
      byDay[row.day] = Number(row.count);
    }

    const inscriptions14j: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      inscriptions14j.push({ date: key, count: byDay[key] ?? 0 });
    }

    return { totalProduits, totalCommandes, commandesCeMois, commandesEnCours, inscriptions14j };
  }

  private frontendStatusToDbStatus(status: string): string | null {
    const map: Record<string, string> = {
      active: UserStatus.ACTIVE, blocked: UserStatus.BANNED,
      pending: UserStatus.PENDING, suspended: UserStatus.SUSPENDED,
    };
    return map[status] ?? null;
  }

  private toUserListItem(user: User): UserListItem {
    return {
      id:       user.id,
      name:     `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      email:    user.email,
      role:     ROLE_TO_FRONTEND[user.role]    ?? user.role,
      status:   STATUS_TO_FRONTEND[user.status] ?? user.status,
      /* countryCode (ISO-2) est renseigné à l'inscription via l'indicatif tél.
       * loc.pays sert de fallback pour les utilisateurs sans numéro. */
      country:  user.countryCode ?? user.localisations?.[0]?.pays ?? '',
      phone:    user.phone ?? '',
      date:     user.createdAt?.toISOString() ?? new Date().toISOString(),
      verified: Boolean(user.emailVerified),
    };
  }

  private toUserDetail(user: User): UserDetail {
    return {
      ...this.toUserListItem(user),
      username:            user.username ?? null,
      city:                user.localisations?.[0]?.ville ?? null,
      address:             user.localisations?.[0]?.rue   ?? null,
      lastLoginAt:         user.lastLoginAt?.toISOString()  ?? null,
      lastLoginIp:         user.lastLoginIp                 ?? null,
      failedLoginAttempts: user.failedLoginAttempts         ?? 0,
      lockedUntil:         user.lockedUntil?.toISOString()  ?? null,
      phoneVerified:       Boolean(user.phoneVerified),
      profilePicture:      user.profilePicture ?? null,
      createdAt:           user.createdAt?.toISOString() ?? '',
      updatedAt:           user.updatedAt?.toISOString() ?? '',
    };
  }

  private escapeCsv(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Résout le profileId d'un User selon son rôle, puis envoie
   * une notification de statut de compte. Fire-and-forget.
   */
  private async notifyUserAccount(
    user: User,
    notif: { type: NotificationType; title: string; body: string },
  ): Promise<void> {
    try {
      type ProfileEntry = { type: NotificationActorType; entityClass: unknown };
      const roleMap: Partial<Record<string, ProfileEntry>> = {
        [UserRole.CLIENT]:        { type: NotificationActorType.CLIENT,       entityClass: Client        },
        [UserRole.COMPANY]:       { type: NotificationActorType.COMPANY,      entityClass: Company       },
        [UserRole.DELIVERY]:      { type: NotificationActorType.DELIVERY,     entityClass: Delivery      },
        [UserRole.CORRESPONDENT]: { type: NotificationActorType.CORRESPONDENT,entityClass: Correspondent },
      };

      const cfg = roleMap[user.role];
      if (!cfg) return;

      const profile = await (this.userRepo.manager.findOne as any)(cfg.entityClass, {
        where:  { userId: user.id },
        select: ['id'],
      });
      if (!profile?.id) return;

      void this.notifEventSvc.notifyAccountStatusChanged({
        recipientType: cfg.type,
        recipientId:   profile.id,
        type:          notif.type,
        title:         notif.title,
        body:          notif.body,
      });
    } catch (err) {
      this.logger.error(`notifyUserAccount (${notif.type}) failed`, err);
    }
  }
}