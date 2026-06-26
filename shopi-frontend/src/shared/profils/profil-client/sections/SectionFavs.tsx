/* ================================================================
 * FICHIER : profil-client/sections/SectionFavs.tsx
 *
 * Onglet "Favoris" : grille de produits.
 *
 * DONNÉES : reçues en prop `favoris` (réel, via /client/favoris).
 * Clic sur un produit → redirige vers sa page (/produit/:id).
 * ================================================================ */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ProfilClient.module.css';
import { FAVORIS as MOCK_FAVORIS, fmtGnf } from '../data/profilClientData';
import type { Favori } from '../data/profilClientData';

interface Props {
  onToast: (m: string) => void;
  favoris?: Favori[];   // dynamique (fallback mock)
}

export default function SectionFavs({ onToast, favoris = MOCK_FAVORIS }: Props) {
  const navigate = useNavigate();

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