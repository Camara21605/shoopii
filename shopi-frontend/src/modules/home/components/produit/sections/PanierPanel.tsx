import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      onToast(t('produitDetail.panier.dejaAuPanierToast'));
      return;
    }

    setAddingCart(true);
    try {
      await addToCart(produitId, qty, variante);
      onToast(t('produitDetail.panier.ajouteToast'));
    } catch (err: any) {
      onToast(t('produitDetail.panier.erreurToast', { msg: err.message }));
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
      onToast(t('produitDetail.panier.erreurToast', { msg: err.message }));
      setAddingBuy(false);
    }
  }

  function renderDelBox() {
    if (!livraison.selectedVille) {
      return (
        <div className={styles.delBox}>
          <div className={styles.delTop}>
            <span className={styles.delIco}>❓</span>
            <span className={styles.delTitleGray}>{t('produitDetail.panier.livraisonNonConfiguree')}</span>
            <button className={styles.delConfigure} onClick={onScrollLivr}>{t('produitDetail.panier.configurer')}</button>
          </div>
        </div>
      );
    }
    if (livraison.delivMode === 'standard') {
      return (
        <div className={`${styles.delBox} ${styles.delBoxStd}`}>
          <div className={styles.delTop}>
            <span className={styles.delIco}>🚚</span>
            <span className={styles.delTitle}>{t('produitDetail.panier.livraisonStandardGratuite')}</span>
            <button className={styles.delConfigure} onClick={onScrollLivr}>{t('produitDetail.panier.modifier')}</button>
          </div>
          <div className={styles.delRows}>
            <div className={styles.delRow}><span>{t('produitDetail.panier.destination')}</span><span className={styles.delVal}>{livraison.selectedVille}, {livraison.selectedPays}</span></div>
            <div className={styles.delRow}><span>{t('produitDetail.panier.fraisLivraison')}</span><span className={`${styles.delVal} ${styles.delValGreen}`}>{t('produitDetail.panier.gratuit')}</span></div>
            {livraison.selectedCorr && <div className={styles.delRow}><span>{t('produitDetail.panier.correspondant')}</span><span className={`${styles.delVal} ${styles.delValIndigo}`}>{livraison.selectedCorr.name} — {corrFee.toLocaleString('fr')} GNF</span></div>}
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
              <span className={styles.delTitle} style={{ color:'var(--teal)' }}>{t('produitDetail.panier.choisissezLivreur')}</span>
              <button className={styles.delConfigure} onClick={onScrollLivr}>{t('produitDetail.panier.voir')}</button>
            </div>
          </div>
        );
      }
      return (
        <div className={`${styles.delBox} ${styles.delBoxLvr}`}>
          <div className={styles.delTop}>
            <span className={styles.delIco}>{livraison.selectedLvr.em}</span>
            <span className={styles.delTitle}>{livraison.selectedLvr.name}</span>
            <button className={styles.delConfigure} onClick={onScrollLivr}>{t('produitDetail.panier.modifier')}</button>
          </div>
          <div className={styles.delRows}>
            <div className={styles.delRow}><span>{t('produitDetail.panier.destination')}</span><span className={styles.delVal}>{livraison.selectedVille}, {livraison.selectedPays}</span></div>
            <div className={styles.delRow}><span>{t('produitDetail.panier.fraisLivraison')}</span><span className={`${styles.delVal} ${styles.delValTeal}`}>{lvFee.toLocaleString('fr')} GNF</span></div>
            {livraison.selectedCorr && <div className={styles.delRow}><span>{t('produitDetail.panier.correspondant')}</span><span className={`${styles.delVal} ${styles.delValIndigo}`}>{livraison.selectedCorr.name} — {corrFee.toLocaleString('fr')} GNF</span></div>}
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
            <div className={styles.economie}><i className="fas fa-tag" /> {t('produitDetail.panier.economisez', { pct: remisePct })}</div>
          </>
        )}

        {renderDelBox()}
        <div className={styles.divider} />

        <div className={styles.qtyRow}>
          <span className={styles.qtyLbl}><i className="fas fa-cube" /> {t('produitDetail.panier.quantite')}</span>
          <div className={styles.qtyCtrl}>
            <button className={styles.qtyBtn} onClick={() => onChangeQty(-1)} disabled={qty <= 1}><i className="fas fa-minus" /></button>
            <span className={styles.qtyNum}>{qty}</span>
            <button className={styles.qtyBtn} onClick={() => onChangeQty(1)} disabled={qty >= Math.min(5, produit.stock)}><i className="fas fa-plus" /></button>
          </div>
        </div>

        <div className={styles.breakdown}>
          <div className={styles.bkrRow}><span>{t('produitDetail.panier.produitFois', { qty })}</span><span className={styles.bkrVal}>{(produit.prix * qty).toLocaleString('fr')} GNF</span></div>
          <div className={styles.bkrRow}>
            <span>{t('produitDetail.panier.fraisDeLivraison')}</span>
            <span className={styles.bkrVal} style={{ color: lvFee === 0 && livraison.delivMode === 'standard' ? 'var(--green,#16A34A)' : 'var(--t2)' }}>
              {livraison.delivMode === 'standard' ? t('produitDetail.panier.gratuit') : lvFee > 0 ? `${lvFee.toLocaleString('fr')} GNF` : '—'}
            </span>
          </div>
          {corrFee > 0 && (
            <div className={styles.bkrRow}><span>{t('produitDetail.panier.fraisCorrespondant')}</span><span className={styles.bkrVal} style={{ color:'#4338CA' }}>{corrFee.toLocaleString('fr')} GNF</span></div>
          )}
          <div className={`${styles.bkrRow} ${styles.bkrTotal}`}>
            <span>{t('produitDetail.panier.totalEstime')}</span>
            <span className={styles.bkrValTotal}>{total.toLocaleString('fr')} GNF</span>
          </div>
        </div>

        {/* ✅ Bouton Ajouter — change selon l'état */}
        {isOutOfStock ? (
          <button className={styles.btnCart} disabled style={{ opacity:.5, cursor:'not-allowed' }}>
            <i className="fas fa-ban" /> {t('produitDetail.panier.ruptureDeStock')}
          </button>
        ) : dejaAuPanier ? (
          /* Déjà dans le panier → bouton "Voir le panier" */
          <button
            className={styles.btnCart}
            onClick={() => navigate('/commande')}
            style={{ background:'var(--emerald,#059669)' }}
          >
            <i className="fas fa-check" /> {t('produitDetail.panier.dejaAuPanier')}
          </button>
        ) : (
          <button
            className={styles.btnCart}
            onClick={handleAddToCart}
            disabled={addingCart || addingBuy}
          >
            {addingCart
              ? <><i className="fas fa-circle-notch fa-spin" /> {t('produitDetail.panier.ajoutEnCours')}</>
              : <><i className="fas fa-cart-plus" /> {t('produitDetail.panier.ajouterAuPanier')}</>
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
            ? <><i className="fas fa-circle-notch fa-spin" /> {t('produitDetail.panier.redirection')}</>
            : dejaAuPanier
              ? <><i className="fas fa-bolt" /> {t('produitDetail.panier.allerAuPanier')}</>
              : <><i className="fas fa-bolt" /> {t('produitDetail.panier.acheterMaintenant')}</>
          }
        </button>

        <div className={styles.secure}><i className="fas fa-lock" /> {t('produitDetail.panier.paiementSecurise')}</div>
      </div>

      <div className={styles.vendeurCard}>
        <div className={styles.vcTop}>
          <div className={styles.vcLogo}>{produit.boutique.emoji}</div>
          <div>
            <div className={styles.vcNom}>{produit.boutique.nom}</div>
            <div className={styles.vcVer}>
              <i className="fas fa-shield-check" /> {t('produitDetail.panier.boutiqueVerifiee')}
              <span style={{ color:'#4338CA' }}> {produit.boutique.drapeau} {produit.boutique.pays}</span>
            </div>
          </div>
        </div>
        <div className={styles.vcStats}>
          <div className={styles.vcStat}><div className={styles.vcStatV}>4.9</div><div className={styles.vcStatL}>{t('produitDetail.panier.note')}</div></div>
          <div className={styles.vcStat}><div className={styles.vcStatV}>97%</div><div className={styles.vcStatL}>{t('produitDetail.panier.satisf')}</div></div>
          <div className={styles.vcStat}><div className={styles.vcStatV}>8K+</div><div className={styles.vcStatL}>{t('produitDetail.panier.ventes')}</div></div>
        </div>
        <div className={styles.vcBtns}>
          <button className={styles.vcBtnV} onClick={onBoutique}>{t('produitDetail.panier.voirBoutique')}</button>
          <button className={styles.vcBtnM} onClick={() => onToast(t('produitDetail.panier.messagerieOuverteToast'))}>
            <i className="fas fa-comment" /> {t('produitDetail.panier.contacter')}
          </button>
        </div>
      </div>
    </div>
  );
}