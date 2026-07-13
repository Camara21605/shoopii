/* ============================================================
 * FICHIER            : src/modules/help/pages/HelpSearchPage.tsx
 * RÔLE               : Page de recherche plein-texte du Centre d'aide.
 * RESPONSABILITES    : Permettre aux utilisateurs de trouver des articles
 *                      via une barre de recherche avec surlignage des termes,
 *                      pagination, état vide enrichi et chips de suggestions.
 * DEPENDANCES        : useHelpSearch, react-router-dom, HelpSearchPage.module.css
 * AUTEUR             : Shopi03
 * DERNIERE MISE A JOUR: 2026-07-03
 *
 * FONCTIONNALITES :
 *   - Recherche debounced (300ms) synchronisée avec l'URL (?q=...)
 *   - Surlignage des termes dans titre et extrait (highlight())
 *   - Squelettes animés pendant le chargement
 *   - État vide enrichi : conseils + CTA catégories + CTA support
 *   - Chips de recherches populaires à l'état initial
 *   - Pagination précédent / suivant
 * ============================================================ */
import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useHelpSearch } from '../hooks/useHelpSearch';
import styles from './HelpSearchPage.module.css';

/**
 * Surligne les mots du query dans un texte.
 *
 * String.split() avec un groupe capturant inclut les matches
 * dans le tableau aux indices impairs — ce qui permet de les
 * envelopper dans <mark> sans reconstruire le texte manuellement.
 */
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  const words = query.trim().split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return text;

  /* Échapper les caractères spéciaux de regex */
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(re);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className={styles.hl}>{part}</mark>
          : part,
      )}
    </>
  );
}

/** Carte squelette affichée pendant le chargement */
function ResultSkeleton() {
  return (
    <div className={styles.skCard} aria-hidden="true">
      <div className={styles.skIcon} />
      <div className={styles.skBody}>
        <div className={styles.skTitle} />
        <div className={styles.skLine} />
        <div className={styles.skCat} />
      </div>
    </div>
  );
}

/** Termes suggérés à l'état initial (aucune recherche) */
const POPULAR_SEARCHES = [
  'retour produit', 'facturation', 'mon compte', 'livraison', 'remboursement',
];

