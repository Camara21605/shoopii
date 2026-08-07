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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
  VIP:      { emoji: '👑', bg: 'var(--g100)',  color: 'var(--t2)',   border: 'rgba(128,128,128,.22)'  },
  Fidèle:   { emoji: '⭐', bg: 'var(--g100)', color: 'var(--t2)', border: 'rgba(128,128,128,.22)'  },
  Régulier: { emoji: '🔄', bg: 'var(--sky-2)', color: 'var(--t2)',    border: 'var(--sky-3)'         },
  Nouveau:  { emoji: '🆕', bg: 'var(--g100)', color: 'var(--t2)',  border: 'rgba(128,128,128,.22)' },
  Abonné:   { emoji: '👁️', bg: 'var(--g100)',  color: 'var(--t2)',      border: 'var(--bdr2)'          },
};

function getStatusLabels(t: TFunction): Record<string, { label: string; color: string; bg: string }> {
  return {
    pending:         { label: t('clientProfil.status.pending'),         color: 'var(--t2)', bg: 'var(--g100)' },
    paid:            { label: t('clientProfil.status.paid'),            color: 'var(--t2)', bg: 'var(--g100)' },
    in_progress:     { label: t('clientProfil.status.in_progress'),     color: 'var(--t2)', bg: 'var(--g100)' },
    awaiting_client: { label: t('clientProfil.status.awaiting_client'), color: 'var(--t2)', bg: 'var(--g100)' },
    delivered:       { label: t('clientProfil.status.delivered'),       color: 'var(--t2)', bg: 'var(--g100)' },
    auto_delivered:  { label: t('clientProfil.status.auto_delivered'),  color: 'var(--t2)', bg: 'var(--g100)' },
    cancelled:       { label: t('clientProfil.status.cancelled'),       color: 'var(--t1)', bg: 'var(--g100)' },
    refunded:        { label: t('clientProfil.status.refunded'),        color: 'var(--t2)', bg: 'var(--g100)' },
    disputed:        { label: t('clientProfil.status.disputed'),        color: 'var(--t1)', bg: 'var(--g100)' },
  };
}

function getModeLabels(t: TFunction): Record<string, string> {
  return {
    livreur:       t('clientProfil.mode.livreur'),
    correspondant: t('clientProfil.mode.correspondant'),
    partenaire:    t('clientProfil.mode.partenaire'),
    pickup:        t('clientProfil.mode.pickup'),
    mixte:         t('clientProfil.mode.mixte'),
  };
}

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

