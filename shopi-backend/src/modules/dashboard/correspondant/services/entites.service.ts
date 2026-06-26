/* ============================================================
 * FICHIER : services/entites.service.ts
 * SECTION : §4 — Entités partenaires
 *
 * Responsabilités :
 *   getCodes()        → retourne les codes actuels + stats
 *   regenererCode()   → génère un nouveau code (boutique ou livreur)
 *   updateEntites()   → colabSettings (JSON boolean map)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }          from '../../../../database/entities/user.entity';
import { UpdateEntitesDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';

@Injectable()
export class EntitesService extends CorrespondantBaseService {

  private readonly logger = new Logger(EntitesService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Retourne les codes d'invitation actuels avec leur statut.
   * Utilisé par le frontend pour afficher les codes dans SecEntites.
   */
  async getCodes(userId: string) {
    const cor = await this.findCorOrFail(userId);
    return {
      boutique: {
        code:   cor.codeBoutique,
        expiry: cor.codeBoutiqueExpiry,
        usages: cor.codeBoutiqueUsages,
        max:    cor.codeBoutiqueMax,
      },
      livreur: {
        code:   cor.codeLivreur,
        expiry: cor.codeLivreurExpiry,
        usages: cor.codeLivreurUsages,
        max:    cor.codeLivreurMax,
      },
    };
  }

  /**
   * Régénère un code d'invitation (boutique ou livreur).
   *
   * Comportement :
   *   - Génère un code unique au format PREFIX-XX9
   *   - Expire dans 90 jours
   *   - Remet le compteur d'usages à 0
   *
   * type = 'boutique' → met à jour codeBoutique
   * type = 'livreur'  → met à jour codeLivreur
   */
  async regenererCode(
    userId: string,
    type: 'boutique' | 'livreur',
  ): Promise<{ code: string; expiry: Date; max: number }> {
    const cor    = await this.findCorOrFail(userId);
    const code   = this.genCode(type === 'boutique' ? 'COR' : 'LVR', cor.id);
    const expiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // +90 jours

    if (type === 'boutique') {
      cor.codeBoutique = code; cor.codeBoutiqueExpiry = expiry; cor.codeBoutiqueUsages = 0;
    } else {
      cor.codeLivreur  = code; cor.codeLivreurExpiry  = expiry; cor.codeLivreurUsages  = 0;
    }

    await this.corRepo.save(cor);
    this.logger.log(`[CODE] ${type} régénéré "${code}" — userId=${userId}`);

    return { code, expiry, max: type === 'boutique' ? cor.codeBoutiqueMax : cor.codeLivreurMax };
  }

  /**
   * Met à jour les paramètres de collaboration.
   * colabSettings = JSON boolean map
   * ex: { "autoAssigner": true, "notifierBoutique": true }
   */
  async updateEntites(userId: string, dto: UpdateEntitesDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.colabSettings !== undefined) cor.colabSettings = dto.colabSettings ?? null;

    return this.corRepo.save(cor);
  }

  /** Génère un code unique court ex: COR-AB7 */
  private genCode(prefix: string, corId: string): string {
    const initiales = corId.replace(/-/g, '').slice(0, 2).toUpperCase();
    const num       = Math.floor(Math.random() * 10);
    return `${prefix}-${initiales}${num}`;
  }
}