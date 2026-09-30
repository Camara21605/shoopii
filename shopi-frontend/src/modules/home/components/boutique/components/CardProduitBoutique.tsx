/*
 * FICHIER : src/modules/home/components/boutique/components/CardProduitBoutique.tsx
 *
 * BUG CORRIGÉ (erreur de compilation) — importait `ProduitBoutique` depuis
 * boutiqueMockData.ts, un type SUPPRIMÉ le 2026-09-02 quand ce mock a été
 * remplacé par les vraies données API (voir l'en-tête de ce fichier) :
 * l'import échouait (`has no exported member 'ProduitBoutique'`), ce qui
 * dégradait TOUS les accès aux champs du produit en `any` implicite —
 * aucune vérification de type sur toute cette carte. Remplacé par
 * `ProduitCarte`, le vrai type produit par BoutiquePage.tsx::produitsFiltres,
 * déclaré une fois ici et réutilisé par ProduitsSection.tsx.
 *
 * BUGS CORRIGÉS (actions factices) — trois boutons ne faisaient QU'un toast,
 * sans aucun effet réel :
 *   ❤️  Favori           → état local jamais persisté (perdu à l'actualisation,
 *                           n'apparaissait jamais dans l'onglet Favoris du profil)
 *   🛒  Ajouter au panier → strictement rien n'était ajouté au panier
 *   🔗  Partager          → aucun lien/action réelle
 * Remplacés par les mêmes mécanismes réels que CardProduit.tsx (carte produit
 * utilisée partout ailleurs sur le site) : useFavoris (persist /client/favoris),
 * useCart().addToCart (vrai panier), ModalPartage (déjà réel et déjà conçu
 * pour être réutilisé "pour une boutique OU un produit", voir son en-tête).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useCart }      from '../../../../../shared/context/CartContext';
import { useFavoris }   from '../../../../../shared/context/FavorisContext';
import { useAuthGate }  from '../../../../../shared/hooks/useAuthGate';
import ModalPartage     from './ModalPartage';
import styles from '../styles/CardsProduit.module.css';

/** Format d'affichage d'un produit boutique — dérivé des vraies données API
 *  (voir BoutiquePage.tsx::produitsFiltres). Prix déjà formatés (chaîne
 *  localisée) car dérivés une seule fois pour toute la liste filtrée/triée. */
export interface ProduitCarte {
  id:        string;
  emoji:     string;
  nom:       string;
  desc:      string;
  cat:       string;
  prix:      string;
  ancien:    string | null;
  note:      number;
  avis:      number;
  stock:     'ok' | 'low' | 'out';
  badge:     'hot' | 'new' | 'promo' | 'sol' | null;
  imageUrl?: string | null;
}

interface Props {
  p:       ProduitCarte;
  isList:  boolean;
  onToast: (m: string) => void;
  /** true UNIQUEMENT depuis "Voir ma boutique" du dashboard entreprise
   *  (BoutiquePreviewPage → BoutiquePage isOwnerPreview) — voir handleVoir
   *  ci-dessous pour la raison. */
  isOwnerPreview?: boolean;
  /** Fourni UNIQUEMENT en aperçu (voir isOwnerPreview) — affiche le produit
   *  SANS naviguer nulle part (ni onglet courant, ni nouvel onglet), voir
   *  BoutiquePreviewPage.tsx qui monte ProduitPage à la place de
   *  BoutiquePage dans le même panneau. */
  onOpenProduct?: (id: string) => void;
}

function getBadgeConfig(t: TFunction) {
  return {
    hot:   { label:t('boutiqueDetail.cardProduit.badges.hot'),   cls:'hot'   },
    new:   { label:t('boutiqueDetail.cardProduit.badges.new'),   cls:'new'   },
    promo: { label:t('boutiqueDetail.cardProduit.badges.promo'), cls:'promo' },
    sol:   { label:t('boutiqueDetail.cardProduit.badges.sol'),   cls:'sol'   },
  };
}

function getStockConfig(t: TFunction) {
  return {
    ok:  { label:t('boutiqueDetail.cardProduit.stock.ok'),  cls:'ok'  },
    low: { label:t('boutiqueDetail.cardProduit.stock.low'), cls:'low' },
    out: { label:t('boutiqueDetail.cardProduit.stock.out'), cls:'out' },
  };
}

