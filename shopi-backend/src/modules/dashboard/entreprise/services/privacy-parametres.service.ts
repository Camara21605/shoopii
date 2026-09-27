/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/privacy-parametres.service.ts
 *
 * RÔLE : Confidentialité de l'entreprise (section 11)
 *   GET   /parametres/confidentialite
 *   PATCH /parametres/confidentialite
 *
 * BUG CORRIGÉ — les 7 interrupteurs étaient enregistrés mais lus NULLE PART.
 * Ne restent que les 3 réglages désormais réellement appliqués :
 *   showInSearch   → recherche par nom (ActorSearchService) et carte
 *                    (ActorMapService.vendors) : la boutique n'y apparaît plus ;
 *   showSalesStats → nombre de ventes masqué sur la page boutique publique
 *                    (PublicService, totalOrders) ;
 *   allowFollow    → nouveaux abonnements refusés (SuivisEntrepriseService).
 * Retirés : « améliorer l'algorithme », « statistiques anonymisées »,
 * « rapports avancés » (aucun mécanisme n'existe) et « partager l'adresse
 * exacte » (par défaut coupé : l'appliquer aurait masqué la position de
 * TOUTES les boutiques, à l'opposé de la localisation exacte des boutiques).
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { UpdatePrivacyDto } from '../dto/update-privacy.dto';

const KEYS = ['showInSearch', 'showSalesStats', 'allowFollow'] as const;
type PrivacyKey = typeof KEYS[number];

@Injectable()
export class PrivacyParametresService {

  private readonly logger = new Logger(PrivacyParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /** Réglages effectifs : absents = activés (comportement par défaut de la plateforme). */
  private view(raw: Record<string, boolean> | null): Record<PrivacyKey, boolean> {
    return Object.fromEntries(KEYS.map(k => [k, raw?.[k] !== false])) as Record<PrivacyKey, boolean>;
  }

  async getPrivacy(userId: string): Promise<Record<PrivacyKey, boolean>> {
    const company = await this.findCompanyOrFail(userId);
    return this.view(company.privacySettings);
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacyDto): Promise<Record<PrivacyKey, boolean>> {
    const company = await this.findCompanyOrFail(userId);
    const next = this.view(company.privacySettings);
    for (const k of KEYS) if (typeof dto[k] === 'boolean') next[k] = dto[k] as boolean;
    /* Seule la colonne concernée est écrite (pas toute la fiche — voir le
     * correctif des documents : save() concurrent écrasait d'autres champs). */
    await this.companyRepo.update(company.id, { privacySettings: next });
    this.logger.log(`[PRIVACY] Mis à jour — companyId=${company.id}`);
    return next;
  }

  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
