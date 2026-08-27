/*
 * FICHIER : src/modules/home/components/sections/CategoriesSection.tsx
 *
 * CHANGEMENT : les catégories sont chargées depuis
 *   GET /categories (public, pas de token requis)
 *   au lieu de CATEGORIES (mock statique).
 *
 * Structure de la réponse API :
 *   { id, nom, icone, slug, ordre, actif, subCategories }
 *
 * La carte "Tout" est ajoutée en tête de liste côté frontend.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch }  from '../../../../shared/services/apiFetch';
import styles        from './CategoriesSection.module.css';

interface CategoryApi {
  id:            string;
  nom:           string;
  icone:         string | null;
  slug:          string;
  ordre:         number;
  actif:         boolean;
  subCategories: { id: string; nom: string }[];
}

/* Carte "Tout" toujours présente en premier */
const CAT_TOUT_ID = 'tout';
const CAT_TOUT_ICONE = '✦';

export default function CategoriesSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [active,  setActive]  = useState(CAT_TOUT_ID);
  const [cats,    setCats]    = useState<CategoryApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CategoryApi[]>('/categories', { public: true })
      .then(data => setCats((data ?? []).filter(c => c.actif)))
      .catch(() => setError(t('home.categories.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  const handleClickTout = () => {
    setActive(CAT_TOUT_ID);
    navigate('/boutiques');
  };

  const handleClickCategory = (c: CategoryApi) => {
    setActive(c.nom);
    navigate(`/boutiques?category=${c.id}`);
  };

  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
        {/* ── Skeleton ── */}
        {loading && (
          <div className={styles.cats}>
            {[...Array(10)].map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        )}

        {/* ── Erreur ── */}
        {!loading && error && (
          <div className={styles.error}>⚠️ {error}</div>
        )}

        {/* ── Liste ── */}
        {!loading && !error && (
          <div className={styles.cats}>

            {/* Carte "Tout" toujours en premier */}
            <div
              className={`${styles.cat} ${active === CAT_TOUT_ID ? styles.catOn : ''}`}
              onClick={handleClickTout}
            >
              <div className={styles.catEm}>{CAT_TOUT_ICONE}</div>
              <div className={styles.catNm}>{t('home.categories.tout')}</div>
              <div className={styles.catCt}>25 000+</div>
            </div>

            {/* Catégories depuis l'API */}
            {cats.map(c => (
              <div
                key={c.id}
                className={`${styles.cat} ${active === c.nom ? styles.catOn : ''}`}
                onClick={() => handleClickCategory(c)}
              >
                <div className={styles.catEm}>{c.icone ?? '📁'}</div>
                <div className={styles.catNm}>{c.nom}</div>
                <div className={styles.catCt}>
                  {c.subCategories?.length > 0
                    ? t('home.categories.sousCat', { count: c.subCategories.length })
                    : '—'}
                </div>
              </div>
            ))}

          </div>
        )}
      </div>
    </section>
  );
}