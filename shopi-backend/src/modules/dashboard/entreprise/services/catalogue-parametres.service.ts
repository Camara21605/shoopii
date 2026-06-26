/*
 * FICHIER : src/modules/dashboard/entreprise/services/catalogue-parametres.service.ts
 * ✅ CORRIGÉ : devise peut être null (venant du DTO) — on l'ignore si null
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { UpdateCatalogueDto } from '../dto/update-catalogue.dto';

@Injectable()
export class CatalogueParametresService {

  private readonly logger = new Logger(CatalogueParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async updateCatalogue(userId: string, dto: UpdateCatalogueDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    if (dto.showOutOfStock  !== undefined) company.showOutOfStock  = dto.showOutOfStock;
    if (dto.autoPublish     !== undefined) company.autoPublish     = dto.autoPublish;
    if (dto.showStrikePrice !== undefined) company.showStrikePrice = dto.showStrikePrice;
    if (dto.allowReviews    !== undefined) company.allowReviews    = dto.allowReviews;

    // ✅ CORRIGÉ : on n'assigne que si la valeur est une vraie string (pas null)
    if (dto.devise !== undefined && dto.devise !== null) {
      company.devise = dto.devise;
    }

    if (dto.returnPolicy    !== undefined) company.returnPolicy    = dto.returnPolicy ?? null;

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[CATALOGUE] Mis à jour — userId=${userId}`);
    return updated;
  }

  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}