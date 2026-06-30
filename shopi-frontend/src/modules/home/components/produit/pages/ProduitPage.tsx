import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

import { AVIS_DATA } from '../data/produitMockData';
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
  images:      { id: string; url: string; ordre: number; alt: string | null }[];
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  specs:       { id: string; cle: string; valeur: string; ordre: number }[];
  variantes:   { id: string; type: string; vals: string }[];
  companyId:   string;
  companyName: string;
  companyLogo: string | null;
  /* Politique de livraison */
  livraisonStandard:      boolean;
  livraisonLivreur:       boolean;
  livraisonCorrespondant: boolean;
  fraisLivraisonLocal:    number | null;
  delaiLivraison:         string;
}

function toProduitInfo(p: ProduitApi): ProduitInfo {
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
      nom:       p.companyName ?? 'Boutique Shopi',
      emoji:     p.companyLogo ?? '🏪',
      verified:  true,
      pays:      'Guinée',
      drapeau:   '🇬🇳',
      region:    'Conakry',
      continent: 'africa',
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
  const { id: produitId } = useParams<{ id: string }>();

  const [produitApi, setProduitApi] = useState<ProduitApi | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!produitId) { setError('ID produit manquant.'); setLoading(false); return; }
    apiFetch<ProduitApi>(`/public/produits/${produitId}`, { public: true })
      .then(data => setProduitApi(data))
      .catch(() => setError('Produit introuvable ou non publié.'))
      .finally(() => setLoading(false));
  }, [produitId]);

  const [qty,         setQty]         = useState(1);
  const [livraison,   setLivraison]   = useState<LivraisonState>(LIVRAISON_INIT);
  const [partageOpen, setPartageOpen] = useState(false);
  const [storActive,  setStorActive]  = useState('256 GB');
  const [colorActive, setColorActive] = useState('Natural');

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
        <div style={{ fontSize:18, fontWeight:700, color:'var(--navy)', marginBottom:8 }}>Produit introuvable</div>
        <div style={{ fontSize:14, marginBottom:24 }}>
          {error ?? "Ce produit n'existe pas ou n'est pas encore publié."}
        </div>
        <button onClick={() => navigate('/home')}
          style={{ background:'var(--navy)', color:'#fff', border:'none', borderRadius:10, padding:'10px 24px', fontWeight:700, cursor:'pointer' }}>
          Retour à l'accueil
        </button>
      </div>
      <Footer onToast={showToast} />
    </div>
  );

  const produit          = toProduitInfo(produitApi);
  const shareUrl         = `https://shopi.gn/produit/${produitApi.urlSlug ?? produitApi.id}`;
  const varianteCombinee = [storActive, colorActive].filter(Boolean).join(' · ') || undefined;

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
            <a href="/home">Accueil</a>
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
              <ProduitInfoSection
                produit={produit}
                qty={qty}
                onChangeQty={handleChangeQty}
                onToast={showToast}
                onPartage={() => setPartageOpen(true)}
                onBoutique={() => navigate(`/boutique/${produitApi.companyId}`)}
                storActive={storActive}
                colorActive={colorActive}
                onStorChange={setStorActive}
                onColorChange={setColorActive}
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

              <TabsSection produit={produit} avis={AVIS_DATA} onToast={showToast} />

              <SimilairesSection
                produitId={produitApi.id}
                onToast={showToast}
              />
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
          titre="Partager ce produit"
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