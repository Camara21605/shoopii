/* ============================================================
 * FICHIER : src/jobs/support-sla.cron.service.ts
 *
 * RÔLE : Surveiller les tickets de support et envoyer une alerte
 *        par email quand le SLA (délai de réponse) est dépassé.
 *
 * DÉFINITION DU SLA CHEZ SHOPI :
 *   Un ticket viole le SLA si :
 *     - Son statut est OPEN ou IN_PROGRESS
 *     - Aucun agent n'a encore répondu (firstResponseAt IS NULL)
 *     - Le ticket a été créé il y a plus de BREACH_HOURS heures
 *
 * FRÉQUENCE :
 *   La tâche s'exécute toutes les heures (cron: '0 * * * *').
 *   À chaque exécution, on :
 *     1. Cherche les tickets en violation SLA non encore signalés
 *     2. Marque leur champ slaBreachedAt (pour ne pas les re-signaler)
 *     3. Envoie un email d'alerte à l'équipe support (SUPPORT_EMAIL)
 *
 * IMPORTANT — Pas de doublon :
 *   On ne signale un ticket qu'une seule fois :
 *   si slaBreachedAt IS NULL → nouveau dépassement → on envoie l'alerte
 *   si slaBreachedAt IS NOT NULL → déjà signalé → on ignore
 * ============================================================ */

import { Injectable, Logger }           from '@nestjs/common';
import { InjectRepository }             from '@nestjs/typeorm';
import { Repository, IsNull, LessThan, Not } from 'typeorm';
import { Cron }                         from '@nestjs/schedule';
import { ConfigService }                from '@nestjs/config';

import {
  SupportTicket,
  SupportTicketStatus,
} from '../database/entities/support/support-ticket.entity';
import { MailService } from '../modules/email/email.service';

@Injectable()
export class SupportSlaCronService {

  private readonly logger = new Logger(SupportSlaCronService.name);

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,

    /* MailService injecté pour envoyer les alertes email */
    private readonly mailService: MailService,

