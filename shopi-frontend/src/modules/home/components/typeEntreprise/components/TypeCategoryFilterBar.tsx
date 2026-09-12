/* ================================================================
 * FICHIER : typeEntreprise/components/TypeCategoryFilterBar.tsx
 *
 * Barre de filtres catégorie pour TypeEntreprisePage — mêmes catégories
 * que celles déjà chargées par useProduitsByType (scopées à ce type
 * d'entreprise, voir GET /company-types/:id/categories), donc pas de
 * fetch séparé ici : simple rendu de chips.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from './TypeCategoryFilterBar.module.css';
import type { TypeCategory } from '../hooks/useProduitsByType';

interface Props {
  categories:      TypeCategory[];
  activeCategoryId?: string;
  onSelect:        (id: string | undefined) => void;
}

export default function TypeCategoryFilterBar({ categories, activeCategoryId, onSelect }: Props) {
  const { t } = useTranslation();

  if (categories.length === 0) return null;

  return (
    <div className={styles.chips}>
      <button
        className={`${styles.chip} ${!activeCategoryId ? styles.chipOn : ''}`}
        onClick={() => onSelect(undefined)}
      >
        {t('typeEntreprisePage.toutesCategories')}
      </button>
      {categories.map(c => (
        <button
          key={c.id}
          className={`${styles.chip} ${activeCategoryId === c.id ? styles.chipOn : ''}`}
          onClick={() => onSelect(c.id)}
        >
          {c.icone ?? '📁'} {c.nom}
        </button>
      ))}
    </div>
  );
}
