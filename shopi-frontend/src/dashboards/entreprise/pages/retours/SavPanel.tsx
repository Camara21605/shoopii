/*
 * SavPanel.tsx — Gestion des tickets SAV.
 * Table des tickets + modale conversation.
 */
import { useState, useEffect, useRef } from 'react';
import { useSavDetail, type SavTicketSummary, type SavStatus, type SavMessage, type SavStats, type SavFilters } from '../../hooks/useSav';
import type { ReturnPriority } from '../../hooks/useRetours';
import s from './RetoursPage.module.css';

const STATUS_LABELS: Record<SavStatus, { label: string; cls: string }> = {
  open:           { label: '🟢 Ouvert',          cls: s.pillAccepted },
  in_progress:    { label: '🔵 En cours',         cls: s.pillTransit  },
  waiting_client: { label: '🟡 Attente client',   cls: s.pillPending  },
  resolved:       { label: '✓ Résolu',            cls: s.pillRefunded },
  closed:         { label: 'Fermé',               cls: s.pillClosed   },
};

const PRIORITY_LABELS: Record<ReturnPriority, { label: string; cls: string }> = {
  low:    { label: 'Basse',     cls: s.prioLow    },
  normal: { label: 'Normal',    cls: s.prioNormal },
  high:   { label: 'Haute',     cls: s.prioHigh   },
  urgent: { label: '🔴 Urgent', cls: s.prioUrgent },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  tickets:        SavTicketSummary[];
  stats:          SavStats | null;
  total:          number;
  loading:        boolean;
  filters:        SavFilters;
  onFilterChange: (patch: Partial<SavFilters>) => void;
  onPageChange:   (page: number) => void;
  onReply:        (ticketId: string, content: string) => Promise<SavMessage>;
  onClose:        (ticketId: string) => Promise<void>;
  onResolve:      (ticketId: string) => Promise<void>;
  onPop:          (msg: string, type?: string) => void;
}

