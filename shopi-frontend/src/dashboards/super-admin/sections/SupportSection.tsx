/* ============================================================
 * FICHIER : src/dashboards/super-admin/sections/SupportSection.tsx
 *
 * RÔLE :
 *   Centre de support client — vue globale multi-zone du super-admin.
 *   Contrairement au dashboard admin (portée limitée aux acteurs
 *   supervisés), le super-admin voit TOUS les tickets de la plateforme
 *   (SupportPermissionService → null = aucun filtre) et peut réassigner
 *   un ticket à n'importe quel admin ayant la permission "support"
 *   (PermissionsSection.tsx), à travers toutes les zones/pays.
 *
 *   Affiche :
 *     ① 5 KPI cards (total, actifs, SLA violations, CSAT, délai réponse)
 *     ② Filtres : recherche, statut, priorité, type, canal, agent assigné
 *     ③ File d'attente globale paginée — clic sur une ligne → modal détail
 *        (réponse, statut, priorité, réassignation — voir SupportTicketModal)
 *     ④ Répartition par statut + par canal (barres horizontales)
 *     ⑤ Export CSV
 *
 * API :
 *   GET /support/agent/stats   → SupportOverview (avec byChannel)
 *   GET /support/agent/tickets → liste paginée + filtres avancés
 *   GET /support/agent/agents  → admins éligibles à la réassignation
 *   GET /support/agent/export  → CSV
 *
 * Avant cette page, le super-admin n'avait qu'un widget en lecture
 * seule dont les liens renvoyaient vers la page CLIENT d'un ticket
 * (scopée sur l'utilisateur courant) — aucune action n'était possible.
 * ============================================================ */

import { useEffect, useState, useCallback } from 'react';
import { apiFetch }  from '../../../shared/services/apiFetch';
import SupportTicketModal from '../components/SupportTicketModal';
import s from './SupportSection.module.css';

// ─────────────────────────────────────────────────────────────
// 1. Types
// ─────────────────────────────────────────────────────────────

interface SupportOverview {
  total:           number;
  byStatus:        { status: string;  count: number }[];
  byType:          { type: string;    count: number }[];
  byChannel:       { channel: string; count: number }[];
  avgResponseTime: number | null;
  csat:            number | null;
  slaViolations:   number;
  unreadCount:     number;
}

interface TicketSummary {
  id:            string;
  reference:     string;
  subject:       string;
  status:        string;
  priority:      string;
  channel:       string;
  agentId:       string | null;
  createdAt:     string;
  /* Nombre de messages client non lus par l'agent — remis à 0 par le
   * backend dès que l'agent ouvre le détail (GET .../tickets/:id).
   * Voir ticket.service.ts findOneAsAgentScoped(). */
  unreadByAgent: number;
}

interface AgentOption {
  id:          string;
  name:        string;
  email:       string;
  paysAssigne: string | null;
}

// ─────────────────────────────────────────────────────────────
// 2. Libellés
// ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  open:         'Ouvert',
  in_progress:  'En cours',
  waiting_user: 'Attente client',
  resolved:     'Résolu',
  closed:       'Fermé',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente',
};

const CHANNEL_LABEL: Record<string, string> = {
  client:    '🛍️ Client',
  company:   '🏪 Entreprise',
  partner:   '🤝 Partenaire',
  delivery:  '🛵 Livreur',
  internal:  '🔒 Interne',
  anonymous: '👤 Anonyme',
};

const STATUS_COLOR: Record<string, string> = {
  open:         'var(--sky)',
  in_progress:  'var(--gold)',
  waiting_user: 'var(--acid)',
  resolved:     'var(--violet)',
  closed:       'var(--txt-3)',
};

function badgeClass(status: string): string {
  if (status === 'open')         return s.badgeOpen;
  if (status === 'in_progress')  return s.badgeProgress;
  if (status === 'waiting_user') return s.badgeWaiting;
  return s.badgeClosed;
}

