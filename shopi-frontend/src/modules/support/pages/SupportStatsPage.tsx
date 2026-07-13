/* ============================================================
 * FICHIER : src/modules/support/pages/SupportStatsPage.tsx
 *
 * RÔLE : Tableau de bord analytique du service support.
 *        Accessible uniquement aux admins → route /support/stats.
 *
 * DONNÉES AFFICHÉES :
 *
 *   KPI Cards (indicateurs clés) :
 *     - Total tickets
 *     - Tickets ouverts (actifs)
 *     - Violations SLA actives (rouge si > 0)
 *     - Note CSAT moyenne (score satisfaction 1-5)
 *     - Délai moyen de première réponse (en heures)
 *
 *   Répartition par statut :
 *     Barres de progression horizontales pour visualiser la
 *     distribution des tickets entre les différents statuts.
 *
 *   Répartition par type de demande :
 *     Même principe — quelle catégorie génère le plus de tickets.
 *
 *   Tendance sur 7 jours :
 *     Graphique en barres simple (CSS only) montrant les tickets
 *     créés et résolus chaque jour — sans bibliothèque externe.
 *
 *   Export CSV :
 *     Bouton qui déclenche le téléchargement du CSV via l'API.
 *
 * SÉCURITÉ :
 *   Cette route est protégée côté routeur (PrivateRoute) mais
 *   uniquement pour les rôles ADMIN / SUPER_ADMIN.
 *   → Un client connecté qui accède à /support/stats recevra
 *     une 403 de l'API quand même (double protection).
 * ============================================================ */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../../shared/services/apiFetch';
import styles from './SupportStatsPage.module.css';

/* ─────────────────────────────────────────────────────────────
 * Types TypeScript — décrivent la réponse de l'API /support/agent/stats
 * Doivent correspondre aux interfaces dans SupportStatsService.
 * ───────────────────────────────────────────────────────────── */
interface DailyCount {
  date:     string; /* format 'YYYY-MM-DD' */
  created:  number;
  resolved: number;
}

interface StatsData {
  total:             number;
  openCount:         number;
  inProgressCount:   number;
  waitingUserCount:  number;
  resolvedCount:     number;
  closedCount:       number;
  avgFirstResponseH: number;
  avgCsat:           number;
  slaBreachedCount:  number;
  byType:            { type: string; count: number }[];
  last7Days:         DailyCount[];
}

/* Libellés français pour les types de tickets */
const TYPE_LABELS: Record<string, string> = {
  general:        'Question générale',
  billing:        'Facturation',
  order_platform: 'Commande / Livraison',
  account:        'Compte / Accès',
  fraud:          'Fraude / Sécurité',
  technical:      'Problème technique',
  feedback:       'Suggestion / Avis',
};

