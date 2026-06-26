/* ============================================================
 * FICHIER : services/zone.service.ts
 * SECTION : §3 — Zone & Horaires
 *
 * Responsabilités :
 *   updateZone()     → zonesActives (JSON) + zoneAutoRules (JSON)
 *   updateHoraires() → remplacement complet du planning 7 jours
 *                      (DELETE + INSERT dans une transaction)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import {
  CorrespondantHoraire,
  JourSemaine,
} from '../../../../database/entities/profiles/correspondant-horaire.entity';
import { User } from '../../../../database/entities/user.entity';
import { UpdateZoneDto, UpdateHorairesDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';

@Injectable()
export class ZoneService extends CorrespondantBaseService {

  private readonly logger = new Logger(ZoneService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,

    @InjectRepository(CorrespondantHoraire)
    private readonly horaireRepo: Repository<CorrespondantHoraire>,

    private readonly dataSource: DataSource,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Met à jour les zones actives et les règles automatiques.
   *
   * zonesActives = JSON array d'IDs ex: ["kaloum", "dixinn"]
   * zoneAutoRules = JSON boolean map ex: { "refusAutoCap": true }
   */
  async updateZone(userId: string, dto: UpdateZoneDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.zonesActives  !== undefined) cor.zonesActives  = dto.zonesActives  ?? null;
    if (dto.zoneAutoRules !== undefined) cor.zoneAutoRules = dto.zoneAutoRules ?? null;

    const updated = await this.corRepo.save(cor);
    this.logger.log(`[ZONE] Zones actives: ${dto.zonesActives?.join(',')} — userId=${userId}`);
    return updated;
  }

  /**
   * Remplace ENTIÈREMENT le planning hebdomadaire.
   * Utilise PUT (pas PATCH) car c'est un remplacement total.
   *
   * Transaction : DELETE tous les anciens horaires du correspondant,
   * puis INSERT les 7 nouveaux. Atomique = pas d'état intermédiaire.
   */
  async updateHoraires(userId: string, dto: UpdateHorairesDto): Promise<CorrespondantHoraire[]> {
    const cor = await this.findCorOrFail(userId);

    return this.dataSource.transaction(async manager => {
      /* Supprimer l'ancien planning */
      await manager.delete(CorrespondantHoraire, { correspondantId: cor.id });

      /* Insérer le nouveau planning */
      const entities = dto.horaires.map(h =>
        manager.create(CorrespondantHoraire, {
          correspondantId: cor.id,
          jour:      h.jour as JourSemaine,
          ouverture: h.ouverture,
          fermeture: h.fermeture,
          actif:     h.actif,
        }),
      );

      const saved = await manager.save(CorrespondantHoraire, entities);
      this.logger.log(`[HORAIRES] ${saved.length} jours enregistrés — userId=${userId}`);
      return saved;
    });
  }
}