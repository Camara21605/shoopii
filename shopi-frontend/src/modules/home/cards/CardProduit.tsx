/*
 * FICHIER : src/modules/home/components/cards/CardProduit.tsx
 *
 * ✅ AJOUT AU PANIER RÉEL :
 *   - Branché sur useCart().addToCart(produitId, qty)
 *   - Réservé aux clients : non-client/anonyme → toast d'invitation
 *   - État "déjà au panier" via isInCart(produitId)
 *   - Bouton désactivé pendant l'appel réseau (loading)
 *   - Galerie de miniatures dans ModalVoir (inchangée)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate }  from 'react-router-dom';
import { apiFetch }     from '../../../shared/services/apiFetch';
import { useCart }      from '../../../shared/context/CartContext';
import { useFavoris }   from '../../../shared/context/FavorisContext';
import { useAuthGate }  from '../../../shared/hooks/useAuthGate';
import styles           from './CardProduit.module.css';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ProductApi {
  id:          string;
  nom:         string;
  description: string | null;
  prix:        number;
  prixAncien:  number | null;
  marque:      string | null;
  urlSlug:     string | null;
  images:      { id: string; url: string; ordre: number; alt: string | null }[];
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  companyId:   string;
  companyName: string;
  companyLogo: string | null;
  badge?:      'hot' | 'new' | 'promo' | null;
  venteEnGros?:    boolean;
  moq?:            number | null;
  wholesaleTiers?: { quantiteMin: number; quantiteMax: number | null; prixUnitaire: number; ordre: number }[];
}

interface BoutiqueApi {
  id:            string;
  companyName:   string;
  description:   string | null;
  logo:          string | null;
  coverImage:    string | null;
  businessPhone: string | null;
  averageRating: number;
  totalOrders:   number;
  totalRatings:  number;
  ville:         string;
  verified:      boolean;
}

interface Props {
  p:       ProductApi;
  onToast: (m: string) => void;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const BADGE_CONFIG = {
  hot:   { label: '🔥 Hot',     cls: 'badgeHot'   },
  new:   { label: '✨ Nouveau', cls: 'badgeNew'   },
  promo: { label: '🏷️ Promo',  cls: 'badgePromo' },
};

const RESEAUX = [
  { icon: 'fab fa-whatsapp',   label: 'WhatsApp', color: '#25D366', action: (u: string) => `https://wa.me/?text=${encodeURIComponent(u)}` },
  { icon: 'fab fa-facebook-f', label: 'Facebook', color: '#1877F2', action: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { icon: 'fab fa-x-twitter',  label: 'X',        color: '#111',    action: (u: string) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}` },
  { icon: 'fab fa-instagram',  label: 'Instagram', color: '#E1306C', action: () => '' },
  { icon: 'fas fa-envelope',   label: 'Email',    color: '#6B7280', action: (u: string) => `mailto:?body=${encodeURIComponent(u)}` },
  { icon: 'fas fa-link',       label: 'Copier',   color: '#1A4FC4', action: () => '' },
];

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

function remise(prix: number, ancien: number): number {
  return Math.round((1 - prix / ancien) * 100);
}

function getImages(p: ProductApi) {
  return (p.images ?? []).sort((a, b) => a.ordre - b.ordre);
}

function mainImage(p: ProductApi): string | null {
  return getImages(p)[0]?.url ?? null;
}

function emoji(p: ProductApi): string {
  return p.category?.icone ?? '📦';
}

// ─────────────────────────────────────────────────────────────
// HOOK PARTAGÉ — logique d'ajout au panier
//
// Centralise la règle métier (client only) + l'appel addToCart
// + le toast, pour que la carte ET la modale partagent le même
// comportement sans duplication.
// ─────────────────────────────────────────────────────────────

function useAddToCart(p: ProductApi, onToast: (m: string) => void, requireClient: (action: () => void) => void) {
  const { addToCart, isInCart } = useCart();
  const [adding, setAdding]     = useState(false); /* état LOCAL — chaque carte indépendante */

  const dejaAuPanier = !!isInCart(p.id);

  const handleAdd = (onDone?: () => void) => {
    requireClient(async () => {
      if (dejaAuPanier) {
        onToast(`✓ ${p.nom} est déjà dans votre panier`);
        return;
      }

      setAdding(true);
      try {
        await addToCart(p.id, 1);
        onToast(`🛒 ${p.nom} ajouté au panier !`);
        onDone?.();
      } catch (e: any) {
        onToast(`❌ ${e?.message ?? 'Impossible d\'ajouter au panier'}`);
      } finally {
        setAdding(false);
      }
    });
  };

  return { handleAdd, dejaAuPanier, loading: adding };
}

