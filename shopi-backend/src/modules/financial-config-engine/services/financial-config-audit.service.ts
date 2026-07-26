/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/services/financial-config-audit.service.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Journalisation des modifications de configuration
 *                dans FinancialAuditLog (piste d'audit légale).
 * RESPONSABILITES :
 *   - Créer une entrée FinancialAuditLog pour chaque modification
 *   - Opérer exclusivement en fire-and-forget (setImmediate)
 *   - Ne jamais lever d'exception — absorber silencieusement les erreurs
 * DEPENDANCES  :
 *   FinancialAuditLog (TypeORM)
 *   FinancialEventType, FinancialAuditSeverity
 * UTILISE PAR  :
 *   FinancialConfigWriterService → appelle logConfigUpdate() en fire-and-forget
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  FinancialAuditLog,
  FinancialEventType,
  FinancialAuditSeverity,
} from '../../../database/entities/paiement/financial-audit-log.entity';

import { ConfigSection } from '../../../database/entities/paiement/configuration-snapshot.entity';

/** Paramètres d'une entrée d'audit de configuration */
export interface ConfigAuditParams {
  section:           ConfigSection;
  snapshotId:        string;
  version:           number;
  changedFields:     string[];
  before:            Record<string, unknown>;
  after:             Record<string, unknown>;
  justification:     string;
  performedByUserId: string | null;
  performedByRole:   string | null;
  ipAddress:         string | null;
}

@Injectable()
export class FinancialConfigAuditService {

  constructor(
    @InjectRepository(FinancialAuditLog)
    private readonly auditRepo: Repository<FinancialAuditLog>,
  ) {}

  /* ----------------------------------------------------------
   * logConfigUpdate()
   *
   * Crée une entrée FinancialAuditLog pour une modification
   * de paramètre financier.
   *
   * Severité = HIGH si la section COMMISSION est modifiée
   * (impact direct sur tous les paiements futurs),
   * NORMAL pour les autres sections.
   *
   * Appelé via setImmediate() par FinancialConfigWriterService —
   * ne doit jamais interrompre le flux principal.
   * ---------------------------------------------------------- */
  async logConfigUpdate(params: ConfigAuditParams): Promise<void> {
    try {
      const severity = params.section === ConfigSection.COMMISSION
        ? FinancialAuditSeverity.HIGH
        : FinancialAuditSeverity.NORMAL;

      const entry = this.auditRepo.create({
        eventType:    FinancialEventType.PLATFORM_SETTINGS_CHANGED,
        severity,
        actorUserId:  params.performedByUserId,
        actorRole:    params.performedByRole,
        commandeId:   null,
        walletId:     null,
        sessionId:    null,
        distributionId: null,
        montant:      null,
        devise:       'GNF',
        entityType:   'PlatformSettings',
        entityId:     params.snapshotId,
        before:       params.before,
        after:        params.after,
        metadata: {
          section:       params.section,
          version:       params.version,
          changedFields: params.changedFields,
          justification: params.justification,
          snapshotId:    params.snapshotId,
        },
        ipAddress:    params.ipAddress,
        userAgent:    null,
      });

      await this.auditRepo.save(entry);
    } catch {
      /* L'audit ne doit jamais interrompre la requête principale */
    }
  }
}
