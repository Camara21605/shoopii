/*
 * RetourDetailModal.tsx — Modale détail complet d'un retour.
 * Affiche : infos, historique timeline, photos, notes, actions.
 */
import React, { useState, useEffect } from 'react';
import { useRetourDetail } from '../../hooks/useRetours';
import type { ReturnStatus } from '../../hooks/useRetours';
import s from './RetoursPage.module.css';

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

const ACTION_ICONS: Record<string, { ico: string; color: string; bg: string }> = {
  created:          { ico: 'fa-plus', color: '#1A4FC4', bg: '#DBEAFE' },
  accepted:         { ico: 'fa-check', color: '#047857', bg: '#D1FAE5' },
  refused:          { ico: 'fa-xmark', color: '#DC2626', bg: '#FEE2E2' },
  refunded:         { ico: 'fa-coins', color: '#7C3AED', bg: '#EDE9FE' },
  received:         { ico: 'fa-box-open', color: '#0E7490', bg: '#CFFAFE' },
  note_added:       { ico: 'fa-note-sticky', color: '#B45309', bg: '#FEF3C7' },
  evidence_uploaded:{ ico: 'fa-image', color: '#047857', bg: '#D1FAE5' },
  priority_changed: { ico: 'fa-flag', color: '#6D28D9', bg: '#EDE9FE' },
  default:          { ico: 'fa-circle-dot', color: '#64748B', bg: '#F1F5F9' },
};

