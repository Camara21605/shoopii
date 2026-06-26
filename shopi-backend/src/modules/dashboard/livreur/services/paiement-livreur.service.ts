/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/paiement-livreur.service.ts
 * ✅ CORRIGÉ : virementFrequence est non-nullable → skip si null
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { UpdatePaiementLivreurDto } from '../dto/livreur-parametres.dto';

@Injectable()
export class PaiementLivreurService {

  private readonly logger = new Logger(PaiementLivreurService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,
  ) {}

  async getPaiement(userId: string) {
    const livreur = await this.findOrFail(userId);
    return {
      methodesRetrait:   livreur.methodesRetrait,
      virementFrequence: livreur.virementFrequence,
      virementSeuil:     livreur.virementSeuil,
      soldeWallet:       livreur.totalEarnings ?? 0,
    };
  }

  async updatePaiement(userId: string, dto: UpdatePaiementLivreurDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);

    if (dto.methodesRetrait !== undefined) {
      livreur.methodesRetrait = dto.methodesRetrait ?? null;
    }
    // ✅ virementFrequence est non-nullable → on n'assigne que si non-null
    if (dto.virementFrequence !== undefined && dto.virementFrequence !== null) {
      livreur.virementFrequence = dto.virementFrequence;
    }
    if (dto.virementSeuil !== undefined) {
      livreur.virementSeuil = dto.virementSeuil;
    }

    const updated = await this.livreurRepo.save(livreur);
    this.logger.log(`[PAIEMENT] Mis à jour — userId=${userId}`);
    return updated;
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}