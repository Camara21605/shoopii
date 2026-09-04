/*
 * FICHIER : src/modules/home/components/boutique/pages/BoutiquePage.tsx
 *
 * CONNEXION API :
 *   GET /public/boutiques/:id             → infos boutique
 *   GET /public/boutiques/:id/produits    → produits publics
 *   GET /public/boutiques/:id/livreurs    → livreurs
 *   GET /public/boutiques/:id/correspondants → correspondants
 *
 *   Promotions et Avis utilisent désormais les vraies données déjà
 *   chargées (promos, avisData) — plus de mock.
 *
 *   À propos / sidebar "Infos boutique" : utilisent désormais boutiqueInfo
 *   (vraies données déjà chargées ci-dessus pour BoutiqueCover/Identity) —
 *   BOUTIQUE_INFO mock supprimé. Catégories et fourchette de prix de la
 *   sidebar dérivées des vrais produits (categoriesReelles, priceBounds).
 *   Reste sans donnée réelle : le filtre "Note minimale" (aucune note par
 *   PRODUIT n'existe dans le modèle de données — CompanyAvis note la
 *   BOUTIQUE, pas un produit précis — retiré plutôt que d'afficher des
 *   compteurs inventés, voir BoutiqueSidebar.tsx).
 */
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { io } from 'socket.io-client';
import { apiFetch, tokenStorage } from '../../../../../shared/services/apiFetch';
import { useStartConversation }   from '../../../../../shared/hooks/useStartConversation';
import { useProfileCall }         from '../../../../../shared/hooks/useProfileCall';
import { useAuthGate }            from '../../../../../shared/hooks/useAuthGate';

/* Même origine que useNotificationSocket.ts (VITE_API_URL sans le
 * suffixe /api). Namespace /public : voir public.gateway.ts côté
 * backend — aucune authentification requise, contrairement à
 * /notifications, puisqu'un visiteur anonyme doit pouvoir recevoir les
 * mises à jour en direct de la fiche boutique qu'il consulte. */
const SOCKET_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace('/api', '') ??
  'http://localhost:3001';

/* ── Layout global ── */
import Header from '../../layout/Header';
import Footer from '../../layout/Footer';

import type { BoutiqueInfo } from '../data/boutiqueMockData';
import type { AvisResponse } from '../data/types';