const ACTION_LABELS: Record<string, string> = {
  created:           'Demande de retour créée',
  accepted:          'Retour accepté',
  refused:           'Retour refusé',
  refunded:          'Remboursement effectué',
  received:          'Retour reçu',
  note_added:        'Note interne ajoutée',
  evidence_uploaded: 'Preuve ajoutée',
  priority_changed:  'Priorité modifiée',
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
  const { detail, loading, error, reload } = useRetourDetail(returnId);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'evidence'>('info');
  const [saving, setSaving]       = useState(false);

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
    if (montant <= 0) { onPop('⚠️ Montant invalide', 'w'); return; }
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
    if (!window.confirm('Confirmer le remboursement ?')) return;
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
          {(['info', 'history', 'evidence'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700,
                color: activeTab === t ? 'var(--blue)' : 'var(--t3)',
                borderBottom: `2px solid ${activeTab === t ? 'var(--blue)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {t === 'info' && <><i className="fas fa-circle-info" /> Détails</>}
              {t === 'history' && <><i className="fas fa-clock-rotate-left" /> Historique</>}
              {t === 'evidence' && <><i className="fas fa-images" /> Preuves {detail ? `(${detail.evidences.length})` : ''}</>}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className={s.modalBody}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, color: 'var(--blue)' }} />
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Produit & commande */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    PRODUIT RETOURNÉ
                  </div>
                  <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)', marginBottom: 4 }}>{detail.productName}</div>
                    {detail.productVariant && <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>{detail.productVariant}</div>}
                    <div style={{ fontSize: 12, color: 'var(--t2)' }}>Qté : <strong>{detail.quantity}</strong></div>
                    {detail.commande && (
                      <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
                        Commande : <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{detail.commande.numero}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Montants */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    MONTANTS
                  </div>
                  <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--t2)' }}>Demandé :</span>
                      <span style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>
                        {fmt(detail.montantDemande)} GNF
                      </span>
                    </div>
                    {detail.montantAccorde !== null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--t2)' }}>Accordé :</span>
                        <span style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 15, fontWeight: 800, color: 'var(--emerald)' }}>
                          {fmt(detail.montantAccorde)} GNF
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    DESCRIPTION DU PROBLÈME
                  </div>
                  <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 12, padding: 14, fontSize: 13, color: 'var(--t1)', lineHeight: 1.6 }}>
                    {detail.description}
                  </div>
                </div>

                {/* Note interne */}
                {detail.noteInterne && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                      <i className="fas fa-note-sticky" /> NOTE INTERNE
                    </div>
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 14, fontSize: 12.5, color: '#92400E', lineHeight: 1.6 }}>
                      {detail.noteInterne}
                    </div>
                  </div>
                )}

                {/* Note client */}
                {detail.noteClient && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                      <i className="fas fa-message" /> MESSAGE CLIENT
                    </div>
                    <div style={{ background: 'var(--sky)', border: '1px solid var(--sky-3)', borderRadius: 12, padding: 14, fontSize: 12.5, color: 'var(--navy)', lineHeight: 1.6 }}>
                      {detail.noteClient}
                    </div>
                  </div>
                )}

                {/* Formulaires conditionnels */}
                {showAccept && (
                  <div style={{ gridColumn: '1 / -1', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#047857', marginBottom: 12 }}>
                      <i className="fas fa-check-circle" /> Accepter le retour
                    </div>
                    <div className={s.field} style={{ marginBottom: 10 }}>
                      <label className={s.label}>Montant accordé (GNF)</label>
                      <input
                        type="number" className={s.input}
                        value={acceptMontant}
                        onChange={e => setAcceptMontant(e.target.value)}
                        min={0}
                      />
                    </div>
                    <div className={s.field} style={{ marginBottom: 12 }}>
                      <label className={s.label}>Message au client (optionnel)</label>
                      <textarea
                        className={s.textarea}
                        value={acceptNote}
                        onChange={e => setAcceptNote(e.target.value)}
                        placeholder="Ex : Votre retour a été accepté. Le remboursement sera effectué sous 3-5 jours."
                        rows={3}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={`${s.btn} ${s.btnSuccess}`} onClick={handleAccept} disabled={saving}>
                        {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check" />}
                        Confirmer l'acceptation
                      </button>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowAccept(false)}>Annuler</button>
                    </div>
                  </div>
                )}

                {showRefuse && (
                  <div style={{ gridColumn: '1 / -1', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#DC2626', marginBottom: 12 }}>
                      <i className="fas fa-xmark-circle" /> Refuser le retour
                    </div>
                    <div className={s.field} style={{ marginBottom: 12 }}>
                      <label className={s.label}>Raison du refus (envoyée au client)</label>
                      <textarea
                        className={s.textarea}
                        value={refuseNote}
                        onChange={e => setRefuseNote(e.target.value)}
                        placeholder="Ex : Votre demande ne respecte pas la politique de retour (délai dépassé)."
                        rows={3}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={`${s.btn} ${s.btnDanger}`} onClick={handleRefuse} disabled={saving}>
                        {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-xmark" />}
                        Confirmer le refus
                      </button>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowRefuse(false)}>Annuler</button>
                    </div>
                  </div>
                )}

                {showNote && (
                  <div style={{ gridColumn: '1 / -1', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#B45309', marginBottom: 12 }}>
                      <i className="fas fa-note-sticky" /> Note interne
                    </div>
                    <div className={s.field} style={{ marginBottom: 12 }}>
                      <textarea
                        className={s.textarea}
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                        placeholder="Note visible uniquement par votre équipe…"
                        rows={3}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleNote} disabled={saving || !noteContent.trim()}>
                        {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
                        Enregistrer
                      </button>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setShowNote(false)}>Annuler</button>
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
                    <div className={s.emptyTitle}>Aucun historique</div>
                    <div className={s.emptySub}>L'historique des actions apparaîtra ici.</div>
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
                    <div className={s.emptyTitle}>Aucune preuve</div>
                    <div className={s.emptySub}>Le client n'a pas encore joint de photos ou documents.</div>
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
                <i className="fas fa-note-sticky" /> Note
              </button>
            </div>

            {detail.status === 'pending' && (
              <>
                <button className={`${s.btn} ${s.btnDanger}`} onClick={() => { setShowRefuse(true); setShowAccept(false); setShowNote(false); }} disabled={saving}>
                  <i className="fas fa-xmark" /> Refuser
                </button>
                <button className={`${s.btn} ${s.btnSuccess}`} onClick={() => { setShowAccept(true); setShowRefuse(false); setShowNote(false); }} disabled={saving}>
                  <i className="fas fa-check" /> Accepter
                </button>
              </>
            )}

            {(detail.status === 'accepted' || detail.status === 'received') && (
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={handleRefund} disabled={saving}>
                {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-coins" />}
                Rembourser
              </button>
            )}

            <button className={`${s.btn} ${s.btnGhost}`} onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}
