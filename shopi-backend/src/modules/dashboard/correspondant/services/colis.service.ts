/* ============================================================
 * FICHIER : services/colis.service.ts
 * SECTION : §5 — Gestion des colis
 *
 * Responsabilités :
 *   updateColis() → colisDelaiMax, colisCapaciteMax, colisValeurMax,
 *                   colisPoids, colisTypesAcceptes, colisIncidentRules
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }          from '../../../../database/entities/user.entity';
import { UpdateColisDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';

@Injectable()
export class ColisService extends CorrespondantBaseService {

  private readonly logger = new Logger(ColisService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Met à jour les règles de dépôt et de gestion des colis.
   *
   * colisTypesAcceptes = array d'indices (référence COLIS_TYPES côté frontend)
   * colisIncidentRules = JSON boolean map
   *   ex: { "retourAuto7j": true, "photoObligatoire": true }
   */
  async updateColis(userId: string, dto: UpdateColisDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.colisDelaiMax      !== undefined) cor.colisDelaiMax      = dto.colisDelaiMax;
    if (dto.colisCapaciteMax   !== undefined) cor.colisCapaciteMax   = dto.colisCapaciteMax;
    if (dto.colisValeurMax     !== undefined) cor.colisValeurMax     = dto.colisValeurMax;
    if (dto.colisPoids         !== undefined) cor.colisPoids         = dto.colisPoids         ?? null;
    if (dto.colisTypesAcceptes !== undefined) cor.colisTypesAcceptes = dto.colisTypesAcceptes ?? null;
    if (dto.colisIncidentRules !== undefined) cor.colisIncidentRules = dto.colisIncidentRules ?? null;

    const updated = await this.corRepo.save(cor);
    this.logger.log(
      `[COLIS] Mis à jour — userId=${userId} delai=${cor.colisDelaiMax}j cap=${cor.colisCapaciteMax}`,
    );
    return updated;
  }
}