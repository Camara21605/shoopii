/* ============================================================
 * FICHIER : src/jobs/expiry-cron.service.ts
 *
 * TÂCHES CRON :
 *   1. Chaque heure  → expire les codes d'invitation périmés
 *   2. Chaque jour   → réactive automatiquement les comptes
 *                      livreur et entreprise dont suspendedUntil ≤ maintenant
 * ============================================================ */

import { Injectable, Logger }   from '@nestjs/common';
import { InjectRepository }     from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CodeCreationService } from '../modules/auth/code-creation/code-creation.service';
import { Delivery, DeliveryStatus } from '../database/entities/profiles/livreur-profile.entity';
import { Company, CompanyStatus }   from '../database/entities/profiles/entreprise-profile.entity';

@Injectable()
export class ExpiryCronService {

  private readonly logger = new Logger(ExpiryCronService.name);

  constructor(
    private readonly codeCreationService: CodeCreationService,
    @InjectRepository(Delivery) private readonly livreurRepo:  Repository<Delivery>,
    @InjectRepository(Company)  private readonly companyRepo:  Repository<Company>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * CRON 1 — Expire les codes d'invitation périmés
   * Fréquence : toutes les heures
   * ────────────────────────────────────────────────────────── */
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

  /* ──────────────────────────────────────────────────────────
   * CRON 2 — Réactive automatiquement les comptes désactivés (J+30)
   * Fréquence : tous les jours à 02h00 (heure serveur)
   *
   * Logique :
   *   - Cherche les Delivery avec status=SUSPENDED ET suspendedUntil ≤ now
   *   - Cherche les Company  avec status=SUSPENDED ET suspendedUntil ≤ now
   *   - Remet status=ACTIVE et efface suspendedUntil
   * ────────────────────────────────────────────────────────── */
  @Cron('0 2 * * *')
  async runAutoReactivation(): Promise<void> {
    this.logger.log('[CRON] Vérification des réactivations automatiques J+30…');
    const now = new Date();

    try {
      /* ── Livreurs ── */
      const expiredLivreurs = await this.livreurRepo.find({
        where: {
          status:         DeliveryStatus.SUSPENDED,
          suspendedUntil: Not(IsNull()) && LessThanOrEqual(now) as any,
        },
        select: ['id', 'suspendedUntil'],
      });

      if (expiredLivreurs.length > 0) {
        await this.livreurRepo
          .createQueryBuilder()
          .update(Delivery)
          .set({ status: DeliveryStatus.ACTIVE, suspendedUntil: null })
          .where('status = :s', { s: DeliveryStatus.SUSPENDED })
          .andWhere('suspendedUntil IS NOT NULL')
          .andWhere('suspendedUntil <= :now', { now })
          .execute();

        this.logger.log(`[CRON ✅] ${expiredLivreurs.length} livreur(s) réactivé(s) automatiquement.`);
      }

      /* ── Entreprises ── */
      const expiredCompanies = await this.companyRepo.find({
        where: {
          status:         CompanyStatus.SUSPENDED,
          suspendedUntil: Not(IsNull()) && LessThanOrEqual(now) as any,
        },
        select: ['id', 'suspendedUntil'],
      });

      if (expiredCompanies.length > 0) {
        await this.companyRepo
          .createQueryBuilder()
          .update(Company)
          .set({ status: CompanyStatus.ACTIVE, suspendedUntil: null })
          .where('status = :s', { s: CompanyStatus.SUSPENDED })
          .andWhere('suspendedUntil IS NOT NULL')
          .andWhere('suspendedUntil <= :now', { now })
          .execute();

        this.logger.log(`[CRON ✅] ${expiredCompanies.length} entreprise(s) réactivée(s) automatiquement.`);
      }

      if (expiredLivreurs.length === 0 && expiredCompanies.length === 0) {
        this.logger.debug('[CRON] Aucune réactivation automatique nécessaire.');
      }

    } catch (err) {
      this.logger.error(`[CRON ❌] Erreur réactivation automatique : ${(err as Error).message}`);
    }
  }
}
