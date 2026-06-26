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

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  partners:  false,
  companies: false,
  delivery:  false,
  customers: false,
  stats:     false,
  reports:   false,
  notifs:    false,
  support:   false,
};

export interface AdminPermDto {
  name:  string;
  email: string;
  perms: Record<string, boolean>;
}

@Injectable()
export class AdminsService {

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    private readonly auditLog: AuditLogService,
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
      name:  a.fullName,
      email: a.user?.email ?? '',
      perms: { ...DEFAULT_PERMISSIONS, ...(a.permissions ?? {}) },
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

    return { message: 'Permission mise à jour.', perms };
  }
}
