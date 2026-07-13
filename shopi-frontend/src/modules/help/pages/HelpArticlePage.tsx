/* ============================================================
 * FICHIER : src/modules/help/pages/HelpArticlePage.tsx
 *
 * RÔLE    : Affichage d'un article du Centre d'aide.
 *           Route : /aide/articles/:slug
 *
 * FONCTIONNALITÉS :
 *   - Rendu Markdown de `article.content` via <MarkdownRenderer>
 *     (titres, gras, italique, code, listes, blockquotes, liens)
 *   - Table des matières auto-générée à partir des H2/H3 du contenu
 *     (visible uniquement si ≥ 2 titres détectés)
 *   - Mise en surbrillance du titre actif au scroll (IntersectionObserver)
 *   - Formulaire de feedback (utile / pas utile) → /help/articles/:slug/feedback
 *   - Mise en page 2 colonnes sur desktop (article + sidebar sticky)
 *
 * DONNÉES :
 *   useHelpArticle(slug) → article complet + submitFeedback
 * ============================================================ */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useHelpArticle }  from '../hooks/useHelp';
import MarkdownRenderer, { extractToc } from '../components/MarkdownRenderer';
import styles from './HelpArticlePage.module.css';

export default function HelpArticlePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { article, loading, error, feedback, submitFeedback } = useHelpArticle(slug);

  const [activeSection, setActiveSection] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  /* Track active heading on scroll for ToC highlighting */
  useEffect(() => {
    if (!contentRef.current) return;
    const headings = Array.from(contentRef.current.querySelectorAll('h2, h3'));
    if (headings.length === 0) return;
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries.find(e => e.isIntersecting);
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-20px 0px -60% 0px', threshold: 0 },
    );
    headings.forEach(h => obs.observe(h));
    return () => obs.disconnect();
  }, [article]);

  if (loading) return (
    <div className={styles.loadingWrap}>
      <div className={styles.skTitle} />
      <div className={styles.skLine} /><div className={styles.skLine} />
      <div className={styles.skLine} style={{ width: '70%' }} />
    </div>
  );

  if (error || !article) return (
    <div className={styles.errorWrap}>
      <i className="fas fa-circle-exclamation" />
      <h2>Article introuvable</h2>
      <p>{error ?? "Cet article n'existe pas ou a été archivé."}</p>
      <Link to="/aide" className={styles.backBtn}><i className="fas fa-arrow-left" /> Retour au centre d'aide</Link>
    </div>
  );

  const toc = article.content ? extractToc(article.content) : [];

  return (
    <div className={styles.page}>
      <div className={styles.outer}>

        {/* ── Breadcrumb ── */}
        <nav className={styles.breadcrumb}>
          <Link to="/aide">Centre d'aide</Link>
          {article.category && (
            <><span>/</span><Link to={`/aide/categories/${article.category.slug}`}>{article.category.name}</Link></>
          )}
          <span>/</span>
          <span className={styles.breadCurrent}>{article.title}</span>
        </nav>

        <div className={styles.layout}>

          {/* ── Main article column ── */}
          <main className={styles.main}>

            <article className={styles.article}>
              <header className={styles.articleHead}>
                {article.category && (
                  <Link to={`/aide/categories/${article.category.slug}`} className={styles.catBadge}>
                    <i className={`fas ${article.category.icon ?? 'fa-folder'}`} />
                    {article.category.name}
                  </Link>
                )}
                <h1 className={styles.articleTitle}>{article.title}</h1>
                <div className={styles.articleMeta}>
                  {article.publishedAt && (
                    <span><i className="fas fa-calendar" /> {new Date(article.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  )}
                  <span><i className="fas fa-eye" /> {article.viewCount.toLocaleString('fr-FR')} vue{article.viewCount !== 1 ? 's' : ''}</span>
                  {article.helpfulCount !== undefined && article.helpfulCount > 0 && (
                    <span><i className="fas fa-thumbs-up" /> {article.helpfulCount} utile{article.helpfulCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </header>

              {article.excerpt && (
                <div className={styles.excerpt}>{article.excerpt}</div>
              )}

              <div ref={contentRef}>
                {article.content ? (
                  <MarkdownRenderer
                    content={article.content}
                    className={styles.articleContent}
                  />
                ) : (
                  <p className={styles.articleContent} style={{ color: '#9AAACB', fontStyle: 'italic' }}>
                    Contenu non disponible.
                  </p>
                )}
              </div>
            </article>

            {/* ── Feedback ── */}
            <div className={styles.feedback}>
              <p className={styles.feedbackQ}>Cet article vous a-t-il aidé ?</p>
              {feedback ? (
                <div className={styles.feedbackThanks}>
                  <i className="fas fa-circle-check" />
                  {feedback === 'helpful'
                    ? 'Merci pour votre retour positif !'
                    : 'Merci ! Nous allons améliorer cet article.'}
                </div>
              ) : (
                <div className={styles.feedbackBtns}>
                  <button className={`${styles.fbBtn} ${styles.fbYes}`} onClick={() => submitFeedback(true)}>
                    <i className="fas fa-thumbs-up" /> Oui, ça m'aide
                  </button>
                  <button className={`${styles.fbBtn} ${styles.fbNo}`} onClick={() => submitFeedback(false)}>
                    <i className="fas fa-thumbs-down" /> Non, pas vraiment
                  </button>
                </div>
              )}
            </div>

            {/* ── Bottom navigation ── */}
            <div className={styles.navRow}>
              <Link to="/aide" className={styles.backBtn}>
                <i className="fas fa-arrow-left" /> Retour au centre d'aide
              </Link>
              <Link to="/contact" className={styles.contactBtn}>
                <i className="fas fa-headset" /> Contacter le support
              </Link>
            </div>

          </main>

          {/* ── Sidebar ── */}
          <aside className={styles.sidebar}>

            {/* Table of Contents */}
            {toc.length >= 2 && (
              <div className={styles.tocCard}>
                <div className={styles.tocTitle}>
                  <i className="fas fa-list-ul" /> Table des matières
                </div>
                <nav className={styles.tocNav}>
                  {toc.map(entry => (
                    <a
                      key={entry.id}
                      href={`#${entry.id}`}
                      className={`${styles.tocLink} ${entry.level === 3 ? styles.tocSub : ''} ${activeSection === entry.id ? styles.tocActive : ''}`}
                    >
                      {entry.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* CTA Contact */}
            <div className={styles.sideContact}>
              <div className={styles.sideContactIcon}><i className="fas fa-comments" /></div>
              <div className={styles.sideContactTitle}>Besoin d'aide ?</div>
              <div className={styles.sideContactSub}>Notre équipe répond dans les 24h ouvrées.</div>
              <Link to="/support/nouveau" className={styles.sideContactBtn}>
                <i className="fas fa-ticket" /> Ouvrir un ticket
              </Link>
              <Link to="/contact" className={styles.sideContactSecondary}>
                Formulaire de contact
              </Link>
            </div>

            {/* Meta info */}
            <div className={styles.sideMeta}>
              <div className={styles.sideMetaRow}>
                <i className="fas fa-shield-halved" />
                <span>Contenu vérifié par l'équipe Shopi</span>
              </div>
              {article.publishedAt && (
                <div className={styles.sideMetaRow}>
                  <i className="fas fa-calendar-check" />
                  <span>Mis à jour le {new Date(article.publishedAt).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
