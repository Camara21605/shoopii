/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/vitesses-livreur.service.ts
 * RÔLE : Section 4 — Vitesses & Tarification
 *   GET   /parametres/vitesses → tarifs + modes activés
 *   PATCH /parametres/vitesses → MAJ tarifs + modes
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { UpdateVitessesDto } from '../dto/livreur-parametres.dto';

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

  async updateVitesses(userId: string, dto: UpdateVitessesDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);
    if (dto.vitessesActives    !== undefined) livreur.vitessesActives    = dto.vitessesActives;
    if (dto.tarifBase          !== undefined) livreur.tarifBase          = dto.tarifBase;
    if (dto.tarifParKm         !== undefined) livreur.tarifParKm         = dto.tarifParKm;
    if (dto.supplementLourd    !== undefined) livreur.supplementLourd    = dto.supplementLourd;
    if (dto.majorationNocturne !== undefined) livreur.majorationNocturne = dto.majorationNocturne;
    const updated = await this.livreurRepo.save(livreur);
    this.logger.log(`[VITESSES] Mis à jour — userId=${userId}`);
    return updated;
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}