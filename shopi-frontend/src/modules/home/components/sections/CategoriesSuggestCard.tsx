/*
 * FICHIER : src/modules/home/components/sections/CategoriesSuggestCard.tsx
 *
 * Carte « Vous cherchez peut-être » glissée DANS la grille produits de
 * l'accueil (voir RandomBloc) : les catégories sont mélangées aux produits
 * au lieu d'avoir leur propre rangée. Chaque ligne = une catégorie, avec une
 * vignette ronde (image de la catégorie, sinon celle d'un produit de cette
 * catégorie) ; le clic ouvre la catégorie.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CatalogueIcon from '../ui/CatalogueIcon';
import { categoryName } from '../../../../shared/utils/catalogueCase';
import type { CategoryApi } from './CategoriesSection';
import styles from './CategoriesSuggestCard.module.css';

export interface SuggestedCategory {
  category: CategoryApi;
  /** Image d'un produit de la catégorie (repli si la catégorie n'a pas d'image). */
  productImage?: string;
}

export default function CategoriesSuggestCard({ items }: { items: SuggestedCategory[] }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <div className={styles.card}>
      <div className={styles.title}>{t('home.categories.suggestTitle')}</div>
      <div className={styles.list}>
        {items.map(({ category: c, productImage }) => (
          <button
            key={c.id}
            type="button"
            className={styles.pill}
            onClick={() => navigate(`/boutiques?category=${c.id}`)}
          >
            <span className={styles.thumb}>
              <CatalogueIcon imageUrl={c.imageUrl ?? productImage} icone={c.icone} fallback="" />
            </span>
            <span className={styles.name}>{categoryName(c.nom)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
