/*
 * FICHIER : src/modules/home/components/boutique/pages/BoutiquePage.tsx
 *
 * CONNEXION API :
 *   GET /public/boutiques/:id             → infos boutique
 *   GET /public/boutiques/:id/produits    → produits publics
 *   GET /public/boutiques/:id/livreurs    → livreurs
 *   GET /public/boutiques/:id/correspondants → correspondants
 *
 *   Onglets sans API (encore en mock) :
 *   - Promotions  → PROMOS_MOCK
 *   - Avis        → AVIS_MOCK
 *
 *   À propos / sidebar "Infos boutique" : utilisent désormais boutiqueInfo
 *   (vraies données déjà chargées ci-dessus pour BoutiqueCover/Identity) —
 *   BOUTIQUE_INFO mock supprimé. Restent en mock dans BoutiqueSidebar :
 *   CATEGORIES_BOUTIQUE (liste de catégories fixe, pas dérivée des vrais
 *   produits de la boutique) et les compteurs du filtre "Note minimale" —
 *   hors périmètre de cette passe, pas montrés/demandés par l'utilisateur.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { apiFetch, tokenStorage } from '../../../../../shared/services/apiFetch';
import { useStartConversation }   from '../../../../../shared/hooks/useStartConversation';
import { useProfileCall }         from '../../../../../shared/hooks/useProfileCall';
import { useAuthGate }            from '../../../../../shared/hooks/useAuthGate';

/* ── Layout global ── */
import Header from '../../layout/Header';
import Footer from '../../layout/Footer';

/* ── Données mock restantes ── */
import {
  PROMOS_MOCK, AVIS_MOCK,
  type BoutiqueInfo,
} from '../data/boutiqueMockData';
import type { AvisResponse } from '../data/types';

/* ── Sections boutique ── */
import StoriesStrip          from '../sections/StoriesStrip';
import BoutiqueCover         from '../sections/BoutiqueCover';
import BoutiqueIdentity      from '../sections/BoutiqueIdentity';
import BoutiqueNav, { type OngletType } from '../sections/BoutiqueNav';
import BoutiqueSidebar       from '../sections/BoutiqueSidebar';
import ProduitsSection       from '../sections/ProduitsSection';
import PromotionsSection     from '../sections/PromotionsSection';
import LivreursSection       from '../sections/LivreursSection';
import CorrespondantsSection from '../sections/CorrespondantsSection';
import AvisSection           from '../sections/AvisSection';
import AProposSection        from '../sections/AProposSection';
import ModalPartage          from '../components/ModalPartage';

import styles from '../styles/BoutiquePage.module.css';

// ─────────────────────────────────────────────────────────────
// TYPES API
// ─────────────────────────────────────────────────────────────

interface BoutiqueApi {
  id:                 string;
  companyName:        string;
  description:        string | null;
  logo:               string | null;
  coverImage:         string | null;
  businessPhone:      string | null;
  businessEmail:      string | null;
  website:            string | null;
  openTime:           string | null;
  closeTime:          string | null;
  averageRating:      number;
  totalOrders:        number;
  totalRatings:       number;
  ville:              string | null;
  pays:               string;
  adresse:            string | null;
  commune:            string | null;
  verificationStatus: string;
  companyType?:       { id: string; nom: string; icone: string | null } | null;
  createdAt:          string;
  totalAbonnes?:      number | null;  /* nombre de followers — calculé par le backend */
  isSuivi?:           boolean;        /* l'utilisateur connecté suit-il cette boutique ? */
  slogan?:            string | null;
}

interface ProduitApi {
  id:          string;
  nom:         string;
  description: string | null;
  prix:        number;
  prixAncien:  number | null;
  marque:      string | null;
  stock:       number;
  images:      { id: string; url: string; ordre: number; alt: string | null }[];
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  companyId:   string;
  companyName: string;
  companyLogo: string | null;
}