/* Libellés courts pour l'axe des jours (tendance 7j) */
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function SupportStatsPage() {

  /* ── État des données ─────────────────────────────────────── */
  const [stats, setStats]     = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  /* ── Chargement des statistiques ─────────────────────────────
   * Appelle GET /support/agent/stats au montage du composant.
   * ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    apiFetch<StatsData>('/support/agent/stats')
      .then(data => setStats(data))
      .catch(e   => setError(e.message ?? 'Erreur de chargement'))
      .finally(  () => setLoading(false));
  }, []);

  /* ── Fonction d'export CSV ───────────────────────────────────
   * Crée un lien temporaire <a> pointant vers l'endpoint CSV
   * et le clique programmatiquement pour déclencher le téléchargement.
   * Cette technique est la plus fiable cross-browser pour les
   * téléchargements de fichiers depuis un endpoint authentifié.
   * ─────────────────────────────────────────────────────────── */
  const handleExport = () => {
    /* On utilise directement l'URL de l'API avec le token dans les
     * cookies httpOnly → la requête est authentifiée automatiquement. */
    const link    = document.createElement('a');
    link.href     = '/api/support/agent/export';
    link.download = 'tickets-support.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ── Calcul de la hauteur des barres du graphique ────────────
   * On normalise les valeurs sur 100% de la hauteur du graphique.
   * La valeur max (created ou resolved) définit le 100%.
   * ─────────────────────────────────────────────────────────── */
  const maxBar = stats
    ? Math.max(1, ...stats.last7Days.map(d => Math.max(d.created, d.resolved)))
    : 1;

  const barHeight = (val: number) => `${Math.round((val / maxBar) * 100)}%`;

  /* ── Calcul du libellé du jour ───────────────────────────────
   * new Date('2026-07-03') → getDay() → 5 (vendredi, 0=dimanche)
   * On mappe sur DAY_LABELS avec l'index ajusté (lundi=0).
   * ─────────────────────────────────────────────────────────── */
  const getDayLabel = (iso: string) => {
    const d = new Date(iso + 'T12:00:00'); /* T12 pour éviter le décalage timezone */
    return DAY_LABELS[(d.getDay() + 6) % 7]; /* getDay() → 0=dimanche, on décale de 6 */
  };

  /* ── États de chargement/erreur ─────────────────────────────── */
  if (loading) {
    return (
      <div className={styles.state}>
        <i className="fas fa-circle-notch fa-spin" /> Chargement des statistiques…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={styles.stateErr}>
        <i className="fas fa-exclamation-triangle" /> {error ?? 'Erreur inconnue'}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>

        {/* ── Fil d'Ariane ─────────────────────────────────── */}
        <nav className={styles.breadcrumb}>
          <Link to="/support">Tickets</Link>
          <span>/</span>
          <span>Statistiques</span>
        </nav>

        {/* ── En-tête + bouton export ──────────────────────── */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Tableau de bord Support</h1>
            <p className={styles.sub}>Statistiques globales — mise à jour en temps réel</p>
          </div>
          <button className={styles.exportBtn} onClick={handleExport}>
            <i className="fas fa-download" /> Exporter CSV
          </button>
        </div>

        {/* ── KPI Cards ────────────────────────────────────── */}
        <div className={styles.kpiGrid}>

          {/* Total tickets */}
          <div className={styles.kpi}>
            <div className={styles.kpiIcon} style={{ background: '#EEF2FF', color: '#1A4FC4' }}>
              <i className="fas fa-ticket-alt" />
            </div>
            <div className={styles.kpiVal}>{stats.total}</div>
            <div className={styles.kpiLabel}>Total tickets</div>
          </div>

          {/* Tickets actifs (open + in_progress + waiting) */}
          <div className={styles.kpi}>
            <div className={styles.kpiIcon} style={{ background: '#FFF7ED', color: '#C05621' }}>
              <i className="fas fa-inbox" />
            </div>
            <div className={styles.kpiVal}>
              {stats.openCount + stats.inProgressCount + stats.waitingUserCount}
            </div>
            <div className={styles.kpiLabel}>Tickets actifs</div>
          </div>

          {/* Violations SLA — rouge si > 0 pour attirer l'attention */}
          <div className={styles.kpi}>
            <div className={styles.kpiIcon} style={{
              background: stats.slaBreachedCount > 0 ? '#FFF5F5' : '#F0FDF4',
              color:      stats.slaBreachedCount > 0 ? '#E53E3E' : '#059669',
            }}>
              <i className="fas fa-exclamation-circle" />
            </div>
            <div className={styles.kpiVal} style={{
              color: stats.slaBreachedCount > 0 ? '#E53E3E' : undefined,
            }}>
              {stats.slaBreachedCount}
            </div>
            <div className={styles.kpiLabel}>Violations SLA</div>
          </div>

          {/* Note CSAT moyenne — affichée avec une étoile */}
          <div className={styles.kpi}>
            <div className={styles.kpiIcon} style={{ background: '#FFFBEB', color: '#D97706' }}>
              <i className="fas fa-star" />
            </div>
            <div className={styles.kpiVal}>
              {stats.avgCsat > 0 ? `${stats.avgCsat}/5` : '—'}
            </div>
            <div className={styles.kpiLabel}>Satisfaction (CSAT)</div>
          </div>

          {/* Délai moyen de première réponse */}
          <div className={styles.kpi}>
            <div className={styles.kpiIcon} style={{ background: '#EEF2FF', color: '#1A4FC4' }}>
              <i className="fas fa-clock" />
            </div>
            <div className={styles.kpiVal}>
              {stats.avgFirstResponseH > 0 ? `${stats.avgFirstResponseH}h` : '—'}
            </div>
            <div className={styles.kpiLabel}>Délai 1ère réponse</div>
          </div>
        </div>

        {/* ── Section 2 colonnes : Types + Tendance ────────── */}
        <div className={styles.charts}>

          {/* Répartition par type de demande */}
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>
              <i className="fas fa-tag" /> Demandes par type
            </h2>
            <div className={styles.barList}>
              {stats.byType.map(item => (
                <div key={item.type} className={styles.barItem}>
                  <div className={styles.barLabel}>
                    {TYPE_LABELS[item.type] ?? item.type}
                  </div>
                  <div className={styles.barTrack}>
                    {/* Barre proportionnelle : largeur = (count / total) * 100% */}
                    <div
                      className={styles.barFill}
                      style={{ width: `${Math.round((item.count / Math.max(1, stats.total)) * 100)}%` }}
                    />
                  </div>
                  <div className={styles.barCount}>{item.count}</div>
                </div>
              ))}
              {stats.byType.length === 0 && (
                <p className={styles.noData}>Aucune donnée pour l'instant.</p>
              )}
            </div>
          </div>

          {/* Tendance sur 7 jours */}
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>
              <i className="fas fa-chart-bar" /> Tendance 7 derniers jours
            </h2>

            {/* Légende */}
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#1A4FC4' }} />
                Créés
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#059669' }} />
                Résolus
              </span>
            </div>

            {/* Graphique en barres CSS */}
            <div className={styles.barChart}>
              {stats.last7Days.map((day, i) => (
                <div key={i} className={styles.barGroup}>
                  {/* Conteneur des barres (disposition verticale) */}
                  <div className={styles.bars}>
                    {/* Barre bleue : tickets créés */}
                    <div
                      className={styles.barCreated}
                      style={{ height: barHeight(day.created) }}
                      title={`${day.created} ticket(s) créé(s)`}
                    />
                    {/* Barre verte : tickets résolus */}
                    <div
                      className={styles.barResolved}
                      style={{ height: barHeight(day.resolved) }}
                      title={`${day.resolved} ticket(s) résolu(s)`}
                    />
                  </div>
                  {/* Valeurs numériques sous les barres */}
                  <div className={styles.barValues}>
                    <span style={{ color: '#1A4FC4' }}>{day.created}</span>
                    <span style={{ color: '#059669' }}>{day.resolved}</span>
                  </div>
                  {/* Libellé du jour */}
                  <div className={styles.barDayLabel}>{getDayLabel(day.date)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Liens rapides ─────────────────────────────────── */}
        <div className={styles.quickLinks}>
          <Link to="/support" className={styles.quickLink}>
            <i className="fas fa-list" /> Voir tous les tickets
          </Link>
          <Link to="/aide" className={styles.quickLink}>
            <i className="fas fa-book-open" /> Centre d'aide
          </Link>
        </div>

      </div>
    </div>
  );
}
