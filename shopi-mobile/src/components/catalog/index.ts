/**
 * Éléments visuels du catalogue — point d'entrée public (`@/components/catalog`).
 * Même organisation que l'accueil mobile du site : titres de section, tuiles
 * type / catégorie, carte boutique, carte produit, états (erreur / vide).
 */
export { ProductCard } from './product-card';
export { SectionHeader } from './section-header';
export { ShopCard } from './shop-card';
export { ErrorState, SectionState } from './states';
export { capitalize, initials } from './text';
export { CategoryCard, TypeCard } from './tiles';
