/* ============================================================
 * FICHIER : src/modules/support/services/support-stats.service.ts
 *
 * RÔLE : Calculer les statistiques agrégées du service support.
 *
 * UTILISATION :
 *   Injecté dans SupportAgentController pour les routes admin.
 *   Toutes les méthodes sont "read-only" (pas d'écriture en base).
 *
 * DONNÉES PRODUITES :
 *   - Vue d'ensemble  : total tickets, par statut, par type
 *   - Performance     : délai de première réponse (en heures)
 *   - Satisfaction    : note CSAT moyenne (score 1-5)
 *   - Tendance        : tickets créés/résolus jour par jour (7j)
 *   - SLA             : nombre de tickets en retard (>24h sans réponse)
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { SupportTicket, SupportTicketStatus } from '../../../database/entities/support/support-ticket.entity';

/* ─────────────────────────────────────────────────────────────
 * Interfaces de sortie — décrivent la forme exacte des données
 * renvoyées par chaque méthode. Utile pour le front-end.
 * ───────────────────────────────────────────────────────────── */

export interface TicketStatusCount {
  status: string;   // ex: 'open', 'resolved'
  count: number;    // nombre de tickets dans ce statut
}

export interface TicketTypeCount {
  type:  string;    // ex: 'billing', 'technical'
  count: number;
}

export interface DailyCount {
  date:     string; // format ISO 'YYYY-MM-DD'
  created:  number; // tickets ouverts ce jour
  resolved: number; // tickets résolus ce jour
}

export interface SupportOverview {
  total:              number;  // tous les tickets, tous statuts
  openCount:          number;  // statut OPEN
  inProgressCount:    number;  // statut IN_PROGRESS
  waitingUserCount:   number;  // statut WAITING_USER
  resolvedCount:      number;  // statut RESOLVED
  closedCount:        number;  // statut CLOSED
  avgFirstResponseH:  number;  // délai moyen 1ère réponse en heures
  avgCsat:            number;  // note CSAT moyenne (0 si aucune note)
  slaBreachedCount:   number;  // tickets > 24h sans réponse d'agent
  byStatus:           TicketStatusCount[];
  byType:             TicketTypeCount[];
  last7Days:          DailyCount[];
}

@Injectable()
export class SupportStatsService {

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * getOverview()
   *
   * Retourne toutes les métriques en un seul appel.
   * Utilise des requêtes SQL agrégées pour minimiser les
   * allers-retours avec la base de données.
   * ────────────────────────────────────────────────────────── */
  async getOverview(): Promise<SupportOverview> {

    /* ── 1. Comptage par statut ─────────────────────────────
     * On GROUP BY status pour obtenir un tableau [{status, count}].
     * Le cast ::int est nécessaire car PostgreSQL renvoie les COUNT
     * sous forme de string dans certains drivers.
     * ─────────────────────────────────────────────────────── */
    const byStatusRaw: { status: string; count: string }[] = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(t.id)', 'count')
      .groupBy('t.status')
      .getRawMany();

    const byStatus: TicketStatusCount[] = byStatusRaw.map(r => ({
      status: r.status,
      count:  parseInt(r.count, 10),
    }));

    /* ── 2. Comptage par type de demande ────────────────────
     * Même principe que par statut, on group by type.
     * ─────────────────────────────────────────────────────── */
    const byTypeRaw: { type: string; count: string }[] = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COUNT(t.id)', 'count')
      .groupBy('t.type')
      .orderBy('COUNT(t.id)', 'DESC')
      .getRawMany();

    const byType: TicketTypeCount[] = byTypeRaw.map(r => ({
      type:  r.type,
      count: parseInt(r.count, 10),
    }));

    /* ── 3. Métriques globales en une seule requête ─────────
     *
     * - AVG(EXTRACT(EPOCH FROM (firstResponseAt - createdAt))/3600)
     *   → délai moyen en heures entre création et 1ère réponse agent
     *   → EXTRACT(EPOCH ...) donne les secondes, /3600 = heures
     *
     * - AVG(satisfactionScore)
     *   → note CSAT moyenne sur 5 (ignore les NULL)
     *
     * - COUNT(id) FILTER (WHERE firstResponseAt IS NULL AND ...)
     *   → tickets sans réponse depuis plus de 24 heures (SLA breach)
     * ─────────────────────────────────────────────────────── */
    const metricsRaw = await this.ticketRepo
      .createQueryBuilder('t')
      .select([
        'COUNT(t.id) AS total',
        `AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - t."createdAt")) / 3600)
           FILTER (WHERE "firstResponseAt" IS NOT NULL) AS "avgResponseH"`,
        `AVG("satisfactionScore")
           FILTER (WHERE "satisfactionScore" IS NOT NULL) AS "avgCsat"`,
        `COUNT(t.id) FILTER (
           WHERE t."firstResponseAt" IS NULL
             AND t.status NOT IN ('resolved','closed')
             AND t."createdAt" < NOW() - INTERVAL '24 hours'
         ) AS "slaBreached"`,
      ])
      .getRawOne();

    /* ── 4. Tendance sur 7 jours ────────────────────────────
     *
     * On génère une série de 7 dates (generate_series PostgreSQL),
     * puis on LEFT JOIN les tickets pour avoir le compte exact
     * même pour les jours sans ticket (valeur 0).
     *
     * generate_series(NOW()-6 days, NOW(), '1 day') :
     *   → génère [J-6, J-5, ..., J-1, J] (7 dates)
     * ─────────────────────────────────────────────────────── */
    const last7DaysRaw: { day: string; created: string; resolved: string }[] =
      await this.ticketRepo.query(`
        SELECT
          to_char(day, 'YYYY-MM-DD')       AS day,
          COALESCE(created.cnt, 0)::int     AS created,
          COALESCE(resolved.cnt, 0)::int    AS resolved
        FROM generate_series(
          NOW() - INTERVAL '6 days',
          NOW(),
          INTERVAL '1 day'
        ) AS day

        /* Tickets créés ce jour */
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt
          FROM support_tickets
          WHERE DATE("createdAt") = DATE(day)
        ) created ON TRUE

        /* Tickets résolus ce jour */
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS cnt
          FROM support_tickets
          WHERE DATE("resolvedAt") = DATE(day)
        ) resolved ON TRUE

        ORDER BY day ASC
      `);

    const last7Days: DailyCount[] = last7DaysRaw.map(r => ({
      date:     r.day,
      created:  Number(r.created),
      resolved: Number(r.resolved),
    }));

    /* ── 5. Comptages simples par statut ────────────────────
     * Extraits du tableau byStatus pour éviter de nouvelles requêtes.
     * ─────────────────────────────────────────────────────── */
    const getCount = (status: string) =>
      byStatus.find(s => s.status === status)?.count ?? 0;

    return {
      total:             parseInt(metricsRaw.total, 10) || 0,
      openCount:         getCount(SupportTicketStatus.OPEN),
      inProgressCount:   getCount(SupportTicketStatus.IN_PROGRESS),
      waitingUserCount:  getCount(SupportTicketStatus.WAITING_USER),
      resolvedCount:     getCount(SupportTicketStatus.RESOLVED),
      closedCount:       getCount(SupportTicketStatus.CLOSED),
      avgFirstResponseH: Math.round((parseFloat(metricsRaw.avgResponseH) || 0) * 10) / 10,
      avgCsat:           Math.round((parseFloat(metricsRaw.avgCsat) || 0) * 10) / 10,
      slaBreachedCount:  parseInt(metricsRaw.slaBreached, 10) || 0,
      byStatus,
      byType,
      last7Days,
    };
  }
}
