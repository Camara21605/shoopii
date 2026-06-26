/* ============================================================
 * FICHIER : services/depot.service.ts
 * SECTION : §2 — Point de dépôt
 *
 * Responsabilités :
 *   updateDepot() → met à jour tous les champs depotXxx
 *                   + depotAccessOptions (JSON boolean map)
 *
 * Note : depotPhone ≠ User.phone
 *   depotPhone = numéro public du relais affiché aux clients
 *   User.phone = numéro personnel / Orange Money
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }          from '../../../../database/entities/user.entity';
import { UpdateDepotDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';

@Injectable()
export class DepotService extends CorrespondantBaseService {

  private readonly logger = new Logger(DepotService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Met à jour les informations du point de dépôt physique.
   * Tous les champs depotXxx sont dans l'entité Correspondent.
   *
   * Stratégie PATCH : seuls les champs présents dans le DTO
   * sont modifiés (les autres restent inchangés).
   */
  async updateDepot(userId: string, dto: UpdateDepotDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.depotNom           !== undefined) cor.depotNom           = dto.depotNom           ?? null;
    if (dto.depotAdresse       !== undefined) cor.depotAdresse       = dto.depotAdresse       ?? null;
    if (dto.depotCommune       !== undefined) cor.depotCommune       = dto.depotCommune       ?? null;
    if (dto.depotVille         !== undefined) cor.depotVille         = dto.depotVille         ?? null;
    if (dto.depotRepere        !== undefined) cor.depotRepere        = dto.depotRepere        ?? null;
    if (dto.depotPhone         !== undefined) cor.depotPhone         = dto.depotPhone         ?? null;
    if (dto.depotCapacite      !== undefined) cor.depotCapacite      = dto.depotCapacite      ?? null;
    if (dto.depotTypeLocal     !== undefined) cor.depotTypeLocal     = dto.depotTypeLocal     ?? null;
    if (dto.depotAcces         !== undefined) cor.depotAcces         = dto.depotAcces         ?? null;
    if (dto.depotAccessOptions !== undefined) cor.depotAccessOptions = dto.depotAccessOptions ?? null;

    const updated = await this.corRepo.save(cor);
    this.logger.log(`[DEPOT] Mis à jour — userId=${userId} commune=${cor.depotCommune}`);
    return updated;
  }
}