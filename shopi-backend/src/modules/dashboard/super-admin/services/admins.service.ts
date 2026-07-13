/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/services/admins.service.ts
 *
 * Gestion des comptes admin et de leurs permissions
 * (section "Permissions" du dashboard super-admin).
 * ============================================================ */

import {
  BadRequestException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../../../../database/entities/profiles/admin-profile.entity';
import { User } from '../../../../database/entities/user.entity';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { AuditLogService } from './audit-log.service';
import { NotificationService } from '../../../notifications/services/notification.service';
import {
  NotificationActorType,
  NotificationType,
  NotificationPriority,
} from '../../../../database/entities/notification/notification.entitiy';

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  /* ── Modules généraux ── */
  partners:             false,
  companies:            false,
  delivery:             false,
  customers:            false,
  stats:                false,
  reports:              false,
  notifs:               false,
  support:              false,
  /* ── Référentiel Géographique ── */
  geo_pays:             false,
  geo_regions:          false,
  geo_prefectures:      false,
  geo_communes:         false,
  geo_quartiers:        false,
  geo_zones:            false,
  /* ── Permission avancée : modifier les données du super-admin ── */
  geo_modifier_protege: false,
};

export interface AdminPermDto {
  name:        string;
  email:       string;
  perms:       Record<string, boolean>;
  paysAssigne: string | null;
}

