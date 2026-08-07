/* ================================================================
 * FICHIER : src/modules/home/components/boutiques/components/CategoryFilterBar.tsx
 *
 * Barre de filtres catégorie / sous-catégorie pour /boutiques.
 * Récupère GET /categories (réponse déjà nichée avec subCategories,
 * cf. CategoriesSection.tsx). Un clic sur une catégorie déplie ses
 * sous-catégories en second rang de chips.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import styles from './CategoryFilterBar.module.css';

interface SubCategoryApi {
  id:  string;
  nom: string;
}

interface CategoryApi {
  id:            string;
  nom:           string;
  icone:         string | null;
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

  if (loading) {
    return (
      <div className={styles.chips}>
        {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.chips}>
        <button
          className={`${styles.chip} ${!activeCategoryId ? styles.chipOn : ''}`}
          onClick={() => { onSelectCategory(undefined); onSelectSubCategory(undefined); }}
        >
          {t('boutiquesPage.filterBar.toutesCategories')}
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            className={`${styles.chip} ${activeCategoryId === c.id ? styles.chipOn : ''}`}
            onClick={() => {
              onSelectCategory(c.id);
              onSelectSubCategory(undefined);
            }}
          >
            {c.icone ?? '📁'} {c.nom}
          </button>
        ))}
      </div>

      {activeCategory && activeCategory.subCategories.length > 0 && (
        <div className={`${styles.chips} ${styles.subChips}`}>
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
              {s.nom}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
