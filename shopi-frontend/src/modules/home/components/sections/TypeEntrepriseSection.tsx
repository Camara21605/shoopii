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

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch }   from '../../../../shared/services/apiFetch';
import HScrollSection from '../ui/HScrollSection';
import CatalogueIcon from '../ui/CatalogueIcon';
import styles         from './TypeEntrepriseSection.module.css';
import { typeName } from '../../../../shared/utils/catalogueCase';

interface CompanyTypeApi {
  id:            string;
  slug:          string;
  nom:           string;
  icone:         string | null;
  imageUrl:      string | null;
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

/* La home n'affiche qu'UN bloc (~30 types, défilement horizontal) ; le
 * reste du catalogue est accessible via la carte finale / le lien
 * "Catalogue" qui mènent à /catalogue. */
const HOME_BLOCK_SIZE = 30;

export default function TypeEntrepriseSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [types,   setTypes]   = useState<CompanyTypeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const shown  = useMemo(() => types.slice(0, HOME_BLOCK_SIZE), [types]);
  const hidden = types.length - shown.length;

  useEffect(() => {
    apiFetch<CompanyTypeApi[]>('/company-types', { public: true })
      .then(data => setTypes((data ?? []).filter(t => t.actif)))
      .catch(() => setError(t('home.typeEntreprise.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
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
          types.length === 0 ? (
            <div className={styles.empty}>
              {t('home.typeEntreprise.empty')}
            </div>
          ) : (
            <div className={styles.blocks}>
              <button className={styles.catalogueLink} onClick={() => navigate('/catalogue')}>
                {t('cataloguePage.title')} <i className="fas fa-arrow-right" />
              </button>
              <HScrollSection>
                {shown.map(ct => {
                  const color = ct.couleur ?? DEFAULT_COLOR;
                  const bg    = makeBg(color);
                  return (
                    <div
                      key={ct.id}
                      className={styles.card}
                      onClick={() => navigate(`/types/${ct.id}`)}
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
                        <CatalogueIcon imageUrl={ct.imageUrl} icone={ct.icone} fallback="🏢" />
                      </div>
                      <div className={styles.label}>{typeName(ct.nom)}</div>
                      <div className={styles.count}>
                        {ct.nbEntreprises > 0
                          ? t('home.typeEntreprise.boutiqueCount', { count: ct.nbEntreprises })
                          : ct.nbCategories > 0
                            ? t('home.typeEntreprise.categorieCount', { count: ct.nbCategories })
                            : '—'}
                      </div>
                    </div>
                  );
                })}

                {/* Carte finale : ouvre le catalogue complet */}
                <div
                  className={`${styles.card} ${styles.moreCard}`}
                  onClick={() => navigate('/catalogue')}
                  role="link"
                >
                  <div className={styles.ico}><i className="fas fa-table-cells-large" /></div>
                  <div className={styles.label}>{t('cataloguePage.seeAll')}</div>
                  <div className={styles.count}>{hidden > 0 ? `+${hidden}` : '—'}</div>
                </div>
              </HScrollSection>
            </div>
          )
        )}
      </div>
    </section>
  );
}