/*
 * RetoursList.tsx — Table paginée avec filtres et actions rapides.
 */
import React from 'react';
import type { ReturnSummary, ReturnStatus, ReturnReason, ReturnPriority, ReturnsFilters } from '../../hooks/useRetours';
import s from './RetoursPage.module.css';

/* ── Labels ── */
const STATUS_LABELS: Record<ReturnStatus, { label: string; cls: string }> = {
  pending:    { label: '⏳ En attente',  cls: s.pillPending  },
  accepted:   { label: '✓ Accepté',     cls: s.pillAccepted },
  refused:    { label: '✕ Refusé',      cls: s.pillRefused  },
  in_transit: { label: '🚚 En transit', cls: s.pillTransit  },
  received:   { label: '📦 Reçu',       cls: s.pillReceived },
  refunded:   { label: '💸 Remboursé',  cls: s.pillRefunded },
  exchanged:  { label: '🔁 Échangé',    cls: s.pillExchanged},
  closed:     { label: 'Fermé',          cls: s.pillClosed   },
};

const REASON_LABELS: Record<string, string> = {
  defective:      'Produit défectueux',
  not_matching:   'Ne correspond pas',
  change_of_mind: 'Changement d\'avis',
  wrong_item:     'Mauvais article reçu',
  damaged:        'Endommagé',
  expired:        'Produit périmé',
  other:          'Autre motif',
};

const PRIORITY_LABELS: Record<ReturnPriority, { label: string; cls: string }> = {
  low:    { label: 'Basse',  cls: s.prioLow    },
  normal: { label: 'Normal', cls: s.prioNormal },
  high:   { label: 'Haute',  cls: s.prioHigh   },
  urgent: { label: '🔴 Urgent', cls: s.prioUrgent },
};

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

const LIMIT = 20;

interface Props {
  returns:        ReturnSummary[];
  total:          number;
  loading:        boolean;
  error:          string | null;
  filters:        ReturnsFilters;
  onFilterChange: (patch: Partial<ReturnsFilters>) => void;
  onPageChange:   (page: number) => void;
  onSelect:       (id: string) => void;
}

