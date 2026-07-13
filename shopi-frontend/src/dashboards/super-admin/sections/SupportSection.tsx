/* ============================================================
 * FICHIER : src/dashboards/super-admin/sections/SupportSection.tsx
 *
 * RÔLE :
 *   Section "Support client" intégrée dans le dashboard super-admin.
 *   Affiche :
 *     ① 5 KPI cards  (total, actifs, SLA violations, CSAT, délai réponse)
 *     ② Grille 2 colonnes :
 *         - colonne gauche  : 10 tickets récents (ouverts / en cours)
 *         - colonne droite  : répartition par statut (barres horizontales)
 *     ③ Bouton export CSV  (réutilise l'endpoint /api/support/agent/export)
 *
 * API :
 *   GET /api/support/agent/stats   → SupportOverview (voir support-stats.service.ts)
 *   GET /api/support/agent/tickets → liste paginée (filtrée open/in_progress)
 *   GET /api/support/agent/export  → téléchargement CSV (déclenché côté navigateur)
 *
 * THÈME :
 *   Variables CSS de super-admin.css (--surface, --raised, --border,
 *   --txt-1/2/3, --sky, --acid, --gold, --rose, --violet…)
 * ============================================================ */

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch }  from '../../../shared/services/apiFetch';
import s from './SupportSection.module.css';

// ─────────────────────────────────────────────────────────────
// 1. Types  (miroir du backend SupportOverview)
// ─────────────────────────────────────────────────────────────

/** Résumé global des tickets retourné par /api/support/agent/stats */
interface SupportOverview {
  total:           number;
  byStatus:        { status: string; count: number }[];
  byType:          { type: string;   count: number }[];
  avgResponseTime: number | null;  // en heures
  csat:            number | null;  // note moyenne /5
  slaViolations:   number;         // tickets SLA dépassé
}

/** Un ticket tel que retourné par la liste agent */
interface TicketSummary {
  id:        string;
  reference: string;
  subject:   string;
  status:    string;
  priority:  string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// 2. Helpers
// ─────────────────────────────────────────────────────────────

/** Libellé français pour chaque statut */
const STATUS_LABEL: Record<string, string> = {
  open:         'Ouvert',
  in_progress:  'En cours',
  waiting_user: 'Attente client',
  resolved:     'Résolu',
  closed:       'Fermé',
};

/** Couleur de barre par statut */
const STATUS_COLOR: Record<string, string> = {
  open:         'var(--sky)',
  in_progress:  'var(--gold)',
  waiting_user: 'var(--acid)',
  resolved:     'var(--violet)',
  closed:       'var(--txt-3)',
};

/** Classe CSS du badge de statut */
function badgeClass(status: string): string {
  if (status === 'open')         return s.badgeOpen;
  if (status === 'in_progress')  return s.badgeProgress;
  if (status === 'waiting_user') return s.badgeWaiting;
  return s.badgeClosed;
}

/** Formate une date ISO en "DD/MM/YYYY" */
function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

/** Télécharge le CSV en créant un <a> temporaire */
function downloadCsv(): void {
  const a = document.createElement('a');
  a.href = '/api/support/agent/export';
  a.click();
  a.remove();
}

// ─────────────────────────────────────────────────────────────
// 3. Composant principal
// ─────────────────────────────────────────────────────────────

interface Props {
  /** Contrôle la visibilité : pattern de super-admin.css (.section + .active) */
  isActive: boolean;
}

export default function SupportSection({ isActive }: Props) {

  // ─── État local ─────────────────────────────────────────────
  const [stats,   setStats]   = useState<SupportOverview | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ─── Chargement des données ─────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Requêtes parallèles : stats KPI + liste des tickets récents ouverts
      const [statsRes, ticketsRes] = await Promise.all([
        apiFetch<SupportOverview>('/support/agent/stats'),
        apiFetch<{ data: TicketSummary[]; total: number }>(
          '/support/agent/tickets?page=1&limit=10&status=open'
        ),
      ]);
      setStats(statsRes);
      setTickets(ticketsRes.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger quand la section devient visible (évite les appels inutiles
  // quand une autre section est affichée)
  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  // ─── Calculs dérivés ────────────────────────────────────────

  // Nombre de tickets actifs = open + in_progress + waiting_user
  const activeCount = stats
    ? (stats.byStatus.find(b => b.status === 'open')?.count         ?? 0)
    + (stats.byStatus.find(b => b.status === 'in_progress')?.count  ?? 0)
    + (stats.byStatus.find(b => b.status === 'waiting_user')?.count ?? 0)
    : 0;

  // Total pour calculer les pourcentages des barres
  const totalForBars = stats?.total ?? 1;

  // ─── Rendu ─────────────────────────────────────────────────
  return (
    /* Le pattern CSS module super-admin :
     * .section = display:none  |  .section.active = display:flex */
    <section className={`${s.section}${isActive ? ` ${s.active}` : ''}`}>

      {/* ①  En-tête ─────────────────────────────────────────── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.title}>🎫 Support client</div>
          <div className={s.subtitle}>
            Centre d'assistance — tickets, SLA et satisfaction
          </div>
        </div>
        <div className={s.actions}>
          {/* Export CSV — déclenche /api/support/agent/export */}
          <button className={`${s.btn} ${s.btnOutline}`} onClick={downloadCsv}>
            ⬇ Exporter CSV
          </button>
          {/* Lien vers la page analytics dédiée (SupportStatsPage) */}
          <a
            href="/support/stats"
            target="_blank"
            rel="noopener noreferrer"
            className={`${s.btn} ${s.btnPrimary}`}
          >
            📊 Stats avancées
          </a>
        </div>
      </div>

      {/* ─── États chargement / erreur ────────────────────── */}
      {loading && <div className={s.loading}>Chargement…</div>}
      {error   && <div className={s.loading} style={{ color: 'var(--rose)' }}>{error}</div>}

      {stats && (
        <>
          {/* ②  KPI Cards ─────────────────────────────────── */}
          <div className={s.kpiGrid}>

            {/* Card 1 : total tickets */}
            <div className={s.kpi}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--sky) 15%,transparent)' }}>
                🎫
              </div>
              <div className={s.kpiVal}>{stats.total}</div>
              <div className={s.kpiLabel}>Total tickets</div>
            </div>

            {/* Card 2 : tickets actifs */}
            <div className={s.kpi}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--acid) 15%,transparent)' }}>
                🔥
              </div>
              <div className={s.kpiVal}>{activeCount}</div>
              <div className={s.kpiLabel}>En cours</div>
            </div>

            {/* Card 3 : violations SLA — rouge si > 0 */}
            <div className={`${s.kpi}${stats.slaViolations > 0 ? ` ${s.kpiDanger}` : ''}`}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--rose) 15%,transparent)' }}>
                ⏰
              </div>
              <div className={s.kpiVal}>{stats.slaViolations}</div>
              <div className={s.kpiLabel}>SLA dépassés</div>
            </div>

