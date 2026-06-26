import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProduitInfo } from '../data/produitMockData';
import type { LivraisonState } from './LivraisonSection';
import { SPEED_MUL, DIST_MUL } from '../data/produitMockData';
import { useCart } from '../../../../../shared/context/CartContext';
import { getRoleFromToken } from '../../../../../shared/services/authUtils';
import styles from '../styles/PanierPanel.module.css';

interface Props {
  produit:      ProduitInfo;
  produitId:    string;
  variante?:    string;
  qty:          number;
  onChangeQty:  (d: number) => void;
  livraison:    LivraisonState;
  onToast:      (m: string) => void;
  onBoutique:   () => void;
  onScrollLivr: () => void;
}

export default function PanierPanel({
  produit, produitId, variante, qty, onChangeQty,
  livraison, onToast, onBoutique, onScrollLivr,
}: Props) {
  const [addingCart, setAddingCart] = useState(false);
  const [addingBuy,  setAddingBuy]  = useState(false);

  const { addToCart, isInCart } = useCart();
  const isClient    = getRoleFromToken() === 'client';
  const navigate    = useNavigate();
  const isOutOfStock = produit.stockStatus === 'out';

  /* ✅ Vérifier si déjà dans le panier */
  const cartItem = isInCart(produitId);
  const dejaAuPanier = !!cartItem;

  const remisePct = Math.round((1 - produit.prix / produit.ancien) * 100);

  function calcLvFee(): number {
    if (!livraison.selectedLvr) return 0;
    return Math.round(
      livraison.selectedLvr.baseFee *
      (DIST_MUL[livraison.distZone] || 1) *
      (SPEED_MUL[livraison.currentSpeed] || 1) / 1000
    ) * 1000;
  }
  const lvFee   = livraison.delivMode === 'livreur' ? calcLvFee() : 0;
  const corrFee = livraison.selectedCorr?.baseFee || 0;
  const total   = produit.prix * qty + lvFee + corrFee;

  async function handleAddToCart() {
    if (!isClient)     { navigate('/login'); return; }
    if (isOutOfStock)  return;

    /* ✅ Déjà dans le panier → ne pas ajouter, informer l'utilisateur */
    if (dejaAuPanier) {
      onToast('🛒 Déjà dans votre panier — rendez-vous dans le panier pour modifier la quantité');
      return;
    }

    setAddingCart(true);
    try {
      await addToCart(produitId, qty, variante);
      onToast('✅ Ajouté au panier !');
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
    } finally { setAddingCart(false); }
  }

  async function handleBuyNow() {
    if (!isClient)    { navigate('/login'); return; }
    if (isOutOfStock) return;

    /* Si déjà dans le panier → aller directement au panier */
    if (dejaAuPanier) { navigate('/commande'); return; }

    setAddingBuy(true);
    try {
      await addToCart(produitId, qty, variante);
      navigate('/commande');
    } catch (err: any) {
      onToast(`❌ ${err.message}`);
      setAddingBuy(false);
    }
  }

  function renderDelBox() {
    if (!livraison.selectedVille) {
      return (
        <div className={styles.delBox}>
          <div className={styles.delTop}>
            <span className={styles.delIco}>❓</span>
            <span className={styles.delTitleGray}>Livraison non configurée</span>
            <button className={styles.delConfigure} onClick={onScrollLivr}>Configurer</button>
          </div>
        </div>
      );
    }
    if (livraison.delivMode === 'standard') {
      return (
        <div className={`${styles.delBox} ${styles.delBoxStd}`}>
          <div className={styles.delTop}>
            <span className={styles.delIco}>🚚</span>
            <span className={styles.delTitle}>Livraison standard — Gratuite</span>
            <button className={styles.delConfigure} onClick={onScrollLivr}>Modifier</button>
          </div>
          <div className={styles.delRows}>
            <div className={styles.delRow}><span>Destination</span><span className={styles.delVal}>{livraison.selectedVille}, {livraison.selectedPays}</span></div>
            <div className={styles.delRow}><span>Frais livraison</span><span className={`${styles.delVal} ${styles.delValGreen}`}>Gratuit</span></div>
            {livraison.selectedCorr && <div className={styles.delRow}><span>Correspondant</span><span className={`${styles.delVal} ${styles.delValIndigo}`}>{livraison.selectedCorr.name} — {corrFee.toLocaleString('fr')} GNF</span></div>}
          </div>
        </div>
      );
    }
    if (livraison.delivMode === 'livreur') {
      if (!livraison.selectedLvr) {
        return (
          <div className={`${styles.delBox} ${styles.delBoxLvr}`}>
            <div className={styles.delTop}>
              <span className={styles.delIco}>🛵</span>
              <span className={styles.delTitle} style={{ color:'var(--teal)' }}>Choisissez un livreur</span>
              <button className={styles.delConfigure} onClick={onScrollLivr}>Voir</button>
            </div>
          </div>
        );
      }
      return (
        <div className={`${styles.delBox} ${styles.delBoxLvr}`}>
          <div className={styles.delTop}>
            <span className={styles.delIco}>{livraison.selectedLvr.em}</span>
            <span className={styles.delTitle}>{livraison.selectedLvr.name}</span>
            <button className={styles.delConfigure} onClick={onScrollLivr}>Modifier</button>
          </div>
          <div className={styles.delRows}>
            <div className={styles.delRow}><span>Destination</span><span className={styles.delVal}>{livraison.selectedVille}, {livraison.selectedPays}</span></div>
            <div className={styles.delRow}><span>Frais livraison</span><span className={`${styles.delVal} ${styles.delValTeal}`}>{lvFee.toLocaleString('fr')} GNF</span></div>
            {livraison.selectedCorr && <div className={styles.delRow}><span>Correspondant</span><span className={`${styles.delVal} ${styles.delValIndigo}`}>{livraison.selectedCorr.name} — {corrFee.toLocaleString('fr')} GNF</span></div>}
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.card}>
        <div className={styles.prix}>{produit.prix.toLocaleString('fr')} <span>GNF</span></div>
        {produit.ancien > produit.prix && (
          <>
            <div className={styles.prixAncien}>{produit.ancien.toLocaleString('fr')} GNF</div>
            <div className={styles.economie}><i className="fas fa-tag" /> Vous économisez {remisePct}%</div>
          </>
        )}

        {renderDelBox()}
        <div className={styles.divider} />

        <div className={styles.qtyRow}>
          <span className={styles.qtyLbl}><i className="fas fa-cube" /> Quantité</span>
          <div className={styles.qtyCtrl}>
            <button className={styles.qtyBtn} onClick={() => onChangeQty(-1)} disabled={qty <= 1}><i className="fas fa-minus" /></button>
            <span className={styles.qtyNum}>{qty}</span>
            <button className={styles.qtyBtn} onClick={() => onChangeQty(1)} disabled={qty >= Math.min(5, produit.stock)}><i className="fas fa-plus" /></button>
          </div>
        </div>

        <div className={styles.breakdown}>
          <div className={styles.bkrRow}><span>Produit × {qty}</span><span className={styles.bkrVal}>{(produit.prix * qty).toLocaleString('fr')} GNF</span></div>
          <div className={styles.bkrRow}>
            <span>Frais de livraison</span>
            <span className={styles.bkrVal} style={{ color: lvFee === 0 && livraison.delivMode === 'standard' ? 'var(--green,#16A34A)' : 'var(--t2)' }}>
              {livraison.delivMode === 'standard' ? 'Gratuit' : lvFee > 0 ? `${lvFee.toLocaleString('fr')} GNF` : '—'}
            </span>
          </div>
          {corrFee > 0 && (
            <div className={styles.bkrRow}><span>Frais correspondant</span><span className={styles.bkrVal} style={{ color:'#4338CA' }}>{corrFee.toLocaleString('fr')} GNF</span></div>
          )}
          <div className={`${styles.bkrRow} ${styles.bkrTotal}`}>
            <span>Total estimé</span>
            <span className={styles.bkrValTotal}>{total.toLocaleString('fr')} GNF</span>
          </div>
        </div>

        {/* ✅ Bouton Ajouter — change selon l'état */}
        {isOutOfStock ? (
          <button className={styles.btnCart} disabled style={{ opacity:.5, cursor:'not-allowed' }}>
            <i className="fas fa-ban" /> Rupture de stock
          </button>
        ) : dejaAuPanier ? (
          /* Déjà dans le panier → bouton "Voir le panier" */
          <button
            className={styles.btnCart}
            onClick={() => navigate('/commande')}
            style={{ background:'var(--emerald,#059669)' }}
          >
            <i className="fas fa-check" /> Déjà au panier — Voir le panier
          </button>
        ) : (
          <button
            className={styles.btnCart}
            onClick={handleAddToCart}
            disabled={addingCart || addingBuy}
          >
            {addingCart
              ? <><i className="fas fa-circle-notch fa-spin" /> Ajout…</>
              : <><i className="fas fa-cart-plus" /> Ajouter au panier</>
            }
          </button>
        )}

        {/* ✅ Bouton Acheter maintenant */}
        <button
          className={styles.btnBuy}
          onClick={handleBuyNow}
          disabled={addingCart || addingBuy || isOutOfStock}
        >
          {addingBuy
            ? <><i className="fas fa-circle-notch fa-spin" /> Redirection…</>
            : dejaAuPanier
              ? <><i className="fas fa-bolt" /> Aller au panier</>
              : <><i className="fas fa-bolt" /> Acheter maintenant</>
          }
        </button>

        <div className={styles.secure}><i className="fas fa-lock" /> Paiement 100% sécurisé</div>
      </div>

      <div className={styles.vendeurCard}>
        <div className={styles.vcTop}>
          <div className={styles.vcLogo}>{produit.boutique.emoji}</div>
          <div>
            <div className={styles.vcNom}>{produit.boutique.nom}</div>
            <div className={styles.vcVer}>
              <i className="fas fa-shield-check" /> Boutique vérifiée ·
              <span style={{ color:'#4338CA' }}> {produit.boutique.drapeau} {produit.boutique.pays}</span>
            </div>
          </div>
        </div>
        <div className={styles.vcStats}>
          <div className={styles.vcStat}><div className={styles.vcStatV}>4.9</div><div className={styles.vcStatL}>Note</div></div>
          <div className={styles.vcStat}><div className={styles.vcStatV}>97%</div><div className={styles.vcStatL}>Satisf.</div></div>
          <div className={styles.vcStat}><div className={styles.vcStatV}>8K+</div><div className={styles.vcStatL}>Ventes</div></div>
        </div>
        <div className={styles.vcBtns}>
          <button className={styles.vcBtnV} onClick={onBoutique}>Voir boutique</button>
          <button className={styles.vcBtnM} onClick={() => onToast('💬 Messagerie ouverte')}>
            <i className="fas fa-comment" /> Contacter
          </button>
        </div>
      </div>
    </div>
  );
}