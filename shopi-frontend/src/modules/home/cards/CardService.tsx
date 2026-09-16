/*
 * FICHIER : src/modules/home/cards/CardService.tsx
 *
 * Miroir de CardProduit.tsx pour une prestation de service — sans
 * panier/stock/vente en gros (aucun sens pour un service, voir
 * service.entity.ts "hors scope MVP"). Le CTA principal renvoie vers la
 * fiche boutique (BoutiquePage), qui expose déjà Message/Appeler — pas de
 * nouveau flux de devis/réservation créé ici (pas de moteur de réservation
 * réel dans ce MVP, voir le plan Produits/Services).
 */

import { useState, useEffect } from 'react';
import { useNavigate }  from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch }     from '../../../shared/services/apiFetch';
import { useServiceFavoris } from '../../../shared/context/ServiceFavorisContext';
import { useAuthGate }  from '../../../shared/hooks/useAuthGate';
import styles           from './CardProduit.module.css';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** Miroir de PublicServiceResponse (backend, public.service.ts) — utilisé
 *  aussi bien par la carte (CardService) que par la fiche détaillée
 *  (ServiceDetailPage), d'où l'ensemble complet des champs même si la
 *  carte n'en affiche qu'une partie. */
export interface ServiceApi {
  id:          string;
  nom:         string;
  description: string | null;
  tags:        string | null;
  urlSlug:     string | null;
  visibilite:  string;
  pricingType: 'fixe' | 'horaire' | 'sur_devis' | string;
  prix:        number | null;
  prixAncien:  number | null;
  dureeMinMinutes: number | null;
  dureeMaxMinutes: number | null;
  capaciteMax:     number | null;
  surPlaceEntreprise: boolean;
  aDomicile:          boolean;
  aDistance:          boolean;
  zoneCouverture:      string | null;
  fraisDeplacement:    number | null;
  reservationRequise:  boolean;
  delaiReponse:        string;
  politiqueAnnulation: string;
  garantiePaiement:     boolean;
  garantieSatisfaction: boolean;
  media:       { id: string; url: string; ordre: number; alt: string | null; type: string }[];
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  specs:       { id: string; cle: string; valeur: string; ordre: number }[];
  companyId:   string;
  companyName: string;
  companyLogo: string | null;
  companyVerified?: boolean;
  companyVille?:    string | null;
  companyPays?:     string;
  createdAt?:  string;
}

interface BoutiqueApi {
  id:            string;
  companyName:   string;
  description:   string | null;
  logo:          string | null;
  coverImage:    string | null;
  averageRating: number;
  totalOrders:   number;
  totalRatings:  number;
  ville:         string;
  verified:      boolean;
}

interface Props {
  s:       ServiceApi;
  onToast: (m: string) => void;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

function mainMedia(s: ServiceApi) {
  return [...(s.media ?? [])].sort((a, b) => a.ordre - b.ordre)[0] ?? null;
}

function emoji(s: ServiceApi): string {
  return s.category?.icone ?? '🛠️';
}

function dureeLabel(s: ServiceApi, t: (k: string, o?: any) => string): string | null {
  if (!s.dureeMinMinutes && !s.dureeMaxMinutes) return null;
  const min = s.dureeMinMinutes ?? s.dureeMaxMinutes;
  const max = s.dureeMaxMinutes && s.dureeMaxMinutes !== s.dureeMinMinutes ? s.dureeMaxMinutes : null;
  return t('sharedCards.service.duree', { min, max: max ?? min });
}

function modeLabels(s: ServiceApi, t: (k: string) => string): string[] {
  const modes: string[] = [];
  if (s.surPlaceEntreprise) modes.push(t('sharedCards.service.modeSurPlace'));
  if (s.aDomicile)          modes.push(t('sharedCards.service.modeDomicile'));
  if (s.aDistance)          modes.push(t('sharedCards.service.modeDistance'));
  return modes;
}

// ─────────────────────────────────────────────────────────────
// HOOK PARTAGÉ — logique du bouton favori (❤️)
//
// Miroir exact de useFavorite (CardProduit.tsx) pour l'entité Service —
// persiste via /client/favoris-services/:id/toggle.
// ─────────────────────────────────────────────────────────────

function useFavorite(s: ServiceApi, onToast: (m: string) => void, requireClient: (action: () => void) => void) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { isLiked, toggle } = useServiceFavoris();

  const liked = isLiked(s.id);

  const handleToggle = () => {
    if (loading) return;
    requireClient(async () => {
      setLoading(true);
      try {
        const nowLiked = await toggle(s.id);
        onToast(nowLiked ? t('sharedCards.produit.favoriAjoute') : t('sharedCards.produit.favoriRetire'));
      } catch (e: any) {
        onToast(`❌ ${e?.message ?? t('sharedCards.produit.favoriErrorFallback')}`);
      } finally {
        setLoading(false);
      }
    });
  };

  return { liked, handleToggle, loading };
}

// ─────────────────────────────────────────────────────────────
// MODALE — Boutique (miroir de CardProduit.ModalEntreprise)
// ─────────────────────────────────────────────────────────────

