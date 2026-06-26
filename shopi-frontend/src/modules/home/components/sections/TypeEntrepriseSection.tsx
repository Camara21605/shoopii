/*
 * FICHIER : src/modules/home/components/sections/TypeEntrepriseSection.tsx
 *
 * CHANGEMENT : les types d'entreprise sont chargés depuis
 *   GET /company-types (public, pas de token requis)
 *   au lieu de TYPES_ENTREPRISE (mock statique).
 *
 * Structure de la réponse API :
 *   { id, slug, nom, icone, couleur, ordre, actif, nbCategories, nbEntreprises }
 *
 * Mapping vers l'UI :
 *   icone  → emoji de la carte
 *   nom    → label
 *   couleur → color (fallback : var(--blue))
 *   nbEntreprises → count (nombre de boutiques)
 */

import React, { useEffect, useState } from 'react';
import { apiFetch }   from '../../../../shared/services/apiFetch';
import SectionHeader  from '../ui/SectionHeader';
import styles         from './TypeEntrepriseSection.module.css';

interface Props {
  onToast: (m: string) => void;
}

interface CompanyTypeApi {
  id:            string;
  slug:          string;
  nom:           string;
  icone:         string | null;
  couleur:       string | null;
  ordre:         number;
  actif:         boolean;
  nbCategories:  number;
  nbEntreprises: number;
}

/* Couleur de fond calculée depuis la couleur principale */
function makeBg(color: string): string {
  // Convertit une couleur hex en fond très léger
  return `color-mix(in srgb, ${color} 10%, transparent)`;
}

/* Fallback si aucune couleur n'est définie */
const DEFAULT_COLOR = 'var(--blue)';

export default function TypeEntrepriseSection({ onToast }: Props) {
  const [types,   setTypes]   = useState<CompanyTypeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CompanyTypeApi[]>('/company-types', { public: true })
      .then(data => setTypes((data ?? []).filter(t => t.actif)))
      .catch(() => setError('Impossible de charger les types d\'entreprise.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
        <SectionHeader
          kick="Types de boutiques"
          title="Toutes les <em>catégories d'entreprises</em>"
          sub="Trouvez l'entreprise qui vous correspond"
          linkText="Toutes les boutiques"
          onLink={() => onToast('🏪 Toutes les boutiques')}
        />

        {/* ── Chargement ── */}
        {loading && (
          <div className={styles.state}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        )}

        {/* ── Erreur ── */}
        {!loading && error && (
          <div className={styles.error}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ── Liste ── */}
        {!loading && !error && (
          <div className={styles.grid}>
            {types.length === 0 ? (
              <div className={styles.empty}>
                Aucun type d'entreprise disponible pour le moment.
              </div>
            ) : types.map(t => {
              const color = t.couleur ?? DEFAULT_COLOR;
              const bg    = makeBg(color);
              return (
                <div
                  key={t.id}
                  className={styles.card}
                  onClick={() => onToast(`${t.icone ?? '🏢'} ${t.nom}`)}
                  style={{
                    '--card-color': color,
                    '--card-bg':    bg,
                  } as React.CSSProperties}
                >
                  <div
                    className={styles.ico}
                    style={{
                      background: bg,
                      border: `1.5px solid color-mix(in srgb, ${color} 20%, transparent)`,
                    }}
                  >
                    {t.icone ?? '🏢'}
                  </div>
                  <div className={styles.label}>{t.nom}</div>
                  <div className={styles.count}>
                    {t.nbEntreprises > 0
                      ? `${t.nbEntreprises.toLocaleString('fr-FR')} boutique${t.nbEntreprises > 1 ? 's' : ''}`
                      : t.nbCategories > 0
                        ? `${t.nbCategories} catégorie${t.nbCategories > 1 ? 's' : ''}`
                        : '—'}
                  </div>
                  <div className={styles.arrow}>
                    <i className="fas fa-arrow-right" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}