function fmtDateRel(d: string | null, t: TFunction) {
  if (!d) return '—';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days === 0) return t('clients.date.auj');
  if (days === 1) return t('clients.date.hier');
  if (days < 30)  return t('clients.date.ilYaJours', { count: days });
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
  const { t } = useTranslation();
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
      .catch(e => setError(e?.message ?? t('clients.error.title')))
      .finally(() => setLoading(false));
  }, [clientId, t]);

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
              <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: loading ? 'var(--g100)' : 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', border: '2.5px solid var(--sky-3)' }}>
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
                          {seg.emoji} {t(`clients.segment.${detail.segment}`)}
                        </span>
                      )}
                      {detail?.isSuivi && (
                        <span style={{ background: 'var(--g100)', color: 'var(--t2)', border: '1px solid rgba(128,128,128,.22)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                          <i className="fas fa-check-circle" style={{ marginRight: 4 }} />{t('clients.table.abonne')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: 3 }}>
                      {detail?.email}
                      {detail?.phone && <> · <i className="fas fa-phone" style={{ marginRight: 4 }} />{detail.phone}</>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
                      <i className="fas fa-calendar" style={{ marginRight: 4 }} />
                      {t('clientProfil.clientDepuis', { date: fmtDate(detail?.membreDepuis ?? null) })}
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
            <div className="gridR3" style={{ gap: 10, marginBottom: 14 }}>
              {[
                { ico: '🛒', label: t('clientProfil.kpi.commandes'),    val: String(detail.totalOrders),         sub: t('clientProfil.kpi.dansCetteBoutique') },
                { ico: '💰', label: t('clientProfil.kpi.totalDepense'), val: fmtGNF(detail.totalSpent),          sub: t('clientProfil.kpi.depuisLeDebut')     },
                { ico: '📅', label: t('clientProfil.kpi.derniereCmd'),  val: fmtDateRel(detail.lastOrderAt, t),     sub: fmtDate(detail.lastOrderAt) },
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
              { key: 'apercu',     label: t('clientProfil.tabs.apercu'),     icon: 'fa-user' },
              { key: 'commandes',  label: detail ? t('clientProfil.tabs.commandes', { count: detail.commandes.length }) : t('clientProfil.tabs.commandes', { count: '…' }), icon: 'fa-box' },
            ] as { key: 'apercu' | 'commandes'; label: string; icon: string }[]).map(tabItem => (
              <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
                style={{ padding: '8px 16px', border: 'none', background: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', borderBottom: `2px solid ${tab === tabItem.key ? 'var(--t2)' : 'transparent'}`, color: tab === tabItem.key ? 'var(--t2)' : 'var(--t3)', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className={`fas ${tabItem.icon}`} style={{ fontSize: 11 }} />{tabItem.label}
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
              <span style={{ fontSize: 13 }}>{t('clientProfil.loadingProfil')}</span>
            </div>
          )}

          {/* Erreur */}
          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}>{t('clients.error.title')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>{error}</div>
            </div>
          )}

          {/* ── ONGLET APERÇU ── */}
          {!loading && !error && detail && tab === 'apercu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Résumé relation */}
              <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg,var(--sky-2,#EFF6FF),var(--white))', border: '1.5px solid var(--sky-3)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                  {t('clientProfil.aperçu.relationTitle')}
                </div>
                <div className="gridR2" style={{ gap: 10 }}>
                  {[
                    { label: t('clientProfil.aperçu.commandesPassees'),   val: String(detail.totalOrders), color: 'var(--t2)'    },
                    { label: t('clientProfil.aperçu.totalDepense'),        val: fmtGNF(detail.totalSpent), color: 'var(--navy)'   },
                    { label: t('clientProfil.aperçu.abonneBoutique'), val: detail.isSuivi ? t('clientProfil.aperçu.oui') : t('clientProfil.aperçu.non'), color: detail.isSuivi ? 'var(--t2)' : 'var(--t3)' },
                    { label: t('clientProfil.aperçu.segment'),              val: `${seg?.emoji} ${t(`clients.segment.${detail.segment}`)}`, color: seg?.color ?? 'var(--t2)' },
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
                    {t('clientProfil.aperçu.derniereCommandeTitle')}
                  </div>
                  {(() => {
                    const c = detail.commandes[0];
                    const st = getStatusLabels(t)[c.status] ?? { label: c.status, color: 'var(--t2)', bg: 'var(--g100)' };
                    return (
                      <div style={{ padding: '13px 16px', background: 'var(--g50)', border: '1.5px solid var(--bdr)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--sky)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          🛒
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--t2)' }}>{c.numero}</span>
                            <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{st.label}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>
                            {fmtDate(c.createdAt)} · {getModeLabels(t)[c.modeLivraison] ?? c.modeLivraison}
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
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t('clientProfil.aperçu.aucuneCommandeTitle')}</div>
                  <div style={{ fontSize: 11.5, marginTop: 3 }}>{t('clientProfil.aperçu.aucuneCommandeSub')}</div>
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
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t('clientProfil.commandesTab.aucune')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detail.commandes.map((c, i) => {
                    const st = getStatusLabels(t)[c.status] ?? { label: c.status, color: 'var(--t2)', bg: 'var(--g100)' };
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: i % 2 === 0 ? 'var(--g50)' : 'var(--white)', border: '1.5px solid var(--bdr)', borderRadius: 12, transition: 'border-color .15s' }}>

                        {/* Numéro + date */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--t2)' }}>
                              {c.numero}
                            </span>
                            <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                              {st.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span><i className="fas fa-calendar" style={{ marginRight: 3 }} />{fmtDate(c.createdAt)}</span>
                            <span>·</span>
                            <span>{getModeLabels(t)[c.modeLivraison] ?? c.modeLivraison}</span>
                            {c.livraisonEffective && (
                              <>
                                <span>·</span>
                                <span style={{ color: 'var(--t2)' }}>
                                  <i className="fas fa-check" style={{ marginRight: 3 }} />
                                  {t('clientProfil.commandesTab.livreLe', { date: fmtDate(c.livraisonEffective) })}
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
                              {t('clientProfil.commandesTab.produits', { montant: fmtGNF(c.sousTotal ?? 0) })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {detail.totalOrders > 10 && (
                    <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--t3)' }}>
                      <i className="fas fa-info-circle" style={{ marginRight: 5 }} />
                      {t('clientProfil.commandesTab.affichageLimite', { total: detail.totalOrders })}
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
              onClick={() => { onPop(t('clientProfil.footer.messageToast', { name: detail.fullName }), 's'); }}
              style={{ flex: 1, padding: '10px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <i className="fas fa-envelope" /> {t('clientProfil.footer.envoyerMessage')}
            </button>
            <button
              onClick={onClose}
              style={{ padding: '10px 20px', background: 'var(--white)', color: 'var(--t2)', border: '1.5px solid var(--bdr2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t('clientProfil.footer.fermer')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
