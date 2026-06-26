/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/services/audit-log.service.ts
 *
 * Journal d'audit — enregistre et liste les actions sensibles
 * effectuées par les admins / super-admins.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../../../database/entities/audit-log.entity';
import { User } from '../../../../database/entities/user.entity';

export interface AuditEntryDto {
  icon:   string;
  user:   string;
  action: string;
  time:   string;
}

@Injectable()
export class AuditLogService {

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * Enregistre une action dans le journal d'audit.
   */
  async log(
    actor:  User,
    icon:   string,
    action: string,
    target?: { type: string; id: string },
  ): Promise<void> {
    const entry = this.auditRepo.create({
      actorId:    actor.id,
      actorName:  `${actor.firstName} ${actor.lastName}`,
      actorEmail: actor.email,
      icon,
      action,
      targetType: target?.type ?? null,
      targetId:   target?.id ?? null,
    });
    await this.auditRepo.save(entry);
  }

  /**
   * Liste les dernières entrées du journal d'audit (plus récentes en premier).
   */
  async list(limit = 50): Promise<AuditEntryDto[]> {
    const entries = await this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take:  Math.min(Math.max(limit, 1), 200),
    });

    return entries.map(e => ({
      icon:   e.icon,
      user:   e.actorName,
      action: e.action,
      time:   e.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }));
  }
}