// ─────────────────────────────────────────────────────────────
// HOOK PARTAGÉ — logique du bouton favori (❤️)
//
// Persiste le like/unlike via /client/favoris/:id/toggle pour
// que le produit apparaisse dans l'onglet Favoris du profil.
// ─────────────────────────────────────────────────────────────

function useFavorite(p: ProductApi, onToast: (m: string) => void, requireClient: (action: () => void) => void) {
  const [loading, setLoading] = useState(false);
  const { isLiked, toggle } = useFavoris();

  const liked = isLiked(p.id);

  const handleToggle = () => {
    if (loading) return;
    requireClient(async () => {
      setLoading(true);
      try {
        const nowLiked = await toggle(p.id);
        onToast(nowLiked ? '❤️ Ajouté aux favoris' : '💔 Retiré des favoris');
      } catch (e: any) {
        onToast(`❌ ${e?.message ?? 'Action impossible'}`);
      } finally {
        setLoading(false);
      }
    });
  };

  return { liked, handleToggle, loading };
}

// ─────────────────────────────────────────────────────────────
// MODALE — Boutique
// ─────────────────────────────────────────────────────────────

function ModalEntreprise({ p, onClose, onToast }: { p: ProductApi; onClose: () => void; onToast: (m: string) => void }) {
  const [suivi,    setSuivi]    = useState(false);
  const [boutique, setBoutique] = useState<BoutiqueApi | null>(null);
  const [loading,  setLoading]  = useState(true);
  const navigate                = useNavigate();

  useEffect(() => {
    apiFetch<BoutiqueApi>(`/public/boutiques/${p.companyId}`, { public: true })
      .then(data => setBoutique(data))
      .catch(() => setBoutique({
        id: p.companyId, companyName: p.companyName, description: null,
        logo: p.companyLogo, coverImage: null, businessPhone: null,
        averageRating: 0, totalOrders: 0, totalRatings: 0,
        ville: 'Conakry', verified: false,
      }))
      .finally(() => setLoading(false));
  }, [p.companyId]);

  const b = boutique;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>

        <div className={styles.mHeader}>
          <div className={styles.mTitle}><i className="fas fa-store" /> Boutique</div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={styles.mBody}>
          {loading ? (
            <div style={{ padding:'32px 0', textAlign:'center', color:'var(--t3)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize:22 }} />
            </div>
          ) : (
            <>
              {b?.coverImage && (
                <div style={{ height:80, borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                  <img src={b.coverImage} alt="cover" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              )}
              <div className={styles.boutiqueProfil}>
                <div className={styles.boutiqueAvatar}>
                  {b?.logo
                    ? <img src={b.logo} alt={b.companyName} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                    : <span style={{ fontSize:28 }}>{emoji(p)}</span>}
                </div>
                <div>
                  <div className={styles.boutiqueNom}>{b?.companyName}</div>
                  <div className={styles.boutiqueVille}><i className="fas fa-map-pin" /> {b?.ville ?? 'Conakry'}, Guinée</div>
                  {b?.verified && (
                    <div className={styles.boutiqueVerif}><i className="fas fa-circle-check" /> Boutique vérifiée Shopi</div>
                  )}
                </div>
              </div>

              {b?.description && (
                <p style={{ fontSize:12.5, color:'var(--t2)', lineHeight:1.6, marginBottom:14 }}>{b.description}</p>
              )}

              <div className={styles.boutiqueStats}>
                {[
                  { ico:'📦', val: b?.totalOrders  ? b.totalOrders.toLocaleString('fr-FR')  : '—', lbl:'Commandes' },
                  { ico:'⭐', val: b?.averageRating ? b.averageRating.toFixed(1)              : '—', lbl:'Note'      },
                  { ico:'💬', val: b?.totalRatings  ? b.totalRatings.toLocaleString('fr-FR') : '—', lbl:'Avis'      },
                  { ico:'📍', val: b?.ville ?? 'Conakry',                                          lbl:'Ville'     },
                ].map(s => (
                  <div key={s.lbl} className={styles.boutiqueStat}>
                    <span className={styles.boutiqueStatIco}>{s.ico}</span>
                    <span className={styles.boutiqueStatVal}>{s.val}</span>
                    <span className={styles.boutiqueStatLbl}>{s.lbl}</span>
                  </div>
                ))}
              </div>

              <div className={styles.produitPublie}>
                <div className={styles.produitPublieLabel}><i className="fas fa-box" /> Produit publié par cette boutique</div>
                <div className={styles.produitPublieCard}>
                  <span className={styles.produitPublieEmo}>
                    {mainImage(p)
                      ? <img src={mainImage(p)!} alt={p.nom} style={{ width:36, height:36, objectFit:'cover', borderRadius:8 }} />
                      : emoji(p)}
                  </span>
                  <div>
                    <div className={styles.produitPublieNom}>{p.nom}</div>
                    <div className={styles.produitPubliePrix}>{fmt(p.prix)} GNF</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.mFooter}>
          <button className={`${styles.suiviBtn} ${suivi ? styles.suiviBtnOn : ''}`}
            onClick={() => { setSuivi(s => !s); onToast(suivi ? '👋 Désabonné' : `✅ Abonné à ${p.companyName}`); }}>
            {suivi ? <><i className="fas fa-check" /> Abonné</> : <><i className="fas fa-plus" /> S'abonner</>}
          </button>
          <button className={styles.voirBoutiqueBtn}
            onClick={() => { onClose(); navigate(`/boutique/${p.companyId}`); }}>
            <i className="fas fa-store" /> Voir la boutique
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE — Partage
// ─────────────────────────────────────────────────────────────

function ModalPartage({ p, onClose, onToast }: { p: ProductApi; onClose: () => void; onToast: (m: string) => void }) {
  const slug       = p.urlSlug ?? p.nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const produitUrl = `https://shopi.gn/p/${slug}`;

  function handleCopier() {
    navigator.clipboard.writeText(produitUrl).catch(() => {});
    onToast('🔗 Lien copié !');
  }

  function handleReseau(r: typeof RESEAUX[0]) {
    if (r.label === 'Copier')    { handleCopier(); return; }
    if (r.label === 'Instagram') { onToast('📸 Ouvrez Instagram et partagez le lien'); return; }
    const url = r.action(produitUrl);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    onToast(`📲 Partage via ${r.label}`);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>

        <div className={styles.mHeader}>
          <div className={styles.mTitle}><i className="fas fa-share-nodes" /> Partager ce produit</div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={styles.mBody}>
          <div className={styles.partageApercu}>
            <span className={styles.partageEmo}>
              {mainImage(p)
                ? <img src={mainImage(p)!} alt={p.nom} style={{ width:40, height:40, objectFit:'cover', borderRadius:8 }} />
                : emoji(p)}
            </span>
            <div>
              <div className={styles.partageNom}>{p.nom}</div>
              <div className={styles.partagePrix}>{fmt(p.prix)} GNF</div>
            </div>
          </div>

          <div className={styles.partageGrid}>
            {RESEAUX.map(r => (
              <button key={r.label} className={styles.partageBtn} onClick={() => handleReseau(r)}>
                <div className={styles.partageBtnIco} style={{ background:`${r.color}15`, border:`1.5px solid ${r.color}30` }}>
                  <i className={r.icon} style={{ color:r.color }} />
                </div>
                <span className={styles.partageBtnLabel}>{r.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.partageLien}>
            <span className={styles.partageLienUrl}>{produitUrl}</span>
            <button className={styles.partageLienBtn} onClick={handleCopier}>
              <i className="fas fa-copy" /> Copier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE — Prix en gros (paliers dégressifs)
// ─────────────────────────────────────────────────────────────

function ModalGros({ p, onClose }: { p: ProductApi; onClose: () => void }) {
  const tiers = [...(p.wholesaleTiers ?? [])].sort((a, b) => a.ordre - b.ordre);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>

        <div className={styles.mHeader}>
          <div className={styles.mTitle}><i className="fas fa-layer-group" /> Prix en gros</div>
          <button className={styles.closeBtn} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={styles.mBody}>
          <div className={styles.grossApercu}>
            <span className={styles.grossImgWrap}>
              {mainImage(p)
                ? <img src={mainImage(p)!} alt={p.nom} style={{ width:44, height:44, objectFit:'cover', borderRadius:8 }} />
                : <span style={{ fontSize:32 }}>{emoji(p)}</span>}
            </span>
            <div>
              <div className={styles.grossNom}>{p.nom}</div>
              <div className={styles.grossSub}>Prix standard : {fmt(p.prix)} GNF / unité</div>
              {p.moq && (
                <div className={styles.grossMoq}><i className="fas fa-boxes-stacked" /> Min. {p.moq} unités</div>
              )}
            </div>
          </div>

          {tiers.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--t3)', fontSize:13 }}>
              Aucun palier de prix configuré pour ce produit.
            </div>
          ) : (
            <>
              <div className={styles.grossLabel}>Paliers de prix dégressifs</div>
              <div className={styles.grossTable}>
                <div className={styles.grossHead}>
                  <span>Quantité</span>
                  <span>Prix / unité</span>
                  <span>Économie</span>
                </div>
                {tiers.map((t, i) => {
                  const eco = p.prix > t.prixUnitaire ? Math.round((1 - t.prixUnitaire / p.prix) * 100) : 0;
                  return (
                    <div key={i} className={`${styles.grossRow} ${i === 0 ? styles.grossRowFirst : ''}`}>
                      <span className={styles.grossQte}>
                        {t.quantiteMin}{t.quantiteMax != null ? ` – ${t.quantiteMax}` : '+'} unités
                      </span>
                      <span className={styles.grossPrix}>{fmt(t.prixUnitaire)} GNF</span>
                      <span className={styles.grossEco}>
                        {eco > 0 ? <span className={styles.grossEcoTag}>-{eco}%</span> : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className={styles.grossNote}>
            <i className="fas fa-circle-info" />
            <span>Ajoutez le produit au panier avec la quantité souhaitée. Le prix dégressif s'applique automatiquement à la commande.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function CardProduit({ p, onToast }: Props) {
  const navigate = useNavigate();
  const [modalEntreprise, setModalEntreprise] = useState(false);
  const [modalPartage,    setModalPartage]    = useState(false);
  const [modalGros,       setModalGros]       = useState(false);

  const img = mainImage(p);
  const em  = emoji(p);
  const b   = p.badge ? BADGE_CONFIG[p.badge] : null;

  /* ✅ Garde d'authentification partagée (panier + favoris) */
  const { requireClient, authModal } = useAuthGate();

  /* ✅ Logique d'ajout au panier partagée */
  const { handleAdd, dejaAuPanier, loading } = useAddToCart(p, onToast, requireClient);

  /* ✅ Logique du bouton favori partagée */
  const { liked: fav, handleToggle: handleToggleFav } = useFavorite(p, onToast, requireClient);

  return (
    <>
      <div className={styles.pcard} onClick={() => navigate(`/produit/${p.id}`)} style={{ cursor: 'pointer' }}>

        {b && <span className={`${styles.pbadge} ${styles[b.cls]}`}>{b.label}</span>}

        <button className={`${styles.pfav} ${fav ? styles.pfavOn : ''}`}
          onClick={e => { e.stopPropagation(); handleToggleFav(); }}>
          <i className={fav ? 'fas fa-heart' : 'far fa-heart'} />
        </button>

        <div className={styles.pimg}>
          {img
            ? <img src={img} alt={p.nom} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <span className={styles.pimgEmoji}>{em}</span>}
          <div className={styles.pimgOverlay}><span><i className="fas fa-eye" /> Voir</span></div>
        </div>

        <div className={styles.pbody}>
          <div className={styles.pshop} onClick={e => { e.stopPropagation(); setModalEntreprise(true); }}>
            {p.companyLogo
              ? <img src={p.companyLogo} alt={p.companyName} style={{ width:14, height:14, borderRadius:3, objectFit:'cover', verticalAlign:'middle', marginRight:4 }} />
              : <i className="fas fa-store" />}
            {' '}{p.companyName}
          </div>

          <div className={styles.pname}>{p.nom}</div>
          <div className={styles.pdesc}>{p.description ?? ''}</div>

          <div className={styles.pprices}>
            <span className={styles.pprice}>{fmt(p.prix)} GNF</span>
            {p.prixAncien && (
              <>
                <span className={styles.pold}>{fmt(p.prixAncien)} GNF</span>
                <span className={styles.premise}>-{remise(p.prix, p.prixAncien)}%</span>
              </>
            )}
          </div>

          {/* ✅ Panier + actions secondaires sur la même ligne */}
          <div className={styles.pbottomRow}>
            {dejaAuPanier ? (
              <button className={`${styles.pcart} ${styles.pcartDone}`}
                onClick={e => { e.stopPropagation(); onToast('✓ Déjà dans votre panier — retirez-le depuis le panier'); }}>
                <i className="fas fa-check" /> Déjà au panier
              </button>
            ) : (
              <button className={styles.pcart} disabled={loading} onClick={e => { e.stopPropagation(); handleAdd(); }}>
                {loading
                  ? <><i className="fas fa-spinner fa-spin" /> Ajout…</>
                  : <><i className="fas fa-cart-plus" /> Ajouter au panier</>}
              </button>
            )}

            <div className={styles.pactions}>
              <button className={`${styles.paction} ${styles.pactionEntreprise}`} onClick={e => { e.stopPropagation(); setModalEntreprise(true); }} title="Boutique" aria-label="Boutique">
                <i className="fas fa-store" /><span>Boutique</span>
              </button>
              <button className={`${styles.paction} ${styles.pactionPartage}`} onClick={e => { e.stopPropagation(); setModalPartage(true); }} title="Partager" aria-label="Partager">
                <i className="fas fa-share-nodes" /><span>Partager</span>
              </button>
              {p.venteEnGros && (
                <button className={`${styles.paction} ${styles.pactionGros}`} onClick={e => { e.stopPropagation(); setModalGros(true); }} title="Prix gros" aria-label="Prix gros">
                  <i className="fas fa-tags" /><span>Prix gros</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalEntreprise && <ModalEntreprise p={p} onClose={() => setModalEntreprise(false)} onToast={onToast} />}
      {modalPartage    && <ModalPartage    p={p} onClose={() => setModalPartage(false)}    onToast={onToast} />}
      {modalGros       && <ModalGros       p={p} onClose={() => setModalGros(false)} />}
      {authModal}
    </>
  );
}