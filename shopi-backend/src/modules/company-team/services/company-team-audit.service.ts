/* ============================================================
 * FICHIER      : src/modules/company-team/services/company-team-audit.service.ts
 * MODULE       : Company Team
 * ROLE         : Journal d'audit des actions d'administration de l'équipe.
 *
 * RESPONSABILITES :
 *   - Enregistrer toutes les modifications des membres dans company_team_audit_logs.
 *   - Permettre la consultation paginée du journal d'audit.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyTeamAuditLog } from '../../../database/entities/company-team/company-team-audit-log.entity';

@Injectable()
export class CompanyTeamAuditService {

  constructor(
    @InjectRepository(CompanyTeamAuditLog)
    private readonly auditRepo: Repository<CompanyTeamAuditLog>,
  ) {}

  /**
   * Enregistre une action d'administration dans le journal d'audit.
   */
  async log(params: {
    companyId:          string;
    performedByUserId:  string;
    targetMemberId?:    string;
    action:             string;
    before?:            Record<string, unknown>;
    after?:             Record<string, unknown>;
    ipAddress?:         string;
    userAgent?:         string;
    success?:           boolean;
    errorMessage?:      string;
  }): Promise<void> {
    const entry = this.auditRepo.create({
      companyId:         params.companyId,
      performedByUserId: params.performedByUserId,
      targetMemberId:    params.targetMemberId  ?? null,
      action:            params.action,
      before:            params.before          ?? null,
      after:             params.after           ?? null,
      ipAddress:         params.ipAddress       ?? null,
      userAgent:         params.userAgent       ?? null,
      success:           params.success         ?? true,
      errorMessage:      params.errorMessage    ?? null,
    });
    await this.auditRepo.save(entry);
  }

  /**
   * Retourne le journal d'audit paginé d'une entreprise.
   */
  async getCompanyAuditLog(
    companyId: string,
    page  = 1,
    limit = 30,
  ) {
    const [items, total] = await this.auditRepo.findAndCount({
      where: { companyId },
      order: { createdAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
    });

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