export interface LivreurApi {
  id:           string;
  fullName:     string;
  zone:         string | null;
  availability: string;
  phone:        string | null;
  emoji:        string;
  note:         number;
  trips:        number;
}

export interface CorrespondantApi {
  id:                string;
  fullName:          string;
  ville:             string | null;
  quartier:          string | null;
  note:              number;
  missions:          number;
  verified:          boolean;
  langues:           string[];
  bio:               string | null;
  phone:             string | null;
  horaireAujourdhui: string | null;
}

// ─────────────────────────────────────────────────────────────
// Convertit BoutiqueApi → BoutiqueInfo (pour BoutiqueCover / Identity)
// ─────────────────────────────────────────────────────────────

function toBoutiqueInfo(raw: any, t: TFunction): BoutiqueInfo {
  const r = raw as any;

  /* Noms de champs : le backend peut utiliser différentes conventions */
  const nom         = r.companyName ?? r.nom ?? r.name ?? '—';
  const logo        = r.logo        ?? r.logoUrl    ?? null;
  const coverImage  = r.coverImage  ?? r.cover      ?? r.coverUrl ?? null;
  const description = r.description ?? r.desc       ?? '';
  const businessPhone = r.businessPhone ?? r.phone  ?? r.tel    ?? '';
  const businessEmail = r.businessEmail ?? r.email  ?? '';
  const website     = r.website     ?? r.site       ?? '';
  const ville       = r.ville       ?? r.city       ?? r.localisation ?? 'Conakry, Guinée';
  const adresse     = r.adresse     ?? r.address    ?? ville;
  const averageRating = r.averageRating ?? r.rating ?? r.note ?? r.moyenneNote ?? 0;
  const totalOrders   = r.totalOrders  ?? r.totalCommandes ?? r.orders ?? 0;
  const totalAbonnes  = r.totalAbonnes ?? r.abonnes ?? r.subscribers ?? null;
  const verified    = r.verified != null
    ? Boolean(r.verified)
    : r.isVerified != null
      ? Boolean(r.isVerified)
      : r.verificationStatus === 'verified';

  /* Domaine/catégorie */
  const domaine = r.domaine
    ?? r.companyType?.nom
    ?? r.type?.nom
    ?? r.category?.nom
    ?? r.categorie
    ?? t('boutiqueDetail.page.boutiqueShopiDefault');

  /* Date membre */
  const membreBrut = r.membre ?? r.memberSince ?? r.createdAt ?? r.dateCreation ?? '';
  const membre = membreBrut
    ? (membreBrut.includes('Membre') ? membreBrut
        : t('boutiqueDetail.page.membreDepuis', { date: new Date(membreBrut).toLocaleDateString('fr-FR', { month:'long', year:'numeric' }) }))
    : t('boutiqueDetail.page.membreShopi');

  /* Horaires */
  const openTime  = r.openTime  ?? r.heureOuverture ?? '';
  const closeTime = r.closeTime ?? r.heureFermeture ?? '';
  const horaires  = openTime && closeTime
    ? `${openTime} – ${closeTime}`
    : t('boutiqueDetail.page.horairesNonRenseignes');

  return {
    nom,
    emoji:       '🏪',
    logo,
    coverImage,
    domaine,
    ville,
    membre,
    description,
    horaires,
    adresse,
    tel:     businessPhone,
    email:   businessEmail,
    website,
    slogan:       r.slogan ?? null,
    note:         typeof averageRating === 'number' ? averageRating : parseFloat(String(averageRating)) || 0,
    totalRatings: typeof r.totalRatings === 'number' ? r.totalRatings : (r.totalAvis ?? 0),
    abonnes:      totalAbonnes != null ? String(totalAbonnes) : '—',
    satisf:  '—',
    ventes:  totalOrders > 0 ? `${totalOrders}+` : '—',
    verified,
    online:  true,
    decos:   ['🛍️', '⭐', '🚀', '✨'],
  };
}

