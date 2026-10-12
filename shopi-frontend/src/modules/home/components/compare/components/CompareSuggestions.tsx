/* ================================================================
 * FICHIER : src/modules/home/components/compare/components/CompareSuggestions.tsx
 *
 * RÔLE : Page « Comparer » vide — propose des catégories et leurs
 *        sous-catégories pour lancer l'exploration en un geste, au lieu
 *        d'un simple bouton « Explorer » qui renvoyait à l'accueil.
 *
 *   - Catégories dans l'ordre de GET /categories (déjà personnalisé
 *     selon les goûts du client connecté côté serveur, aléatoire sinon).
 *   - Toucher une catégorie ouvre ses sous-catégories juste en dessous ;
 *     chaque puce mène à l'Explorer filtré (/explorer?category=…
 *     [&subCategory=…]), où le bouton ⚖️ « Comparer » des fiches permet
 *     ensuite de remplir la comparaison.
 *   - Échec réseau / aucune catégorie : la section ne s'affiche pas
 *     (l'état vide de la page reste utilisable tel quel).
 * ================================================================ */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { apiFetch } from '../../../../../shared/services/apiFetch';
import { categoryName, subCategoryName } from '../../../../../shared/utils/catalogueCase';
import CatalogueIcon from '../../ui/CatalogueIcon';
import styles from './CompareSuggestions.module.css';

interface SubCategoryApi { id: string; nom: string; actif?: boolean }
interface CategoryApi {
  id:            string;
  nom:           string;
  icone:         string | null;
  imageUrl:      string | null;
  actif:         boolean;
  subCategories: SubCategoryApi[];
}

/** Catégories visibles avant « Voir plus » (2 rangées de 4 sur mobile). */
const APERCU = 8;

export default function CompareSuggestions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryApi[] | null>(null);
  const [ouverte,    setOuverte]    = useState<string | null>(null);
  const [toutes,     setToutes]     = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Les sous-catégories s'ouvrent sous la grille : on les amène à l'écran
   * si elles tombent hors de la vue (petit téléphone, grille dépliée). */
  useEffect(() => {
    if (!ouverte) return;
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 80) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [ouverte]);

  useEffect(() => {
    let annule = false;
    apiFetch<CategoryApi[]>('/categories', { public: true })
      .then(data => { if (!annule) setCategories((data ?? []).filter(c => c.actif)); })
      .catch(() => { if (!annule) setCategories([]); });
    return () => { annule = true; };
  }, []);

  /* Chargement : squelettes à la même place (pas de saut de mise en page) */
  if (categories === null) {
    return (
      <section className={styles.wrap} aria-busy="true">
        <div className={styles.grid}>
          {[...Array(APERCU)].map((_, i) => <div key={i} className={styles.skel} />)}
        </div>
      </section>
    );
  }
  if (categories.length === 0) return null;

  const visibles = toutes ? categories : categories.slice(0, APERCU);
  const active   = categories.find(c => c.id === ouverte) ?? null;
  const subs     = (active?.subCategories ?? []).filter(s => s.actif !== false);

  const explorer = (categoryId: string, subCategoryId?: string) => {
    const q = new URLSearchParams({ category: categoryId });
    if (subCategoryId) q.set('subCategory', subCategoryId);
    navigate(`/explorer?${q.toString()}`);
  };

  return (
    <section className={styles.wrap}>
      <h2 className={styles.titre}>{t('compare.demarrerTitre')}</h2>
      <p className={styles.sub}>{t('compare.suggestionsSub')}</p>

      <div className={styles.grid}>
        {visibles.map(c => {
          const on = c.id === ouverte;
          return (
            <button
              key={c.id}
              type="button"
              className={`${styles.tile} ${on ? styles.tileOn : ''}`}
              aria-expanded={on}
              /* Sans sous-catégorie : on va directement aux produits. */
              onClick={() => (c.subCategories?.length ? setOuverte(on ? null : c.id) : explorer(c.id))}
            >
              <span className={styles.icon}>
                <CatalogueIcon imageUrl={c.imageUrl} icone={c.icone} fallback="📁" />
              </span>
              <span className={styles.nom}>{categoryName(c.nom)}</span>
            </button>
          );
        })}
      </div>

      {categories.length > APERCU && (
        <button type="button" className={styles.plus} onClick={() => setToutes(v => !v)}>
          {toutes ? t('compare.moinsCategories') : t('compare.plusCategories', { count: categories.length - APERCU })}
          <i className={`fas fa-chevron-${toutes ? 'up' : 'down'}`} />
        </button>
      )}

      {active && (
        <div className={styles.subPanel} ref={panelRef}>
          <div className={styles.subLabel}>
            {t('compare.sousCategoriesDe', { name: categoryName(active.nom) })}
          </div>
          <div className={styles.chips}>
            <button type="button" className={`${styles.chip} ${styles.chipAll}`} onClick={() => explorer(active.id)}>
              {t('compare.toutVoirCategorie')} <i className="fas fa-arrow-right" />
            </button>
            {subs.map(s => (
              <button key={s.id} type="button" className={styles.chip} onClick={() => explorer(active.id, s.id)}>
                {subCategoryName(s.nom)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
