/* ============================================================
 * FICHIER : src/jobs/expiry-cron.service.ts
 * RÔLE    : Tâche cron qui expire automatiquement les codes
 *           d'invitation périmés.
 *
 * Fréquence : toutes les heures (configurable).
 * Dépendance : @nestjs/schedule + CodeCreationService.
 *
 * Installation requise :
 *   npm install @nestjs/schedule
 *   npm install --save-dev @types/cron
 *
 * Activation : importer ScheduleModule.forRoot() dans AppModule.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CodeCreationService } from '../modules/auth/code-creation/code-creation.service';

@Injectable()
export class ExpiryCronService {
  private readonly logger = new Logger(ExpiryCronService.name);

  constructor(private readonly codeCreationService: CodeCreationService) {}

  /**
   * runExpiry()
   * Déclenché automatiquement toutes les heures.
   * Passe tous les codes PENDING dont la date d'expiration est dépassée
   * au statut EXPIRED — en une seule requête UPDATE en base.
   *
   * En complément, syncExpiredInList() dans CodeCreationService
   * corrige les codes au fil des lectures (lazy expiration),
   * mais ce cron garantit la cohérence même sans lecture.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runExpiry(): Promise<void> {
    this.logger.log('[CRON] Vérification des codes d\'invitation expirés…');

    try {
      const count = await this.codeCreationService.expireOutdatedCodes();

      if (count > 0) {
        this.logger.log(`[CRON ✅] ${count} code(s) passé(s) au statut EXPIRED.`);
      } else {
        this.logger.debug('[CRON] Aucun code expiré trouvé.');
      }
    } catch (err) {
      this.logger.error(`[CRON ❌] Erreur expiration codes : ${(err as Error).message}`);
    }
  }
}