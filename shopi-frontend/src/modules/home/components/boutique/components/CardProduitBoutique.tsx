/*
 * FICHIER : src/modules/home/components/boutique/components/CardProduitBoutique.tsx
 *
 * CORRECTION : affiche la vraie image depuis imageUrl (API)
 *   avec fallback emoji si pas d'image.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ProduitBoutique } from '../data/boutiqueMockData';
import styles from '../styles/CardsProduit.module.css';

// ✅ Champ imageUrl optionnel — absent dans le mock, présent dans les données API
interface ProduitBoutiqueAvecImage extends ProduitBoutique {
  imageUrl?: string | null;
  id:        string;
}

interface Props {
  p:       ProduitBoutiqueAvecImage;
  isList:  boolean;
  onToast: (m: string) => void;
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

export default function CardProduitBoutique({ p, isList, onToast }: Props) {
  const { t } = useTranslation();
  const [fav, setFav] = useState(false);
  const navigate      = useNavigate();

  const badge = p.badge ? getBadgeConfig(t)[p.badge] : null;
  const stock = getStockConfig(t)[p.stock];

  // ✅ Navigue vers la page détail si on a un vrai ID produit
  function handleVoir() {
    if (p.id && !p.id.startsWith('p')) {
      // ID UUID → vrai produit API
      navigate(`/produit/${p.id}`);
    } else {
      onToast(t('boutiqueDetail.cardProduit.detailToast', { nom: p.nom }));
    }
  }

  return (
    <div className={`${styles.card} ${isList ? styles.cardList : ''}`}>

      {badge && (
        <span className={`${styles.badge} ${styles[badge.cls]}`}>{badge.label}</span>
      )}

      <button
        className={`${styles.fav} ${fav ? styles.favOn : ''}`}
        onClick={() => { setFav(f => !f); onToast(fav ? t('boutiqueDetail.cardProduit.retireFavorisToast') : t('boutiqueDetail.cardProduit.ajouteFavorisToast')); }}
      >
        <i className={fav ? 'fas fa-heart' : 'far fa-heart'} />
      </button>

      {/* ✅ Image réelle ou emoji fallback */}
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

        {/* Note — masquée si 0 */}
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

        <button className={styles.btnCart} onClick={() => onToast(t('boutiqueDetail.cardProduit.ajouteAuPanierToast'))}>
          <i className="fas fa-cart-plus" /> {t('boutiqueDetail.cardProduit.ajouterPanier')}
        </button>

        <div className={styles.btnRow}>
          <button className={styles.btnSm} onClick={handleVoir}>
            <i className="fas fa-eye" /> {t('boutiqueDetail.cardProduit.voir')}
          </button>
          <button className={styles.btnSm} onClick={() => onToast(t('boutiqueDetail.cardProduit.partagerToast', { nom: p.nom }))}>
            <i className="fas fa-share-nodes" /> {t('boutiqueDetail.cardProduit.partager')}
          </button>
        </div>
      </div>
    </div>
  );
}