export default function HelpSearchPage() {
  const [params, setParams] = useSearchParams();
  const {
    query, setQuery,
    results, total, pages, page,
    setPage, loading,
  } = useHelpSearch(params.get('q') ?? '');

  /* Synchronise le hook avec les changements d'URL (navigation arrière) */
  useEffect(() => {
    const q = params.get('q') ?? '';
    if (q !== query) setQuery(q);
  }, [params]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setParams(v ? { q: v } : {});
    setPage(1);
  };

  const clearSearch = () => {
    setQuery('');
    setParams({});
  };

  const jumpTo = (term: string) => {
    setQuery(term);
    setParams({ q: term });
    setPage(1);
  };

  const hasQuery   = query.trim().length >= 2;
  const hasResults = results.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>

        {/* ── Fil d'Ariane ── */}
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link>
          <span>/</span>
          <span>Recherche</span>
        </nav>

        {/* ── Hero + barre de recherche ── */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Que cherchez-vous ?</h1>
          <p className={styles.heroSub}>
            Recherchez dans toute notre base de connaissances.
          </p>

          <div className={styles.searchBox}>
            <i className="fas fa-magnifying-glass" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={handleInput}
              placeholder="Ex. : retour produit, facturation, mon compte…"
              className={styles.searchInput}
              autoFocus
              aria-label="Rechercher dans le centre d'aide"
            />
            {/* Indicateur de chargement inline */}
            {loading && hasQuery && (
              <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
            )}
            {/* Bouton d'effacement */}
            {query && !loading && (
              <button
                className={styles.clearBtn}
                onClick={clearSearch}
                aria-label="Effacer la recherche"
                type="button"
              >
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* ── Compteur de résultats ── */}
        {!loading && hasQuery && (
          <div className={styles.meta}>
            {hasResults ? (
              <>
                <strong>{total}</strong>{' '}
                résultat{total > 1 ? 's' : ''} pour{' '}
                <em>« {query} »</em>
              </>
            ) : (
              <span className={styles.metaNone}>
                Aucun résultat pour <em>« {query} »</em>
              </span>
            )}
          </div>
        )}

        {/* ── Squelettes pendant le chargement ── */}
        {loading && hasQuery && (
          <div className={styles.results}>
            {[1, 2, 3].map(n => <ResultSkeleton key={n} />)}
          </div>
        )}

        {/* ── Liste des résultats ── */}
        {!loading && hasResults && (
          <div className={styles.results}>
            {results.map(r => (
              <Link
                key={r.id}
                to={`/aide/articles/${r.slug}`}
                className={styles.result}
              >
                <div className={styles.resultIcon}>
                  <i className="fas fa-file-lines" aria-hidden="true" />
                </div>
                <div className={styles.resultBody}>
                  <div className={styles.resultTitle}>
                    {highlight(r.title, query)}
                  </div>
                  {r.excerpt && (
                    <div className={styles.resultExcerpt}>
                      {highlight(r.excerpt, query)}
                    </div>
                  )}
                  {r.categoryName && (
                    <div className={styles.resultCat}>
                      <i className="fas fa-folder" aria-hidden="true" />
                      {r.categoryName}
                    </div>
                  )}
                </div>
                <i className={`fas fa-chevron-right ${styles.chevron}`} aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}

        {/* ── État vide enrichi ── */}
        {!loading && hasQuery && !hasResults && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <i className="fas fa-magnifying-glass" aria-hidden="true" />
            </div>
            <h2 className={styles.emptyTitle}>
              Aucun résultat pour <em>« {query} »</em>
            </h2>
            <p className={styles.emptySub}>
              Essayez avec des termes plus généraux, ou explorez nos catégories.
            </p>

            {/* Conseils de recherche */}
            <div className={styles.emptyTips}>
              <div className={styles.emptyTip}>
                <i className="fas fa-spell-check" aria-hidden="true" />
                Vérifiez l'orthographe des mots
              </div>
              <div className={styles.emptyTip}>
                <i className="fas fa-compress-arrows-alt" aria-hidden="true" />
                Utilisez des mots plus courts ou généraux
              </div>
              <div className={styles.emptyTip}>
                <i className="fas fa-rotate" aria-hidden="true" />
                Essayez une formulation différente
              </div>
            </div>

            {/* Boutons d'action */}
            <div className={styles.emptyCtas}>
              <Link to="/aide" className={styles.ctaPrimary}>
                <i className="fas fa-th-large" aria-hidden="true" />
                Parcourir les catégories
              </Link>
              <Link to="/support/nouveau" className={styles.ctaSecondary}>
                <i className="fas fa-headset" aria-hidden="true" />
                Contacter le support
              </Link>
            </div>
          </div>
        )}

        {/* ── État initial : aucune requête ── */}
        {!hasQuery && !loading && (
          <div className={styles.initial}>
            <i className="fas fa-keyboard" aria-hidden="true" />
            <p>Tapez votre recherche pour trouver des articles.</p>
            <div className={styles.chips}>
              <span className={styles.chipsLabel}>Suggestions&nbsp;:</span>
              {POPULAR_SEARCHES.map(term => (
                <button
                  key={term}
                  className={styles.chip}
                  type="button"
                  onClick={() => jumpTo(term)}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {pages > 1 && (
          <div className={styles.pager}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className={styles.pgBtn}
              type="button"
              aria-label="Page précédente"
            >
              <i className="fas fa-chevron-left" aria-hidden="true" />
            </button>
            <span className={styles.pgInfo}>Page {page} / {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage(p => p + 1)}
              className={styles.pgBtn}
              type="button"
              aria-label="Page suivante"
            >
              <i className="fas fa-chevron-right" aria-hidden="true" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