function ModalEntreprise({ s, onClose }: { s: ServiceApi; onClose: () => void }) {
  const { t } = useTranslation();
  const [boutique, setBoutique] = useState<BoutiqueApi | null>(null);
  const [loading,  setLoading]  = useState(true);
  const navigate                = useNavigate();

  useEffect(() => {
    apiFetch<BoutiqueApi>(`/public/boutiques/${s.companyId}`, { public: true })
      .then(data => setBoutique(data))
      .catch(() => setBoutique({
        id: s.companyId, companyName: s.companyName, description: null,
        logo: s.companyLogo, coverImage: null,
        averageRating: 0, totalOrders: 0, totalRatings: 0,
        ville: 'Conakry', verified: false,
      }))
      .finally(() => setLoading(false));
  }, [s.companyId, s.companyName, s.companyLogo]);

  const b = boutique;
  const media = mainMedia(s);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>

        <div className={styles.mHeader}>
          <div className={styles.mTitle}><i className="fas fa-store" /> {t('sharedCards.produit.modalEntreprise.titre')}</div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={styles.mBody}>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--t3)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 22 }} />
            </div>
          ) : (
            <>
              {b?.coverImage && (
                <div style={{ height: 80, borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                  <img src={b.coverImage} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div className={styles.boutiqueProfil}>
                <div className={styles.boutiqueAvatar}>
                  {b?.logo
                    ? <img src={b.logo} alt={b.companyName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : <span style={{ fontSize: 28 }}>{emoji(s)}</span>}
                </div>
                <div>
                  <div className={styles.boutiqueNom}>{b?.companyName}</div>
                  <div className={styles.boutiqueVille}><i className="fas fa-map-pin" /> {b?.ville ?? 'Conakry'}, {t('sharedCards.produit.modalEntreprise.guinee')}</div>
                  {b?.verified && (
                    <div className={styles.boutiqueVerif}><i className="fas fa-circle-check" /> {t('sharedCards.produit.modalEntreprise.boutiqueVerifiee')}</div>
                  )}
                </div>
              </div>

              {b?.description && (
                <p style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 14 }}>{b.description}</p>
              )}

              <div className={styles.produitPublie}>
                <div className={styles.produitPublieLabel}><i className="fas fa-concierge-bell" /> {t('sharedCards.service.modalEntreprise.servicePublieLabel')}</div>
                <div className={styles.produitPublieCard}>
                  <span className={styles.produitPublieEmo}>
                    {media
                      ? <img src={media.url} alt={s.nom} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8 }} />
                      : emoji(s)}
                  </span>
                  <div>
                    <div className={styles.produitPublieNom}>{s.nom}</div>
                    <div className={styles.produitPubliePrix}>
                      {s.pricingType === 'sur_devis' ? t('sharedCards.service.surDevis') : s.prix != null ? `${fmt(s.prix)} GNF` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.mFooter}>
          <button className={styles.voirBoutiqueBtn} style={{ flex: 1 }}
            onClick={() => { onClose(); navigate(`/boutique/${s.companyId}`); }}>
            <i className="fas fa-store" /> {t('sharedCards.service.contacterBoutique')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function CardService({ s, onToast }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [modalEntreprise, setModalEntreprise] = useState(false);

  /* ✅ Garde d'authentification partagée (miroir CardProduit) */
  const { requireClient, authModal } = useAuthGate();

  /* ✅ Logique du bouton favori partagée */
  const { liked: fav, handleToggle: handleToggleFav } = useFavorite(s, onToast, requireClient);

  const media  = mainMedia(s);
  const em     = emoji(s);
  const duree  = dureeLabel(s, t);
  const modes  = modeLabels(s, t);
  const prixLabel = s.pricingType === 'sur_devis'
    ? t('sharedCards.service.surDevis')
    : s.prix != null
      ? `${fmt(s.prix)} GNF${s.pricingType === 'horaire' ? t('sharedCards.service.parHeure') : ''}`
      : '';

  return (
    <>
      <div className={styles.pcard} onClick={() => navigate(`/service/${s.id}`)} style={{ cursor: 'pointer' }}>

        <button className={`${styles.pfav} ${fav ? styles.pfavOn : ''}`}
          onClick={e => { e.stopPropagation(); handleToggleFav(); }}>
          <i className={fav ? 'fas fa-heart' : 'far fa-heart'} />
        </button>

        <div className={styles.pimg}>
          {media
            ? (media.type === 'video'
                ? <video src={media.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <img src={media.url} alt={s.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
            : <span className={styles.pimgEmoji}>{em}</span>}
          <div className={styles.pimgOverlay}><span><i className="fas fa-eye" /> {t('sharedCards.produit.voir')}</span></div>
        </div>

        <div className={styles.pbody}>
          <div className={styles.pshop} onClick={e => { e.stopPropagation(); setModalEntreprise(true); }}>
            {s.companyLogo
              ? <img src={s.companyLogo} alt={s.companyName} style={{ width: 14, height: 14, borderRadius: 3, objectFit: 'cover', verticalAlign: 'middle', marginRight: 4 }} />
              : <i className="fas fa-store" />}
            {' '}{s.companyName}
          </div>

          <div className={styles.pname}>{s.nom}</div>
          <div className={styles.pdesc}>{s.description ?? ''}</div>

          {(duree || modes.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0 4px' }}>
              {duree && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t2)', background: 'var(--g100)', borderRadius: 999, padding: '2px 8px' }}>
                  <i className="fas fa-clock" style={{ marginRight: 4 }} />{duree}
                </span>
              )}
              {modes.map(m => (
                <span key={m} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--t2)', background: 'var(--g100)', borderRadius: 999, padding: '2px 8px' }}>
                  {m}
                </span>
              ))}
            </div>
          )}

          <div className={styles.pprices}>
            <span className={styles.pprice}>{prixLabel}</span>
          </div>

          <div className={styles.pbottomRow}>
            <button className={styles.pcart} onClick={e => { e.stopPropagation(); setModalEntreprise(true); }}>
              <i className="fas fa-comment-dots" /> <span className={styles.pcartLabel}>{t('sharedCards.service.demanderDevis')}</span>
            </button>
          </div>
        </div>
      </div>

      {modalEntreprise && <ModalEntreprise s={s} onClose={() => setModalEntreprise(false)} />}
      {authModal}
    </>
  );
}
