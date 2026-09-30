/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/ServicesSection.tsx
 *
 * RÔLE    : Onglet "Services" — grille des prestations d'une boutique dont
 *           le modèle économique est "services" (voir Company.businessModel).
 *           Remplace l'onglet "Produits" pour ce type de boutique — jamais
 *           les deux en même temps (une entreprise vend soit des produits,
 *           soit propose des services, choisi une fois à l'inscription).
 *
 * AVANT CET ÉCRAN : une boutique de services n'avait tout simplement AUCUN
 * moyen d'afficher ce qu'elle propose sur sa fiche publique — l'onglet
 * "Produits" restait vide indéfiniment (elle n'a aucune ligne Product,
 * seulement des Service), sans le moindre onglet "Services" pour les
 * afficher, alors que /public/boutiques/:id/services existe déjà côté API.
 *
 * Réutilise CardService (modules/home/cards/CardService.tsx), déjà réel
 * (favori persisté, CTA "Demander un devis") et déjà utilisé ailleurs
 * (TypeEntreprisePage.tsx) — pas de nouvelle carte créée ici. Volontairement
 * plus simple que ProduitsSection (pas de filtres catégorie/prix/stock : ces
 * notions n'ont pas de sens pour un service, voir service.entity.ts).
 * ============================================================
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CardService, { type ServiceApi } from '../../../cards/CardService';
import styles from '../styles/ProduitsSection.module.css';

const PAR_PAGE = 24;

interface Props {
  services: ServiceApi[];
  onToast:  (m: string) => void;
}

export default function ServicesSection({ services, onToast }: Props) {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  /* Revient à la page 1 quand la liste change — ajusté pendant le rendu,
   * voir le même motif documenté dans ProduitsSection.tsx. */
  const [servicesRef, setServicesRef] = useState(services);
  if (services !== servicesRef) { setServicesRef(services); setPage(1); }
  const totalPages = Math.max(1, Math.ceil(services.length / PAR_PAGE));
  const pageClamped = Math.min(page, totalPages);
  const servicesPage = services.slice((pageClamped - 1) * PAR_PAGE, pageClamped * PAR_PAGE);

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(pageClamped - 3, totalPages - 6));
    return Array.from({ length: 7 }, (_, i) => start + i);
  })();

  return (
    <div>
      <div className={styles.resultsHd}>
        <div className={styles.resultsCnt}>
          <strong>{services.length}</strong>{' '}
          {t('boutiqueDetail.servicesSection.trouveCount', { count: services.length })}
        </div>
      </div>

      {services.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIco}>🛠️</span>
          <strong>{t('boutiqueDetail.servicesSection.aucunService')}</strong>
          <p>{t('boutiqueDetail.servicesSection.aucunServiceDesc')}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {servicesPage.map(s => (
            <CardService key={s.id} s={s} onToast={onToast} />
          ))}
        </div>
      )}

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
