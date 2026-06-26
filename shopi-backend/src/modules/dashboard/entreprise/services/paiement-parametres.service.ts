/*
 * FICHIER : src/modules/dashboard/entreprise/services/paiement-parametres.service.ts
 * ✅ CORRIGÉ : payoutFrequency et receptionMethod peuvent être null — on les ignore si null
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { UpdatePaiementDto } from '../dto/update-paiement.dto';

@Injectable()
export class PaiementParametresService {

  private readonly logger = new Logger(PaiementParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async updatePaiement(userId: string, dto: UpdatePaiementDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    if (dto.paymentMethods  !== undefined) company.paymentMethods  = dto.paymentMethods ?? null;

    // ✅ CORRIGÉ : on n'assigne que si c'est une vraie string (pas null)
    // null signifie que l'utilisateur a vidé le champ — on garde l'ancienne valeur
    if (dto.receptionMethod  !== undefined && dto.receptionMethod  !== null) {
      company.receptionMethod = dto.receptionMethod;
    }
    if (dto.payoutFrequency  !== undefined && dto.payoutFrequency  !== null) {
      company.payoutFrequency = dto.payoutFrequency;
    }

    if (dto.receptionNumber  !== undefined) company.receptionNumber  = dto.receptionNumber ?? null;
    if (dto.payoutMinAmount  !== undefined) company.payoutMinAmount  = dto.payoutMinAmount;
    if (dto.nif              !== undefined) company.nif              = dto.nif ?? null;
    if (dto.rccm             !== undefined) company.rccm             = dto.rccm ?? null;
    if (dto.raisonSociale    !== undefined) company.raisonSociale    = dto.raisonSociale ?? null;

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[PAIEMENT] Mis à jour — userId=${userId}`);
    return updated;
  }

  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}