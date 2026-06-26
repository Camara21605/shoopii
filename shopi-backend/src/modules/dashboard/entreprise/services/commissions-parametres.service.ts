/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/commissions-parametres.service.ts
 *
 * RÔLE : Gère le plan de commissions (section 7)
 *   GET   /parametres/commissions → lire le plan actuel + grille tarifaire
 *   PATCH /parametres/commissions → changer de plan (standard/pro/premium)
 *
 * Note : Le changement de plan est normalement soumis à validation
 * admin. Ici on laisse l'entreprise demander, l'admin confirme.
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsEnum } from 'class-validator';

import {
  Company,
  CompanyPlan,
} from 'src/database/entities/profiles/entreprise-profile.entity';

/* ── DTO inline (simple) ── */
export class UpdatePlanDto {
  @IsEnum(CompanyPlan)
  plan!: CompanyPlan;
}

/* ── Grille de commissions par plan ── */
const COMMISSIONS_GRILLE: Record<CompanyPlan, { taux: number; label: string }> = {
  [CompanyPlan.STANDARD]: { taux: 3,   label: 'Standard — 3% / vente'   },
  [CompanyPlan.PRO]:      { taux: 2,   label: 'Pro      — 2% / vente'   },
  [CompanyPlan.PREMIUM]:  { taux: 1.5, label: 'Premium  — 1,5% / vente' },
};

@Injectable()
export class CommissionsParametresService {

  private readonly logger = new Logger(CommissionsParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Lire le plan et la grille
   * ────────────────────────────────────────────────────────── */

  async getCommissions(userId: string) {
    const company = await this.findCompanyOrFail(userId);

    return {
      planActuel:  company.plan,
      tauxActuel:  COMMISSIONS_GRILLE[company.plan],
      grille:      COMMISSIONS_GRILLE,
      plans:       Object.values(CompanyPlan),
    };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Changer de plan (section 7)
   * ────────────────────────────────────────────────────────── */

  async updatePlan(userId: string, dto: UpdatePlanDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    company.plan = dto.plan;

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[PLAN] Changé → ${dto.plan} — userId=${userId}`);

    return updated;
  }

  /* ── HELPER ── */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