    /* ConfigService pour lire SLA_BREACH_HOURS, SUPPORT_EMAIL, FRONTEND_URL.
     * SLA_BREACH_HOURS est configurable par environnement :
     *   - Production : peut varier selon le niveau de service (4h, 8h, 24h).
     *   - Staging/dev : valeur courte (ex: 1h) pour tester sans attendre.
     * Défaut : 24h si la variable est absente (comportement antérieur). */
    private readonly config: ConfigService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * checkSlaBreaches()
   *
   * Tâche cron exécutée automatiquement toutes les heures.
   * Expression cron : '0 * * * *'
   *   → 0 minute, * heure, * jour, * mois, * jour semaine
   *   → Se déclenche à xx:00 chaque heure.
   *
   * On utilise CronExpression.EVERY_HOUR (constante NestJS)
   * qui vaut '0 * * * *'.
   * ────────────────────────────────────────────────────────── */
  @Cron('0 * * * *')
  async checkSlaBreaches(): Promise<void> {

    /* Lire le seuil depuis l'environnement à chaque exécution du cron,
     * pas seulement au démarrage — permet de modifier sans redéploiement. */
    const BREACH_HOURS = this.config.get<number>('SLA_BREACH_HOURS', 24);

    this.logger.log(`[SLA] Vérification des violations SLA (seuil: ${BREACH_HOURS}h)…`);

    const slaThreshold = new Date();
    slaThreshold.setHours(slaThreshold.getHours() - BREACH_HOURS);

    /* ── Récupération des tickets en violation ──────────────
     *
     * Conditions :
     *  1. status IN (OPEN, IN_PROGRESS) → ticket actif
     *  2. firstResponseAt IS NULL        → aucun agent n'a répondu
     *  3. slaBreachedAt IS NULL          → non encore signalé
     *  4. createdAt < slaThreshold       → créé il y a > 24h
     * ─────────────────────────────────────────────────────── */
    const breachedTickets = await this.ticketRepo.find({
      where: [
        {
          status:          SupportTicketStatus.OPEN,
          firstResponseAt: IsNull(),
          slaBreachedAt:   IsNull(),
          createdAt:       LessThan(slaThreshold),
        },
        {
          status:          SupportTicketStatus.IN_PROGRESS,
          firstResponseAt: IsNull(),
          slaBreachedAt:   IsNull(),
          createdAt:       LessThan(slaThreshold),
        },
      ],
      take: 50, // limite pour éviter une surcharge accidentelle
    });

    if (breachedTickets.length === 0) {
      this.logger.log('[SLA] ✅ Aucune violation détectée.');
      return;
    }

    this.logger.warn(`[SLA] ⚠️  ${breachedTickets.length} ticket(s) en violation SLA !`);

    /* ── Marquer les tickets comme signalés ─────────────────
     * On met à jour slaBreachedAt AVANT d'envoyer l'email pour
     * éviter un double envoi si le process redémarre entre-temps.
     * ─────────────────────────────────────────────────────── */
    const ids       = breachedTickets.map(t => t.id);
    const nowStamp  = new Date();

    await this.ticketRepo
      .createQueryBuilder()
      .update(SupportTicket)
      .set({ slaBreachedAt: nowStamp })
      .whereInIds(ids)
      .execute();

    /* ── Envoi de l'email d'alerte ──────────────────────────
     * On envoie un seul email récapitulatif (pas un email par ticket)
     * pour ne pas spammer l'équipe support.
     * ─────────────────────────────────────────────────────── */
    const supportEmail  = this.config.get<string>('SUPPORT_EMAIL', 'support@shopi.gn');
    const frontendUrl   = this.config.get<string>('FRONTEND_URL',  'https://shopi.gn');

    /* Construction du tableau HTML des tickets en retard */
    const ticketRows = breachedTickets.map(t => {
      const hours = Math.round(
        (nowStamp.getTime() - t.createdAt.getTime()) / 3_600_000,
      );
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5ebf5;">${t.reference}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5ebf5;">${t.type}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5ebf5;">${t.subject}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5ebf5;color:#dc2626;font-weight:700;">${hours}h</td>
      </tr>`;
    }).join('');

    try {
      /* On réutilise sendContactEmail en mode alerte interne */
      await this.mailService.sendContactEmail({
        toEmail:  supportEmail,
        toName:   'Équipe Support Shopi',
        fromName: 'Système SLA Shopi',
        sujet:    `⚠️ ${breachedTickets.length} ticket(s) SLA dépassé(s) (>${BREACH_HOURS}h) — action requise`,
        message:  `
          <h2 style="color:#dc2626;margin:0 0 16px;">Alerte SLA Support</h2>
          <p style="color:#475569;">${breachedTickets.length} ticket(s) n'ont pas reçu de réponse depuis plus de ${BREACH_HOURS} heures.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr style="background:#f8faff;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9aaacb;text-transform:uppercase;">Référence</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9aaacb;text-transform:uppercase;">Type</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9aaacb;text-transform:uppercase;">Sujet</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#9aaacb;text-transform:uppercase;">Délai</th>
              </tr>
            </thead>
            <tbody>${ticketRows}</tbody>
          </table>
          <p style="margin-top:20px;">
            <a href="${frontendUrl}/support" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;">
              Traiter les tickets →
            </a>
          </p>
        `,
      });

      this.logger.warn(`[SLA] 📧 Alerte email envoyée à ${supportEmail} pour ${breachedTickets.length} ticket(s).`);
    } catch (emailError) {
      /* L'échec d'email ne doit pas faire rater la tâche cron entière.
       * On log l'erreur pour investigation mais on n'interrompt pas. */
      this.logger.error(`[SLA] ❌ Échec envoi email alerte : ${emailError}`);
    }
  }
}
