/* ============================================================
 * FICHIER : services/confidentialite.service.ts
 * SECTION : §10 — Confidentialité
 *
 * Responsabilités :
 *   updateConfidentialite() → privacySettings (JSON structuré)
 *
 * Structure JSON attendue :
 * {
 *   visibilite: { afficherStats, afficherTelephone, apparaitreRecherche, partagerLocalisation },
 *   donnees:    { ameliorerAlgo, statsAnonymisees, rapportsPerso }
 * }
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }          from '../../../../database/entities/user.entity';
import { UpdateConfidentialiteDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';

/**
 * Réglages de visibilité du correspondant (Paramètres > Confidentialité → privacySettings.visibilite).
 * Absent = activé. Lu partout où le correspondant est visible publiquement (profil, liste,
 * recherche, carte — voir ActorMapService).
 */
export interface VisibiliteCorrespondant {
  afficherStats: boolean; afficherTelephone: boolean; apparaitreRecherche: boolean; partagerLocalisation: boolean;
}
export function lireVisibiliteCorrespondant(ps: unknown): VisibiliteCorrespondant {
  const v = ((ps as { visibilite?: Record<string, unknown> } | null)?.visibilite) ?? {};
  return {
    afficherStats:        v.afficherStats        !== false,
    afficherTelephone:    v.afficherTelephone    !== false,
    apparaitreRecherche:  v.apparaitreRecherche  !== false,
    partagerLocalisation: v.partagerLocalisation !== false,
  };
}

@Injectable()
export class ConfidentialiteService extends CorrespondantBaseService {

  private readonly logger = new Logger(ConfidentialiteService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Met à jour les paramètres de confidentialité et de partage.
   * Le JSON complet est remplacé à chaque appel.
   */
  async updateConfidentialite(userId: string, dto: UpdateConfidentialiteDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.privacySettings !== undefined) cor.privacySettings = dto.privacySettings ?? null;

    const updated = await this.enregistrer(cor, ['privacySettings']);
    this.logger.log(`[CONFIDENTIALITE] Paramètres mis à jour — userId=${userId}`);
    return updated;
  }
}