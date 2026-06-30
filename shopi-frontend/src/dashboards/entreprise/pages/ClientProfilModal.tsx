/*
 * FICHIER : src/dashboards/entreprise/pages/ClientProfilModal.tsx
 *
 * RÔLE : Modale profil complet d'un client, vue depuis le dashboard
 *        entreprise. S'ouvre quand on clique "Profil" dans ClientsPage.
 *
 * DONNÉES : GET /dashboard/entreprise/clients/:id
 *   - Identité (nom, email, téléphone, avatar)
 *   - Métriques (commandes, CA total, dernière commande)
 *   - Segment automatique (VIP / Fidèle / Régulier / Nouveau / Abonné)
 *   - Abonnement à la boutique
 *   - 10 dernières commandes passées dans cette boutique
 */

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import type { ClientSegment } from '../hooks/useClients';

/* ── Types ── */

interface ClientCommande {
  id:                 string;
  numero:             string;
  status:             string;
  total:              number;
  modeLivraison:      string;
  createdAt:          string;
  livraisonEffective: string | null;
}

interface ClientDetail {
  id:             string;
  userId:         string;
  fullName:       string;
  email:          string;
  phone:          string | null;
  profilePicture: string | null;
  membreDepuis:   string;
  totalOrders:    number;
  totalSpent:     number;
  lastOrderAt:    string | null;
  segment:        ClientSegment;
  isSuivi:        boolean;
  commandes:      ClientCommande[];
}

/* ── Constantes ── */

const SEGMENT_META: Record<ClientSegment, { emoji: string; bg: string; color: string; border: string }> = {
  VIP:      { emoji: '👑', bg: 'var(--am-bg)',  color: 'var(--amber)',   border: 'rgba(217,119,6,.22)'  },
  Fidèle:   { emoji: '⭐', bg: 'var(--em-bg)', color: 'var(--emerald)', border: 'rgba(5,150,105,.22)'  },
  Régulier: { emoji: '🔄', bg: 'var(--sky-2)', color: 'var(--blue)',    border: 'var(--sky-3)'         },
  Nouveau:  { emoji: '🆕', bg: 'var(--vl-bg)', color: 'var(--violet)',  border: 'rgba(124,58,237,.22)' },
  Abonné:   { emoji: '👁️', bg: 'var(--g100)',  color: 'var(--t2)',      border: 'var(--bdr2)'          },
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:         { label: 'En attente',    color: '#B45309', bg: '#FEF3C7' },
  paid:            { label: 'Payée',         color: '#0E7490', bg: '#CFFAFE' },
  in_progress:     { label: 'En cours',      color: '#1A4FC4', bg: '#DBEAFE' },
  awaiting_client: { label: 'À confirmer',   color: '#7C3AED', bg: '#EDE9FE' },
  delivered:       { label: 'Livrée',        color: '#047857', bg: '#D1FAE5' },
  auto_delivered:  { label: 'Livrée (auto)', color: '#047857', bg: '#D1FAE5' },
  cancelled:       { label: 'Annulée',       color: '#DC2626', bg: '#FEE2E2' },
  refunded:        { label: 'Remboursée',    color: '#6D28D9', bg: '#EDE9FE' },
  disputed:        { label: 'Litige',        color: '#DC2626', bg: '#FEE2E2' },
};

const MODE_LABELS: Record<string, string> = {
  livreur:       '🛵 Livreur',
  correspondant: '🤝 Correspondant',
  partenaire:    '🤝 Partenaire',
  pickup:        '🏪 Retrait boutique',
  mixte:         '🔀 Mixte',
};

/* ── Helpers ── */

function fmtGNF(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M GNF`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k GNF`;
  return `${n.toLocaleString('fr-FR')} GNF`;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateRel(d: string | null) {
  if (!d) return '—';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days === 0) return 'Auj.';
  if (days === 1) return 'Hier';
  if (days < 30)  return `Il y a ${days}j`;
  return fmtDate(d);
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
}

/* ══════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ════════════════════════════════════════════════════════════ */

interface Props {
  clientId: string;
  onClose:  () => void;
  onPop:    (msg: string, type?: string) => void;
}

