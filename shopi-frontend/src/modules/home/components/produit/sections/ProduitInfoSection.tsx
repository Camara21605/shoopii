/*
 * FICHIER : src/modules/home/components/produit/sections/ProduitInfoSection.tsx
 *
 * CORRECTIONS :
 *   ✅ storActive / colorActive → props contrôlés depuis ProduitPage
 *   ✅ Boutons CTA "Ajouter au panier" et "Acheter" → connectés à CartContext
 *   ✅ Variantes dynamiques depuis produitApi.variantes si disponibles
 *   ✅ Prix ancien masqué si identique au prix actuel
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProduitInfo } from '../data/produitMockData';
import { useCart } from '../../../../../shared/context/CartContext';
import { useCompare, MAX_COMPARE } from '../../../../../shared/context/CompareContext';
import { useAuthGate } from '../../../../../shared/hooks/useAuthGate';
import styles from '../styles/ProduitInfoSection.module.css';

interface VarianteApi { id: string; type: string; vals: string }
interface WholesaleTier { quantiteMin: number; quantiteMax: number | null; prixUnitaire: number; ordre: number }

interface Props {
  produit:       ProduitInfo;
  produitId?:    string;          // ✅ ID réel pour CartContext
  qty:           number;
  onChangeQty:   (delta: number) => void;
  onToast:       (m: string) => void;
  onPartage:     () => void;
  onBoutique:    () => void;
  children?:     React.ReactNode;

  /* ── Vraies variantes du produit (ex: [{type:'Couleur', vals:'Noir, Blanc'}]) —
   * un groupe de chips par type réellement saisi par le vendeur, plus de
   * "Stockage"/"Coloris" fixes affichés pour tous les produits. ── */
  variantes?:        VarianteApi[];
  selectedVariants?: Record<string, string>;
  onVariantsChange?: (v: Record<string, string>) => void;

  /* ── Vente en gros ── */
  venteEnGros?:    boolean;
  moq?:            number | null;
  wholesaleTiers?: WholesaleTier[];
}

export default function ProduitInfoSection({
  produit, produitId, qty, onChangeQty,
  onToast, onBoutique, children,
  variantes = [], selectedVariants: selectedProp, onVariantsChange,
  venteEnGros = false, moq, wholesaleTiers = [],
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { isComparing, toggle: toggleCompare } = useCompare();
  const { requireClient, authModal } = useAuthGate();

  /* État local si le parent ne contrôle pas encore la sélection */
  const [selectedLocal, setSelectedLocal] = useState<Record<string, string>>({});
  const [wish,       setWish]       = useState(false);
  const [addingCart, setAddingCart] = useState(false);
  const [addingBuy,  setAddingBuy]  = useState(false);

  const selected = selectedProp ?? selectedLocal;

  const compareId = produitId ?? produit.id;
  const comparing = compareId ? isComparing(compareId) : false;

  const handleToggleCompare = () => {
    if (!compareId) { onToast(t('produitDetail.infoSection.idManquantToast')); return; }
    const { added, full } = toggleCompare(compareId);
    if (full) {
      onToast(t('produitDetail.infoSection.comparaisonPleineToast', { max: MAX_COMPARE }));
      return;
    }
    onToast(added
      ? t('produitDetail.infoSection.comparaisonToast')
      : t('produitDetail.infoSection.comparaisonRetireeToast'));
  };

  /* Sélectionne la première valeur de chaque variante par défaut, dès que
   * la liste réelle arrive (chargement async du produit). */
  useEffect(() => {
    if (variantes.length === 0) return;
    setSelectedLocal(prev => {
      const next = { ...prev };
      let changed = false;
      for (const v of variantes) {
        if (!next[v.type]) {
          const first = v.vals.split(',')[0]?.trim();
          if (first) { next[v.type] = first; changed = true; }
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantes]);

  function setVariant(type: string, value: string) {
    const next = { ...selected, [type]: value };
    setSelectedLocal(next);
    onVariantsChange?.(next);
  }

  const varianteCombinee = Object.values(selected).filter(Boolean).join(' · ');

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

      {/* ── Variantes réelles du produit (une section par type saisi par le vendeur) ── */}
      {variantes.map(v => {
        const values = v.vals.split(',').map(s => s.trim()).filter(Boolean);
        if (values.length === 0) return null;
        return (
          <div className={styles.varSec} key={v.id}>
            <div className={styles.varLbl}>
              {v.type} <span className={styles.varVal}>· {selected[v.type] ?? values[0]}</span>
            </div>
            <div className={styles.varChips}>
              {values.map(val => (
                <div
                  key={val}
                  className={`${styles.chip} ${selected[v.type] === val ? styles.chipActive : ''}`}
                  onClick={() => { setVariant(v.type, val); onToast(t('produitDetail.infoSection.varianteToast', { type: v.type, v: val })); }}
                >
                  {val}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ── Vente en gros — MOQ + paliers dégressifs ── */}
      {venteEnGros && wholesaleTiers.length > 0 && (
        <div className={styles.grosBox}>
          <div className={styles.grosHead}>
            <i className="fas fa-boxes-stacked" />
            {t('produitDetail.infoSection.gros.titre')}
            {moq != null && <span className={styles.grosMoq}>{t('produitDetail.infoSection.gros.moq', { moq })}</span>}
          </div>
          <div className={styles.grosTable}>
            {wholesaleTiers.map((tier, i) => (
              <div key={i} className={styles.grosRow}>
                <span>
                  {tier.quantiteMin}{tier.quantiteMax != null ? `–${tier.quantiteMax}` : '+'} {t('produitDetail.infoSection.gros.unites')}
                </span>
                <span className={styles.grosPrix}>{tier.prixUnitaire.toLocaleString('fr')} GNF</span>
              </div>
            ))}
          </div>
        </div>
      )}

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

        <div className={styles.btnRow1}>
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
        </div>

        <div className={styles.btnRow2}>
          <button
            className={`${styles.btnWish} ${wish ? styles.btnWishOn : ''}`}
            onClick={() => { setWish(w => !w); onToast(wish ? t('produitDetail.infoSection.retireFavorisToast') : t('produitDetail.infoSection.favorisToast')); }}
            title={t('produitDetail.infoSection.favoris')}
            aria-label={t('produitDetail.infoSection.favoris')}
          >
            <i className={wish ? 'fas fa-heart' : 'far fa-heart'} />
          </button>
          <button
            className={`${styles.btnCompare} ${comparing ? styles.btnCompareOn : ''}`}
            onClick={handleToggleCompare}
            title={t('produitDetail.infoSection.comparer')}
            aria-label={t('produitDetail.infoSection.comparer')}
            aria-pressed={comparing}
          >
            <i className="fas fa-code-compare" />
          </button>
        </div>
      </div>

      {produit.vues > 0 && (
        <div className={styles.socialRow}>
          <span className={styles.vues}>
            <i className="fas fa-eye" /> {t('produitDetail.infoSection.vuesAujourdhui', { count: produit.vues.toLocaleString('fr') })}
          </span>
        </div>
      )}

      {authModal}
    </div>
  );
}