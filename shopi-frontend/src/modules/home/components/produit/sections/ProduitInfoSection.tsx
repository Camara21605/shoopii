/*
 * FICHIER : src/modules/home/components/produit/sections/ProduitInfoSection.tsx
 *
 * CORRECTIONS :
 *   ✅ storActive / colorActive → props contrôlés depuis ProduitPage
 *   ✅ Boutons CTA "Ajouter au panier" et "Acheter" → connectés à CartContext
 *   ✅ Variantes dynamiques depuis produitApi.variantes si disponibles
 *   ✅ Prix ancien masqué si identique au prix actuel
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProduitInfo } from '../data/produitMockData';
import { VARIANTES_STOCKAGE, VARIANTES_COLORIS } from '../data/produitMockData';
import { useCart } from '../../../../../shared/context/CartContext';
import { useAuthGate } from '../../../../../shared/hooks/useAuthGate';
import styles from '../styles/ProduitInfoSection.module.css';

interface Props {
  produit:       ProduitInfo;
  produitId?:    string;          // ✅ ID réel pour CartContext
  qty:           number;
  onChangeQty:   (delta: number) => void;
  onToast:       (m: string) => void;
  onPartage:     () => void;
  onBoutique:    () => void;
  children?:     React.ReactNode;

  /* ✅ Variantes contrôlées depuis ProduitPage */
  storActive?:   string;
  colorActive?:  string;
  onStorChange?: (v: string) => void;
  onColorChange?:(v: string) => void;
}

