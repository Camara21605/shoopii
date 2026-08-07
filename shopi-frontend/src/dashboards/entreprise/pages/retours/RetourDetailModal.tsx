/*
 * RetourDetailModal.tsx — Modale détail complet d'un retour.
 * Affiche : infos, historique timeline, photos, notes, actions.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRetourDetail } from '../../hooks/useRetours';
import type { ReturnStatus } from '../../hooks/useRetours';
import s from './RetoursPage.module.css';

const ACTION_ICONS: Record<string, { ico: string; color: string; bg: string }> = {
  created:          { ico: 'fa-plus', color: 'var(--t2)', bg: 'var(--g100)' },
  accepted:         { ico: 'fa-check', color: 'var(--emerald)', bg: 'var(--em-bg)' },
  refused:          { ico: 'fa-xmark', color: 'var(--red)', bg: 'var(--rs-bg)' },
  refunded:         { ico: 'fa-coins', color: 'var(--emerald)', bg: 'var(--em-bg)' },
  received:         { ico: 'fa-box-open', color: 'var(--blue)', bg: 'var(--sky-2)' },
  note_added:       { ico: 'fa-note-sticky', color: 'var(--t2)', bg: 'var(--g100)' },
  evidence_uploaded:{ ico: 'fa-image', color: 'var(--violet)', bg: 'var(--vl-bg)' },
  priority_changed: { ico: 'fa-flag', color: 'var(--amber)', bg: 'var(--am-bg)' },
  default:          { ico: 'fa-circle-dot', color: 'var(--t2)', bg: 'var(--g100)' },
};

function fmt(n: number)  { return n.toLocaleString('fr-FR'); }
function fmtDt(d: string){ return new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }); }

interface Props {
  returnId:   string;
  onClose:    () => void;
  onAccept:   (id: string, montant: number, note?: string) => Promise<void>;
  onRefuse:   (id: string, note?: string)                  => Promise<void>;
  onRefund:   (id: string, montant?: number)               => Promise<void>;
  onAddNote:  (id: string, content: string)                => Promise<void>;
  onPop:      (msg: string, type?: string) => void;
}

export default function RetourDetailModal({
  returnId, onClose, onAccept, onRefuse, onRefund, onAddNote, onPop,
}: Props) {
  const { t } = useTranslation();
  const { detail, loading, error, reload } = useRetourDetail(returnId);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'evidence'>('info');
  const [saving, setSaving]       = useState(false);

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

  const ACTION_LABELS: Record<string, string> = {
    created:           t('retours.detail.actions.created'),
    accepted:          t('retours.detail.actions.accepted'),
    refused:           t('retours.detail.actions.refused'),
    refunded:          t('retours.detail.actions.refunded'),
    received:          t('retours.detail.actions.received'),
    note_added:        t('retours.detail.actions.note_added'),
    evidence_uploaded: t('retours.detail.actions.evidence_uploaded'),
    priority_changed:  t('retours.detail.actions.priority_changed'),
  };

  /* ── Formulaires d'action ── */
  const [acceptMontant, setAcceptMontant] = useState('');
  const [acceptNote,    setAcceptNote]    = useState('');
  const [refuseNote,    setRefuseNote]    = useState('');
  const [noteContent,   setNoteContent]   = useState('');
  const [showAccept,    setShowAccept]    = useState(false);
  const [showRefuse,    setShowRefuse]    = useState(false);
  const [showNote,      setShowNote]      = useState(false);

  /* Pré-remplir le montant accordé */
  useEffect(() => {
    if (detail) {
      setAcceptMontant(String(detail.montantAccorde ?? detail.montantDemande));
    }
  }, [detail]);

  /* Escape pour fermer */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const handleAccept = async () => {
    const montant = parseInt(acceptMontant) || 0;
    if (montant <= 0) { onPop(t('retours.detail.invalidAmount'), 'w'); return; }
    setSaving(true);
    try {
      await onAccept(returnId, montant, acceptNote || undefined);
    } finally { setSaving(false); }
  };

  const handleRefuse = async () => {
    setSaving(true);
    try { await onRefuse(returnId, refuseNote || undefined); }
    finally { setSaving(false); }
  };

  const handleNote = async () => {
    if (!noteContent.trim()) return;
    setSaving(true);
    try {
      await onAddNote(returnId, noteContent.trim());
      setNoteContent('');
      setShowNote(false);
      reload();
    } finally { setSaving(false); }
  };

  const handleRefund = async () => {
    if (!window.confirm(t('retours.detail.confirmRefund'))) return;
    setSaving(true);
    try { await onRefund(returnId, undefined); }
    finally { setSaving(false); }
  };

  return (
    <div className={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${s.modal} ${s.modalLg}`}>

        {/* ── Header ── */}
        <div className={s.modalHead}>
          <div>
            <div className={s.modalTitle}>
              {loading ? '…' : detail?.reference ?? '—'}
            </div>
            {detail && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className={`${s.pill} ${STATUS_LABELS[detail.status]?.cls ?? s.pillClosed}`} style={{ fontSize: 11 }}>
                  {STATUS_LABELS[detail.status]?.label ?? detail.status}
                </span>
                <span className={s.modalSub}>
                  {detail.productName} · {detail.clientName}
                </span>
              </div>
            )}
          </div>
          <button className={s.modalClose} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* ── Onglets ── */}
        <div style={{ display: 'flex', gap: 4, padding: '0 22px', borderBottom: '1px solid var(--bdr)', background: 'var(--g50)' }}>
          {(['info', 'history', 'evidence'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              style={{
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700,
                color: activeTab === tabKey ? 'var(--t2)' : 'var(--t3)',
                borderBottom: `2px solid ${activeTab === tabKey ? 'var(--t2)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {tabKey === 'info' && <><i className="fas fa-circle-info" /> {t('retours.detail.tabInfo')}</>}
              {tabKey === 'history' && <><i className="fas fa-clock-rotate-left" /> {t('retours.detail.tabHistory')}</>}
              {tabKey === 'evidence' && <><i className="fas fa-images" /> {t('retours.detail.tabEvidence', { count: detail ? detail.evidences.length : 0 })}</>}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className={s.modalBody}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--t2)' }} />
            </div>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
              <div>{error}</div>
            </div>
          )}

          {!loading && detail && (

            /* ── ONGLET INFO ── */
            activeTab === 'info' ? (
              <div className="gridR2" style={{ gap: 16 }}>

                {/* Produit & commande */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    {t('retours.detail.produitRetourne')}
                  </div>
                  <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>{detail.productName}</div>
                    {detail.productVariant && <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>{detail.productVariant}</div>}
                    <div style={{ fontSize: 12, color: 'var(--t2)' }}>{t('retours.detail.qte')} <strong>{detail.quantity}</strong></div>
                    {detail.commande && (
                      <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
                        {t('retours.detail.commande')} <span style={{ fontWeight: 700, color: 'var(--t2)' }}>{detail.commande.numero}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Montants */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    {t('retours.detail.montants')}
                  </div>
                  <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{t('retours.detail.demande')}</span>
                      <span style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>
                        {fmt(detail.montantDemande)} GNF
                      </span>
                    </div>
                    {detail.montantAccorde !== null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--t2)' }}>{t('retours.detail.accorde')}</span>
                        <span style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 15, fontWeight: 800, color: 'var(--t2)' }}>
                          {fmt(detail.montantAccorde)} GNF
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    {t('retours.detail.descriptionProbleme')}
                  </div>
                  <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--t1)', lineHeight: 1.6 }}>
                    {detail.description}
                  </div>
                </div>

                {/* Note interne */}
                {detail.noteInterne && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                      <i className="fas fa-note-sticky" /> {t('retours.detail.noteInterne')}
                    </div>
                    <div style={{ background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 12, padding: 14, fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6 }}>
                      {detail.noteInterne}
                    </div>
                  </div>
                )}

                {/* Note client */}
                {detail.noteClient && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                      <i className="fas fa-message" /> {t('retours.detail.messageClient')}
                    </div>
                    <div style={{ background: 'var(--sky)', border: '1px solid var(--sky-3)', borderRadius: 12, padding: 14, fontSize: 12.5, color: 'var(--navy)', lineHeight: 1.6 }}>
                      {detail.noteClient}
                    </div>
                  </div>
                )}

                {/* Formulaires conditionnels */}
                {showAccept && (
                  <div style={{ gridColumn: '1 / -1', background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>
                      <i className="fas fa-check-circle" /> {t('retours.detail.accept.title')}
                    </div>
                    <div className={s.field} style={{ marginBottom: 10 }}>
                      <label className={s.label}>{t('retours.detail.accept.montant')}</label>
                      <input
                        type="number" className={s.input}
                        value={acceptMontant}
                        onChange={e => setAcceptMontant(e.target.value)}
                        min={0}
                      />
                    </div>
                    <div className={s.field} style={{ marginBottom: 12 }}>
                      <label className={s.label}>{t('retours.detail.accept.message')}</label>
                      <textarea
                        className={s.textarea}
                        value={acceptNote}
                        onChange={e => setAcceptNote(e.target.value)}
                        placeholder={t('retours.detail.accept.placeholder')}
                        rows={3}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={`${s.btn} ${s.btnSuccess}`} onClick={handleAccept} disabled={saving}>
                        {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check" />}
                        {t('retours.detail.accept.confirm')}
                      </button>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowAccept(false)}>{t('retours.detail.accept.annuler')}</button>
                    </div>
                  </div>
                )}

                {showRefuse && (
                  <div style={{ gridColumn: '1 / -1', background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)', marginBottom: 12 }}>
                      <i className="fas fa-xmark-circle" /> {t('retours.detail.refuse.title')}
                    </div>
                    <div className={s.field} style={{ marginBottom: 12 }}>
                      <label className={s.label}>{t('retours.detail.refuse.raison')}</label>
                      <textarea
                        className={s.textarea}
                        value={refuseNote}
                        onChange={e => setRefuseNote(e.target.value)}
                        placeholder={t('retours.detail.refuse.placeholder')}
                        rows={3}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={`${s.btn} ${s.btnDanger}`} onClick={handleRefuse} disabled={saving}>
                        {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-xmark" />}
                        {t('retours.detail.refuse.confirm')}
                      </button>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowRefuse(false)}>{t('retours.detail.refuse.annuler')}</button>
                    </div>
                  </div>
                )}

                {showNote && (
                  <div style={{ gridColumn: '1 / -1', background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>
                      <i className="fas fa-note-sticky" /> {t('retours.detail.note.title')}
                    </div>
                    <div className={s.field} style={{ marginBottom: 12 }}>
                      <textarea
                        className={s.textarea}
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                        placeholder={t('retours.detail.note.placeholder')}
                        rows={3}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleNote} disabled={saving || !noteContent.trim()}>
                        {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
                        {t('retours.detail.note.save')}
                      </button>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowNote(false)}>{t('retours.detail.note.annuler')}</button>
                    </div>
                  </div>
                )}
              </div>

            /* ── ONGLET HISTORIQUE ── */
            ) : activeTab === 'history' ? (
              <div className={s.timeline}>
                {detail.history.length === 0 ? (
                  <div className={s.empty}>
                    <div className={s.emptyIco}>📋</div>
                    <div className={s.emptyTitle}>{t('retours.detail.historyEmptyTitle')}</div>
                    <div className={s.emptySub}>{t('retours.detail.historyEmptySub')}</div>
                  </div>
                ) : detail.history.map((h, i) => {
                  const icon = ACTION_ICONS[h.action] ?? ACTION_ICONS.default;
                  return (
                    <div key={h.id} className={s.timelineItem}>
                      {i < detail.history.length - 1 && <div className={s.timelineLine} />}
                      <div className={s.timelineDot} style={{ background: icon.bg, color: icon.color }}>
                        <i className={`fas ${icon.ico}`} />
                      </div>
                      <div className={s.timelineContent}>
                        <div className={s.timelineAction}>
                          {ACTION_LABELS[h.action] ?? h.action}
                        </div>
                        <div className={s.timelineMeta}>
                          {h.actorName && <span>{h.actorName} · </span>}
                          <span style={{ textTransform: 'capitalize' }}>{h.actorRole}</span>
                          <span> · {fmtDt(h.createdAt)}</span>
                        </div>
                        {h.metadata && Object.keys(h.metadata).length > 0 && (
                          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 4, background: 'var(--g50)', padding: '4px 10px', borderRadius: 7, display: 'inline-block' }}>
                            {JSON.stringify(h.metadata)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            /* ── ONGLET PREUVES ── */
            ) : (
              <div>
                {detail.evidences.length === 0 ? (
                  <div className={s.empty}>
                    <div className={s.emptyIco}>🖼️</div>
                    <div className={s.emptyTitle}>{t('retours.detail.evidenceEmptyTitle')}</div>
                    <div className={s.emptySub}>{t('retours.detail.evidenceEmptySub')}</div>
                  </div>
                ) : (
                  <div className={s.gallery}>
                    {detail.evidences.map(e => (
                      <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className={s.galleryThumb}>
                        {e.type === 'image'
                          ? <img src={e.url} alt={e.filename ?? ''} className={s.galleryThumbImg} />
                          : <span className={s.galleryThumbDoc}>
                              {e.type === 'video' ? '🎥' : '📄'}
                            </span>
                        }
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* ── Footer — Actions ── */}
        {detail && !loading && (
          <div className={s.modalFoot}>
            <div style={{ display: 'flex', gap: 8, flex: 1 }}>
              <button className={`${s.btn} ${s.btnGhost}`} style={{ fontSize: 12 }} onClick={() => { setShowNote(true); setShowAccept(false); setShowRefuse(false); }}>
                <i className="fas fa-note-sticky" /> {t('retours.detail.footerNote')}
              </button>
            </div>

            {detail.status === 'pending' && (
              <>
                <button className={`${s.btn} ${s.btnDanger}`} onClick={() => { setShowRefuse(true); setShowAccept(false); setShowNote(false); }} disabled={saving}>
                  <i className="fas fa-xmark" /> {t('retours.detail.footerRefuser')}
                </button>
                <button className={`${s.btn} ${s.btnSuccess}`} onClick={() => { setShowAccept(true); setShowRefuse(false); setShowNote(false); }} disabled={saving}>
                  <i className="fas fa-check" /> {t('retours.detail.footerAccepter')}
                </button>
              </>
            )}

            {(detail.status === 'accepted' || detail.status === 'received') && (
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleRefund} disabled={saving}>
                {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-coins" />}
                {t('retours.detail.footerRembourser')}
              </button>
            )}

            <button className={`${s.btn} ${s.btnGhost}`} onClick={onClose}>{t('retours.detail.footerFermer')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
