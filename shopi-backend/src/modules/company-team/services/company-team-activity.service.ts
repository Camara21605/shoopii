/* ============================================================
 * FICHIER      : src/modules/company-team/services/company-team-activity.service.ts
 * MODULE       : Company Team
 * ROLE         : Journal d'activité des membres de l'équipe.
 *
 * RESPONSABILITES :
 *   - Enregistrer les actions des membres dans company_team_activity_logs.
 *   - Permettre la consultation paginée de l'historique d'un membre.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyTeamActivityLog } from '../../../database/entities/company-team/company-team-activity-log.entity';
import { QueryActivityDto } from '../dto/query-team.dto';

@Injectable()
export class CompanyTeamActivityService {

  constructor(
    @InjectRepository(CompanyTeamActivityLog)
    private readonly activityRepo: Repository<CompanyTeamActivityLog>,
  ) {}

  /**
   * Enregistre une action d'un membre dans le journal d'activité.
   */
  async log(params: {
    memberId:    string;
    companyId:   string;
    action:      string;
    description?: string;
    metadata?:   Record<string, unknown>;
    ipAddress?:  string;
  }): Promise<void> {
    const entry = this.activityRepo.create({
      memberId:    params.memberId,
      companyId:   params.companyId,
      action:      params.action,
      description: params.description ?? null,
      metadata:    params.metadata    ?? null,
      ipAddress:   params.ipAddress   ?? null,
    });
    await this.activityRepo.save(entry);
  }

  /**
   * Retourne l'historique d'activité paginé d'un membre.
   */
  async getMemberActivity(memberId: string, query: QueryActivityDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.activityRepo
      .createQueryBuilder('log')
      .where('log.memberId = :memberId', { memberId })
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action) {
      qb.andWhere('log.action LIKE :action', { action: `%${query.action}%` });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retourne toutes les activités d'une entreprise (pour le tableau de bord).
   */
  async getCompanyActivity(companyId: string, limit = 50) {
    return this.activityRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
