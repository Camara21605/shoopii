import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { apiFetch } from '../../../../../shared/services/apiFetch';

import Header             from '../../layout/Header';
import Footer             from '../../layout/Footer';
import ProduitGallerie    from '../components/ProduitGallerie';
import ModalPartage       from '../components/ModalPartage';
import ProduitInfoSection from '../sections/ProduitInfoSection';
import LivraisonSection, { type LivraisonState } from '../sections/LivraisonSection';
import PanierPanel        from '../sections/PanierPanel';
import TabsSection        from '../sections/TabsSection';
import SimilairesSection  from '../sections/SimilairesSection';

import type { ProduitInfo } from '../data/produitMockData';
import styles from '../styles/ProduitPage.module.css';

export interface ProduitApi {
  id:          string;
  nom:         string;
  description: string | null;
  prix:        number;
  prixAncien:  number | null;
  marque:      string | null;
  stock:       number;
  visibilite:  string;
  condition:   string;
  garantie:    string;
  urlSlug:     string | null;
  images:      { id: string; url: string; ordre: number; alt: string | null; type: string }[];
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  specs:       { id: string; cle: string; valeur: string; ordre: number }[];
  variantes:   { id: string; type: string; vals: string }[];
  companyId:   string;
  companyName: string;
  companyLogo: string | null;
  companyVerified: boolean;
  companyVille:    string | null;
  companyPays:     string;
  /* Vente en gros */
  venteEnGros:    boolean;
  moq:            number | null;
  wholesaleTiers: { quantiteMin: number; quantiteMax: number | null; prixUnitaire: number; ordre: number }[];
  /* Politique de livraison */
  livraisonStandard:      boolean;
  livraisonLivreur:       boolean;
  livraisonCorrespondant: boolean;
  fraisLivraisonLocal:    number | null;
  delaiLivraison:         string;
}

/** Étiquette + drapeau pour les pays déjà référencés dans GEO_DATA (produitMockData.ts)
 *  — évite de dupliquer une seconde liste pays/drapeaux pour le même usage. */
const PAYS_LABELS: Record<string, { label: string; drapeau: string; continent: string }> = {
  GN: { label: 'Guinée',        drapeau: '🇬🇳', continent: 'africa'  },
  SN: { label: 'Sénégal',       drapeau: '🇸🇳', continent: 'africa'  },
  CI: { label: "Côte d'Ivoire", drapeau: '🇨🇮', continent: 'africa'  },
  ML: { label: 'Mali',          drapeau: '🇲🇱', continent: 'africa'  },
  CM: { label: 'Cameroun',      drapeau: '🇨🇲', continent: 'africa'  },
  FR: { label: 'France',        drapeau: '🇫🇷', continent: 'europe'  },
  BE: { label: 'Belgique',      drapeau: '🇧🇪', continent: 'europe'  },
  DE: { label: 'Allemagne',     drapeau: '🇩🇪', continent: 'europe'  },
  US: { label: 'États-Unis',    drapeau: '🇺🇸', continent: 'america' },
  CA: { label: 'Canada',        drapeau: '🇨🇦', continent: 'america' },
  CN: { label: 'Chine',         drapeau: '🇨🇳', continent: 'asia'    },
  JP: { label: 'Japon',         drapeau: '🇯🇵', continent: 'asia'    },
};

