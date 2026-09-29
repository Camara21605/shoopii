/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/vitesses-livreur.service.ts
 * RÔLE : Section 4 — Vitesses & Tarification
 *   GET   /parametres/vitesses → tarifs + modes activés
 *   (PATCH retiré : un livreur ne fixe plus lui-même ses tarifs — voir le contrôleur)
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';

/* Multiplicateurs Shopi par mode (lecture seule, pas en BDD) */
export const SPEED_MULTIPLIERS = { eco: 1.0, standard: 1.3, express: 1.8, ultra: 2.5 };

@Injectable()
export class VitessesLivreurService {

  private readonly logger = new Logger(VitessesLivreurService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,
  ) {}

  async getVitesses(userId: string) {
    const livreur = await this.findOrFail(userId);
    return {
      vitessesActives: livreur.vitessesActives ?? { eco:true, standard:true, express:true, ultra:false },
      tarifBase:           livreur.tarifBase,
      tarifParKm:          livreur.tarifParKm,
      supplementLourd:     livreur.supplementLourd,
      majorationNocturne:  livreur.majorationNocturne,
      multiplicateurs:     SPEED_MULTIPLIERS, // lecture seule, défini par Shopi
    };
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}