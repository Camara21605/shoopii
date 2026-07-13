/* ================================================================
 * FICHIER : profil-client/sections/SectionFavs.tsx
 *
 * Onglet "Favoris" : grille de produits.
 * Données exclusivement depuis /client/favoris.
 * ================================================================ */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ProfilClient.module.css';
import type { Favori } from '../data/profilClientData';

const fmtGnf = (n: number | undefined | null) =>
  n != null ? n.toLocaleString('fr-FR') + ' GNF' : '—';

interface Props {
  onToast: (m: string) => void;
  favoris: Favori[];
}

export default function SectionFavs({ onToast, favoris }: Props) {
  const navigate = useNavigate();

  if (favoris.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.ct}><i className="fas fa-heart" /> Produits favoris</div>
        </div>
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--t3)' }}>
            <i className="fas fa-heart" style={{ fontSize: 28, display: 'block', marginBottom: 10, opacity: 0.3 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucun favori</div>
            <div style={{ fontSize: 12 }}>Ajoutez des produits à vos favoris depuis la boutique.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <div className={styles.ct}><i className="fas fa-heart" /> Produits favoris ({favoris.length})</div>
        <button className={styles.chLink} onClick={() => onToast('❤️ Tous les favoris')}>Voir tout</button>
      </div>
      <div className={styles.favG}>
        {favoris.map(f => (
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