/* ── Sections boutique ── */
import HomeStoriesStrip      from '../../sections/HomeStoriesStrip';
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
  /** Détail par jour — voir PublicBoutiqueResponse.horaires côté backend
   *  (remplace openTime/closeTime ci-dessus, jamais renseignés). */
  horaires?: { jour: string; ouverture: string | null; fermeture: string | null; actif: boolean }[];
  /** Méthodes + zones de livraison (Paramètres > Livraison), voir
   *  PublicBoutiqueResponse.livraison côté backend. */
  livraison?: {
    standard: boolean; livreursShopi: boolean; correspondants: boolean;
    clickCollect: boolean; express: boolean; zones: string[];
  };
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
  createdAt:   string;
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

  /* Horaires — BUG CORRIGÉ : openTime/closeTime (Company) ne sont jamais
   * renseignés nulle part côté backend (voir company-horaire.entity.ts :
   * cette table les remplace). On utilise maintenant le vrai détail par
   * jour (r.horaires, voir PublicBoutiqueResponse.horaires), avec un
   * repli sur openTime/closeTime pour compatibilité si jamais présents. */
  const rawHoraires: { jour: string; ouverture: string | null; fermeture: string | null; actif: boolean }[]
    = Array.isArray(r.horaires) ? r.horaires : [];

  const JOURS_LABELS: Record<string, string> = {
    lundi:    t('boutiqueDetail.aPropos.jours.lundi'),
    mardi:    t('boutiqueDetail.aPropos.jours.mardi'),
    mercredi: t('boutiqueDetail.aPropos.jours.mercredi'),
    jeudi:    t('boutiqueDetail.aPropos.jours.jeudi'),
    vendredi: t('boutiqueDetail.aPropos.jours.vendredi'),
    samedi:   t('boutiqueDetail.aPropos.jours.samedi'),
    dimanche: t('boutiqueDetail.aPropos.jours.dimanche'),
  };

  /* BUG CORRIGÉ — la colonne Postgres `time` renvoie "HH:MM:SS" (avec
   * secondes), affiché tel quel ("08:00:00 – 20:00:00") sans cette
   * troncature. Même correctif que côté sauvegarde (useParametres.ts). */
  const toHHMM = (v: string | null) => v ? v.slice(0, 5) : v;

  const horairesDetail = rawHoraires.map(h => ({
    jour:      h.jour,
    label:     JOURS_LABELS[h.jour] ?? h.jour,
    ouverture: toHHMM(h.ouverture),
    fermeture: toHHMM(h.fermeture),
    actif:     h.actif,
  }));

  /* Résumé compact "aujourd'hui" pour BoutiqueSidebar — jour local du
   * visiteur, correspond à ce qu'il voit affiché en réalité au moment où
   * il regarde la page. */
  const JOURS_BY_GETDAY = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const jourAujourdhui  = JOURS_BY_GETDAY[new Date().getDay()];
  const horaireAujourdhui = horairesDetail.find(h => h.jour === jourAujourdhui);

  const openTime  = r.openTime  ?? r.heureOuverture ?? '';
  const closeTime = r.closeTime ?? r.heureFermeture ?? '';

  const horaires = horaireAujourdhui
    ? (horaireAujourdhui.actif && horaireAujourdhui.ouverture && horaireAujourdhui.fermeture
        ? t('boutiqueDetail.aPropos.ouvertAujourdhui', { debut: horaireAujourdhui.ouverture, fin: horaireAujourdhui.fermeture })
        : t('boutiqueDetail.aPropos.fermeAujourdhui'))
    : (openTime && closeTime
        ? `${openTime} – ${closeTime}`
        : t('boutiqueDetail.page.horairesNonRenseignes'));

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
    horairesDetail,
    livraison: r.livraison,
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

interface Props {
  /* BUG CORRIGÉ — l'aperçu entreprise ("Voir ma boutique") chargeait
   * cette page dans une <iframe> pointant vers /boutique/:id?preview=1 :
   * à chaque ouverture/actualisation, le navigateur rebootait
   * l'application entière depuis zéro À L'INTÉRIEUR de l'iframe (nouveau
   * bundle JS exécuté, nouveau routeur, nouvelle vérification de session
   * /auth/me…) — plusieurs secondes pendant lesquelles l'en-tête générique
   * du site (le même que sur Home) restait visible avant que le contenu
   * boutique ne s'installe. companyIdOverride/previewOverride permettent
   * à BoutiquePreviewPage.tsx de monter ce composant DIRECTEMENT dans
   * l'arbre React du dashboard entreprise (un seul <BrowserRouter> pour
   * toute l'app, voir router.tsx) plutôt que via une iframe — plus de
   * redémarrage complet, le contenu s'affiche aussi vite qu'un
   * changement de page normal. Sans override, comportement inchangé :
   * lit companyId/preview depuis l'URL (route /boutique/:id). */
  companyIdOverride?: string;
  previewOverride?:   boolean;
}

