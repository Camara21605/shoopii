/* ================================================================
 * FICHIER : src/modules/home/components/boutiques/components/CategoryFilterBar.tsx
 *
 * Barre de filtres catégorie / sous-catégorie pour /boutiques.
 * Récupère GET /categories (réponse déjà nichée avec subCategories,
 * cf. CategoriesSection.tsx). Un clic sur une catégorie déplie ses
 * sous-catégories en second rang de chips.
 * ================================================================ */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import CatalogueIcon from '../../ui/CatalogueIcon';
import styles from './CategoryFilterBar.module.css';
import { categoryName, subCategoryName } from '../../../../../shared/utils/catalogueCase';

interface SubCategoryApi {
  id:  string;
  nom: string;
}

interface CategoryApi {
  id:            string;
  nom:           string;
  icone:         string | null;
  imageUrl:      string | null;
  actif:         boolean;
  subCategories: SubCategoryApi[];
}

interface Props {
  activeCategoryId?:    string;
  activeSubCategoryId?: string;
  onSelectCategory:    (id: string | undefined) => void;
  onSelectSubCategory: (id: string | undefined) => void;
}

export default function CategoryFilterBar({
  activeCategoryId, activeSubCategoryId, onSelectCategory, onSelectSubCategory,
}: Props) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    apiFetch<CategoryApi[]>('/categories', { public: true })
      .then(data => setCategories((data ?? []).filter(c => c.actif)))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  const activeCategory = categories.find(c => c.id === activeCategoryId);

  /* La puce active peut être hors écran (rangée défilante) : sans ce
   * recentrage, on voyait « Toutes catégories » non cochée ET une rangée
   * de sous-catégories, sans comprendre quelle catégorie était choisie. */
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[data-active="true"]');
    if (!row || !chip) return;
    row.scrollTo({ left: chip.offsetLeft - 12, behavior: 'smooth' });
  }, [activeCategoryId, categories.length]);

  if (loading) {
    return (
      <div className={styles.chips}>
        {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>{t('boutiquesPage.filterBar.categories')}</div>
      <div className={styles.chips} ref={rowRef}>
        <button
          data-active={!activeCategoryId}
          className={`${styles.chip} ${!activeCategoryId ? styles.chipOn : ''}`}
          onClick={() => { onSelectCategory(undefined); onSelectSubCategory(undefined); }}
        >
          {t('boutiquesPage.filterBar.toutesCategories')}
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            data-active={activeCategoryId === c.id}
            className={`${styles.chip} ${activeCategoryId === c.id ? styles.chipOn : ''}`}
            onClick={() => {
              onSelectCategory(c.id);
              onSelectSubCategory(undefined);
            }}
          >
            <CatalogueIcon imageUrl={c.imageUrl} icone={c.icone} fallback="📁" inline={18} /> {categoryName(c.nom)}
          </button>
        ))}
      </div>

      {activeCategory && activeCategory.subCategories.length > 0 && (
        <div className={styles.subPanel}>
          <div className={styles.label}>
            {t('boutiquesPage.filterBar.sousCategoriesDe', { name: categoryName(activeCategory.nom) })}
          </div>
          <div className={styles.chips}>
          <button
            className={`${styles.chip} ${styles.chipSub} ${!activeSubCategoryId ? styles.chipOn : ''}`}
            onClick={() => onSelectSubCategory(undefined)}
          >
            {t('boutiquesPage.filterBar.toutesSousCategories')}
          </button>
          {activeCategory.subCategories.map(s => (
            <button
              key={s.id}
              className={`${styles.chip} ${styles.chipSub} ${activeSubCategoryId === s.id ? styles.chipOn : ''}`}
              onClick={() => onSelectSubCategory(s.id)}
            >
              {subCategoryName(s.nom)}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