function toProduitInfo(p: ProduitApi, t: TFunction): ProduitInfo {
  return {
    id:          p.id,
    nom:         p.nom,
    categorie:   p.category?.nom ?? '',
    sku:         p.urlSlug ?? p.id.slice(0, 8).toUpperCase(),
    description: p.description ?? '',
    prix:        p.prix,
    ancien:      p.prixAncien ?? p.prix,
    note:        4.5,
    avis:        0,
    acheteurs:   0,
    vues:        0,
    stock:       p.stock,
    stockStatus: p.stock === 0 ? 'out' : p.stock < 5 ? 'low' : 'ok',
    thumbnails:  p.images?.length
      ? p.images.sort((a, b) => a.ordre - b.ordre).map(img => img.url)
      : [p.category?.icone ?? '📦'],
    specs: p.specs?.map(s => ({ label: s.cle, value: s.valeur })) ?? [],
    boutique: {
      nom:       p.companyName ?? t('boutiqueDetail.page.boutiqueShopiDefault'),
      emoji:     '🏪',
      logoUrl:   p.companyLogo ?? null,
      verified:  p.companyVerified,
      pays:      PAYS_LABELS[p.companyPays]?.label   ?? p.companyPays,
      drapeau:   PAYS_LABELS[p.companyPays]?.drapeau  ?? '🌍',
      region:    p.companyVille ?? '—',
      continent: PAYS_LABELS[p.companyPays]?.continent ?? 'africa',
      abonnes:   '—',
    },
  } as ProduitInfo;
}

