/* ============================================================
 * FICHIER : services/paiement.service.ts
 * SECTION : §6 — Paiement & Commissions
 *
 * Responsabilités :
 *   updatePaiement() → paiementMethodes (JSON), virementFrequence, virementSeuil
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }          from '../../../../database/entities/user.entity';
import { UpdatePaiementDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';

@Injectable()
export class PaiementService extends CorrespondantBaseService {

  private readonly logger = new Logger(PaiementService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Met à jour les méthodes de paiement et la fréquence des virements.
   *
   * paiementMethodes = JSON array d'objets
   *   ex: [{ "em":"🏦", "nm":"Orange Money", "sub":"+224 622…", "def":true }]
   *
   * virementSeuil = montant minimum en GNF pour déclencher un virement auto
   */
  async updatePaiement(userId: string, dto: UpdatePaiementDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.paiementMethodes  !== undefined) cor.paiementMethodes  = dto.paiementMethodes  ?? null;
    if (dto.virementFrequence !== undefined) cor.virementFrequence = dto.virementFrequence;
    if (dto.virementSeuil     !== undefined) cor.virementSeuil     = dto.virementSeuil;

    const updated = await this.corRepo.save(cor);
    this.logger.log(
      `[PAIEMENT] Mis à jour — userId=${userId} freq=${cor.virementFrequence} seuil=${cor.virementSeuil}`,
    );
    return updated;
  }
}