export default function ClientProfilModal({ clientId, onClose, onPop }: Props) {
  const [detail,  setDetail]  = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<'apercu' | 'commandes'>('apercu');

  /* Charger le profil */
  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<ClientDetail>(`/dashboard/entreprise/clients/${clientId}`)
      .then(d => setDetail(d))
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [clientId]);

  /* Fermer avec Escape */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const seg = detail ? SEGMENT_META[detail.segment] : null;

  /* ── RENDER ── */
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,31,58,.5)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(11,31,58,.25)', overflow: 'hidden' }}>

        {/* ── HEADER ── */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--bdr)', flexShrink: 0 }}>

          {/* Titre + bouton fermer */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

              {/* Avatar */}
              <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: loading ? 'var(--g100)' : '#1A4FC4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', border: '2.5px solid var(--sky-3)' }}>
                {detail?.profilePicture
                  ? <img src={detail.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : loading ? null : getInitials(detail?.fullName ?? '?')
                }
              </div>

              {/* Infos identité */}
              <div>
                {loading ? (
                  <div style={{ width: 160, height: 16, background: 'var(--g100)', borderRadius: 6 }} />
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>
                        {detail?.fullName}
                      </span>
                      {detail && seg && (
                        <span style={{ background: seg.bg, color: seg.color, border: `1px solid ${seg.border}`, fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999 }}>
                          {seg.emoji} {detail.segment}
                        </span>
                      )}
                      {detail?.isSuivi && (
                        <span style={{ background: 'var(--em-bg)', color: 'var(--emerald)', border: '1px solid rgba(5,150,105,.22)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                          <i className="fas fa-check-circle" style={{ marginRight: 4 }} />Abonné
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: 3 }}>
                      {detail?.email}
                      {detail?.phone && <> · <i className="fas fa-phone" style={{ marginRight: 4 }} />{detail.phone}</>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
                      <i className="fas fa-calendar" style={{ marginRight: 4 }} />
                      Client depuis {fmtDate(detail?.membreDepuis ?? null)}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Fermer */}
            <button onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 9, border: '1.5px solid var(--bdr2)', background: 'var(--g50)', color: 'var(--t3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, flexShrink: 0, transition: 'all .15s' }}>
              <i className="fas fa-xmark" />
            </button>
          </div>

          {/* KPI strip */}
          {!loading && detail && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { ico: '🛒', label: 'Commandes',    val: String(detail.totalOrders),         sub: 'dans cette boutique' },
                { ico: '💰', label: 'Total dépensé', val: fmtGNF(detail.totalSpent),          sub: 'depuis le début'     },
                { ico: '📅', label: 'Dernière cmd',  val: fmtDateRel(detail.lastOrderAt),     sub: fmtDate(detail.lastOrderAt) },
              ].map(item => (
                <div key={item.label} style={{ padding: '11px 14px', background: 'var(--g50)', border: '1.5px solid var(--bdr)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{item.ico}</div>
                  <div style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 15, fontWeight: 800, color: 'var(--navy)', lineHeight: 1.2 }}>
                    {item.val}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{item.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Onglets */}
          <div style={{ display: 'flex', gap: 0, borderBottom: 'none' }}>
            {([
              { key: 'apercu',     label: 'Aperçu',     icon: 'fa-user' },
              { key: 'commandes',  label: `Commandes (${detail?.commandes.length ?? '…'})`, icon: 'fa-box' },
            ] as { key: 'apercu' | 'commandes'; label: string; icon: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '8px 16px', border: 'none', background: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', borderBottom: `2px solid ${tab === t.key ? 'var(--blue)' : 'transparent'}`, color: tab === t.key ? 'var(--blue)' : 'var(--t3)', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className={`fas ${t.icon}`} style={{ fontSize: 11 }} />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Chargement */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--t3)', gap: 10 }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28 }} />
              <span style={{ fontSize: 13 }}>Chargement du profil…</span>
            </div>
          )}

          {/* Erreur */}
          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 700, color: 'var(--rose)', marginBottom: 6 }}>Erreur de chargement</div>
              <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>{error}</div>
            </div>
          )}

          {/* ── ONGLET APERÇU ── */}
          {!loading && !error && detail && tab === 'apercu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Résumé relation */}
              <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg,var(--sky-2,#EFF6FF),var(--white))', border: '1.5px solid var(--sky-3)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                  Relation avec votre boutique
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Commandes passées',   val: String(detail.totalOrders), color: 'var(--blue)'    },
                    { label: 'Total dépensé',        val: fmtGNF(detail.totalSpent), color: 'var(--navy)'   },
                    { label: 'Abonné à la boutique', val: detail.isSuivi ? '✅ Oui' : '❌ Non', color: detail.isSuivi ? 'var(--emerald)' : 'var(--t3)' },
                    { label: 'Segment',              val: `${seg?.emoji} ${detail.segment}`, color: seg?.color ?? 'var(--t2)' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '10px 12px', background: 'var(--white)', border: '1px solid var(--bdr)', borderRadius: 10 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: item.color }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dernière commande (preview) */}
              {detail.commandes.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Dernière commande
                  </div>
                  {(() => {
                    const c = detail.commandes[0];
                    const st = STATUS_LABELS[c.status] ?? { label: c.status, color: 'var(--t2)', bg: 'var(--g100)' };
                    return (
                      <div style={{ padding: '13px 16px', background: 'var(--g50)', border: '1.5px solid var(--bdr)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--sky)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          🛒
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--blue)' }}>{c.numero}</span>
                            <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{st.label}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>
                            {fmtDate(c.createdAt)} · {MODE_LABELS[c.modeLivraison] ?? c.modeLivraison}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 15, fontWeight: 800, color: 'var(--navy)', textAlign: 'right' }}>
                          {fmtGNF(c.total)}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Message si aucune commande */}
              {detail.totalOrders === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t3)', background: 'var(--g50)', borderRadius: 12, border: '1px dashed var(--bdr2)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🛍️</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Aucune commande pour le moment</div>
                  <div style={{ fontSize: 11.5, marginTop: 3 }}>Ce client suit votre boutique mais n'a pas encore acheté.</div>
                </div>
              )}
            </div>
          )}

          {/* ── ONGLET COMMANDES ── */}
          {!loading && !error && detail && tab === 'commandes' && (
            <div>
              {detail.commandes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t3)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Aucune commande</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detail.commandes.map((c, i) => {
                    const st = STATUS_LABELS[c.status] ?? { label: c.status, color: 'var(--t2)', bg: 'var(--g100)' };
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: i % 2 === 0 ? 'var(--g50)' : 'var(--white)', border: '1.5px solid var(--bdr)', borderRadius: 12, transition: 'border-color .15s' }}>

                        {/* Numéro + date */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--blue)' }}>
                              {c.numero}
                            </span>
                            <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                              {st.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span><i className="fas fa-calendar" style={{ marginRight: 3 }} />{fmtDate(c.createdAt)}</span>
                            <span>·</span>
                            <span>{MODE_LABELS[c.modeLivraison] ?? c.modeLivraison}</span>
                            {c.livraisonEffective && (
                              <>
                                <span>·</span>
                                <span style={{ color: 'var(--emerald)' }}>
                                  <i className="fas fa-check" style={{ marginRight: 3 }} />
                                  Livré le {fmtDate(c.livraisonEffective)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Montant */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>
                            {fmtGNF(c.total)}
                          </div>
                          {c.total !== c.sousTotal && (
                            <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>
                              Produits : {fmtGNF(c.sousTotal ?? 0)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {detail.totalOrders > 10 && (
                    <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--t3)' }}>
                      <i className="fas fa-info-circle" style={{ marginRight: 5 }} />
                      Affichage des 10 dernières commandes sur {detail.totalOrders} au total.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── FOOTER ── */}
        {!loading && !error && detail && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--bdr)', display: 'flex', gap: 10, background: 'var(--g50)', flexShrink: 0 }}>
            <button
              onClick={() => { onPop(`📧 Message envoyé à ${detail.fullName}`, 's'); }}
              style={{ flex: 1, padding: '10px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <i className="fas fa-envelope" /> Envoyer un message
            </button>
            <button
              onClick={onClose}
              style={{ padding: '10px 20px', background: 'var(--white)', color: 'var(--t2)', border: '1.5px solid var(--bdr2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