// ─────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────

function SkeletonPage() {
  return (
    <div style={{ padding: '80px 20px', maxWidth: 1200, margin: '0 auto' }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          height: i === 0 ? 200 : 60,
          borderRadius: 16, marginBottom: 16,
          background: 'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s infinite',
        }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Type promotion publique (réponse de GET /public/boutiques/:id/promotions)
// ─────────────────────────────────────────────────────────────

export interface PromoPublic {
  id:              string;
  nom:             string;
  code:            string;
  type:            'discount' | 'free-ship' | 'bundle' | 'flash';
  valueType:       'percent' | 'fixed' | 'free';
  valeur:          number | null;
  montantMinimum:  number | null;
  endDate:         string | null;
  usesCount:       number;
  maxUtilisations: number | null;
  flashStock:      number | null;
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function BoutiquePage() {
  const navigate       = useNavigate();
  const { t } = useTranslation();
  const { id: companyId } = useParams<{ id: string }>();
  const [searchParams]    = useSearchParams();
  const isPreview         = searchParams.get('preview') === '1';

  // ── Données API ──────────────────────────────────────────────
  const [boutique,       setBoutique]       = useState<BoutiqueApi | null>(null);
  const [produits,       setProduits]       = useState<ProduitApi[]>([]);
  const [livreurs,       setLivreurs]       = useState<LivreurApi[]>([]);
  const [correspondants, setCorrespondants] = useState<CorrespondantApi[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  // ── États UI ─────────────────────────────────────────────────
  const [onglet,       setOnglet]       = useState<OngletType>('produits');
  const [suivi,        setSuivi]        = useState(false);
  const { start: startConv, loading: msgLoading } = useStartConversation();
  const { call: callProfile, loading: callLoading } = useProfileCall();
  const [partageOpen,    setPartageOpen]    = useState(false);
  const [filtresOpen,    setFiltresOpen]    = useState(false);
  const [avisData,       setAvisData]       = useState<AvisResponse | null>(null);
  const [avisLoading,    setAvisLoading]    = useState(false);
  const [promos,         setPromos]         = useState<PromoPublic[]>([]);
  const [promosLoading,  setPromosLoading]  = useState(false);
  const isLoggedIn = !!tokenStorage.get();
  const { openAuthModal, authModal } = useAuthGate();

  /* ── Suivi + compteur d'abonnés ────────────────────────────────
   * FollowButton met à jour son propre badge "Suivi(e)" tout seul, mais
   * ne touche à aucun compteur — sans ceci, le nombre d'abonnés affiché
   * restait figé sur la valeur chargée au montage, même après avoir
   * cliqué "S'abonner"/"Se désabonner" sur CETTE page. On ajuste ici
   * `boutique.totalAbonnes` de ±1 en optimiste (boutiqueInfo.abonnes en
   * dérive automatiquement, voir toBoutiqueInfo) ; comparé à l'ancien
   * `suivi` pour ne compter qu'un vrai changement, jamais deux fois. */
  function handleSuiviChange(isSuivi: boolean) {
    setSuivi(prevSuivi => {
      if (prevSuivi === isSuivi) return prevSuivi;
      setBoutique(b => b ? { ...b, totalAbonnes: Math.max(0, (b.totalAbonnes ?? 0) + (isSuivi ? 1 : -1)) } : b);
      return isSuivi;
    });
  }

  // ── Toast ────────────────────────────────────────────────────
  const [toastMsg,     setToastMsg]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastVisible(false), 2800);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // ── Chargement des promotions (rechargé à chaque clic sur l'onglet) ──
  useEffect(() => {
    if (onglet !== 'promos' || !companyId) return;
    setPromosLoading(true);
    apiFetch<PromoPublic[]>(`/public/boutiques/${companyId}/promotions`, { public: true })
      .then(d => setPromos(Array.isArray(d) ? d : []))
      .catch(() => setPromos([]))
      .finally(() => setPromosLoading(false));
  }, [onglet, companyId]);

  // ── Chargement des avis (lazy : déclenché au clic sur l'onglet) ──
  useEffect(() => {
    if (onglet !== 'avis' || !companyId || avisData) return;
    setAvisLoading(true);
    apiFetch<AvisResponse>(`/public/boutiques/${companyId}/avis`, { public: true })
      .then(d => setAvisData({ ...d, avis: d.avis ?? [] }))
      .catch(() => {}) /* silencieux — fallback sur les données de la boutique */
      .finally(() => setAvisLoading(false));
  }, [onglet, companyId, avisData]);

  // ── Chargement des données ───────────────────────────────────
  useEffect(() => {
    if (!companyId) { setError(t('boutiqueDetail.page.idBoutiqueManquant')); setLoading(false); return; }

    setLoading(true);
    setError(null);

    const suiviPromise = isLoggedIn
      ? apiFetch<{ isSuivi: boolean }>(`/suivis/entreprises/${companyId}/statut`).catch(() => null)
      : Promise.resolve(null);

    Promise.all([
      apiFetch<any>(`/public/boutiques/${companyId}`, { public: true }),
      apiFetch<any>(`/public/boutiques/${companyId}/produits`, {
        public: true, params: { limit: 50 },
      }).catch(() => ({ data: [] })),
      apiFetch<any>(`/public/boutiques/${companyId}/livreurs`, { public: true })
        .catch(() => []),
      apiFetch<any>(`/public/boutiques/${companyId}/correspondants`, { public: true })
        .catch(() => []),
      suiviPromise,
    ])
      .then(([b, p, l, co, s]) => {
        const boutiqueData = b as BoutiqueApi;
        setBoutique(boutiqueData);
        /* isSuivi provient de l'endpoint authentifié /suivis/entreprises/:id/statut */
        if (s?.isSuivi != null) setSuivi(s.isSuivi);
        const prodList = Array.isArray(p) ? p : (p?.data ?? p?.produits ?? []);
        setProduits(prodList);
        setLivreurs(Array.isArray(l) ? l : (l?.data ?? []));
        setCorrespondants(Array.isArray(co) ? co : (co?.data ?? []));
      })
      .catch(() => setError(t('boutiqueDetail.page.erreurChargement')))
      .finally(() => setLoading(false));
  }, [companyId, isLoggedIn, t]);

  // ── Filtres produits ─────────────────────────────────────────
  const [catActive,  setCatActive]  = useState('Tout');
  const [sortBy,     setSortBy]     = useState('Pertinence');
  const [filtrStock, setFiltrStock] = useState(false);
  const [filtrPromo, setFiltrPromo] = useState(false);
  const [filtrNew,   setFiltrNew]   = useState(false);

  // Convertit ProduitApi → format attendu par ProduitsSection
  const produitsFiltres = useMemo(() => {
    return produits
      .filter(p => {
        if (catActive !== 'Tout' && p.category?.nom !== catActive) return false;
        if (filtrStock && p.stock === 0)  return false;
        if (filtrPromo && !p.prixAncien)  return false;
        return true;
      })
      .map(p => ({
        id:     p.id,
        emoji:  p.category?.icone ?? '📦',
        nom:    p.nom,
        desc:   p.description ?? '',
        cat:    p.category?.nom ?? '',
        prix:   p.prix.toLocaleString('fr-FR'),
        ancien: p.prixAncien ? p.prixAncien.toLocaleString('fr-FR') : null,
        note:   0,
        avis:   0,
        stock:  p.stock === 0 ? 'out' : p.stock < 5 ? 'low' : 'ok',
        badge:  p.prixAncien ? 'promo' : null,
        // Champ extra pour l'image
        imageUrl: p.images?.[0]?.url ?? null,
      }));
  }, [produits, catActive, filtrStock, filtrPromo, filtrNew]);

  const filtreEnStockLabel     = t('boutiqueDetail.page.filtreEnStock');
  const filtreEnPromotionLabel = t('boutiqueDetail.page.filtreEnPromotion');
  const filtreNouveautesLabel  = t('boutiqueDetail.page.filtreNouveautes');

  const filtresActifs = [
    catActive !== 'Tout' && catActive,
    filtrStock && filtreEnStockLabel,
    filtrPromo && filtreEnPromotionLabel,
    filtrNew   && filtreNouveautesLabel,
  ].filter(Boolean) as string[];

  function handleRemoveFiltreActif(f: string) {
    if (f === catActive)              setCatActive('Tout');
    if (f === filtreEnStockLabel)     setFiltrStock(false);
    if (f === filtreEnPromotionLabel) setFiltrPromo(false);
    if (f === filtreNouveautesLabel)  setFiltrNew(false);
  }

  // ── Counts ──────────────────────────────────────────────────
  const counts = {
    produits:       produitsFiltres.length,
    promos:         PROMOS_MOCK.length,
    livreurs:       livreurs.length,
    correspondants: correspondants.length,
    avis:           AVIS_MOCK.length * 49,
  };

  // ── Infos boutique converties ────────────────────────────────
  const boutiqueInfo: BoutiqueInfo | null = boutique ? toBoutiqueInfo(boutique, t) : null;

  // ── Rendu loading / erreur ───────────────────────────────────
  if (loading) return (
    <div className={styles.root}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
      <SkeletonPage />
      <Footer onToast={showToast} />
    </div>
  );

  if (error || !boutiqueInfo) return (
    <div className={styles.root}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
      <div style={{ padding:'80px 20px', textAlign:'center', color:'var(--t3)' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🏪</div>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--navy)', marginBottom:8 }}>
          {t('boutiqueDetail.page.boutiqueIntrouvable')}
        </div>
        <div style={{ fontSize:14, marginBottom:24 }}>
          {error ?? t('boutiqueDetail.page.boutiqueIntrouvableDesc')}
        </div>
        <button
          onClick={() => navigate('/home')}
          style={{ background:'var(--navy)', color:'#fff', border:'none', borderRadius:10, padding:'10px 24px', fontWeight:700, cursor:'pointer' }}
        >
          {t('boutiqueDetail.page.retourAccueil')}
        </button>
      </div>
      <Footer onToast={showToast} />
    </div>
  );

  // ── Rendu principal ──────────────────────────────────────────
  const shareUrl = `https://shopi.gn/boutique/${companyId}`;

  return (
    <div className={styles.root}>

      {!isPreview && (
        <Header
          onToast={showToast}
          onLogin={() => navigate('/login')}
          onRegister={() => navigate('/register')}
        />
      )}

      <div className={styles.pageBody} style={{ paddingTop: isPreview ? 0 : 66 }}>

        {/* Breadcrumb */}
        {!isPreview && (
          <div className={styles.breadcrumbWrap}>
            <nav className={styles.breadcrumb}>
              <a href="/home">{t('boutiqueDetail.page.accueil')}</a>
              <i className="fas fa-chevron-right" />
              <a href="/boutiques">{t('boutiqueDetail.page.boutiques')}</a>
              <i className="fas fa-chevron-right" />
              <span className={styles.bcCurrent}>{boutiqueInfo.nom}</span>
            </nav>
          </div>
        )}

        {/* Cover */}
        <BoutiqueCover boutique={boutiqueInfo} />

        {/* Identité sticky */}
        <BoutiqueIdentity
          boutiqueId={companyId ?? ''}
          boutique={boutiqueInfo}
          suivi={suivi}
          msgLoading={msgLoading}
          callLoading={callLoading}
          onToast={showToast}
          onRequireAuth={openAuthModal}
          onSuiviChange={handleSuiviChange}
          onMessage={() => {
            if (!isLoggedIn) { openAuthModal(); return; }
            if (!suivi)      { showToast(t('boutiqueDetail.page.abonnezVousMessage')); return; }
            startConv('company', companyId ?? '', msg => showToast(t('boutiqueDetail.page.erreurToast', { msg })));
          }}
          onCall={() => {
            if (!isLoggedIn) { openAuthModal(); return; }
            if (!suivi)      { showToast(t('boutiqueDetail.page.abonnezVousAppel')); return; }
            callProfile('company', companyId ?? '', boutiqueInfo.nom, boutique?.logo, msg => showToast(t('boutiqueDetail.page.erreurToast', { msg })));
          }}
          onPartage={() => setPartageOpen(true)}
        />

        {/* Navigation onglets */}
        <BoutiqueNav
          onglet={onglet}
          onChangeOnglet={setOnglet}
          counts={counts}
        />

        {/* Stories */}
        {onglet === 'produits' && (
          <StoriesStrip
            companyId={companyId ?? ''}
            companyName={boutiqueInfo.nom}
            companyLogo={boutique?.logo}
            onToast={showToast}
          />
        )}

        {/* Layout 2 colonnes */}
        <div className={styles.layout}>

          {onglet === 'produits' && (
            <BoutiqueSidebar
              catActive={catActive}   setCatActive={setCatActive}
              sortBy={sortBy}         setSortBy={setSortBy}
              filtrStock={filtrStock} setFiltrStock={setFiltrStock}
              filtrPromo={filtrPromo} setFiltrPromo={setFiltrPromo}
              filtrNew={filtrNew}     setFiltrNew={setFiltrNew}
              onToast={showToast}
              isOpen={filtresOpen}
              onClose={() => setFiltresOpen(false)}
              boutiqueInfo={boutiqueInfo}
            />
          )}

          <main className={`${styles.main} ${onglet !== 'produits' ? styles.mainFull : ''}`}>
            {onglet === 'produits' && (
              <ProduitsSection
                produits={produitsFiltres as any}
                filtresActifs={filtresActifs}
                onRemoveFiltreActif={handleRemoveFiltreActif}
                onResetFiltres={() => { setCatActive('Tout'); setFiltrStock(false); setFiltrPromo(false); setFiltrNew(false); }}
                onToast={showToast}
                onOpenFiltres={() => setFiltresOpen(true)}
              />
            )}
            {onglet === 'promos'         && <PromotionsSection
                                              promos={promos}
                                              loading={promosLoading}
                                              companyId={companyId ?? ''}
                                              onToast={showToast}
                                            />}
            {onglet === 'livreurs'       && <LivreursSection        livreurs={livreurs} onToast={showToast} />}
            {onglet === 'correspondants' && <CorrespondantsSection  correspondants={correspondants} onToast={showToast} />}
            {onglet === 'avis'           && <AvisSection
                                              note={avisData?.averageRating ?? boutiqueInfo.note}
                                              totalRatings={avisData?.totalRatings ?? boutiqueInfo.totalRatings ?? 0}
                                              avis={avisData?.avis ?? []}
                                              distribution={avisData?.distribution}
                                              loading={avisLoading}
                                            />}
            {onglet === 'apropos'        && <AProposSection         boutiqueInfo={boutiqueInfo} createdAt={boutique?.createdAt ?? null} livreurs={livreurs} onToast={showToast} />}
          </main>
        </div>
      </div>

      {!isPreview && <Footer onToast={showToast} />}

      {partageOpen && (
        <ModalPartage
          url={shareUrl}
          titre={t('boutiqueDetail.page.partagerTitre')}
          onClose={() => setPartageOpen(false)}
          onToast={showToast}
        />
      )}

      <div className={`${styles.toast} ${toastVisible ? styles.toastVisible : ''}`}>
        <i className="fas fa-circle-check" />
        <span>{toastMsg}</span>
      </div>

      {authModal}
    </div>
  );
}
