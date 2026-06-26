/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/sections/ArticlesSection.tsx
 *
 * RÔLE    : Section "Vos articles" — liste du panier.
 *           Numéro d'étape : ✓ (déjà complété)
 *           - Liste des articles avec image emoji
 *           - Sélecteur de quantité (+/−)
 *           - Bouton de suppression par article
 *           - Prix total par ligne + ancien prix barré
 * ============================================================
 */
import React from 'react';
import type { CartItem } from '../data/panierData';
import { fmt } from '../data/panierData';
import styles from '../styles/ArticlesSection.module.css';

interface Props {
  items:       CartItem[];
  onChangeQty: (id: number, delta: number) => void;
  onRemove:    (id: number) => void;
  onToast:     (m: string) => void;
}

export default function ArticlesSection({ items, onChangeQty, onRemove, onToast }: Props) {
  return (
    <div className={`${styles.sc} ${styles.lit}`}>

      {/* ── En-tête section ── */}
      <div className={styles.scHd}>
        {/* Numéro étape : coché (vert) car articles déjà validés */}
        <div className={`${styles.scNum} ${styles.done}`}>
          <i className="fas fa-check" style={{ fontSize: 9 }} />
        </div>
        <div>
          <div className={styles.scTitre}>Vos articles</div>
          <div className={styles.scSub}>{items.length} article{items.length > 1 ? 's' : ''} · TechStore Conakry</div>
        </div>
        {/* Lien modifier le panier */}
        <button className={styles.editBtn} onClick={() => onToast('✏️ Modifier le panier')}>
          <i className="fas fa-pen-to-square" /> Modifier
        </button>
      </div>

      {/* ── Liste des articles ── */}
      <div className={styles.scBody}>
        <div className={styles.list}>
          {items.map(item => (
            <div key={item.id} className={styles.ci}>

              {/* Image produit */}
              <div className={styles.ciImg}>{item.em}</div>

              {/* Informations produit */}
              <div className={styles.ciInfo}>
                <div className={styles.ciShop}>{item.shop}</div>
                <div className={styles.ciName}>{item.name}</div>
                {/* Variantes sous forme de chips */}
                <div className={styles.ciVt}>
                  {item.vt.split(' · ').map((v, i) => (
                    <span key={i}>{v}</span>
                  ))}
                </div>
              </div>

              {/* Droite : prix + quantité + supprimer */}
              <div className={styles.ciRight}>
                {/* Prix */}
                <div>
                  <div className={styles.ciPrice}>{fmt(item.price * item.qty)}</div>
                  {item.old && (
                    <div className={styles.ciOld}>{fmt(item.old * item.qty)}</div>
                  )}
                </div>

                {/* Sélecteur quantité */}
                <div className={styles.ciQty}>
                  <button
                    className={styles.cqBtn}
                    onClick={() => onChangeQty(item.id, -1)}
                  >
                    <i className="fas fa-minus" style={{ fontSize: 10 }} />
                  </button>
                  <span className={styles.cqNum}>{item.qty}</span>
                  <button
                    className={styles.cqBtn}
                    onClick={() => onChangeQty(item.id, 1)}
                  >
                    <i className="fas fa-plus" style={{ fontSize: 10 }} />
                  </button>
                </div>

                {/* Supprimer */}
                <button
                  className={styles.delBtn}
                  onClick={() => { onRemove(item.id); onToast('🗑️ Article retiré'); }}
                  title="Supprimer l'article"
                >
                  <i className="fas fa-trash-can" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
