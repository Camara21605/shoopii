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
import { PlatformSettings } from 'src/database/entities/platform-settings.entity';

/* ── DTO inline (simple) ── */
export class UpdatePlanDto {
  @IsEnum(CompanyPlan)
  plan!: CompanyPlan;
}

@Injectable()
export class CommissionsParametresService {

  private readonly logger = new Logger(CommissionsParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(PlatformSettings)
    private readonly platformRepo: Repository<PlatformSettings>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Lire le plan et la grille
   * ────────────────────────────────────────────────────────── */

  async getCommissions(userId: string) {
    const [company, platform] = await Promise.all([
      this.findCompanyOrFail(userId),
      this.platformRepo.findOne({ where: { id: 1 } }),
    ]);

    const base     = +(platform?.tauxCommissionProduit ?? 6);
    const multPro  = +(platform?.planMultiplierPro     ?? 0.75);
    const multPrem = +(platform?.planMultiplierPremium ?? 0.5);

    const tauxPro  = +(base * multPro).toFixed(2);
    const tauxPrem = +(base * multPrem).toFixed(2);

    const grille = {
      [CompanyPlan.STANDARD]: { taux: base,     label: `Standard — ${base}% / vente`     },
      [CompanyPlan.PRO]:      { taux: tauxPro,  label: `Pro — ${tauxPro}% / vente`       },
      [CompanyPlan.PREMIUM]:  { taux: tauxPrem, label: `Premium — ${tauxPrem}% / vente`  },
    };

    return {
      planActuel: company.plan,
      tauxActuel: grille[company.plan],
      grille,
      plans: Object.values(CompanyPlan),
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
  /* FIX m4 — Lookup strict par userId uniquement; le fallback par companyId
   * permettait l'accès cross-tenant si un UUID de boutique était connu. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
