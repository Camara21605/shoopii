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
import { apiFetch }  from '../../../../shared/services/apiFetch';
import SectionHeader from '../ui/SectionHeader';
import styles        from './CategoriesSection.module.css';

interface Props {
  onToast: (m: string) => void;
}

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
const CAT_TOUT = { id: 'tout', nom: 'Tout', icone: '✦', count: null };

export default function CategoriesSection({ onToast }: Props) {
  const [active,  setActive]  = useState('Tout');
  const [cats,    setCats]    = useState<CategoryApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CategoryApi[]>('/categories', { public: true })
      .then(data => setCats((data ?? []).filter(c => c.actif)))
      .catch(() => setError('Impossible de charger les catégories.'))
      .finally(() => setLoading(false));
  }, []);

  const handleClick = (nom: string) => {
    setActive(nom);
    onToast(`📂 ${nom}`);
  };

  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
        <SectionHeader
          kick="Explorer"
          title="Catégories <em>populaires</em>"
          sub="Naviguez dans nos univers produits"
          linkText="Tout parcourir"
          onLink={() => onToast('📂 Toutes les catégories')}
        />

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
              className={`${styles.cat} ${active === CAT_TOUT.nom ? styles.catOn : ''}`}
              onClick={() => handleClick(CAT_TOUT.nom)}
            >
              <div className={styles.catEm}>{CAT_TOUT.icone}</div>
              <div className={styles.catNm}>{CAT_TOUT.nom}</div>
              <div className={styles.catCt}>25 000+</div>
            </div>

            {/* Catégories depuis l'API */}
            {cats.map(c => (
              <div
                key={c.id}
                className={`${styles.cat} ${active === c.nom ? styles.catOn : ''}`}
                onClick={() => handleClick(c.nom)}
              >
                <div className={styles.catEm}>{c.icone ?? '📁'}</div>
                <div className={styles.catNm}>{c.nom}</div>
                <div className={styles.catCt}>
                  {c.subCategories?.length > 0
                    ? `${c.subCategories.length} sous-cat${c.subCategories.length > 1 ? 's' : ''}`
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