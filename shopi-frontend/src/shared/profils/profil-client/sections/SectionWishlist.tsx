/* ================================================================
 * FICHIER : profil-client/sections/SectionWishlist.tsx
 *
 * Onglet "Liste de souhaits" : grille de produits.
 * Données exclusivement depuis /client/wishlist — mirroir de
 * SectionFavs.tsx, mais pour une liste personnelle distincte des
 * favoris (❤️, voir wishlist-item.entity.ts pour la distinction).
 * ================================================================ */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ProfilClient.module.css';
import type { Favori } from '../data/profilClientData';

const fmtGnf = (n: number | undefined | null) =>
  n != null ? n.toLocaleString('fr-FR') + ' GNF' : '—';

interface Props {
  onToast: (m: string) => void;
  wishlist: Favori[];
}

export default function SectionWishlist({ onToast, wishlist }: Props) {
  const navigate = useNavigate();

  if (wishlist.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.ct}><i className="fas fa-bookmark" /> Liste de souhaits</div>
        </div>
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--t3)' }}>
            <i className="fas fa-bookmark" style={{ fontSize: 28, display: 'block', marginBottom: 10, opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Liste de souhaits vide</div>
            <div style={{ fontSize: 12 }}>Ajoutez des produits à votre liste de souhaits depuis leur fiche.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}><i className="fas fa-bookmark" /> Liste de souhaits ({wishlist.length})</div>
        <button className={styles.chLink} onClick={() => onToast('🔖 Toute la liste de souhaits')}>Voir tout</button>
      </div>
      <div className={styles.favG}>
        {wishlist.map(f => (
          <div key={f.id} className={styles.favC} onClick={() => navigate(`/produit/${f.id}`)}>
            <div className={styles.favImg}>
              {f.imageUrl
                ? <img src={f.imageUrl} alt={f.nom} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : f.emoji}
            </div>
            <div className={styles.favBd}>
              <div className={styles.favNm2}>{f.nom}</div>
              <div className={styles.favPr}>
                {fmtGnf(f.prix)}
                {f.prixAncien && <span className={styles.favOld}>{f.prixAncien}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