function prioClass(priority: string): string {
  if (priority === 'low')    return s.prioLow;
  if (priority === 'high')   return s.prioHigh;
  if (priority === 'urgent') return s.prioUrgent;
  return s.prioNormal;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

function downloadCsv(): void {
  const a = document.createElement('a');
  a.href = '/api/support/agent/export';
  a.click();
  a.remove();
}

const LIMIT = 20;

// ─────────────────────────────────────────────────────────────
// 3. Composant principal
// ─────────────────────────────────────────────────────────────

interface Props {
  isActive: boolean;
  toast:    (type: string, msg: string) => void;
  /** Notifie le parent (badge sidebar) à chaque rechargement des stats. */
  onStatsChange?: (slaViolations: number, unreadCount: number) => void;
}

export default function SupportSection({ isActive, toast, onStatsChange }: Props) {

  // ─── État ────────────────────────────────────────────────
  const [stats,   setStats]   = useState<SupportOverview | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total,   setTotal]   = useState(0);
  const [agents,  setAgents]  = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [search,     setSearch]     = useState('');
  const [statusF,    setStatusF]    = useState('');
  const [priorityF,  setPriorityF]  = useState('');
  const [typeF,      setTypeF]      = useState('');
  const [channelF,   setChannelF]   = useState('');
  const [agentF,     setAgentF]     = useState('');
  const [page,       setPage]       = useState(1);

  const [openTicket, setOpenTicket] = useState<string | null>(null);

  // ─── Chargement stats + agents (une fois par activation) ──
  const loadOverview = useCallback(async () => {
    try {
      const [statsRes, agentsRes] = await Promise.all([
        apiFetch<SupportOverview>('/support/agent/stats'),
        apiFetch<AgentOption[]>('/support/agent/agents'),
      ]);
      setStats(statsRes);
      setAgents(agentsRes ?? []);
      onStatsChange?.(statsRes.slaViolations, statsRes.unreadCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    }
  }, [onStatsChange]);

  // ─── Chargement liste tickets (filtres + pagination) ──────
  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: TicketSummary[]; total: number }>('/support/agent/tickets', {
        params: {
          status:   statusF   || undefined,
          priority: priorityF || undefined,
          type:     typeF     || undefined,
          channel:  channelF  || undefined,
          agentId:  agentF    || undefined,
          search:   search    || undefined,
          page,
          limit: LIMIT,
        },
      });
      setTickets(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [statusF, priorityF, typeF, channelF, agentF, search, page]);

  useEffect(() => { if (isActive) loadOverview(); }, [isActive, loadOverview]);
  useEffect(() => { if (isActive) loadTickets(); }, [isActive, loadTickets]);

  // Revenir à la page 1 quand un filtre change
  useEffect(() => { setPage(1); }, [statusF, priorityF, typeF, channelF, agentF, search]);

  const resetFilters = () => {
    setSearch(''); setStatusF(''); setPriorityF(''); setTypeF(''); setChannelF(''); setAgentF('');
  };

  const agentName = (agentId: string | null): string => {
    if (!agentId) return 'Non assigné';
    return agents.find(a => a.id === agentId)?.name ?? '—';
  };

  const activeCount = stats
    ? (stats.byStatus.find(b => b.status === 'open')?.count         ?? 0)
    + (stats.byStatus.find(b => b.status === 'in_progress')?.count  ?? 0)
    + (stats.byStatus.find(b => b.status === 'waiting_user')?.count ?? 0)
    : 0;

  const totalForBars = stats?.total ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const handleChanged = useCallback(() => {
    loadTickets();
    loadOverview();
  }, [loadTickets, loadOverview]);

  // ─── Rendu ─────────────────────────────────────────────────
  return (
    <section className={`${s.section}${isActive ? ` ${s.active}` : ''}`}>

      {/* ①  En-tête ─────────────────────────────────────────── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.title}>🎫 Support client</div>
          <div className={s.subtitle}>
            Vue globale — tous les tickets de la plateforme, toutes zones confondues
          </div>
        </div>
        <div className={s.actions}>
          <button className={`${s.btn} ${s.btnOutline}`} onClick={downloadCsv}>
            ⬇ Exporter CSV
          </button>
        </div>
      </div>

      {error && <div className={s.loading} style={{ color: 'var(--rose)' }}>{error}</div>}

      {stats && (
        <>
          {/* ②  KPI Cards ─────────────────────────────────── */}
          <div className={s.kpiGrid}>
            <div className={s.kpi}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--sky) 15%,transparent)' }}>🎫</div>
              <div className={s.kpiVal}>{stats.total}</div>
              <div className={s.kpiLabel}>Total tickets</div>
            </div>
            <div className={s.kpi}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--acid) 15%,transparent)' }}>🔥</div>
              <div className={s.kpiVal}>{activeCount}</div>
              <div className={s.kpiLabel}>En cours</div>
            </div>
            <div className={`${s.kpi}${stats.unreadCount > 0 ? ` ${s.kpiDanger}` : ''}`}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--rose) 15%,transparent)' }}>✉️</div>
              <div className={s.kpiVal}>{stats.unreadCount}</div>
              <div className={s.kpiLabel}>Non lus</div>
            </div>
            <div className={`${s.kpi}${stats.slaViolations > 0 ? ` ${s.kpiDanger}` : ''}`}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--rose) 15%,transparent)' }}>⏰</div>
              <div className={s.kpiVal}>{stats.slaViolations}</div>
              <div className={s.kpiLabel}>SLA dépassés</div>
            </div>
            <div className={s.kpi}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--gold) 15%,transparent)' }}>⭐</div>
              <div className={s.kpiVal}>{stats.csat != null ? stats.csat.toFixed(1) : '—'}</div>
              <div className={s.kpiLabel}>CSAT /5</div>
            </div>
            <div className={s.kpi}>
              <div className={s.kpiIcon} style={{ background: 'color-mix(in srgb,var(--violet) 15%,transparent)' }}>⚡</div>
              <div className={s.kpiVal}>{stats.avgResponseTime != null ? `${stats.avgResponseTime.toFixed(1)}h` : '—'}</div>
              <div className={s.kpiLabel}>Délai réponse</div>
            </div>
          </div>

          {/* ③  File d'attente globale ─────────────────────── */}
          <div className={s.card}>
            <div className={s.cardTitle}>📥 File d'attente globale ({total})</div>

            {/* Filtres */}
            <div className={s.filters}>
              <div className={s.searchBox}>
                <span>🔍</span>
                <input
                  type="text"
                  placeholder="Référence, sujet…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select className="sel" value={statusF} onChange={e => setStatusF(e.target.value)}>
                <option value="">Tous statuts</option>
                {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select className="sel" value={priorityF} onChange={e => setPriorityF(e.target.value)}>
                <option value="">Toutes priorités</option>
                {Object.entries(PRIORITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select className="sel" value={channelF} onChange={e => setChannelF(e.target.value)}>
                <option value="">Tous canaux</option>
                {Object.entries(CHANNEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select className="sel" value={agentF} onChange={e => setAgentF(e.target.value)}>
                <option value="">Tous agents</option>
                <option value="unassigned">Non assignés</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}{a.paysAssigne ? ` (${a.paysAssigne})` : ''}</option>)}
              </select>
              {(search || statusF || priorityF || channelF || agentF || typeF) && (
                <button className={s.resetBtn} onClick={resetFilters}>✕ Réinitialiser</button>
              )}
            </div>

            {/* Tableau */}
            {loading ? (
              <div className={s.loading}>Chargement…</div>
            ) : tickets.length === 0 ? (
              <div className={s.empty}>Aucun ticket ne correspond à ces filtres</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={s.queueTable}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Référence</th>
                      <th>Sujet</th>
                      <th>Canal</th>
                      <th>Statut</th>
                      <th>Priorité</th>
                      <th>Agent</th>
                      <th>Créé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map(t => {
                      const unread = t.unreadByAgent > 0;
                      return (
                        <tr key={t.id} className={`${s.queueRow}${unread ? ` ${s.queueRowUnread}` : ''}`} onClick={() => setOpenTicket(t.id)}>
                          <td>
                            {unread && (
                              <span className={s.unreadDot} title={`${t.unreadByAgent} message(s) non lu(s)`} />
                            )}
                          </td>
                          <td className={s.queueRef}>{t.reference}</td>
                          <td className={s.queueSubject}>{t.subject}</td>
                          <td><span className={s.channelBadge}>{CHANNEL_LABEL[t.channel] ?? t.channel}</span></td>
                          <td><span className={`${s.badge} ${badgeClass(t.status)}`}>{STATUS_LABEL[t.status] ?? t.status}</span></td>
                          <td><span className={`${s.badge} ${prioClass(t.priority)}`}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span></td>
                          <td className={`${s.agentCell} ${!t.agentId ? s.agentUnassigned : ''}`}>{agentName(t.agentId)}</td>
                          <td>{fmt(t.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {total > LIMIT && (
              <div className={s.pagination}>
                <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Précédent</button>
                <span className={s.pageInfo}>Page {page} / {totalPages}</span>
                <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suivant →</button>
              </div>
            )}
          </div>

          {/* ④  Répartition statut + canal ──────────────────── */}
          <div className={s.grid2}>
            <div className={s.card}>
              <div className={s.cardTitle}>📊 Répartition par statut</div>
              <div className={s.barList}>
                {stats.byStatus.length === 0 && <div className={s.empty}>Aucune donnée</div>}
                {stats.byStatus.map(b => (
                  <div key={b.status} className={s.barItem}>
                    <div className={s.barTop}>
                      <span className={s.barLabel}>{STATUS_LABEL[b.status] ?? b.status}</span>
                      <span className={s.barCount}>{b.count}</span>
                    </div>
                    <div className={s.barTrack}>
                      <div className={s.barFill} style={{ width: `${(b.count / Math.max(1, totalForBars)) * 100}%`, background: STATUS_COLOR[b.status] ?? 'var(--sky)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={s.card}>
              <div className={s.cardTitle}>🌐 Répartition par canal</div>
              <div className={s.barList}>
                {stats.byChannel.length === 0 && <div className={s.empty}>Aucune donnée</div>}
                {stats.byChannel.map(b => (
                  <div key={b.channel} className={s.barItem}>
                    <div className={s.barTop}>
                      <span className={s.barLabel}>{CHANNEL_LABEL[b.channel] ?? b.channel}</span>
                      <span className={s.barCount}>{b.count}</span>
                    </div>
                    <div className={s.barTrack}>
                      <div className={s.barFill} style={{ width: `${(b.count / Math.max(1, totalForBars)) * 100}%`, background: 'var(--sky)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {openTicket && (
        <SupportTicketModal
          ticketId={openTicket}
          agents={agents}
          /* Ouvrir le ticket marque unreadByAgent=0 côté serveur (voir
           * findOneAsAgentScoped) — il faut recharger la liste à la
           * fermeture, pas seulement après une mutation, sinon le
           * badge "non lu" reste affiché à tort tant qu'aucune action
           * n'a été prise sur le ticket. */
          onClose={() => { setOpenTicket(null); handleChanged(); }}
          toast={toast}
          onChanged={handleChanged}
        />
      )}
    </section>
  );
}
