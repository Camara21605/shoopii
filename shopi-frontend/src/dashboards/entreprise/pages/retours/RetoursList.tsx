/*
 * RetoursList.tsx — Table paginée avec filtres et actions rapides.
 */
import { useTranslation } from 'react-i18next';
import type { ReturnSummary, ReturnStatus, ReturnReason, ReturnPriority, ReturnsFilters } from '../../hooks/useRetours';
import s from './RetoursPage.module.css';

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
  const { t } = useTranslation();
  const page  = filters.page  ?? 1;
  const pages = Math.ceil(total / LIMIT);

  const STATUS_LABELS: Record<ReturnStatus, { label: string; cls: string }> = {
    pending:    { label: t('retours.list.status.pending'),    cls: s.pillPending  },
    accepted:   { label: t('retours.list.status.accepted'),   cls: s.pillAccepted },
    refused:    { label: t('retours.list.status.refused'),    cls: s.pillRefused  },
    in_transit: { label: t('retours.list.status.in_transit'), cls: s.pillTransit  },
    received:   { label: t('retours.list.status.received'),   cls: s.pillReceived },
    refunded:   { label: t('retours.list.status.refunded'),   cls: s.pillRefunded },
    exchanged:  { label: t('retours.list.status.exchanged'),  cls: s.pillExchanged},
    closed:     { label: t('retours.list.status.closed'),     cls: s.pillClosed   },
  };

  const REASON_LABELS: Record<string, string> = {
    defective:      t('retours.list.reasons.defective'),
    not_matching:   t('retours.list.reasons.not_matching'),
    change_of_mind: t('retours.list.reasons.change_of_mind'),
    wrong_item:     t('retours.list.reasons.wrong_item'),
    damaged:        t('retours.list.reasons.damaged'),
    expired:        t('retours.list.reasons.expired'),
    other:          t('retours.list.reasons.other'),
  };

  const PRIORITY_LABELS: Record<ReturnPriority, { label: string; cls: string }> = {
    low:    { label: t('retours.list.priority.low'),    cls: s.prioLow    },
    normal: { label: t('retours.list.priority.normal'), cls: s.prioNormal },
    high:   { label: t('retours.list.priority.high'),   cls: s.prioHigh   },
    urgent: { label: t('retours.list.priority.urgent'), cls: s.prioUrgent },
  };

  const RETURN_TYPE_LABELS: Record<string, string> = {
    refund: t('retours.list.returnType.refund'),
    exchange: t('retours.list.returnType.exchange'),
    repair: t('retours.list.returnType.repair'),
    credit: t('retours.list.returnType.credit'),
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className={s.toolbar}>
        <div className={s.searchWrap}>
          <i className={`fas fa-magnifying-glass ${s.searchIco}`} />
          <input
            className={s.searchInput}
            placeholder={t('retours.list.search')}
            value={filters.search ?? ''}
            onChange={e => onFilterChange({ search: e.target.value })}
          />
        </div>

        <select
          className={`${s.filterSel} ${filters.status ? s.filterActive : ''}`}
          value={filters.status ?? ''}
          onChange={e => onFilterChange({ status: e.target.value as ReturnStatus || undefined })}
        >
          <option value="">{t('retours.list.allStatus')}</option>
          {(Object.keys(STATUS_LABELS) as ReturnStatus[]).map(k => (
            <option key={k} value={k}>{STATUS_LABELS[k].label}</option>
          ))}
        </select>

        <select
          className={`${s.filterSel} ${filters.reason ? s.filterActive : ''}`}
          value={filters.reason ?? ''}
          onChange={e => onFilterChange({ reason: e.target.value as ReturnReason || undefined })}
        >
          <option value="">{t('retours.list.allReasons')}</option>
          {Object.entries(REASON_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          className={`${s.filterSel} ${filters.priority ? s.filterActive : ''}`}
          value={filters.priority ?? ''}
          onChange={e => onFilterChange({ priority: e.target.value as ReturnPriority || undefined })}
        >
          <option value="">{t('retours.list.allPriorities')}</option>
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
          <option value="createdAt_DESC">{t('retours.list.sort.recent')}</option>
          <option value="createdAt_ASC">{t('retours.list.sort.oldest')}</option>
          <option value="montantDemande_DESC">{t('retours.list.sort.amountDesc')}</option>
          <option value="montantDemande_ASC">{t('retours.list.sort.amountAsc')}</option>
          <option value="status_ASC">{t('retours.list.sort.statusAz')}</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ marginBottom: 0 }}>
        {error ? (
          <div className={s.empty}>
            <div className={s.emptyIco}>⚠️</div>
            <div className={s.emptyTitle}>{t('retours.list.loadError')}</div>
            <div className={s.emptySub}>{error}</div>
          </div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('retours.list.table.reference')}</th>
                  <th>{t('retours.list.table.produit')}</th>
                  <th>{t('retours.list.table.client')}</th>
                  <th>{t('retours.list.table.motif')}</th>
                  <th>{t('retours.list.table.type')}</th>
                  <th>{t('retours.list.table.montant')}</th>
                  <th>{t('retours.list.table.priorite')}</th>
                  <th>{t('retours.list.table.statut')}</th>
                  <th>{t('retours.list.table.date')}</th>
                  <th>{t('retours.list.table.actions')}</th>
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
                        <div className={s.emptyTitle}>{t('retours.list.emptyTitle')}</div>
                        <div className={s.emptySub}>{t('retours.list.emptySub')}</div>
                      </div>
                    </td>
                  </tr>
                ) : returns.map(r => {
                  const st  = STATUS_LABELS[r.status]   ?? { label: r.status,   cls: s.pillClosed };
                  const prio = PRIORITY_LABELS[r.priority] ?? { label: r.priority, cls: s.prioNormal };
                  return (
                    <tr key={r.id} onClick={() => onSelect(r.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontSize: 11.5, fontWeight: 700, color: 'var(--t2)' }}>
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
                            background: 'var(--sky)', color: 'var(--t2)',
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
                          {RETURN_TYPE_LABELS[r.returnType] ?? r.returnType}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
                          {fmt(r.montantDemande)} GNF
                        </div>
                        {r.montantAccorde !== null && r.montantAccorde !== r.montantDemande && (
                          <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                            {t('retours.list.accorde', { montant: fmt(r.montantAccorde) })}
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
                            <i className="fas fa-eye" /> {t('retours.list.voir')}
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
            <span>{t('retours.list.results', { count: total })} · {t('retours.list.page', { page, pages })}</span>
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