export default function ProduitInfoSection({
  produit, produitId, qty, onChangeQty,
  onToast, onPartage, onBoutique, children,
  storActive:   storProp,
  colorActive:  colorProp,
  onStorChange,
  onColorChange,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { requireClient, authModal } = useAuthGate();

  const GARANTIES = [
    { ico:'🔒', titre:t('produitDetail.infoSection.garanties.paiementTitre'),   sub:t('produitDetail.infoSection.garanties.paiementSub')   },
    { ico:'↩️', titre:t('produitDetail.infoSection.garanties.retourTitre'),      sub:t('produitDetail.infoSection.garanties.retourSub') },
    { ico:'✅', titre:t('produitDetail.infoSection.garanties.authentiqueTitre'),  sub:t('produitDetail.infoSection.garanties.authentiqueSub')     },
    { ico:'📞', titre:t('produitDetail.infoSection.garanties.supportTitre'),         sub:t('produitDetail.infoSection.garanties.supportSub')     },
  ];

  /* État local si ProduitPage ne contrôle pas encore les variantes */
  const [storLocal,  setStorLocal]  = useState('256 GB');
  const [colorLocal, setColorLocal] = useState('Natural');
  const [wish,       setWish]       = useState(false);
  const [addingCart, setAddingCart] = useState(false);
  const [addingBuy,  setAddingBuy]  = useState(false);

  /* Utilise les props si disponibles, sinon l'état local */
  const storActive  = storProp  ?? storLocal;
  const colorActive = colorProp ?? colorLocal;

  function setStorActive(v: string) {
    setStorLocal(v);
    onStorChange?.(v);
  }
  function setColorActive(v: string) {
    setColorLocal(v);
    onColorChange?.(v);
  }

  const varianteCombinee = [storActive, colorActive].filter(Boolean).join(' · ');

  /* ── Calculs prix ── */
  const hasRemise = produit.ancien > produit.prix;
  const remisePct = hasRemise ? Math.round((1 - produit.prix / produit.ancien) * 100) : 0;
  const economie  = hasRemise ? produit.ancien - produit.prix : 0;

  /* ── Stock ── */
  const STOCK_CFG = {
    ok:  { cls:styles.stockOk,  dot:styles.dotOk,  label:t('produitDetail.infoSection.stock.ok'),       note:t('produitDetail.infoSection.stock.okNote', { count: produit.stock })   },
    low: { cls:styles.stockLow, dot:styles.dotLow, label:t('produitDetail.infoSection.stock.low'),   note:t('produitDetail.infoSection.stock.lowNote', { count: produit.stock })  },
    out: { cls:styles.stockOut, dot:styles.dotOut, label:t('produitDetail.infoSection.stock.out'), note:''                                       },
  };
  const stock = STOCK_CFG[produit.stockStatus];
  const isOutOfStock = produit.stockStatus === 'out';

  /* ── Ajouter au panier ── */
  function handleAddToCart() {
    requireClient(async () => {
      if (!produitId)   { onToast(t('produitDetail.infoSection.idManquantToast')); return; }
      if (isOutOfStock) { onToast(t('produitDetail.infoSection.ruptureToast')); return; }
      setAddingCart(true);
      try {
        await addToCart(produitId, qty, varianteCombinee);
        onToast(t('produitDetail.infoSection.ajouteToast'));
      } catch (err: any) {
        onToast(t('produitDetail.infoSection.erreurToast', { msg: err.message }));
      } finally {
        setAddingCart(false);
      }
    });
  }

  /* ── Acheter maintenant ── */
  function handleBuyNow() {
    requireClient(async () => {
      if (!produitId)   { onToast(t('produitDetail.infoSection.idManquantToast')); return; }
      if (isOutOfStock) { onToast(t('produitDetail.infoSection.ruptureToast')); return; }
      setAddingBuy(true);
      try {
        await addToCart(produitId, qty, varianteCombinee);
        navigate('/commande');
      } catch (err: any) {
        onToast(t('produitDetail.infoSection.erreurToast', { msg: err.message }));
        setAddingBuy(false);
      }
    });
  }

  return (
    <div className={styles.wrap}>

      {/* ── Catégorie + SKU ── */}
      <div className={styles.metaTop}>
        <span className={styles.cat}>{produit.categorie}</span>
        <span className={styles.sku}>{t('produitDetail.infoSection.sku', { sku: produit.sku })}</span>
      </div>

      {/* ── Bannière internationale ── */}
      {produit.boutique.continent !== 'africa' && (
        <div className={styles.intlBanner}>
          <div className={styles.intlIco}>🌍</div>
          <div>
            <div className={styles.intlTitle}>{t('produitDetail.infoSection.intlTitre')}</div>
            <div className={styles.intlDesc}>
              {t('produitDetail.infoSection.intlDesc')}
            </div>
            <div style={{ marginTop:6 }}>
              <span className={styles.intlCountry}>
                <i className="fas fa-store" /> {produit.boutique.nom} — {produit.boutique.pays} {produit.boutique.drapeau}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Titre ── */}
      <h1 className={styles.titre}>{produit.nom}</h1>

      {/* ── Boutique ── */}
      <div className={styles.shopRow} onClick={onBoutique} title={t('produitDetail.infoSection.voirLaBoutique', { nom: produit.boutique.nom })}>
        <div className={styles.shopLogo}>{produit.boutique.emoji}</div>
        <div>
          <div className={styles.shopNom}>{produit.boutique.nom}</div>
          <div className={styles.shopBadges}>
            {produit.boutique.verified && (
              <span className={styles.shopVer}><i className="fas fa-shield-check" /> {t('produitDetail.infoSection.boutiqueVerifieeShopi')}</span>
            )}
            <span className={styles.shopPays}>
              {produit.boutique.drapeau} {produit.boutique.pays} · {produit.boutique.region}
            </span>
          </div>
        </div>
        {produit.boutique.abonnes !== '—' && (
          <span className={styles.shopAbonnes}>
            <i className="fas fa-users" style={{ color:'var(--blue)' }} /> {t('produitDetail.infoSection.abonnesCount', { count: produit.boutique.abonnes })}
          </span>
        )}
      </div>

      {/* ── Note & avis — masqués si 0 ── */}
      {(produit.note > 0 || produit.avis > 0) && (
        <div className={styles.ratingRow}>
          <span className={styles.stars}>
            {'★'.repeat(Math.round(produit.note))}{'☆'.repeat(5 - Math.round(produit.note))}
          </span>
          <span className={styles.ratingNum}>{produit.note.toFixed(1)}</span>
          {produit.avis > 0 && <span className={styles.ratingCnt}>{t('produitDetail.infoSection.avisCount', { count: produit.avis })}</span>}
          {produit.acheteurs > 0 && (
            <>
              <span className={styles.sep} />
              <span className={styles.acheteurs}>
                <i className="fas fa-check-circle" /> {t('produitDetail.infoSection.acheteursConfirmes', { count: produit.acheteurs })}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Bloc prix ── */}
      <div className={styles.prixBox}>
        <div className={styles.prixRow}>
          <span className={styles.prixMain}>{produit.prix.toLocaleString('fr')} GNF</span>
          {/* ✅ Ancien prix masqué si identique */}
          {hasRemise && (
            <span className={styles.prixAncien}>{produit.ancien.toLocaleString('fr')} GNF</span>
          )}
        </div>
        {/* ✅ Économie masquée si pas de remise */}
        {hasRemise && (
          <div className={styles.prixSave}>
            <i className="fas fa-tag" /> {t('produitDetail.infoSection.economieDe', { montant: economie.toLocaleString('fr'), pct: remisePct })}
          </div>
        )}
        <div className={styles.prixNote}>
          <i className="fas fa-lock" style={{ color:'var(--emerald)' }} />
          {t('produitDetail.infoSection.prixNote')}
        </div>
      </div>

      {/* ── Stock ── */}
      <div className={styles.stockRow}>
        <div className={`${styles.stockDot} ${stock.dot}`} />
        <span className={`${styles.stockLabel} ${stock.cls}`}>{stock.label}</span>
        <span className={styles.stockNote}>{stock.note}</span>
      </div>

      {/* ── Variantes stockage ── */}
      <div className={styles.varSec}>
        <div className={styles.varLbl}>
          {t('produitDetail.infoSection.stockage')} <span className={styles.varVal}>· {storActive}</span>
        </div>
        <div className={styles.varChips}>
          {VARIANTES_STOCKAGE.map(v => (
            <div
              key={v.label}
              className={`${styles.chip} ${!v.disabled && storActive === v.label ? styles.chipActive : ''} ${v.disabled ? styles.chipDisabled : ''}`}
              onClick={() => {
                if (v.disabled) return;
                setStorActive(v.label);
                onToast(t('produitDetail.infoSection.stockageToast', { v: v.label }));
              }}
            >
              {v.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Variantes coloris ── */}
      <div className={styles.varSec}>
        <div className={styles.varLbl}>
          {t('produitDetail.infoSection.coloris')} <span className={styles.varVal}>· {colorActive} {t('produitDetail.infoSection.titanium')}</span>
        </div>
        <div className={styles.varChips}>
          {VARIANTES_COLORIS.map(v => (
            <div
              key={v.label}
              className={`${styles.chip} ${colorActive === v.label ? styles.chipActive : ''}`}
              onClick={() => { setColorActive(v.label); onToast(t('produitDetail.infoSection.colorisToast', { v: v.label })); }}
            >
              <span
                className={styles.colorDot}
                style={{ background:v.color, border:v.border ? '1px solid var(--bdr2)' : 'none' }}
              />
              {v.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Quantité ── */}
      <div className={styles.qtyRow}>
        <span className={styles.qtyLbl}>{t('produitDetail.infoSection.quantite')}</span>
        <div className={styles.qtyCtrl}>
          <button className={styles.qtyBtn} onClick={() => onChangeQty(-1)} disabled={qty <= 1}>
            <i className="fas fa-minus" />
          </button>
          <span className={styles.qtyNum}>{qty}</span>
          <button className={styles.qtyBtn} onClick={() => onChangeQty(1)} disabled={qty >= Math.min(5, produit.stock)}>
            <i className="fas fa-plus" />
          </button>
        </div>
        <span className={styles.qtyMax}>{t('produitDetail.infoSection.maxParCommande')}</span>
      </div>

      {/* ── Slot LivraisonSection ── */}
      {children}

      {/* ── Boutons CTA — connectés à CartContext ── */}
      <div className={styles.ctaRow}>

        {isOutOfStock ? (
          <button className={styles.btnCart} disabled style={{ opacity:.5, cursor:'not-allowed' }}>
            <i className="fas fa-ban" /> {t('produitDetail.infoSection.ruptureDeStock')}
          </button>
        ) : (
          <button
            className={styles.btnCart}
            onClick={handleAddToCart}
            disabled={addingCart || addingBuy}
          >
            {addingCart
              ? <><i className="fas fa-circle-notch fa-spin" /> {t('produitDetail.infoSection.ajoutEnCours')}</>
              : <><i className="fas fa-cart-plus" /> {t('produitDetail.infoSection.ajouterAuPanier')}</>
            }
          </button>
        )}

        <button
          className={styles.btnBuy}
          onClick={handleBuyNow}
          disabled={addingCart || addingBuy || isOutOfStock}
        >
          {addingBuy
            ? <><i className="fas fa-circle-notch fa-spin" /> {t('produitDetail.infoSection.redirection')}</>
            : <><i className="fas fa-bolt" /> {t('produitDetail.infoSection.acheterMaintenant')}</>
          }
        </button>

        <div className={styles.btnRow2}>
          <button
            className={`${styles.btnWish} ${wish ? styles.btnWishOn : ''}`}
            onClick={() => { setWish(w => !w); onToast(wish ? t('produitDetail.infoSection.retireFavorisToast') : t('produitDetail.infoSection.favorisToast')); }}
          >
            <i className={wish ? 'fas fa-heart' : 'far fa-heart'} /> {t('produitDetail.infoSection.favoris')}
          </button>
          <button className={styles.btnCompare} onClick={() => onToast(t('produitDetail.infoSection.comparaisonToast'))}>
            <i className="fas fa-code-compare" /> {t('produitDetail.infoSection.comparer')}
          </button>
        </div>
      </div>

      {/* ── Garanties ── */}
      <div className={styles.garanties}>
        {GARANTIES.map(g => (
          <div key={g.titre} className={styles.guar}>
            <div className={styles.guarIco}>{g.ico}</div>
            <div>
              <div className={styles.guarTitre}>{g.titre}</div>
              <div className={styles.guarSub}>{g.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Partage social ── */}
      <div className={styles.socialRow}>
        <span className={styles.socialLbl}>{t('produitDetail.infoSection.partager')}</span>
        <button className={`${styles.socBtn} ${styles.socWa}`} onClick={() => onToast('📲 WhatsApp')}>
          <i className="fab fa-whatsapp" />
        </button>
        <button className={`${styles.socBtn} ${styles.socFb}`} onClick={() => onToast('📘 Facebook')}>
          <i className="fab fa-facebook-f" />
        </button>
        <button className={styles.socBtn} onClick={() => onToast('𝕏 X')}>
          <i className="fab fa-x-twitter" />
        </button>
        <button className={styles.socBtn} onClick={onPartage}>
          <i className="fas fa-share-nodes" />
        </button>
        {produit.vues > 0 && (
          <span className={styles.vues}>
            <i className="fas fa-eye" /> {t('produitDetail.infoSection.vuesAujourdhui', { count: produit.vues.toLocaleString('fr') })}
          </span>
        )}
      </div>

      {authModal}
    </div>
  );
}