@Injectable()
export class AdminsService {

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly auditLog:   AuditLogService,
    private readonly notifSvc:   NotificationService,
  ) {}

  private assertIsSuperAdmin(caller: User): void {
    if (caller.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Accès réservé au super-admin.');
    }
  }

  /* ── Liste des comptes admin et leurs permissions ── */
  async list(caller: User): Promise<AdminPermDto[]> {
    this.assertIsSuperAdmin(caller);

    const admins = await this.adminRepo.find({
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return admins.map(a => ({
      name:        a.fullName,
      email:       a.user?.email ?? '',
      perms:       { ...DEFAULT_PERMISSIONS, ...(a.permissions ?? {}) },
      paysAssigne: a.paysAssigne ?? null,
    }));
  }

  /* ── Met à jour une permission d'un admin ── */
  async setPermission(
    email: string,
    perm:  string,
    value: boolean,
    caller: User,
  ): Promise<{ message: string; perms: Record<string, boolean> }> {
    this.assertIsSuperAdmin(caller);

    if (!(perm in DEFAULT_PERMISSIONS)) {
      throw new BadRequestException(`Permission inconnue : "${perm}".`);
    }

    const admin = await this.adminRepo.findOne({
      relations: ['user'],
      where: { user: { email } },
    });
    if (!admin) throw new NotFoundException('Administrateur introuvable.');

    const perms = { ...DEFAULT_PERMISSIONS, ...(admin.permissions ?? {}), [perm]: value };
    admin.permissions = perms;
    await this.adminRepo.save(admin);

    await this.auditLog.log(
      caller, '👤',
      `a ${value ? 'activé' : 'désactivé'} la permission "${perm}" de ${email}`,
      { type: 'admin', id: admin.id },
    );

    /* ── Notification si permission géo accordée ── */
    if (value && perm.startsWith('geo_')) {
      const GEO_LABELS: Record<string, string> = {
        geo_pays:        'Pays',
        geo_regions:     'Régions',
        geo_prefectures: 'Préfectures',
        geo_communes:    'Communes',
        geo_quartiers:   'Quartiers',
        geo_zones:       'Zones de livraison',
      };
      const isAdvanced = perm === 'geo_modifier_protege';
      this.notifSvc.create({
        recipientType: NotificationActorType.ADMIN,
        recipientId:   admin.id,
        actorType:     NotificationActorType.SUPER_ADMIN,
        actorId:       caller.id,
        type:          NotificationType.ACCOUNT_APPROVED,
        priority:      NotificationPriority.HIGH,
        title:         isAdvanced ? 'Accès étendu accordé' : 'Accès Référentiel Géo accordé',
        body:          isAdvanced
          ? 'Vous êtes maintenant autorisé à modifier les éléments géographiques créés par le super-administrateur.'
          : `Vous pouvez désormais gérer les ${GEO_LABELS[perm] ?? perm} dans le référentiel géographique.`,
        actionUrl:     '/dashboard/administrateur',
        resourceType:  'geo_permission',
        resourceId:    admin.id,
      }).catch(() => {/* notification non bloquante */});
    }

    return { message: 'Permission mise à jour.', perms };
  }

  /* ── Permissions de l'admin connecté (accessible par l'admin lui-même) ── */
  async getMyPermissions(userId: string): Promise<Record<string, boolean | string | null>> {
    const admin = await this.adminRepo.findOne({ where: { userId } });
    if (!admin) throw new NotFoundException('Profil administrateur introuvable.');
    return {
      ...DEFAULT_PERMISSIONS,
      ...(admin.permissions ?? {}),
      _paysAssigne: admin.paysAssigne ?? null,
    };
  }

  /* ── Assigner / retirer un pays à un admin (super-admin uniquement) ── */
  async setAssignedCountry(
    email:  string,
    paysId: string | null,
    caller: User,
  ): Promise<{ message: string; paysAssigne: string | null }> {
    this.assertIsSuperAdmin(caller);

    const admin = await this.adminRepo.findOne({
      relations: ['user'],
      where: { user: { email } },
    });
    if (!admin) throw new NotFoundException('Administrateur introuvable.');

    admin.paysAssigne = paysId;
    await this.adminRepo.save(admin);

    await this.auditLog.log(
      caller, '🌍',
      paysId
        ? `a assigné le pays "${paysId}" à ${email}`
        : `a retiré l'assignation de pays de ${email}`,
      { type: 'admin', id: admin.id },
    );

    if (paysId) {
      this.notifSvc.create({
        recipientType: NotificationActorType.ADMIN,
        recipientId:   admin.id,
        actorType:     NotificationActorType.SUPER_ADMIN,
        actorId:       caller.id,
        type:          NotificationType.ACCOUNT_APPROVED,
        priority:      NotificationPriority.HIGH,
        title:         'Zone géographique assignée',
        body:          'Le super-administrateur vous a assigné une zone géographique. Connectez-vous pour gérer votre référentiel.',
        actionUrl:     '/dashboard/administrateur',
        resourceType:  'geo_assignment',
        resourceId:    admin.id,
      }).catch(() => {});
    }

    return { message: 'Pays assigné mis à jour.', paysAssigne: paysId };
  }

  /* ── Profil de l'admin connecté ── */
  async getMyProfil(userId: string): Promise<{
    firstName: string; lastName: string; email: string;
    phone: string; zone: string; bio: string;
    status: string; profilePicture: string | null;
  }> {
    const admin = await this.adminRepo.findOne({ where: { userId }, relations: ['user'] });
    if (!admin) throw new NotFoundException('Profil administrateur introuvable.');
    return {
      firstName:      admin.user.firstName        ?? '',
      lastName:       admin.user.lastName         ?? '',
      email:          admin.user.email            ?? '',
      phone:          admin.user.phone ?? admin.phone ?? '',
      zone:           admin.zone                  ?? '',
      bio:            admin.bio                   ?? '',
      status:         admin.status,
      profilePicture: admin.user.profilePicture   ?? null,
    };
  }

  async updateMyProfil(
    userId: string,
    dto: { firstName?: string; lastName?: string; phone?: string; zone?: string; bio?: string },
  ): Promise<{ message: string }> {
    const admin = await this.adminRepo.findOne({ where: { userId }, relations: ['user'] });
    if (!admin) throw new NotFoundException('Profil administrateur introuvable.');

    if (dto.firstName !== undefined) admin.user.firstName = dto.firstName;
    if (dto.lastName  !== undefined) admin.user.lastName  = dto.lastName;
    if (dto.phone     !== undefined) {
      admin.user.phone = dto.phone;
      admin.phone      = dto.phone;
    }
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const first = dto.firstName ?? admin.user.firstName ?? '';
      const last  = dto.lastName  ?? admin.user.lastName  ?? '';
      admin.fullName = `${first} ${last}`.trim();
    }
    if (dto.zone !== undefined) admin.zone = dto.zone || null;
    if (dto.bio  !== undefined) admin.bio  = dto.bio  || null;

    await this.userRepo.save(admin.user);
    await this.adminRepo.save(admin);

    return { message: 'Profil mis à jour avec succès.' };
  }

  async updateMyAvatar(userId: string, avatarUrl: string | null): Promise<{ profilePicture: string | null }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    user.profilePicture = avatarUrl || null;
    await this.userRepo.save(user);
    return { profilePicture: user.profilePicture };
  }
}