function Stars({ n }: { n: number }) {
  return (
    <span className={styles.stars}>
      {'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// HOOKS PARTAGÉS — mêmes mécanismes réels que cards/CardProduit.tsx
// (favoris persistés, panier réel), mirroités ici comme le fait déjà
// cards/CardService.tsx pour les services.
// ─────────────────────────────────────────────────────────────

function useAddToCart(p: ProduitCarte, onToast: (m: string) => void, requireClient: (action: () => void) => void, t: TFunction) {
  const { addToCart, isInCart } = useCart();
  const [adding, setAdding]     = useState(false);
  const dejaAuPanier = !!isInCart(p.id);

  const handleAdd = () => {
    requireClient(async () => {
      if (dejaAuPanier) {
        onToast(t('boutiqueDetail.cardProduit.dejaAuPanierToast', { nom: p.nom }));
        return;
      }
      setAdding(true);
      try {
        await addToCart(p.id, 1);
        onToast(t('boutiqueDetail.cardProduit.ajouteAuPanierToast', { nom: p.nom }));
      } catch (e: any) {
        onToast(`❌ ${e?.message ?? t('boutiqueDetail.cardProduit.ajoutErrorFallback')}`);
      } finally {
        setAdding(false);
      }
    });
  };

  return { handleAdd, dejaAuPanier, loading: adding };
}

function useFavorite(p: ProduitCarte, onToast: (m: string) => void, requireClient: (action: () => void) => void, t: TFunction) {
  const [loading, setLoading] = useState(false);
  const { isLiked, toggle } = useFavoris();
  const liked = isLiked(p.id);

  const handleToggle = () => {
    if (loading) return;
    requireClient(async () => {
      setLoading(true);
      try {
        const nowLiked = await toggle(p.id);
        onToast(nowLiked ? t('boutiqueDetail.cardProduit.favoriAjoute') : t('boutiqueDetail.cardProduit.favoriRetire'));
      } catch (e: any) {
        onToast(`❌ ${e?.message ?? t('boutiqueDetail.cardProduit.favoriErrorFallback')}`);
      } finally {
        setLoading(false);
      }
    });
  };

  return { liked, handleToggle, loading };
}

export default function CardProduitBoutique({ p, isList, onToast, isOwnerPreview = false, onOpenProduct }: Props) {
  const { t } = useTranslation();
  const navigate      = useNavigate();
  const [partageOpen, setPartageOpen] = useState(false);
  const { requireClient, authModal }  = useAuthGate();
  const { liked: fav, handleToggle: handleToggleFav } = useFavorite(p, onToast, requireClient, t);
  const { handleAdd, dejaAuPanier, loading: adding }  = useAddToCart(p, onToast, requireClient, t);

  const badge = p.badge ? getBadgeConfig(t)[p.badge] : null;
  const stock = getStockConfig(t)[p.stock];

  /* Depuis "Voir ma boutique" (dashboard entreprise), BoutiquePage est
   * montée directement dans l'arbre React de l'app (un seul <BrowserRouter>
   * pour toute l'app, voir BoutiquePreviewPage.tsx) : navigate() ici
   * changerait l'URL de l'onglet ENTIER et ferait quitter le dashboard.
   * onOpenProduct fait remonter l'id pour afficher le produit SANS quitter
   * le dashboard (BoutiquePreviewPage monte ProduitPage à la place). */
  function handleVoir() {
    if (isOwnerPreview && onOpenProduct) onOpenProduct(p.id);
    else navigate(`/produit/${p.id}`);
  }

  return (
    <div className={`${styles.card} ${isList ? styles.cardList : ''}`}>

      {badge && (
        <span className={`${styles.badge} ${styles[badge.cls]}`}>{badge.label}</span>
      )}

      <button
        className={`${styles.fav} ${fav ? styles.favOn : ''}`}
        onClick={handleToggleFav}
        title={fav ? t('boutiqueDetail.cardProduit.retireFavorisToast') : t('boutiqueDetail.cardProduit.ajouteFavorisToast')}
      >
        <i className={fav ? 'fas fa-heart' : 'far fa-heart'} />
      </button>

      {/* Image réelle ou emoji fallback */}
      <div className={styles.img} onClick={handleVoir}>
        {p.imageUrl
          ? <img
              src={p.imageUrl}
              alt={p.nom}
              style={{ width:'100%', height:'100%', objectFit:'cover' }}
            />
          : <span className={styles.imgEmoji}>{p.emoji}</span>
        }
        <div className={styles.imgOverlay}>
          <span><i className="fas fa-eye" /> {t('boutiqueDetail.cardProduit.voir')}</span>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.cat}>{p.cat}</div>
        <div className={styles.nom}>{p.nom}</div>
        <div className={styles.desc}>{p.desc}</div>

        {/* Note — masquée si 0 (pas de notation par produit côté backend, voir BoutiquePage.tsx) */}
        {p.note > 0 && (
          <div className={styles.rate}>
            <Stars n={p.note} />
            <span className={styles.noteVal}>{p.note.toFixed(1)}</span>
            <span className={styles.noteCnt}>({p.avis})</span>
          </div>
        )}

        <div className={styles.prices}>
          <span className={styles.prix}>{p.prix} GNF</span>
          {p.ancien && <span className={styles.ancien}>{p.ancien} GNF</span>}
        </div>

        <span className={`${styles.stock} ${styles[stock.cls]}`}>{stock.label}</span>

        <button
          className={styles.btnCart}
          onClick={handleAdd}
          disabled={adding || p.stock === 'out'}
          style={{ opacity: adding || p.stock === 'out' ? 0.6 : 1, cursor: p.stock === 'out' ? 'not-allowed' : 'pointer' }}
        >
          <i className={`fas ${adding ? 'fa-spinner fa-spin' : dejaAuPanier ? 'fa-check' : 'fa-cart-plus'}`} />
          {' '}
          {p.stock === 'out'
            ? t('boutiqueDetail.cardProduit.stock.out')
            : dejaAuPanier
              ? t('boutiqueDetail.cardProduit.dejaAuPanier')
              : t('boutiqueDetail.cardProduit.ajouterPanier')}
        </button>

        <div className={styles.btnRow}>
          <button className={styles.btnSm} onClick={handleVoir}>
            <i className="fas fa-eye" /> {t('boutiqueDetail.cardProduit.voir')}
          </button>
          <button className={styles.btnSm} onClick={() => setPartageOpen(true)}>
            <i className="fas fa-share-nodes" /> {t('boutiqueDetail.cardProduit.partager')}
          </button>
        </div>
      </div>

      {partageOpen && (
        <ModalPartage
          url={`https://shopi.gn/produit/${p.id}`}
          titre={t('boutiqueDetail.cardProduit.partagerToast', { nom: p.nom })}
          onClose={() => setPartageOpen(false)}
          onToast={onToast}
        />
      )}
      {authModal}
    </div>
  );
}
