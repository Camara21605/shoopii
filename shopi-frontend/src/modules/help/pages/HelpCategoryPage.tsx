/* ============================================================
 * FICHIER            : src/modules/help/pages/HelpCategoryPage.tsx
 * RÔLE               : Page d'une catégorie du Centre d'aide.
 * RESPONSABILITES    : Afficher tous les articles d'une catégorie
 *                      en grille 2 colonnes style Stripe Docs.
 *                      Trier par vues décroissantes.
 *                      Proposer un lien vers le support en cas d'échec.
 * DEPENDANCES        : useHelpCategory (hook), react-router-dom,
 *                      HelpCategoryPage.module.css
 * AUTEUR             : Shopi03
 * DERNIERE MISE A JOUR: 2026-07-03
 *
 * FONCTIONNALITES :
 *   - Hero avec icône de catégorie, nom, description, compteur
 *   - Grille responsive 2 colonnes (1 colonne sur mobile)
 *   - Chaque carte : titre, extrait, compteur de vues, chevron
 *   - Article le plus consulté mis en avant (badge "Populaire")
 *   - Squelettes animés pendant le chargement
 *   - État vide + état d'erreur
 * ============================================================ */
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useHelpCategory } from '../hooks/useHelp';
import styles from './HelpCategoryPage.module.css';

/** Formate un compteur de vues de façon compacte (1234 → "1,2k") */
function fmtViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}

/** Squelette d'une carte article pendant le chargement */
function ArticleSkeleton() {
  return (
    <div className={styles.skCard} aria-hidden="true">
      <div className={styles.skTitle} />
      <div className={styles.skLine} />
      <div className={styles.skLine} style={{ width: '65%' }} />
      <div className={styles.skMeta} />
    </div>
  );
}

export default function HelpCategoryPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, loading, error } = useHelpCategory(slug);

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>

        {/* ── Fil d'Ariane ── */}
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link>
          <span>/</span>
          <span>{loading ? '…' : (data?.name ?? slug)}</span>
        </nav>

        {/* ── Chargement : squelettes ── */}
        {loading && (
          <>
            <div className={styles.heroSkeleton}>
              <div className={styles.skHeroIcon} />
              <div className={styles.skHeroBody}>
                <div className={styles.skHeroTitle} />
                <div className={styles.skHeroLine} />
              </div>
            </div>
            <div className={styles.grid}>
              {[1, 2, 3, 4].map(n => <ArticleSkeleton key={n} />)}
            </div>
          </>
        )}

        {/* ── Erreur ── */}
        {!loading && error && (
          <div className={styles.errorWrap}>
            <div className={styles.errorIcon}>
              <i className="fas fa-circle-exclamation" aria-hidden="true" />
            </div>
            <h2 className={styles.errorTitle}>Catégorie introuvable</h2>
            <p className={styles.errorSub}>{error}</p>
            <Link to="/aide" className={styles.backBtn}>
              <i className="fas fa-arrow-left" aria-hidden="true" />
              Retour au centre d'aide
            </Link>
          </div>
        )}

        {/* ── Contenu ── */}
        {!loading && data && (
          <>
            {/* Hero de catégorie */}
            <header className={styles.hero}>
              <div className={styles.heroIcon}>
                <i className={`fas ${data.icon ?? 'fa-folder'}`} aria-hidden="true" />
              </div>
              <div className={styles.heroBody}>
                <h1 className={styles.heroTitle}>{data.name}</h1>
                {data.description && (
                  <p className={styles.heroDesc}>{data.description}</p>
                )}
                <div className={styles.heroBadges}>
                  <span className={styles.countBadge}>
                    <i className="fas fa-file-lines" aria-hidden="true" />
                    {data.articleCount} article{data.articleCount !== 1 ? 's' : ''}
                  </span>
                  <Link to="/aide/recherche" className={styles.searchBadge}>
                    <i className="fas fa-magnifying-glass" aria-hidden="true" />
                    Rechercher dans cette catégorie
                  </Link>
                </div>
              </div>
            </header>

            {/* ── Grille d'articles ── */}
            {data.articles.length === 0 ? (
              <div className={styles.empty}>
                <i className="fas fa-file-circle-xmark" aria-hidden="true" />
                <h3>Aucun article pour l'instant</h3>
                <p>Des articles seront publiés prochainement.</p>
                <Link to="/aide" className={styles.backBtn}>
                  <i className="fas fa-arrow-left" aria-hidden="true" />
                  Retour au centre d'aide
                </Link>
              </div>
            ) : (
              <>
                {/* Article le plus consulté en vedette */}
                {data.articles.length > 0 && (() => {
                  const top = [...data.articles].sort((a, b) => b.viewCount - a.viewCount)[0];
                  return (
                    <Link
                      to={`/aide/articles/${top.slug}`}
                      className={styles.featured}
                    >
                      <div className={styles.featuredLabel}>
                        <i className="fas fa-fire" aria-hidden="true" /> Populaire
                      </div>
                      <div className={styles.featuredBody}>
                        <div className={styles.featuredTitle}>{top.title}</div>
                        {top.excerpt && (
                          <div className={styles.featuredExcerpt}>{top.excerpt}</div>
                        )}
                        <div className={styles.featuredMeta}>
                          <span>
                            <i className="fas fa-eye" aria-hidden="true" />
                            {top.viewCount.toLocaleString('fr-FR')} vues
                          </span>
                          <span className={styles.featuredCta}>
                            Lire l'article
                            <i className="fas fa-arrow-right" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })()}

                {/* Grille des autres articles */}
                <div className={styles.grid}>
                  {[...data.articles]
                    .sort((a, b) => b.viewCount - a.viewCount)
                    .map(art => (
                      <Link
                        key={art.id}
                        to={`/aide/articles/${art.slug}`}
                        className={styles.card}
                      >
                        <div className={styles.cardIcon}>
                          <i className="fas fa-file-lines" aria-hidden="true" />
                        </div>
                        <div className={styles.cardBody}>
                          <div className={styles.cardTitle}>{art.title}</div>
                          {art.excerpt && (
                            <div className={styles.cardExcerpt}>{art.excerpt}</div>
                          )}
                        </div>
                        <div className={styles.cardFooter}>
                          <span className={styles.cardViews}>
                            <i className="fas fa-eye" aria-hidden="true" />
                            {fmtViews(art.viewCount)}
                          </span>
                          <i
                            className={`fas fa-chevron-right ${styles.cardChevron}`}
                            aria-hidden="true"
                          />
                        </div>
                      </Link>
                    ))}
                </div>
              </>
            )}

            {/* ── Pied de page ── */}
            <div className={styles.footer}>
              <Link to="/aide" className={styles.backBtn}>
                <i className="fas fa-arrow-left" aria-hidden="true" />
                Retour au centre d'aide
              </Link>
              <div className={styles.footerContact}>
                <span>Vous n'avez pas trouvé ce que vous cherchiez ?</span>
                <Link to="/support/nouveau" className={styles.contactBtn}>
                  <i className="fas fa-headset" aria-hidden="true" />
                  Contacter le support
                </Link>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
