/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/paiement-livreur.service.ts
 * ✅ CORRIGÉ : virementFrequence est non-nullable → skip si null
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { UpdatePaiementLivreurDto } from '../dto/livreur-parametres.dto';
import { masquerDocuments } from './zone-livreur.service';

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

  /* Plus appelé par l'écran (fréquence / seuil de virement : aucun virement
   * automatique n'existe) mais la route reste : seules ses colonnes sont écrites
   * (avant : `save()` de toute la fiche) et les pièces d'identité sont masquées. */
  async updatePaiement(userId: string, dto: UpdatePaiementLivreurDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);
    const patch: Partial<Delivery> = {};
    if (dto.methodesRetrait !== undefined) patch.methodesRetrait = dto.methodesRetrait ?? null;
    if (dto.virementFrequence !== undefined && dto.virementFrequence !== null) patch.virementFrequence = dto.virementFrequence;
    if (dto.virementSeuil !== undefined) patch.virementSeuil = dto.virementSeuil;
    if (Object.keys(patch).length) await this.livreurRepo.update({ id: livreur.id }, patch as any);
    this.logger.log(`[PAIEMENT] Mis à jour — userId=${userId}`);
    return masquerDocuments(await this.findOrFail(userId));
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}