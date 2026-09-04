/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/privacy-parametres.service.ts
 *
 * RÔLE : Gère la confidentialité (section 11)
 *   GET   /parametres/confidentialite → lire les 7 toggles
 *   PATCH /parametres/confidentialite → mettre à jour les toggles
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { UpdatePrivacyDto } from '../dto/update-privacy.dto';

/* ── Valeurs par défaut */
const DEFAULT_PRIVACY: Record<string, boolean> = {
  showInSearch:        true,
  showSalesStats:      true,
  allowFollow:         true,
  shareExactLocation:  false,
  improveAlgorithm:    true,
  anonymizedStats:     true,
  advancedReports:     false,
};

@Injectable()
export class PrivacyParametresService {

  private readonly logger = new Logger(PrivacyParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Lire les préférences de confidentialité
   * ────────────────────────────────────────────────────────── */

  async getPrivacy(userId: string): Promise<Record<string, boolean>> {
    const company = await this.findCompanyOrFail(userId);
    return company.privacySettings ?? DEFAULT_PRIVACY;
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre à jour la confidentialité (section 11)
   * ────────────────────────────────────────────────────────── */

  async updatePrivacy(userId: string, dto: UpdatePrivacyDto): Promise<Record<string, boolean>> {
    const company = await this.findCompanyOrFail(userId);

    const current  = company.privacySettings ?? DEFAULT_PRIVACY;
    const dtoPlain = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as Record<string, boolean>;

    company.privacySettings = { ...current, ...dtoPlain };

    await this.companyRepo.save(company);
    this.logger.log(`[PRIVACY] Mis à jour — userId=${userId}`);

    return company.privacySettings;
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
