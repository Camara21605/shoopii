/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/services/financial-config-history.service.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Lecture en lecture seule de l'historique
 *                des modifications de configuration.
 * RESPONSABILITES :
 *   - Requêter la table configuration_snapshots
 *   - Paginer les résultats
 *   - Trouver un snapshot par section/version pour rollback
 * DEPENDANCES  :
 *   ConfigurationSnapshot (TypeORM)
 * UTILISE PAR  :
 *   FinancialConfigEngine → getHistory, getSnapshot
 *   API admin → affichage de l'historique
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfigurationSnapshot, ConfigSection } from '../../../database/entities/paiement/configuration-snapshot.entity';
import { ConfigHistoryEntry } from '../types/financial-config.types';

/** Paramètres de filtre pour getHistory() */
export interface HistoryFilter {
  section?:          ConfigSection;
  performedByUserId?: string;
  fromDate?:         Date;
  toDate?:           Date;
  limit?:            number;  // défaut 50, max 200
  offset?:           number;
}

@Injectable()
export class FinancialConfigHistoryService {

  constructor(
    @InjectRepository(ConfigurationSnapshot)
    private readonly snapshotRepo: Repository<ConfigurationSnapshot>,
  ) {}

  /* ----------------------------------------------------------
   * getHistory()
   *
   * Retourne les snapshots avec filtrage optionnel, paginés,
   * triés par date décroissante (le plus récent en premier).
   * ---------------------------------------------------------- */
  async getHistory(filter: HistoryFilter = {}): Promise<{
    items: ConfigHistoryEntry[];
    total: number;
  }> {
    const limit  = Math.min(filter.limit  ?? 50, 200);
    const offset = filter.offset ?? 0;

    const qb = this.snapshotRepo
      .createQueryBuilder('s')
      .orderBy('s.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (filter.section) {
      qb.andWhere('s.section = :section', { section: filter.section });
    }
    if (filter.performedByUserId) {
      qb.andWhere('s.performedByUserId = :uid', { uid: filter.performedByUserId });
    }
    if (filter.fromDate) {
      qb.andWhere('s.createdAt >= :from', { from: filter.fromDate });
    }
    if (filter.toDate) {
      qb.andWhere('s.createdAt <= :to', { to: filter.toDate });
    }

    const [raw, total] = await qb.getManyAndCount();
    return { items: raw.map(this._toEntry), total };
  }

  /* ----------------------------------------------------------
   * getSnapshot()
   *
   * Récupère un snapshot précis par section + version.
   * Utilisé avant un rollback pour vérifier que la cible existe.
   * ---------------------------------------------------------- */
  async getSnapshot(section: ConfigSection, version: number): Promise<ConfigHistoryEntry | null> {
    const s = await this.snapshotRepo.findOne({ where: { section, version } });
    return s ? this._toEntry(s) : null;
  }

  /* ----------------------------------------------------------
   * getLatestVersion()
   *
   * Retourne le numéro de la dernière version pour une section.
   * ---------------------------------------------------------- */
  async getLatestVersion(section: ConfigSection): Promise<number> {
    const s = await this.snapshotRepo.findOne({
      where: { section },
      order: { version: 'DESC' },
    });
    return s?.version ?? 0;
  }

  /* ----------------------------------------------------------
   * _toEntry()
   *
   * Convertit un ConfigurationSnapshot en ConfigHistoryEntry.
   * Évite d'exposer directement l'entité TypeORM aux consommateurs.
   * ---------------------------------------------------------- */
  private _toEntry(s: ConfigurationSnapshot): ConfigHistoryEntry {
    return {
      id:                  s.id,
      section:             s.section,
      version:             s.version,
      label:               s.label,
      changedFields:       s.changedFields,
      before:              s.before,
      after:               s.after,
      justification:       s.justification,
      performedByUserId:   s.performedByUserId,
      performedByRole:     s.performedByRole,
      ipAddress:           s.ipAddress,
      isRollback:          s.isRollback,
      rolledBackToVersion: s.rolledBackToVersion,
      createdAt:           s.createdAt,
    };
  }
}
