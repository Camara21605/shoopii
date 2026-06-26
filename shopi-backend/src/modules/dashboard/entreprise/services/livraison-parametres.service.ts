/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/livraison-parametres.service.ts
 *
 * RÔLE : Gère les méthodes et zones de livraison (section 5)
 *   PATCH /parametres/livraison → toggles méthodes + zones JSON
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { UpdateLivraisonDto } from '../dto/update-livraison.dto';

@Injectable()
export class LivraisonParametresService {

  private readonly logger = new Logger(LivraisonParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre à jour les méthodes et zones (section 5)
   * ────────────────────────────────────────────────────────── */

  async updateLivraison(userId: string, dto: UpdateLivraisonDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    if (dto.livraisonStandard !== undefined) company.livraisonStandard = dto.livraisonStandard;
    if (dto.livraisonShopi    !== undefined) company.livraisonShopi    = dto.livraisonShopi;
    if (dto.livraisonCorresp  !== undefined) company.livraisonCorresp  = dto.livraisonCorresp;
    if (dto.clickCollect      !== undefined) company.clickCollect      = dto.clickCollect;
    if (dto.livraisonExpress  !== undefined) company.livraisonExpress  = dto.livraisonExpress;
    if (dto.zonesLivraison    !== undefined) company.zonesLivraison    = dto.zonesLivraison;

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[LIVRAISON] Mis à jour — userId=${userId}`);

    return updated;
  }

  /* ── HELPER ── */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