export default function SavPanel({
  tickets, stats, loading, filters,
  onFilterChange,
  onReply, onClose, onResolve, onPop,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      {/* ── Stats SAV ── */}
      {stats && (
        <div className={s.kpiStrip} style={{ marginBottom: 16 }}>
          {[
            { ico: '📬', label: 'Tickets ouverts',    val: stats.open,       color: '#047857', bg: '#D1FAE5' },
            { ico: '🔵', label: 'En cours',           val: stats.inProgress, color: '#1A4FC4', bg: '#DBEAFE' },
            { ico: '✅', label: 'Résolus',            val: stats.resolved,   color: '#7C3AED', bg: '#EDE9FE' },
            { ico: '⏱️', label: 'Délai réponse moy.', val: `${stats.avgResponseMinutes}m`, color: '#B45309', bg: '#FEF3C7' },
          ].map((k, i) => (
            <div key={i} className={s.kpiCard}>
              <div className={s.kpiStripe} style={{ background: k.color }} />
              <div className={s.kpiIcon}>{k.ico}</div>
              <div className={s.kpiVal}>{k.val}</div>
              <div className={s.kpiLbl}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className={s.toolbar}>
        <div className={s.searchWrap}>
          <i className={`fas fa-magnifying-glass ${s.searchIco}`} />
          <input
            className={s.searchInput}
            placeholder="Rechercher un ticket (réf., sujet)…"
            value={filters.search ?? ''}
            onChange={e => onFilterChange({ search: e.target.value })}
          />
        </div>
        <select
          className={`${s.filterSel} ${filters.status ? s.filterActive : ''}`}
          value={filters.status ?? ''}
          onChange={e => onFilterChange({ status: e.target.value as SavStatus || undefined })}
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as SavStatus[]).map(k => (
            <option key={k} value={k}>{STATUS_LABELS[k].label}</option>
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
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Sujet</th>
                <th>Client</th>
                <th>Produit</th>
                <th>Priorité</th>
                <th>Statut</th>
                <th>Messages</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j}><div className={s.skCell} /></td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className={s.empty}>
                      <div className={s.emptyIco}>🎧</div>
                      <div className={s.emptyTitle}>Aucun ticket SAV</div>
                      <div className={s.emptySub}>Les tickets client apparaîtront ici.</div>
                    </div>
                  </td>
                </tr>
              ) : tickets.map(t => {
                const st   = STATUS_LABELS[t.status]    ?? { label: t.status,    cls: s.pillClosed };
                const prio = PRIORITY_LABELS[t.priority] ?? { label: t.priority, cls: s.prioNormal };
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(t.id)}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 11.5, fontWeight: 700, color: 'var(--blue)' }}>
                        {t.reference}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--navy)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.subject}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--sky)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                          {t.clientName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12.5 }}>{t.clientName}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--t3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.productName ?? '—'}
                    </td>
                    <td><span className={`${s.pill} ${prio.cls}`}>{prio.label}</span></td>
                    <td><span className={`${s.pill} ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="fas fa-comment-dots" style={{ fontSize: 11, color: 'var(--t3)' }} />
                        <span style={{ fontSize: 12.5 }}>{t.messageCount}</span>
                        {t.unreadCount > 0 && (
                          <span style={{ background: '#DC2626', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>
                            {t.unreadCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{fmtDate(t.createdAt)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className={s.actions}>
                        <button className={`${s.btnSm} ${s.btnDetail}`} onClick={() => setSelectedId(t.id)}>
                          <i className="fas fa-comment" /> Répondre
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modale conversation ── */}
      {selectedId && (
        <SavConversationModal
          ticketId={selectedId}
          onClose={() => setSelectedId(null)}
          onReply={onReply}
          onClose2={onClose}
          onResolve={onResolve}
          onPop={onPop}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function SavConversationModal({
  ticketId, onClose, onReply, onClose2, onResolve, onPop,
}: {
  ticketId:  string;
  onClose:   () => void;
  onReply:   (id: string, content: string) => Promise<SavMessage>;
  onClose2:  (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  onPop:     (msg: string, type?: string) => void;
}) {
  const { detail, loading, addMessage } = useSavDetail(ticketId);
  const [draft,   setDraft]   = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages.length]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const msg = await onReply(ticketId, draft.trim());
      addMessage(msg);
      setDraft('');
    } catch (e: any) {
      onPop(`❌ ${e?.message ?? 'Erreur envoi'}`, 'e');
    } finally { setSending(false); }
  };

  const handleClose = async () => {
    if (!window.confirm('Fermer ce ticket ?')) return;
    try { await onClose2(ticketId); onPop('Ticket fermé', 'i'); onClose(); }
    catch { onPop('❌ Erreur', 'e'); }
  };

  const handleResolve = async () => {
    try { await onResolve(ticketId); onPop('✅ Ticket résolu', 's'); onClose(); }
    catch { onPop('❌ Erreur', 'e'); }
  };

  return (
    <div className={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.modal} style={{ maxWidth: 680, height: '80vh' }}>

        {/* Header */}
        <div className={s.modalHead}>
          <div>
            <div className={s.modalTitle}>{loading ? '…' : detail?.reference ?? '—'}</div>
            {detail && <div className={s.modalSub}>{detail.subject} · {detail.clientName}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {detail && detail.status !== 'closed' && detail.status !== 'resolved' && (
              <>
                <button className={`${s.btnSm} ${s.btnAccept}`} onClick={handleResolve}>
                  <i className="fas fa-check" /> Résoudre
                </button>
                <button className={`${s.btnSm} ${s.btnClose}`} onClick={handleClose}>
                  <i className="fas fa-xmark" /> Fermer
                </button>
              </>
            )}
            <button className={s.modalClose} onClick={onClose}><i className="fas fa-xmark" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className={s.modalBody} style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 24, color: 'var(--blue)' }} />
            </div>
          ) : (
            <div className={s.conversation}>
              {(detail?.messages ?? []).map(msg => {
                const isEnt = msg.senderRole === 'enterprise';
                return (
                  <div key={msg.id} className={`${s.msgItem} ${isEnt ? s.msgItemEnt : ''}`}>
                    <div className={`${s.msgAvatar} ${isEnt ? s.msgAvatarEnt : s.msgAvatarCli}`}>
                      {msg.senderAvatar
                        ? <img src={msg.senderAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        : msg.senderName.charAt(0).toUpperCase()
                      }
                    </div>
                    <div>
                      <div className={`${s.msgBubble} ${isEnt ? s.msgBubbleEnt : s.msgBubbleCli}`}>
                        {msg.content}
                      </div>
                      <div className={`${s.msgTime} ${isEnt ? s.msgTimeEnt : s.msgTimeCli}`}>
                        {msg.senderName} · {fmtTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Réponse */}
        {detail && detail.status !== 'closed' && (
          <div style={{ padding: '12px 18px', borderTop: '1.5px solid var(--bdr)', background: 'var(--g50)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              className={s.textarea}
              style={{ flex: 1, minHeight: 60, maxHeight: 120, resize: 'vertical' }}
              placeholder="Répondre au client…"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
            />
            <button
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              style={{ height: 40, flexShrink: 0 }}
            >
              {sending
                ? <i className="fas fa-spinner fa-spin" />
                : <><i className="fas fa-paper-plane" /> Envoyer</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
