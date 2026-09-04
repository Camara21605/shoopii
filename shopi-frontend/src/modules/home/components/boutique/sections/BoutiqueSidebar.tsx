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
import { useTranslation } from 'react-i18next';
import type { BoutiqueInfo } from '../data/boutiqueMockData';
import styles from '../styles/BoutiqueSidebar.module.css';

interface CategorieReelle { label: string; emoji: string; count: number; }

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
  /* Catégories et fourchette de prix — dérivées des vrais produits de
   * CETTE boutique côté BoutiquePage.tsx (categoriesReelles, priceBounds),
   * remplacent l'ancienne liste CATEGORIES_BOUTIQUE figée (compteurs
   * inventés, sans rapport avec les produits réels — cliquer dessus
   * filtrait sur un nom de catégorie qui ne correspondait à aucun produit). */
  categories:   CategorieReelle[];
  priceBounds:  { min: number; max: number };
  priceMin:     number;
  priceMax:     number;
  setPriceMin:  (v: number | null) => void;
  setPriceMax:  (v: number | null) => void;
  onToast:      (m: string) => void;
  /* Mobile uniquement : la sidebar devient un tiroir superposé plutôt
   * que de s'empiler au-dessus de la grille produits (voir CSS). Sur
   * desktop, isOpen/onClose n'ont aucun effet (colonne toujours visible). */
  isOpen?:      boolean;
  onClose?:     () => void;
  boutiqueInfo: BoutiqueInfo | null;
}

export default function BoutiqueSidebar({
  catActive, setCatActive, sortBy, setSortBy,
  filtrStock, setFiltrStock, filtrPromo, setFiltrPromo,
  filtrNew,   setFiltrNew,  onToast,
  categories, priceBounds, priceMin, priceMax, setPriceMin, setPriceMax,
  isOpen = false, onClose, boutiqueInfo,
}: Props) {
  const { t } = useTranslation();

  /* Nombre total de produits pour la catégorie "Tout" */
  const totalProduits = categories.reduce((a, c) => a + c.count, 0);

  return (
    <>
      {/* Fond assombri — mobile uniquement (voir CSS), ferme le tiroir au clic */}
      {isOpen && <div className={styles.backdrop} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>

        {/* En-tête du tiroir — mobile uniquement (voir CSS) */}
        <div className={styles.drawerHd}>
          <h3><i className="fas fa-filter" /> {t('boutiqueDetail.sidebar.titreTiroir', 'Filtres')}</h3>
          <button className={styles.drawerClose} onClick={onClose} aria-label="Fermer">
            <i className="fas fa-xmark" />
          </button>
        </div>

      {/* ══ 1. Tri ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-arrow-up-wide-short" /> {t('boutiqueDetail.sidebar.trierPar')}</h4>
        </div>
        <div className={styles.cardBd}>
          <select
            className={styles.sortSel}
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); onToast(t('boutiqueDetail.sidebar.triToast', { value: e.target.value })); }}
          >
            {[
              t('boutiqueDetail.sidebar.triOptions.pertinence'),
              t('boutiqueDetail.sidebar.triOptions.prixCroissant'),
              t('boutiqueDetail.sidebar.triOptions.prixDecroissant'),
              t('boutiqueDetail.sidebar.triOptions.mieuxNotes'),
              t('boutiqueDetail.sidebar.triOptions.nouveautes'),
              t('boutiqueDetail.sidebar.triOptions.meilleuresVentes'),
            ].map(o => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ══ 2. Catégories ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-layer-group" /> {t('boutiqueDetail.sidebar.categories')}</h4>
          {/* Bouton "Tout" pour réinitialiser */}
          <button className={styles.clearBtn} onClick={() => setCatActive('Tout')}>
            {t('boutiqueDetail.sidebar.tout')}
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
              <span>{t('boutiqueDetail.sidebar.tout')}</span>
              <span className={styles.catCnt}>{totalProduits}</span>
            </div>

            {/* Une ligne par catégorie réellement présente dans cette boutique */}
            {categories.map(c => (
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

      {/* ══ 3. Fourchette de prix ══
       * BUG CORRIGÉ — slider figé (0 → 30M, valeur par défaut 21M) et
       * inputs non contrôlés (defaultValue seul, aucun onChange) : ça ne
       * filtrait rien du tout, quel que soit le produit le plus cher de
       * CETTE boutique. Bornes et valeurs réelles désormais. */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-coins" /> {t('boutiqueDetail.sidebar.prix')}</h4>
        </div>
        <div className={styles.cardBd}>
          {/* Slider — contrôle la borne haute */}
          <input
            type="range"
            className={styles.slider}
            min={priceBounds.min}
            max={priceBounds.max}
            value={priceMax}
            onChange={e => setPriceMax(Number(e.target.value))}
          />
          {/* Inputs min / max */}
          <div className={styles.priceInputs}>
            <input
              type="number"
              className={styles.priceIn}
              placeholder="Min"
              min={priceBounds.min}
              max={priceMax}
              value={priceMin}
              onChange={e => setPriceMin(e.target.value === '' ? priceBounds.min : Math.min(Number(e.target.value), priceMax))}
            />
            <input
              type="number"
              className={styles.priceIn}
              placeholder="Max"
              min={priceMin}
              max={priceBounds.max}
              value={priceMax}
              onChange={e => setPriceMax(e.target.value === '' ? priceBounds.max : Math.max(Number(e.target.value), priceMin))}
            />
          </div>
        </div>
      </div>

      {/* ══ 5. Disponibilité ══ */}
      <div className={styles.card}>
        <div className={styles.cardHd}>
          <h4><i className="fas fa-warehouse" /> {t('boutiqueDetail.sidebar.disponibilite')}</h4>
        </div>
        <div className={styles.cardBd}>
          <div className={styles.checkList}>
            {[
              { lbl: t('boutiqueDetail.sidebar.enStockUniquement'), val: filtrStock, set: setFiltrStock },
              { lbl: t('boutiqueDetail.sidebar.enPromotion'),         val: filtrPromo, set: setFiltrPromo },
              { lbl: t('boutiqueDetail.sidebar.nouveautesSeulement'), val: filtrNew,   set: setFiltrNew   },
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

      {/* ══ 6. Infos boutique — n'affiche que les champs réellement
             renseignés par la boutique (pas de ligne vide). ══ */}
      {(() => {
        const rows = boutiqueInfo ? [
          { ico: '🕐', bg: 'bg1', title: t('boutiqueDetail.sidebar.horaires'),  sub: boutiqueInfo.horaires },
          { ico: '📍', bg: 'bg2', title: t('boutiqueDetail.sidebar.adresse'),   sub: boutiqueInfo.adresse  },
          { ico: '📞', bg: 'bg3', title: t('boutiqueDetail.sidebar.telephone'), sub: boutiqueInfo.tel      },
          { ico: '✉️', bg: 'bg4', title: t('boutiqueDetail.sidebar.email'),     sub: boutiqueInfo.email    },
        ].filter(r => r.sub && r.sub.trim().length > 0) : [];
        if (rows.length === 0) return null;
        return (
          <div className={styles.card}>
            <div className={styles.cardHd}>
              <h4><i className="fas fa-circle-info" /> {t('boutiqueDetail.sidebar.infosBoutique')}</h4>
            </div>
            <div className={styles.cardBd}>
              <div className={styles.infoRows}>
                {rows.map(r => (
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
        );
      })()}
      </aside>
    </>
  );
}
