/* ============================================================
 * FICHIER : src/modules/settlement-engine/services/settlement-scheduler.service.ts
 *
 * RÔLE    : Déclenchement automatique des batches de settlement.
 *
 * PLANIFICATIONS :
 *   - QUOTIDIEN   : tous les jours à 02h00 (UTC)
 *   - HEBDOMADAIRE: lundi à 03h00 (UTC)
 *
 * NOTE : ScheduleModule.forRoot() est déjà activé dans JobsModule.
 *        Ce service utilise juste @Cron sans re-déclarer forRoot().
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Retrait }          from '../../../database/entities/paiement/retrait.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { SettlementFrequence } from '../../../database/entities/paiement/settlement-batch.entity';

import { PayoutManagerService }    from './payout-manager.service';
import { SettlementHistoryService } from './settlement-history.service';

@Injectable()
export class SettlementSchedulerService {

  private readonly logger = new Logger(SettlementSchedulerService.name);

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    private readonly payoutManager:   PayoutManagerService,
    private readonly historyService:  SettlementHistoryService,
  ) {}

  /** Batch quotidien — 02h00 UTC chaque nuit. */
  @Cron('0 2 * * *', { name: 'settlement-daily' })
  async lancerBatchQuotidien(): Promise<void> {
    this.logger.log('[Scheduler] Déclenchement batch quotidien');
    await this._lancerBatch(SettlementFrequence.QUOTIDIEN);
  }

  /** Batch hebdomadaire — lundi 03h00 UTC. */
  @Cron('0 3 * * 1', { name: 'settlement-weekly' })
  async lancerBatchHebdomadaire(): Promise<void> {
    this.logger.log('[Scheduler] Déclenchement batch hebdomadaire');
    await this._lancerBatch(SettlementFrequence.HEBDOMADAIRE);
  }

  /**
   * Exécution manuelle déclenchée par un admin ou un événement.
   * Utilisée pour les retraits immédiats et les déclenchements API.
   */
  async lancerBatchManuel(triggeredByUserId?: string): Promise<void> {
    this.logger.log(`[Scheduler] Batch manuel déclenché par userId=${triggeredByUserId ?? 'SYSTEM'}`);
    await this._lancerBatch(SettlementFrequence.MANUEL, triggeredByUserId);
  }

  /**
   * Traite immédiatement un retrait individuel (mode immédiat).
   */
  async traiterImmediatement(retraitId: string, triggeredByUserId?: string): Promise<void> {
    this.logger.log(`[Scheduler] Traitement immédiat retrait ${retraitId}`);
    try {
      await this.payoutManager.executerPayout({ retraitId, triggeredByUserId });
    } catch (err) {
      this.logger.error(`[Scheduler] Erreur traitement immédiat ${retraitId} : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _lancerBatch(
    frequence: SettlementFrequence,
    triggeredByUserId?: string,
  ): Promise<void> {
    try {
      const retraits = await this.historyService.getRetraitsPending();

      if (retraits.length === 0) {
        this.logger.log(`[Scheduler] Aucun retrait PENDING — batch ${frequence} ignoré`);
        return;
      }

      this.logger.log(`[Scheduler] Batch ${frequence} — ${retraits.length} retraits à traiter`);
      const batch = await this.payoutManager.executerBatch({ frequence, triggeredByUserId }, retraits);
      this.logger.log(`[Scheduler] Batch ${batch.reference} terminé : ${batch.nbCompleted} succès, ${batch.nbFailed} échecs`);

    } catch (err) {
      this.logger.error(`[Scheduler] Erreur batch ${frequence} : ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
