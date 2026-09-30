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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CardProduitBoutique, { type ProduitCarte } from '../components/CardProduitBoutique';
import styles from '../styles/ProduitsSection.module.css';

const PAR_PAGE = 24;

interface Props {
  produits:      ProduitCarte[];   /* produits déjà filtrés/triés depuis le parent */
  filtresActifs: string[];            /* labels des filtres actifs */
  onRemoveFiltreActif: (f: string) => void; /* supprime un filtre */
  onResetFiltres: () => void;         /* remet tous les filtres à zéro */
  onToast: (m: string) => void;
  /* Ouvre le tiroir de filtres — bouton visible uniquement sur mobile,
   * voir styles.mobileFiltresBtn (BoutiqueSidebar reste toujours en
   * colonne visible sur desktop, ce bouton n'y sert à rien). */
  onOpenFiltres?: () => void;
  /** true UNIQUEMENT depuis "Voir ma boutique" du dashboard entreprise —
   *  voir CardProduitBoutique.handleVoir pour la raison (évite de faire
   *  quitter tout le dashboard vers la page produit publique). */
  isOwnerPreview?: boolean;
  /** Fourni UNIQUEMENT en aperçu — voir CardProduitBoutique.onOpenProduct. */
  onOpenProduct?: (id: string) => void;
}

export default function ProduitsSection({
  produits, filtresActifs, onRemoveFiltreActif, onResetFiltres, onToast,
  onOpenFiltres, isOwnerPreview, onOpenProduct,
}: Props) {
  const { t } = useTranslation();

  /* ── Vue grille / liste ── */
  const [vue, setVue] = useState<'grille' | 'liste'>('grille');

  /* ── Pagination RÉELLE ──
   * BUG CORRIGÉ — la pagination était entièrement factice : toujours 5
   * pages fixes quel que soit le nombre réel de produits, et cliquer sur
   * une page ne faisait qu'un toast ("📄 Page 2") sans jamais rien changer
   * à l'écran. `produits` est déjà la liste COMPLÈTE, filtrée et triée
   * (voir BoutiquePage.tsx — le chargement récupère désormais toutes les
   * pages de l'API au lieu de s'arrêter à 50 produits) : on la découpe
   * ici en vraies pages. */
  const [page, setPage] = useState(1);
  /* Revient à la page 1 dès que la liste change (nouveau filtre/tri) —
   * ajusté PENDANT le rendu (pas dans un effet) : React documente ce motif
   * pour "réinitialiser un état quand une prop change" sans l'aller-retour
   * supplémentaire (rendu obsolète puis effet puis re-rendu) qu'un effet
   * imposerait ici. */
  const [produitsRef, setProduitsRef] = useState(produits);
  if (produits !== produitsRef) { setProduitsRef(produits); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(produits.length / PAR_PAGE));
  const pageClamped = Math.min(page, totalPages);
  const produitsPage = produits.slice((pageClamped - 1) * PAR_PAGE, pageClamped * PAR_PAGE);

  /* Au plus 7 numéros affichés, centrés sur la page courante — évite une
   * rangée de 50 boutons si la boutique a beaucoup de produits. */
  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(pageClamped - 3, totalPages - 6));
    return Array.from({ length: 7 }, (_, i) => start + i);
  })();

  return (
    <div>

      {/* ── Chips des filtres actifs ── */}
      {filtresActifs.length > 0 && (
        <div className={styles.activeFilters}>
          <span className={styles.afLabel}>{t('boutiqueDetail.produitsSection.filtresActifs')}</span>
          {filtresActifs.map(f => (
            <span
              key={f}
              className={styles.chip}
              onClick={() => onRemoveFiltreActif(f)}
              title={t('boutiqueDetail.produitsSection.supprimerFiltre')}
            >
              {f} <i className="fas fa-xmark" />
            </span>
          ))}
          {/* Tout effacer */}
          <button className={styles.clearAll} onClick={onResetFiltres}>
            <i className="fas fa-xmark" /> {t('boutiqueDetail.produitsSection.toutEffacer')}
          </button>
        </div>
      )}

      {/* ── Barre résultats + toggle vue ── */}
      <div className={styles.resultsHd}>
        <div className={styles.resultsCnt}>
          <strong>{produits.length}</strong>
          {' '}{t('boutiqueDetail.produitsSection.trouveCount', { count: produits.length })}
        </div>
        {/* Ouvre le tiroir de filtres — mobile uniquement */}
        {onOpenFiltres && (
          <button className={styles.mobileFiltresBtn} onClick={onOpenFiltres}>
            <i className="fas fa-sliders" />
            {t('boutiqueDetail.produitsSection.filtres', 'Filtres')}
            {filtresActifs.length > 0 && <span className={styles.mfBadge}>{filtresActifs.length}</span>}
          </button>
        )}
        <div className={styles.viewBtns}>
          {/* Grille */}
          <button
            className={`${styles.vbtn} ${vue === 'grille' ? styles.vbtnActive : ''}`}
            onClick={() => setVue('grille')}
            title={t('boutiqueDetail.produitsSection.vueGrille')}
          >
            <i className="fas fa-grid-2" />
          </button>
          {/* Liste */}
          <button
            className={`${styles.vbtn} ${vue === 'liste' ? styles.vbtnActive : ''}`}
            onClick={() => setVue('liste')}
            title={t('boutiqueDetail.produitsSection.vueListe')}
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
          <strong>{t('boutiqueDetail.produitsSection.aucunProduit')}</strong>
          <p>{t('boutiqueDetail.produitsSection.essayezModifier')}</p>
          <button className={styles.emptyBtn} onClick={onResetFiltres}>
            <i className="fas fa-rotate-left" /> {t('boutiqueDetail.produitsSection.reinitialiser')}
          </button>
        </div>

      ) : (

        /* Grille de cartes produits — seulement la page courante */
        <div className={`${styles.grid} ${vue === 'liste' ? styles.gridList : ''}`}>
          {produitsPage.map(p => (
            <CardProduitBoutique
              key={p.id}
              p={p}
              isList={vue === 'liste'}
              onToast={onToast}
              isOwnerPreview={isOwnerPreview}
              onOpenProduct={onOpenProduct}
            />
          ))}
        </div>
      )}

      {/* ── Pagination réelle — n'apparaît que s'il y a effectivement plus d'une page ── */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={`${styles.pgBtn} ${pageClamped === 1 ? styles.pgDisabled : ''}`}
            disabled={pageClamped === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <i className="fas fa-chevron-left" />
          </button>
          {pageNumbers.map(n => (
            <button
              key={n}
              className={`${styles.pgBtn} ${n === pageClamped ? styles.pgActive : ''}`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            className={`${styles.pgBtn} ${pageClamped === totalPages ? styles.pgDisabled : ''}`}
            disabled={pageClamped === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}