function SkeletonPage() {
  return (
    <div style={{ padding:'80px 20px', maxWidth:1200, margin:'0 auto' }}>
      {[200, 60, 120].map((h, i) => (
        <div key={i} style={{
          height:h, borderRadius:16, marginBottom:16,
          background:'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
          backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite',
        }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

const LIVRAISON_INIT: LivraisonState = {
  selectedVille: null, selectedPays: null,
  isInternational: false, delivMode: null,
  selectedLvr: null, selectedCorr: null,
  currentSpeed: 'standard', distZone: 'local',
};

export default function ProduitPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id: produitId } = useParams<{ id: string }>();

  const [produitApi, setProduitApi] = useState<ProduitApi | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!produitId) { setError(t('produitDetail.page.idManquant')); setLoading(false); return; }
    apiFetch<ProduitApi>(`/public/produits/${produitId}`, { public: true })
      .then(data => setProduitApi(data))
      .catch(() => setError(t('produitDetail.page.introuvable')))
      .finally(() => setLoading(false));
  }, [produitId, t]);

  const [qty,         setQty]         = useState(1);
  const [livraison,   setLivraison]   = useState<LivraisonState>(LIVRAISON_INIT);
  const [partageOpen, setPartageOpen] = useState(false);
  /* Une entrée par type de variante réel du produit (ex: {Couleur: 'Noir', Taille: 'M'})
   * — remplace l'ancien storActive/colorActive à 2 emplacements fixes, qui affichait
   * "Stockage"/"Coloris" pour TOUT produit quelles que soient ses vraies variantes. */
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const [toastMsg,     setToastMsg]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastVisible(false), 3000);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function handleChangeQty(delta: number) {
    setQty(prev => Math.max(1, Math.min(5, prev + delta)));
  }

  const handleLivraisonChange = useCallback((state: LivraisonState) => {
    setLivraison(state);
  }, []);

  const livraisonRef = useRef<HTMLDivElement>(null);
  function scrollToLivraison() {
    livraisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (loading) return (
    <div className={styles.root}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
      <SkeletonPage />
      <Footer onToast={showToast} />
    </div>
  );

  if (error || !produitApi) return (
    <div className={styles.root}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
      <div style={{ padding:'80px 20px', textAlign:'center', color:'var(--t3)' }}>
        <div style={{ fontSize:64, marginBottom:16 }}>📦</div>
        <div style={{ fontSize:18, fontWeight:700, color:'var(--navy)', marginBottom:8 }}>{t('produitDetail.page.produitIntrouvableTitre')}</div>
        <div style={{ fontSize:14, marginBottom:24 }}>
          {error ?? t('produitDetail.page.produitIntrouvableDesc')}
        </div>
        <button onClick={() => navigate('/home')}
          style={{ background:'var(--navy)', color:'#fff', border:'none', borderRadius:10, padding:'10px 24px', fontWeight:700, cursor:'pointer' }}>
          {t('produitDetail.page.retourAccueil')}
        </button>
      </div>
      <Footer onToast={showToast} />
    </div>
  );

  const produit          = toProduitInfo(produitApi, t);
  const shareUrl         = `https://shopi.gn/produit/${produitApi.urlSlug ?? produitApi.id}`;
  const varianteCombinee = Object.values(selectedVariants).filter(Boolean).join(' · ') || undefined;

  return (
    <div className={styles.root}>

      <Header
        onToast={showToast}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      <main className={styles.main}>
        <div className={styles.wrap}>

          <nav className={styles.breadcrumb}>
            <a href="/home">{t('produitDetail.page.accueil')}</a>
            <i className="fas fa-chevron-right" />
            <span>{produit.categorie}</span>
            <i className="fas fa-chevron-right" />
            <span className={styles.bcCurrent}>{produit.nom}</span>
          </nav>

          <div className={styles.layout}>

            <div className={styles.leftCol}>
              <ProduitGallerie
                produit={produit}
                produitApi={produitApi}
                onToast={showToast}
                onPartage={() => setPartageOpen(true)}
              />
            </div>

            <div className={styles.centerCol}>
              {/* Regroupé dans un wrapper dédié (styles.infoBlock) : en dessous de
               * 1024px, .centerCol devient display:contents (voir CSS) pour que
               * ce bloc et .extraBlock ci-dessous redeviennent des enfants directs
               * de .layout, replaçables indépendamment via `order` — sans ça,
               * le panier (rightCol) atterrissait tout en bas de la page, après
               * les onglets et les produits similaires, au lieu de juste après
               * les infos produit. */}
              <div className={styles.infoBlock}>
                <ProduitInfoSection
                  produit={produit}
                  produitId={produitApi.id}
                  variantes={produitApi.variantes}
                  venteEnGros={produitApi.venteEnGros}
                  moq={produitApi.moq}
                  wholesaleTiers={produitApi.wholesaleTiers}
                  qty={qty}
                  onChangeQty={handleChangeQty}
                  onToast={showToast}
                  onPartage={() => setPartageOpen(true)}
                  onBoutique={() => navigate(`/boutique/${produitApi.companyId}`)}
                  selectedVariants={selectedVariants}
                  onVariantsChange={setSelectedVariants}
                >
                  <div ref={livraisonRef}>
                    <LivraisonSection
                      onChange={handleLivraisonChange}
                      onToast={showToast}
                      policy={produitApi ? {
                        standard:      produitApi.livraisonStandard      ?? true,
                        livreur:       produitApi.livraisonLivreur        ?? true,
                        correspondant: produitApi.livraisonCorrespondant  ?? false,
                        fraisLocal:    produitApi.fraisLivraisonLocal     ?? null,
                        delai:         produitApi.delaiLivraison          ?? '1-3 jours',
                      } : undefined}
                    />
                  </div>
                </ProduitInfoSection>
              </div>

              <div className={styles.extraBlock}>
                <TabsSection
                  produit={produit}
                  venteEnGros={produitApi.venteEnGros}
                  moq={produitApi.moq}
                  wholesaleTiers={produitApi.wholesaleTiers}
                />

                <SimilairesSection
                  produitId={produitApi.id}
                  onToast={showToast}
                />
              </div>
            </div>

            <div className={styles.rightCol}>
              <PanierPanel
                produit={produit}
                produitId={produitApi.id}
                variante={varianteCombinee}
                qty={qty}
                onChangeQty={handleChangeQty}
                livraison={livraison}
                onToast={showToast}
                onBoutique={() => navigate(`/boutique/${produitApi.companyId}`)}
                onScrollLivr={scrollToLivraison}
              />
            </div>
          </div>
        </div>
      </main>

      <Footer onToast={showToast} />

      {partageOpen && (
        <ModalPartage
          url={shareUrl}
          titre={t('produitDetail.page.partagerTitre')}
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