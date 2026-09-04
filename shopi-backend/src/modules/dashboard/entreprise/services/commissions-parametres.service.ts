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
import { CompanySetting }   from 'src/modules/company-settings/company-settings.entity';

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

    @InjectRepository(CompanySetting)
    private readonly companySettingRepo: Repository<CompanySetting>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Lire le plan et la grille
   * ────────────────────────────────────────────────────────── */

  async getCommissions(userId: string) {
    const [company, platform, companySettings] = await Promise.all([
      this.findCompanyOrFail(userId),
      this.platformRepo.findOne({ where: { id: 1 } }),
      this.companySettingRepo.findOne({ where: { id: 1 } }),
    ]);

    /* BUG CORRIGÉ — cette grille ignorait totalement un override
     * CompanySetting (Centre de Gestion des Commissions, onglet
     * "Entreprises") : en mode 'percentage', commissionValue REMPLACE
     * rule.tauxCommissionProduit pour le calcul réel (voir
     * resoudreCommissionProduit()) — cette page continuait à afficher
     * l'ancien taux plateforme, qui pouvait ne plus correspondre à rien.
     * En mode 'fixed'/'progressive', aucun taux unique ne représente
     * fidèlement ce qui sera réellement prélevé (ça dépend du montant de
     * chaque commande) — on retombe alors sur le taux plateforme comme
     * simple indication, comportement inchangé pour ces 2 modes. */
    const base = companySettings?.commissionType === 'percentage'
      ? +(companySettings.commissionValue ?? platform?.tauxCommissionProduit ?? 6)
      : +(platform?.tauxCommissionProduit ?? 6);
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
  /* FIX m4 (historique, param client) — sans rapport ici : `userId` est en
   * réalité req.user.actorId, signé serveur (voir boutique-parametres.
   * service.ts pour le détail du bug que ce `[{id},{userId}]` corrige). */
  /* BUG CORRIGÉ — l'ancien `where:[{id},{userId}]` était un OR SQL sans
   * ordre garanti : quand une AUTRE entreprise a par accident un userId
   * identique à l'id de celle-ci (bug de profil fantôme, voir getParametres
   * dans boutique-parametres.service.ts), Postgres pouvait retourner l'une
   * ou l'autre selon le plan de requête — a réellement fait persister des
   * réglages sur la mauvaise fiche. `id` (cas normal, actorId) est
   * désormais toujours tenté en priorité ; `userId` n'est qu'un repli. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
