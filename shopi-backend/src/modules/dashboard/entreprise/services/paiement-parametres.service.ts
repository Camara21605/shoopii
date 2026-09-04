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