export default function BoutiquePage({ companyIdOverride, previewOverride }: Props = {}) {
  const navigate       = useNavigate();
  const { t } = useTranslation();
  const { id: companyIdFromUrl } = useParams<{ id: string }>();
  const [searchParams]    = useSearchParams();
  const companyId         = companyIdOverride ?? companyIdFromUrl;
  const isPreview         = previewOverride ?? (searchParams.get('preview') === '1');

  /* BUG CORRIGÉ — BoutiqueIdentity.module.css/BoutiqueNav.module.css
   * calaient leur position sticky sur un décalage FIXE de 66px pour le
   * <Header> fixe du dessus — sauf qu'en mode aperçu (isPreview, "Voir
   * ma boutique" depuis le dashboard entreprise, voir ci-dessous), ce
   * <Header> n'est JAMAIS rendu (`{!isPreview && <Header/>}`). La barre
   * d'identité se collait donc 66px trop bas, avec un vide au-dessus —
   * et pendant le scroll, cet écart entre position réelle/attendue
   * donnait l'impression que la barre "se décolle"/bouge, exactement
   * dans le contexte où l'utilisateur teste (l'aperçu entreprise). */
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--boutique-header-h', isPreview ? '0px' : '66px');
  }, [isPreview]);

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

  /* ── Chargement des données ───────────────────────────────────
   * Extrait en fonction réutilisable : appelée au montage ET quand
   * boutique:catalogue_updated arrive (voir l'effet socket plus bas) —
   * `silent` évite de réafficher le skeleton complet le temps d'un simple
   * rafraîchissement en arrière-plan (données déjà à l'écran). */
  const loadBoutiqueData = useCallback((silent = false) => {
    if (!companyId) { setError(t('boutiqueDetail.page.idBoutiqueManquant')); setLoading(false); return; }

    if (!silent) { setLoading(true); setError(null); }

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
      .catch(() => { if (!silent) setError(t('boutiqueDetail.page.erreurChargement')); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [companyId, isLoggedIn, t]);

  useEffect(() => { loadBoutiqueData(); }, [loadBoutiqueData]);

  /* ── Mises à jour en direct (horaires, catalogue…) ────────────────
   * Namespace /public : aucune authentification (visiteur anonyme
   * inclus), une seule room par fiche consultée. Connexion dédiée à
   * cette page (pas de singleton comme useNotificationSocket) — se
   * connecte/déconnecte avec le montage/démontage de cette page. Voir
   * public.gateway.ts + HorairesParametresService/CatalogueParametresService
   * côté backend. */
  useEffect(() => {
    if (!companyId) return;
    const socket = io(`${SOCKET_URL}/public`, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => socket.emit('boutique:join', { companyId }));

    socket.on('boutique:horaires_updated', (payload: { horaires: BoutiqueApi['horaires'] }) => {
      setBoutique(b => b ? { ...b, horaires: payload.horaires } : b);
    });

    /* showOutOfStock/showStrikePrice/returnPolicy (Paramètres > Catalogue)
     * touchent à la fois la fiche boutique ET la liste de produits (quels
     * produits apparaissent, prix barré affiché ou non) — trop de surfaces
     * pour pousser juste un champ comme pour les horaires : on recharge
     * silencieusement ce que cette page affiche déjà. */
    socket.on('boutique:catalogue_updated', () => loadBoutiqueData(true));

    /* Méthodes/zones de livraison (Paramètres > Livraison) — même
     * traitement que catalogue_updated : rechargement silencieux. */
    socket.on('boutique:livraison_updated', () => loadBoutiqueData(true));

    return () => {
      socket.emit('boutique:leave', { companyId });
      socket.disconnect();
    };
  }, [companyId, loadBoutiqueData]);

  // ── Filtres produits ─────────────────────────────────────────
  const [catActive,  setCatActive]  = useState('Tout');
  const [sortBy,     setSortBy]     = useState('Pertinence');
  const [filtrStock, setFiltrStock] = useState(false);
  const [filtrPromo, setFiltrPromo] = useState(false);
  const [filtrNew,   setFiltrNew]   = useState(false);
  /* Bornes réelles dérivées des produits (voir priceRange plus bas) —
   * null tant qu'aucun filtrage manuel n'a été appliqué : la sidebar
   * affiche alors les bornes réelles sans qu'on ait à les dupliquer ici. */
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);

  /* BUG CORRIGÉ — un produit publié depuis moins de 14 jours est
   * considéré "nouveau" ; cette classification n'existait nulle part
   * (aucun champ `badge` côté API pour les produits boutique, voir
   * public.service.ts::toPublicProduit), donc le filtre "Nouveautés
   * seulement" ne filtrait jamais rien. */
  const NOUVEAUTE_JOURS = 14;
  const isNouveau = (p: ProduitApi) =>
    Date.now() - new Date(p.createdAt).getTime() < NOUVEAUTE_JOURS * 24 * 60 * 60 * 1000;

  /* Bornes réelles de prix parmi les produits de LA boutique — remplace
   * l'ancien slider figé (0 → 30M, valeur par défaut 21M) qui n'avait
   * aucun rapport avec les prix réellement pratiqués. */
  const priceBounds = useMemo(() => {
    if (produits.length === 0) return { min: 0, max: 0 };
    const prices = produits.map(p => p.prix);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [produits]);

  // Convertit ProduitApi → format attendu par ProduitsSection
  const produitsFiltres = useMemo(() => {
    const effMin = priceMin ?? priceBounds.min;
    const effMax = priceMax ?? priceBounds.max;

    return produits
      .filter(p => {
        if (catActive !== 'Tout' && p.category?.nom !== catActive) return false;
        if (filtrStock && p.stock === 0)  return false;
        if (filtrPromo && !p.prixAncien)  return false;
        if (filtrNew   && !isNouveau(p))  return false;
        if (p.prix < effMin || p.prix > effMax) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case t('boutiqueDetail.sidebar.triOptions.prixCroissant'):   return a.prix - b.prix;
          case t('boutiqueDetail.sidebar.triOptions.prixDecroissant'): return b.prix - a.prix;
          case t('boutiqueDetail.sidebar.triOptions.nouveautes'):
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          /* "Mieux notées" / "Meilleures ventes" : aucune donnée réelle
           * par produit n'existe encore pour les alimenter (pas de
           * notation par produit, pas de compteur de ventes) — ordre
           * inchangé plutôt que de trier sur une valeur inventée. */
          default: return 0;
        }
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
        badge:  p.prixAncien ? 'promo' : isNouveau(p) ? 'new' : null,
        // Champ extra pour l'image
        imageUrl: p.images?.[0]?.url ?? null,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produits, catActive, filtrStock, filtrPromo, filtrNew, priceMin, priceMax, priceBounds, sortBy, t]);

  /* Catégories réelles de la boutique — remplace CATEGORIES_BOUTIQUE
   * (liste fixe avec des compteurs inventés, sans rapport avec les
   * produits réels de CETTE boutique — cliquer dessus filtrait sur un
   * nom de catégorie qui ne correspondait à aucun produit réel). */
  const categoriesReelles = useMemo(() => {
    const map = new Map<string, { emoji: string; count: number }>();
    for (const p of produits) {
      const nom = p.category?.nom;
      if (!nom) continue;
      const entry = map.get(nom) ?? { emoji: p.category?.icone ?? '📦', count: 0 };
      entry.count++;
      map.set(nom, entry);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, emoji: v.emoji, count: v.count }))
      .sort((a, b) => b.count - a.count);
  }, [produits]);

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

  // ── Infos boutique converties ────────────────────────────────
  const boutiqueInfo: BoutiqueInfo | null = boutique ? toBoutiqueInfo(boutique, t) : null;

  // ── Counts ──────────────────────────────────────────────────
  // BUG CORRIGÉ — promos/avis venaient de PROMOS_MOCK/AVIS_MOCK
  // (données factices, "avis" était même multiplié par 49 sans raison)
  // alors que les vraies données (promos, avisData) étaient déjà
  // chargées et utilisées ailleurs dans cette page — juste jamais
  // reliées à ce badge de comptage sur la barre d'onglets.
  const counts = {
    produits:       produitsFiltres.length,
    promos:         promos.length,
    livreurs:       livreurs.length,
    correspondants: correspondants.length,
    avis:           avisData?.totalRatings ?? boutiqueInfo?.totalRatings ?? 0,
  };

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
          /* isPreview = ?preview=1, posé UNIQUEMENT par BoutiquePreviewPage.tsx
           * ("Voir ma boutique" du dashboard entreprise) — jamais ailleurs
           * dans le code. Une entreprise ne peut pas se suivre, s'appeler
           * ou s'envoyer un message à elle-même. */
          isOwnerPreview={isPreview}
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

        {/* Stories — même carte/viewer que la home, filtré sur cette boutique */}
        {onglet === 'produits' && companyId && (
          <HomeStoriesStrip
            companyId={companyId}
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
              categories={categoriesReelles}
              priceBounds={priceBounds}
              priceMin={priceMin ?? priceBounds.min}
              priceMax={priceMax ?? priceBounds.max}
              setPriceMin={setPriceMin}
              setPriceMax={setPriceMax}
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
