/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/BoutiqueSidebar.tsx
 *
 * RÔLE    : Panneau de filtres latéral (colonne gauche).
 *           Sticky pendant le scroll de la page.
 *
 * FILTRES DISPONIBLES :
 *   1. Tri         → Pertinence, Prix, Note, Nouveautés…
 *   2. Catégories  → Liste des catégories de la boutique
 *   3. Prix        → Slider + inputs min/max
 *   4. Note        → Radio buttons (5★ / 4★+ / 3★+ / Tous)
 *   5. Disponibilité → Cases à cocher
 *   6. Infos boutique → Horaires, adresse, contact
 *
 * PROPS :
 *   catActive    → catégorie filtrée actuellement active
 *   sortBy       → tri actif
 *   filtrStock   → filtre "en stock seulement"
 *   filtrPromo   → filtre "en promotion"
 *   filtrNew     → filtre "nouveautés"
 *   + setters pour modifier chaque état
 * ============================================================
 */
import React from 'react';
import { CATEGORIES_BOUTIQUE, BOUTIQUE_INFO } from '../data/boutiqueMockData';
import styles from '../styles/BoutiqueSidebar.module.css';

interface Props {
  catActive:    string;
  setCatActive: (c: string) => void;
  sortBy:       string;
  setSortBy:    (s: string) => void;
  filtrStock:   boolean;
  setFiltrStock:(v: boolean) => void;
  filtrPromo:   boolean;
  setFiltrPromo:(v: boolean) => void;
  filtrNew:     boolean;
  setFiltrNew:  (v: boolean) => void;
  onToast:      (m: string) => void;
}

export default function BoutiqueSidebar({
  catActive, setCatActive, sortBy, setSortBy,
  filtrStock, setFiltrStock, filtrPromo, setFiltrPromo,
  filtrNew,   setFiltrNew,  onToast,
}: Props) {

  /* Nombre total de produits pour la catégorie "Tout" */
  const totalProduits = CATEGORIES_BOUTIQUE.reduce((a, c) => a + c.count, 0);

  return (
    <aside className={styles.sidebar}>

      {/* ══ 1. Tri ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-arrow-up-wide-short" /> Trier par</h4>
        </div>
        <div className={styles.cardBd}>
          <select
            className={styles.sortSel}
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); onToast(`🔃 Tri : ${e.target.value}`); }}
          >
            {['Pertinence','Prix croissant','Prix décroissant','Mieux notés','Nouveautés','Meilleures ventes'].map(o => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ══ 2. Catégories ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-layer-group" /> Catégories</h4>
          {/* Bouton "Tout" pour réinitialiser */}
          <button className={styles.clearBtn} onClick={() => setCatActive('Tout')}>
            Tout
          </button>
        </div>
        <div className={`${styles.cardBd} ${styles.cardBdPad}`}>
          <div className={styles.catList}>

            {/* Option "Tout" */}
            <div
              className={`${styles.catItem} ${catActive === 'Tout' ? styles.catItemActive : ''}`}
              onClick={() => setCatActive('Tout')}
            >
              <span className={styles.catEm}>✦</span>
              <span>Tout</span>
              <span className={styles.catCnt}>{totalProduits}</span>
            </div>

            {/* Une ligne par catégorie */}
            {CATEGORIES_BOUTIQUE.map(c => (
              <div
                key={c.label}
                className={`${styles.catItem} ${catActive === c.label ? styles.catItemActive : ''}`}
                onClick={() => setCatActive(c.label)}
              >
                <span className={styles.catEm}>{c.emoji}</span>
                <span>{c.label}</span>
                <span className={styles.catCnt}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ 3. Fourchette de prix ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-coins" /> Prix (GNF)</h4>
        </div>
        <div className={styles.cardBd}>
          {/* Slider */}
          <input
            type="range"
            className={styles.slider}
            min={0} max={30000000}
            defaultValue={21000000}
          />
          {/* Inputs min / max */}
          <div className={styles.priceInputs}>
            <input type="text" className={styles.priceIn} placeholder="Min" defaultValue="0" />
            <input type="text" className={styles.priceIn} placeholder="Max" defaultValue="21 000 000" />
          </div>
        </div>
      </div>

      {/* ══ 4. Note minimale ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-star" /> Note minimale</h4>
        </div>
        <div className={styles.cardBd}>
          <div className={styles.ratingList}>
            {[
              { val: 5, cnt: '(204)', label: '★★★★★' },
              { val: 4, cnt: '(234)', label: '★★★★☆' },
              { val: 3, cnt: '(241)', label: '★★★☆☆' },
            ].map(r => (
              <label key={r.val} className={styles.ratingOpt}>
                <input
                  type="radio"
                  name="rat"
                  style={{ accentColor: 'var(--blue)' }}
                  onChange={() => onToast(`⭐ Filtre ${r.val}+ étoiles`)}
                />
                <span className={styles.ratingStars}>{r.label}</span>
                <span className={styles.ratingCnt}>{r.cnt}</span>
              </label>
            ))}
            {/* Option "Tous" */}
            <label className={styles.ratingOpt}>
              <input
                type="radio"
                name="rat"
                defaultChecked
                style={{ accentColor: 'var(--blue)' }}
                onChange={() => onToast('Tous les avis')}
              />
              <span className={styles.ratingAll}>Tous les avis</span>
            </label>
          </div>
        </div>
      </div>

      {/* ══ 5. Disponibilité ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-warehouse" /> Disponibilité</h4>
        </div>
        <div className={styles.cardBd}>
          <div className={styles.checkList}>
            {[
              { lbl: 'En stock uniquement', val: filtrStock, set: setFiltrStock },
              { lbl: 'En promotion',         val: filtrPromo, set: setFiltrPromo },
              { lbl: 'Nouveautés seulement', val: filtrNew,   set: setFiltrNew   },
            ].map(c => (
              <label key={c.lbl} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={c.val}
                  style={{ accentColor: 'var(--blue)' }}
                  onChange={e => c.set(e.target.checked)}
                />
                <span>{c.lbl}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ══ 6. Infos boutique ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-circle-info" /> Infos boutique</h4>
        </div>
        <div className={styles.cardBd}>
          <div className={styles.infoRows}>
            {[
              { ico: '🕐', bg: 'bg1', title: 'Horaires',  sub: BOUTIQUE_INFO.horaires },
              { ico: '📍', bg: 'bg2', title: 'Adresse',   sub: BOUTIQUE_INFO.adresse  },
              { ico: '📞', bg: 'bg3', title: 'Téléphone', sub: BOUTIQUE_INFO.tel      },
              { ico: '✉️', bg: 'bg4', title: 'Email',     sub: BOUTIQUE_INFO.email    },
            ].map(r => (
              <div key={r.title} className={styles.infoRow}>
                <div className={`${styles.infoIco} ${styles[r.bg]}`}>{r.ico}</div>
                <div>
                  <div className={styles.infoTitle}>{r.title}</div>
                  <div className={styles.infoSub}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
