/*
 * FICHIER : src/modules/home/components/service/pages/ServiceDetailPage.tsx
 *
 * RÔLE : Page publique "/service/:id" — fiche détaillée d'UNE prestation
 *        de service. Volontairement DIFFÉRENTE de ProduitPage.tsx : pas
 *        de panier/stock/vente en gros/livraison, remplacés par ce qui a
 *        du sens pour un service (tarification, durée, mode de
 *        prestation, réservation/annulation, garanties, "ce qui est
 *        inclus") et un panneau de contact (pas d'achat direct — hors
 *        scope MVP, voir service.entity.ts "hors scope").
 *
 * Réutilise la mise en page 3 colonnes de ProduitPage.module.css (classes
 * génériques, pas spécifiques aux produits) plutôt que de dupliquer un
 * fichier CSS quasi identique.
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../../shared/services/apiFetch';

import Header       from '../../layout/Header';
import Footer       from '../../layout/Footer';
import ModalPartage from '../../produit/components/ModalPartage';

import type { ServiceApi } from '../../../cards/CardService';
import styles from '../../produit/styles/ProduitPage.module.css';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

function SkeletonPage() {
  return (
    <div style={{ padding: '80px 20px', maxWidth: 1200, margin: '0 auto' }}>
      {[280, 60, 120].map((h, i) => (
        <div key={i} style={{
          height: h, borderRadius: 16, marginBottom: 16,
          background: 'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
        }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

const DELAI_LABELS: Record<string, string> = {
  immediate: 'Réponse immédiate',
  '24h':     'Réponse sous 24h',
  '48h':     'Réponse sous 48h',
  '7j':      'Réponse sous 7 jours',
};

const ANNULATION_LABELS: Record<string, string> = {
  flexible:          'Annulation flexible',
  moderee:           'Annulation modérée',
  stricte:           'Annulation stricte',
  non_remboursable:  'Non remboursable',
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function ServiceDetailPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id: serviceId } = useParams<{ id: string }>();

  const [service, setService] = useState<ServiceApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [imgIdx,  setImgIdx]  = useState(0);
  const [partageOpen, setPartageOpen] = useState(false);
  const [toastMsg,     setToastMsg]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  const loadService = useCallback(() => {
    if (!serviceId) { setError('Identifiant manquant.'); setLoading(false); return; }
    setLoading(true);
    apiFetch<ServiceApi>(`/public/services/${serviceId}`, { public: true })
      .then(data => setService(data))
      .catch(() => setError('Cette prestation est introuvable ou n\'est plus publiée.'))
      .finally(() => setLoading(false));
  }, [serviceId]);

  useEffect(() => { loadService(); }, [loadService]);

  if (loading) return (
    <div className={styles.root}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
      <SkeletonPage />
      <Footer onToast={showToast} />
    </div>
  );

  if (error || !service) return (
    <div className={styles.root}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--t3)' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🛠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Prestation introuvable</div>
        <div style={{ fontSize: 14, marginBottom: 24 }}>{error}</div>
        <button onClick={() => navigate('/home')}
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}>
          Retour à l'accueil
        </button>
      </div>
      <Footer onToast={showToast} />
    </div>
  );

  const media    = [...(service.media ?? [])].sort((a, b) => a.ordre - b.ordre);
  const emoji    = service.category?.icone ?? '🛠️';
  const shareUrl = `https://shopi.gn/service/${service.urlSlug ?? service.id}`;
  const prixLabel = service.pricingType === 'sur_devis'
    ? 'Sur devis'
    : service.prix != null
      ? `${fmt(service.prix)} GNF${service.pricingType === 'horaire' ? ' /h' : ''}`
      : null;
  const dureeLabel = (service.dureeMinMinutes || service.dureeMaxMinutes)
    ? `${service.dureeMinMinutes ?? service.dureeMaxMinutes} ${service.dureeMaxMinutes && service.dureeMaxMinutes !== service.dureeMinMinutes ? `– ${service.dureeMaxMinutes}` : ''} min`
    : null;
  const modes = [
    service.surPlaceEntreprise && { icon: 'fa-shop', label: 'Sur place' },
    service.aDomicile          && { icon: 'fa-house', label: 'À domicile' },
    service.aDistance          && { icon: 'fa-video', label: 'À distance' },
  ].filter(Boolean) as { icon: string; label: string }[];

  return (
    <div className={styles.root}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />

      <main className={styles.main}>
        <div className={styles.wrap}>

          <nav className={styles.breadcrumb}>
            <a href="/home">Accueil</a>
            <i className="fas fa-chevron-right" />
            <span>{service.category?.nom}</span>
            <i className="fas fa-chevron-right" />
            <span className={styles.bcCurrent}>{service.nom}</span>
          </nav>

          <div className={styles.layout}>

            {/* ════════ GALERIE ════════ */}
            <div className={styles.leftCol}>
              <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--g100)', aspectRatio: '1/1', position: 'relative' }}>
                {media.length > 0 ? (
                  media[imgIdx].type === 'video' ? (
                    <video src={media[imgIdx].url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={media[imgIdx].url} alt={media[imgIdx].alt ?? service.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>{emoji}</div>
                )}
              </div>
              {media.length > 1 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {media.map((m, i) => (
                    <button key={m.id} onClick={() => setImgIdx(i)}
                      style={{
                        width: 56, height: 56, borderRadius: 10, overflow: 'hidden', padding: 0, cursor: 'pointer',
                        border: i === imgIdx ? '2px solid var(--blue)' : '2px solid var(--bdr)', background: 'none',
                      }}>
                      {m.type === 'video'
                        ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g100)' }}><i className="fas fa-video" /></div>
                        : <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ════════ INFOS ════════ */}
            <div className={styles.centerCol}>
              <div className={styles.infoBlock}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', background: 'var(--g100)', borderRadius: 999, padding: '3px 10px' }}>
                    <i className="fas fa-concierge-bell" style={{ marginRight: 5 }} />Service
                  </span>
                  {service.category?.nom && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)' }}>{service.category.icone} {service.category.nom}</span>
                  )}
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', marginBottom: 10 }}>{service.nom}</h1>

                <div
                  onClick={() => navigate(`/boutique/${service.companyId}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13, color: 'var(--t2)', fontWeight: 600 }}
                >
                  {service.companyLogo
                    ? <img src={service.companyLogo} alt={service.companyName} style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
                    : <i className="fas fa-store" />}
                  {service.companyName}
                  <i className="fas fa-chevron-right" style={{ fontSize: 10 }} />
                </div>

                {prixLabel && (
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', marginBottom: 18 }}>{prixLabel}</div>
                )}

                {/* Durée / capacité / modes */}
                {(dureeLabel || modes.length > 0 || service.capaciteMax) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                    {dureeLabel && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 999, padding: '5px 12px' }}>
                        <i className="fas fa-clock" style={{ marginRight: 6 }} />{dureeLabel}
                      </span>
                    )}
                    {service.capaciteMax && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 999, padding: '5px 12px' }}>
                        <i className="fas fa-users" style={{ marginRight: 6 }} />{service.capaciteMax} pers. max
                      </span>
                    )}
                    {modes.map(m => (
                      <span key={m.label} style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 999, padding: '5px 12px' }}>
                        <i className={`fas ${m.icon}`} style={{ marginRight: 6 }} />{m.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description */}
                {service.description && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Description</div>
                    <p style={{ fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.7 }}>{service.description}</p>
                  </div>
                )}

                {/* Ce qui est inclus */}
                {service.tags && (
                  <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {service.tags.split(',').map(tag => (
                      <span key={tag.trim()} style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--g50)', borderRadius: 6, padding: '3px 8px' }}>#{tag.trim()}</span>
                    ))}
                  </div>
                )}

                {/* Zone d'intervention / frais */}
                {service.aDomicile && service.zoneCouverture && (
                  <div style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--t2)' }}>
                    <i className="fas fa-map-pin" style={{ marginRight: 6, color: 'var(--blue)' }} />
                    Zone d'intervention : {service.zoneCouverture}
                  </div>
                )}

                {/* Réservation / annulation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--t2)', fontWeight: 600 }}>
                    <i className="fas fa-calendar-check" style={{ marginRight: 8, color: 'var(--blue)' }} />
                    {service.reservationRequise === false ? 'Sans rendez-vous' : 'Réservation requise'}
                  </div>
                  {service.delaiReponse && (
                    <div style={{ fontSize: 12.5, color: 'var(--t2)', fontWeight: 600 }}>
                      <i className="fas fa-reply" style={{ marginRight: 8, color: 'var(--blue)' }} />
                      {DELAI_LABELS[service.delaiReponse] ?? service.delaiReponse}
                    </div>
                  )}
                  {service.politiqueAnnulation && (
                    <div style={{ fontSize: 12.5, color: 'var(--t2)', fontWeight: 600 }}>
                      <i className="fas fa-rotate-left" style={{ marginRight: 8, color: 'var(--blue)' }} />
                      {ANNULATION_LABELS[service.politiqueAnnulation] ?? service.politiqueAnnulation}
                    </div>
                  )}
                </div>

                {/* Garanties */}
                {(service.garantiePaiement || service.garantieSatisfaction) && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    {service.garantiePaiement && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--t2)' }}>
                        <i className="fas fa-shield-check" style={{ color: 'var(--emerald)' }} /> Paiement sécurisé
                      </div>
                    )}
                    {service.garantieSatisfaction && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--t2)' }}>
                        <i className="fas fa-heart-circle-check" style={{ color: 'var(--emerald)' }} /> Satisfait ou refait
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => setPartageOpen(true)}
                  style={{ marginTop: 10, background: 'none', border: '1px solid var(--bdr2)', borderRadius: 999, padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer' }}>
                  <i className="fas fa-share-nodes" style={{ marginRight: 6 }} />Partager
                </button>
              </div>

              {/* "Ce qui est inclus" (specs) */}
              {service.specs?.length > 0 && (
                <div className={styles.extraBlock}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 10 }}>Ce qui est inclus</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {service.specs.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: 'var(--g50)', borderRadius: 10, fontSize: 12.5 }}>
                        <span style={{ color: 'var(--t3)' }}>{s.cle}</span>
                        <span style={{ color: 'var(--navy)', fontWeight: 700, textAlign: 'right' }}>{s.valeur}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ════════ CONTACT (remplace le panier) ════════ */}
            <div className={styles.rightCol}>
              <div style={{ border: '1px solid var(--bdr)', borderRadius: 16, padding: 18, position: 'sticky', top: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  {service.companyLogo
                    ? <img src={service.companyLogo} alt={service.companyName} style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
                    : <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--g100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏪</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{service.companyName}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>Proposé par cette boutique</div>
                  </div>
                </div>

                {prixLabel && (
                  <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--g50)', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5 }}>Tarif</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{prixLabel}</div>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/boutique/${service.companyId}`)}
                  style={{
                    width: '100%', background: 'var(--navy, #0B1F3A)', color: '#fff', border: 'none',
                    borderRadius: 12, padding: '13px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8,
                  }}
                >
                  <i className="fas fa-comment-dots" /> Demander un devis
                </button>
                <button
                  onClick={() => navigate(`/boutique/${service.companyId}`)}
                  style={{
                    width: '100%', background: 'var(--g100)', color: 'var(--t2)', border: 'none',
                    borderRadius: 12, padding: '13px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <i className="fas fa-store" /> Voir la boutique
                </button>

                <p style={{ fontSize: 11, color: 'var(--t4)', marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
                  Cette prestation ne s'achète pas directement — contactez la boutique pour convenir des détails et du rendez-vous.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer onToast={showToast} />

      {partageOpen && (
        <ModalPartage
          url={shareUrl}
          titre="Partager cette prestation"
          onClose={() => setPartageOpen(false)}
          onToast={showToast}
        />
      )}

      <div className={`${styles.toast} ${toastVisible ? styles.toastVisible : ''}`}>
        <i className="fas fa-check-circle" />
        <span>{toastMsg}</span>
      </div>
    </div>
  );
}
