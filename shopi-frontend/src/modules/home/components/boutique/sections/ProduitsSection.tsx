/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/ProduitsSection.tsx
 *
 * RÔLE    : Section principale affichant la grille de produits
 *           de la boutique avec filtres actifs et pagination.
 *
 * FONCTIONNALITÉS :
 *   - Chips des filtres actifs (supprimables)
 *   - Compteur de résultats + toggle vue grille/liste
 *   - Grille produits (3 colonnes) ou vue liste (1 colonne)
 *   - Message si aucun produit ne correspond
 *   - Pagination (5 pages)
 * ============================================================
 */
import React, { useState } from 'react';
import type { ProduitBoutique } from '../data/boutiqueMockData';
import CardProduitBoutique from '../components/CardProduitBoutique';
import styles from '../styles/ProduitsSection.module.css';

interface Props {
  produits:      ProduitBoutique[];   /* produits déjà filtrés depuis le parent */
  filtresActifs: string[];            /* labels des filtres actifs */
  onRemoveFiltreActif: (f: string) => void; /* supprime un filtre */
  onResetFiltres: () => void;         /* remet tous les filtres à zéro */
  onToast: (m: string) => void;
}

export default function ProduitsSection({
  produits, filtresActifs, onRemoveFiltreActif, onResetFiltres, onToast,
}: Props) {

  /* ── Vue grille / liste ── */
  const [vue, setVue] = useState<'grille' | 'liste'>('grille');

  return (
    <div>

      {/* ── Chips des filtres actifs ── */}
      {filtresActifs.length > 0 && (
        <div className={styles.activeFilters}>
          <span className={styles.afLabel}>Filtres actifs :</span>
          {filtresActifs.map(f => (
            <span
              key={f}
              className={styles.chip}
              onClick={() => onRemoveFiltreActif(f)}
              title="Supprimer ce filtre"
            >
              {f} <i className="fas fa-xmark" />
            </span>
          ))}
          {/* Tout effacer */}
          <button className={styles.clearAll} onClick={onResetFiltres}>
            <i className="fas fa-xmark" /> Tout effacer
          </button>
        </div>
      )}

      {/* ── Barre résultats + toggle vue ── */}
      <div className={styles.resultsHd}>
        <div className={styles.resultsCnt}>
          <strong>{produits.length}</strong>
          {' '}produit{produits.length > 1 ? 's' : ''} trouvé{produits.length > 1 ? 's' : ''}
        </div>
        <div className={styles.viewBtns}>
          {/* Grille */}
          <button
            className={`${styles.vbtn} ${vue === 'grille' ? styles.vbtnActive : ''}`}
            onClick={() => setVue('grille')}
            title="Vue grille"
          >
            <i className="fas fa-grid-2" />
          </button>
          {/* Liste */}
          <button
            className={`${styles.vbtn} ${vue === 'liste' ? styles.vbtnActive : ''}`}
            onClick={() => setVue('liste')}
            title="Vue liste"
          >
            <i className="fas fa-list" />
          </button>
        </div>
      </div>

      {/* ── Grille ou état vide ── */}
      {produits.length === 0 ? (

        /* Message "aucun résultat" */
        <div className={styles.empty}>
          <span className={styles.emptyIco}>📦</span>
          <strong>Aucun produit ne correspond à vos filtres</strong>
          <p>Essayez de modifier ou supprimer certains filtres.</p>
          <button className={styles.emptyBtn} onClick={onResetFiltres}>
            <i className="fas fa-rotate-left" /> Réinitialiser les filtres
          </button>
        </div>

      ) : (

        /* Grille de cartes produits */
        <div className={`${styles.grid} ${vue === 'liste' ? styles.gridList : ''}`}>
          {produits.map(p => (
            <CardProduitBoutique
              key={p.id}
              p={p}
              isList={vue === 'liste'}
              onToast={onToast}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {produits.length > 0 && (
        <div className={styles.pagination}>
          <button className={`${styles.pgBtn} ${styles.pgDisabled}`} disabled>
            <i className="fas fa-chevron-left" />
          </button>
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              className={`${styles.pgBtn} ${n === 1 ? styles.pgActive : ''}`}
              onClick={() => onToast(`📄 Page ${n}`)}
            >
              {n}
            </button>
          ))}
          <button
            className={styles.pgBtn}
            onClick={() => onToast('📄 Page suivante')}
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}