export default function RetoursList({
  returns, total, loading, error, filters,
  onFilterChange, onPageChange, onSelect,
}: Props) {
  const page  = filters.page  ?? 1;
  const pages = Math.ceil(total / LIMIT);

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className={s.toolbar}>
        <div className={s.searchWrap}>
          <i className={`fas fa-magnifying-glass ${s.searchIco}`} />
          <input
            className={s.searchInput}
            placeholder="Rechercher par référence ou produit…"
            value={filters.search ?? ''}
            onChange={e => onFilterChange({ search: e.target.value })}
          />
        </div>

        <select
          className={`${s.filterSel} ${filters.status ? s.filterActive : ''}`}
          value={filters.status ?? ''}
          onChange={e => onFilterChange({ status: e.target.value as ReturnStatus || undefined })}
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as ReturnStatus[]).map(k => (
            <option key={k} value={k}>{STATUS_LABELS[k].label}</option>
          ))}
        </select>

        <select
          className={`${s.filterSel} ${filters.reason ? s.filterActive : ''}`}
          value={filters.reason ?? ''}
          onChange={e => onFilterChange({ reason: e.target.value as ReturnReason || undefined })}
        >
          <option value="">Tous les motifs</option>
          {Object.entries(REASON_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          className={`${s.filterSel} ${filters.priority ? s.filterActive : ''}`}
          value={filters.priority ?? ''}
          onChange={e => onFilterChange({ priority: e.target.value as ReturnPriority || undefined })}
        >
          <option value="">Toutes les priorités</option>
          {(Object.keys(PRIORITY_LABELS) as ReturnPriority[]).map(k => (
            <option key={k} value={k}>{PRIORITY_LABELS[k].label}</option>
          ))}
        </select>

        <select
          className={s.filterSel}
          value={`${filters.sortBy ?? 'createdAt'}_${filters.sortOrder ?? 'DESC'}`}
          onChange={e => {
            const [sortBy, sortOrder] = e.target.value.split('_');
            onFilterChange({ sortBy, sortOrder: sortOrder as 'ASC' | 'DESC' });
          }}
        >
          <option value="createdAt_DESC">Plus récents</option>
          <option value="createdAt_ASC">Plus anciens</option>
          <option value="montantDemande_DESC">Montant ↓</option>
          <option value="montantDemande_ASC">Montant ↑</option>
          <option value="status_ASC">Statut A→Z</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ marginBottom: 0 }}>
        {error ? (
          <div className={s.empty}>
            <div className={s.emptyIco}>⚠️</div>
            <div className={s.emptyTitle}>Erreur de chargement</div>
            <div className={s.emptySub}>{error}</div>
          </div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Produit</th>
                  <th>Client</th>
                  <th>Motif</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j}>
                          <div className={s.skCell} style={{ width: `${60 + Math.random() * 40}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : returns.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className={s.empty}>
                        <div className={s.emptyIco}>📭</div>
                        <div className={s.emptyTitle}>Aucun retour trouvé</div>
                        <div className={s.emptySub}>Aucune demande de retour ne correspond à vos filtres.</div>
                      </div>
                    </td>
                  </tr>
                ) : returns.map(r => {
                  const st  = STATUS_LABELS[r.status]   ?? { label: r.status,   cls: s.pillClosed };
                  const prio = PRIORITY_LABELS[r.priority] ?? { label: r.priority, cls: s.prioNormal };
                  return (
                    <tr key={r.id} onClick={() => onSelect(r.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontSize: 11.5, fontWeight: 700, color: 'var(--blue)' }}>
                          {r.reference}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {r.productImage
                            ? <img src={r.productImage} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--bdr)' }} />
                            : <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--g100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📦</div>
                          }
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--navy)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.productName}
                            </div>
                            {r.productVariant && (
                              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.productVariant}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%',
                            background: 'var(--sky)', color: 'var(--blue)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 800, overflow: 'hidden', flexShrink: 0,
                          }}>
                            {r.clientAvatar
                              ? <img src={r.clientAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : r.clientName.charAt(0).toUpperCase()
                            }
                          </div>
                          <span style={{ fontSize: 12.5 }}>{r.clientName}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--t2)', maxWidth: 130 }}>
                        {REASON_LABELS[r.reason] ?? r.reason}
                      </td>
                      <td>
                        <span style={{ fontSize: 11.5, background: 'var(--g100)', padding: '2px 8px', borderRadius: 999, color: 'var(--t2)', fontWeight: 600 }}>
                          {{ refund: 'Remboursement', exchange: 'Échange', repair: 'Réparation', credit: 'Avoir' }[r.returnType] ?? r.returnType}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
                          {fmt(r.montantDemande)} GNF
                        </div>
                        {r.montantAccorde !== null && r.montantAccorde !== r.montantDemande && (
                          <div style={{ fontSize: 11, color: 'var(--emerald)' }}>
                            Accordé: {fmt(r.montantAccorde)} GNF
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`${s.pill} ${prio.cls}`}>{prio.label}</span>
                      </td>
                      <td>
                        <span className={`${s.pill} ${st.cls}`}>{st.label}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                        {fmtDate(r.createdAt)}
                      </td>
                      <td>
                        <div className={s.actions} onClick={e => e.stopPropagation()}>
                          <button className={`${s.btnSm} ${s.btnDetail}`} onClick={() => onSelect(r.id)}>
                            <i className="fas fa-eye" /> Voir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && !error && total > 0 && (
          <div className={s.pagination}>
            <span>{total} résultat{total > 1 ? 's' : ''} · Page {page}/{pages}</span>
            <div className={s.pgBtns}>
              <button
                className={`${s.pgBtn} ${page <= 1 ? s.pgBtnDisabled : ''}`}
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <i className="fas fa-chevron-left" />
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const pg = page <= 4 ? i + 1 : page - 3 + i;
                if (pg < 1 || pg > pages) return null;
                return (
                  <button
                    key={pg}
                    className={`${s.pgBtn} ${pg === page ? s.pgBtnActive : ''}`}
                    onClick={() => onPageChange(pg)}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                className={`${s.pgBtn} ${page >= pages ? s.pgBtnDisabled : ''}`}
                disabled={page >= pages}
                onClick={() => onPageChange(page + 1)}
              >
                <i className="fas fa-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
