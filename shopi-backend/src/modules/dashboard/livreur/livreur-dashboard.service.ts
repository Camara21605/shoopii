/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/livreur-dashboard.service.ts
 *
 * RÔLE : Stats & données overview du dashboard livreur.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';

@Injectable()
export class LivreurDashboardService {

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,
  ) {}

  async getStats(userId: string) {
    const livreur = await this.livreurRepo.findOne({ where: { userId } });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');

    return {
      totalDeliveries: livreur.totalDeliveries,
      totalEarnings:   livreur.totalEarnings,
      averageRating:   livreur.averageRating,
      status:          livreur.status,
      verificationStatus: livreur.verificationStatus,
    };
  }

  async getMissions(userId: string) {
    // TODO : brancher sur la table commandes/livraisons
    // Pour l'instant retourne un tableau vide
    return { active: [], recent: [] };
  }
}