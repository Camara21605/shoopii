import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { produitApi, type SimilaireApi } from '../api/produit.api';
import { useCart } from '../../../../../shared/context/CartContext';
import { getRoleFromToken } from '../../../../../shared/services/authUtils';
import styles from '../styles/SimilairesSection.module.css';

interface Props {
  produitId: string;
  onToast:   (m: string) => void;
}

const BADGE_CFG: Record<string, string> = { hot:'⭐ Pop.', new:'✨ Nouveau', promo:'🏷️ Promo' };
const BADGE_CLS: Record<string, string> = { hot:styles.badgeHot, new:styles.badgeNew, promo:styles.badgePromo };

export default function SimilairesSection({ produitId, onToast }: Props) {
  const [produits, setProduits] = useState<SimilaireApi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [favs,     setFavs]     = useState<Set<string>>(new Set());
  const [adding,   setAdding]   = useState<string | null>(null);

  const { addToCart, isInCart } = useCart();
  const isClient = getRoleFromToken() === 'client';
  const navigate = useNavigate();

  useEffect(() => {
    if (!produitId) return;
    setLoading(true);
    produitApi.getSimilaires(produitId)
      .then(data => setProduits(data ?? []))
      .catch(() => setProduits([]))
      .finally(() => setLoading(false));
  }, [produitId]);

  if (loading) return (
    <section className={styles.sec}>
      <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize:20 }} />
      </div>
    </section>
  );

  if (!loading && produits.length === 0) return null;

  const toggleFav = (id: string) => {
    setFavs(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); onToast('🤍 Retiré des favoris'); }
      else              { next.add(id);    onToast('❤️ Ajouté aux favoris'); }
      return next;
    });
  };

  async function handleAddToCart(p: SimilaireApi) {
    if (!isClient) { navigate('/login'); return; }

    /* ✅ Déjà dans le panier → rediriger vers le panier */
    if (isInCart(p.id)) {
      onToast('🛒 Déjà dans votre panier — allez dans le panier pour modifier la quantité');
      return;
    }

    setAdding(p.id);
    try {
      await addToCart(p.id, 1);
      onToast(`✅ ${p.nom} ajouté au panier !`);
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
    } finally {
      setAdding(null);
    }
  }

  const remise = (p: SimilaireApi) =>
    p.prixAncien && p.prixAncien > p.prix
      ? Math.round((1 - p.prix / p.prixAncien) * 100)
      : null;

  return (
    <section className={styles.sec}>
      <div className={styles.hd}>
        <div>
          <div className={styles.kick}>Vous aimerez aussi</div>
          <h2 className={styles.titre}>Produits <em>similaires</em></h2>
        </div>
        <a href="#" className={styles.lkAll} onClick={e => e.preventDefault()}>
          Voir tout <i className="fas fa-arrow-right" />
        </a>
      </div>

      <div className={styles.grid}>
        {produits.map(p => {
          const pct         = remise(p);
          const enPanier    = !!isInCart(p.id);
          return (
            <div key={p.id} className={styles.card} onClick={() => navigate(`/produit/${p.id}`)}>
              {p.badge && <span className={`${styles.badge} ${BADGE_CLS[p.badge] ?? ''}`}>{BADGE_CFG[p.badge]}</span>}
              {pct && <span className={`${styles.badge} ${styles.badgePromo}`}>−{pct}%</span>}

              <button
                className={`${styles.fav} ${favs.has(p.id) ? styles.favOn : ''}`}
                onClick={e => { e.stopPropagation(); toggleFav(p.id); }}
              >
                <i className={favs.has(p.id) ? 'fas fa-heart' : 'far fa-heart'} />
              </button>

              <div className={styles.img}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.nom}
                    style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }}
                  />
                ) : (
                  <span style={{ fontSize:40 }}>{p.emoji ?? '📦'}</span>
                )}
              </div>

              <div className={styles.body}>
                {p.shopNom && <div className={styles.shop}>{p.shopNom}</div>}
                <h3 className={styles.nom}>{p.nom}</h3>

                {p.nbAvis > 0 && (
                  <div className={styles.rate}>
                    <span className={styles.stars}>
                      {'★'.repeat(Math.round(p.noteAvg))}{'☆'.repeat(5 - Math.round(p.noteAvg))}
                    </span>
                    <span className={styles.cnt}>({p.nbAvis})</span>
                  </div>
                )}

                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <div className={styles.prix}>{p.prix.toLocaleString('fr')} GNF</div>
                  {p.prixAncien && p.prixAncien > p.prix && (
                    <div style={{ fontSize:11, color:'var(--t4)', textDecoration:'line-through' }}>
                      {p.prixAncien.toLocaleString('fr')}
                    </div>
                  )}
                </div>

                {/* ✅ Bouton change selon état panier */}
                {enPanier ? (
                  <button
                    className={styles.btnAdd}
                    onClick={e => { e.stopPropagation(); navigate('/commande'); }}
                    style={{ background:'var(--emerald,#059669)', borderColor:'var(--emerald,#059669)' }}
                  >
                    <i className="fas fa-check" /> Voir le panier
                  </button>
                ) : (
                  <button
                    className={styles.btnAdd}
                    onClick={e => { e.stopPropagation(); handleAddToCart(p); }}
                    disabled={adding === p.id}
                  >
                    {adding === p.id
                      ? <i className="fas fa-circle-notch fa-spin" />
                      : <><i className="fas fa-cart-plus" /> Ajouter</>
                    }
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}