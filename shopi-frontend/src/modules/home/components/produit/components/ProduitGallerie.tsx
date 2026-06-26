/*
 * FICHIER : src/modules/home/components/produit/components/ProduitGallerie.tsx
 *
 * CONNEXION API : affiche les vraies images Cloudinary
 *   - Image principale depuis produitApi.images
 *   - Miniatures cliquables
 *   - Fallback emoji si pas d'image
 */
import React, { useState } from 'react';
import type { ProduitInfo } from '../data/produitMockData';
import type { ProduitApi }  from '../pages/ProduitPage';
import styles from '../styles/ProduitGallerie.module.css';

interface Props {
  produit:    ProduitInfo;   // pour les badges (prix, continent)
  produitApi: ProduitApi;    // pour les vraies images
  onToast:    (m: string) => void;
  onPartage:  () => void;
}

export default function ProduitGallerie({ produit, produitApi, onToast, onPartage }: Props) {
  const [thumbActive, setThumbActive] = useState(0);
  const [fav,         setFav]         = useState(false);

  // Images triées par ordre
  const images = (produitApi.images ?? []).sort((a, b) => a.ordre - b.ordre);
  const hasImages = images.length > 0;
  const activeImg = hasImages ? images[thumbActive] : null;

  // Fallback emoji depuis la catégorie
  const fallbackEmoji = produitApi.category?.icone ?? '📦';

  return (
    <div className={styles.gallerie}>

      {/* ── Image principale ── */}
      <div className={styles.main} style={{ position: 'relative', overflow: 'hidden' }}>

        {/* Badges */}
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.badgeHot}`}>⭐ Populaire</span>
          {produit.ancien > produit.prix && (
            <span className={`${styles.badge} ${styles.badgePromo}`}>
              🏷️ −{Math.round((1 - produit.prix / produit.ancien) * 100)}%
            </span>
          )}
          {produit.boutique.continent !== 'africa' && (
            <span className={`${styles.badge} ${styles.badgeIntl}`}>🌍 Importé</span>
          )}
        </div>

        {/* Image réelle ou emoji fallback */}
        {activeImg ? (
          <img
            src={activeImg.url}
            alt={activeImg.alt ?? produit.nom}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <span className={styles.emoji}>{fallbackEmoji}</span>
        )}

        {/* Flèches navigation si plusieurs images */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setThumbActive(i => (i - 1 + images.length) % images.length)}
              style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,.9)', border: '1px solid var(--bdr)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: 'var(--navy)', zIndex: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,.12)',
              }}
            >
              <i className="fas fa-chevron-left" />
            </button>
            <button
              onClick={() => setThumbActive(i => (i + 1) % images.length)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,.9)', border: '1px solid var(--bdr)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: 'var(--navy)', zIndex: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,.12)',
              }}
            >
              <i className="fas fa-chevron-right" />
            </button>
            {/* Compteur */}
            <div style={{
              position: 'absolute', bottom: 10, right: 12,
              background: 'rgba(11,31,58,.65)', color: '#fff',
              fontSize: 11, fontWeight: 700, padding: '3px 10px',
              borderRadius: 999, backdropFilter: 'blur(4px)',
            }}>
              {thumbActive + 1} / {images.length}
            </div>
          </>
        )}

        {/* Bouton favori */}
        <button
          className={`${styles.favBtn} ${fav ? styles.favBtnOn : ''}`}
          onClick={() => { setFav(f => !f); onToast(fav ? '🤍 Retiré des favoris' : '❤️ Ajouté aux favoris'); }}
          title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <i className={fav ? 'fas fa-heart' : 'far fa-heart'} />
        </button>

        {/* Bouton partage */}
        <button className={styles.shareBtn} onClick={onPartage} title="Partager ce produit">
          <i className="fas fa-share-nodes" />
        </button>
      </div>

      {/* ── Miniatures ── */}
      {hasImages && (
        <div className={styles.thumbs}>
          {images.map((img, i) => (
            <div
              key={img.id}
              className={`${styles.thumb} ${thumbActive === i ? styles.thumbActive : ''}`}
              onClick={() => setThumbActive(i)}
              title={img.alt ?? `Image ${i + 1}`}
              style={{ overflow: 'hidden', padding: 0 }}
            >
              <img
                src={img.url}
                alt={img.alt ?? `Image ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Fallback : pas d'images → emoji seul, pas de miniatures */}
      {!hasImages && (
        <div className={styles.thumbs}>
          <div className={`${styles.thumb} ${styles.thumbActive}`}>
            {fallbackEmoji}
          </div>
        </div>
      )}
    </div>
  );
}