            {/* Card 4 : satisfaction client */}
            <div className={s.kpi}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--gold) 15%,transparent)' }}>
                ⭐
              </div>
              <div className={s.kpiVal}>
                {stats.csat != null ? stats.csat.toFixed(1) : '—'}
              </div>
              <div className={s.kpiLabel}>CSAT /5</div>
            </div>

            {/* Card 5 : délai première réponse */}
            <div className={s.kpi}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--violet) 15%,transparent)' }}>
                ⚡
              </div>
              <div className={s.kpiVal}>
                {stats.avgResponseTime != null
                  ? `${stats.avgResponseTime.toFixed(1)}h`
                  : '—'}
              </div>
              <div className={s.kpiLabel}>Délai réponse</div>
            </div>

          </div>

          {/* ③  Grille 2 colonnes ─────────────────────────── */}
          <div className={s.grid2}>

            {/* ── Colonne gauche : tickets récents ouverts ── */}
            <div className={s.card}>
              <div className={s.cardTitle}>🕐 Tickets récents (ouverts)</div>
              <div className={s.ticketTable}>
                {tickets.length === 0 && (
                  <div className={s.empty}>Aucun ticket ouvert</div>
                )}
                {tickets.map(t => (
                  <a
                    key={t.id}
                    /* Lien vers la page agent du ticket
                     * (cette page est à implémenter dans Phase 6) */
                    href={`/support/tickets/${t.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div className={s.ticketRow}>
                      <div>
                        <div className={s.ticketRef}>{t.reference}</div>
                        <div className={s.ticketSubject}>{t.subject}</div>
                        <div className={s.ticketMeta}>{fmt(t.createdAt)}</div>
                      </div>
                      <span className={`${s.badge} ${badgeClass(t.status)}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
              {/* Lien vers la page stats complète */}
              <button
                className={s.seeAll}
                onClick={() => { window.location.href = '/support/stats'; }}
              >
                Voir tous les tickets →
              </button>
            </div>

            {/* ── Colonne droite : répartition par statut ─── */}
            <div className={s.card}>
              <div className={s.cardTitle}>📊 Répartition par statut</div>
              <div className={s.barList}>
                {stats.byStatus.length === 0 && (
                  <div className={s.empty}>Aucune donnée</div>
                )}
                {stats.byStatus.map(b => (
                  <div key={b.status} className={s.barItem}>
                    <div className={s.barTop}>
                      <span className={s.barLabel}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                      <span className={s.barCount}>{b.count}</span>
                    </div>
                    <div className={s.barTrack}>
                      <div
                        className={s.barFill}
                        style={{
                          width: `${(b.count / Math.max(1, totalForBars)) * 100}%`,
                          background: STATUS_COLOR[b.status] ?? 'var(--sky)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

    </section>
  );
}
