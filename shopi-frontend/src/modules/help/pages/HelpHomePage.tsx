/* ============================================================
 * FICHIER : src/modules/help/pages/HelpHomePage.tsx
 *
 * RÔLE    : Page d'accueil du Centre d'aide Shopi.
 *           Accessible publiquement depuis /aide.
 *
 * SECTIONS :
 *   - Hero  : titre + barre de recherche avec suggestions en direct
 *              (debounce 280 ms, navigation clavier ↑↓ Entrée Échap)
 *   - Catégories : grille des catégories disponibles
 *   - Articles populaires : liste des articles les plus consultés
 *   - FAQ  : accordéon groupé par catégorie
 *   - CTA  : bannière de contact
 *
 * DONNÉES :
 *   useHelpHome()  → categories + popular (via /help/categories + /help/popular)
 *   useHelpFaq()   → groupes de FAQ (via /help/faq)
 *   helpApi.search → suggestions temps réel (via /help/search)
 * ============================================================ */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link }  from 'react-router-dom';
import { useHelpHome, useHelpFaq } from '../hooks/useHelp';
import { helpApi } from '../services/help.api';
import type { SearchResult } from '../services/help.api';
import styles from './HelpHomePage.module.css';

const FAQ_LABELS: Record<string, string> = {
  commandes:   'Commandes',
  livraisons:  'Livraisons',
  paiements:   'Paiements',
  compte:      'Compte',
  retours:     'Retours & Remboursements',
  securite:    'Sécurité',
};

export default function HelpHomePage() {
  const navigate = useNavigate();
  const { categories, popular, loading, error } = useHelpHome();
  const { faq } = useHelpFaq();

  const [search, setSearch]         = useState('');
  const [openFaq, setOpenFaq]       = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [sugOpen, setSugOpen]       = useState(false);
  const [sugIdx, setSugIdx]         = useState(-1);
  const [sugLoading, setSugLoading] = useState(false);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  /* Close suggestions on click outside */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSugOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setSugOpen(false); return; }
    setSugLoading(true);
    try {
      const res = await helpApi.search(q.trim(), 1, 5);
      setSuggestions(res.data);
      setSugOpen(res.data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setSugLoading(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    setSugIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!sugOpen || suggestions.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSugIdx(i => (i + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSugIdx(i => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case 'Escape':
        setSugOpen(false);
        break;
      case 'Enter':
        if (sugIdx >= 0) {
          e.preventDefault();
          navigate(`/aide/articles/${suggestions[sugIdx].slug}`);
          setSugOpen(false);
        }
        break;
    }
  };

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSugOpen(false);
    if (search.trim()) navigate(`/aide/recherche?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroWrap}>
          <div className={styles.heroBadge}><i className="fas fa-headset" /> Centre d'aide Shopi</div>
          <h1 className={styles.heroTitle}>Comment pouvons-nous vous aider ?</h1>
          <p className={styles.heroSub}>Trouvez des réponses, des guides et des tutoriels pour tout ce dont vous avez besoin.</p>

          {/* Search with live suggestions */}
          <div ref={searchWrapRef} className={styles.searchWrap}>
            <form className={styles.searchBox} onSubmit={handleSearch}>
              <i className={`fas ${sugLoading ? 'fa-circle-notch fa-spin' : 'fa-magnifying-glass'}`} />
              <input
                ref={inputRef}
                className={styles.searchInput}
                type="text"
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setSugOpen(true)}
                placeholder="Rechercher : commandes, livraisons, paiements…"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={sugOpen}
              />
              <button type="submit" className={styles.searchBtn}>Rechercher</button>
            </form>

            {/* Suggestions dropdown */}
            {sugOpen && suggestions.length > 0 && (
              <div className={styles.suggestions} role="listbox">
                {suggestions.map((s, idx) => (
                  <Link
                    key={s.id}
                    to={`/aide/articles/${s.slug}`}
                    className={`${styles.sugItem} ${idx === sugIdx ? styles.sugActive : ''}`}
                    role="option"
                    aria-selected={idx === sugIdx}
                    onClick={() => setSugOpen(false)}
                  >
                    <div className={styles.sugIcon}><i className="fas fa-file-lines" /></div>
                    <div className={styles.sugBody}>
                      <div className={styles.sugTitle}>{s.title}</div>
                      {s.categoryName && (
                        <div className={styles.sugCat}>
                          <i className="fas fa-folder" /> {s.categoryName}
                        </div>
                      )}
                    </div>
                    <i className="fas fa-arrow-right" style={{ color: '#C5D0E8', fontSize: '11px' }} />
                  </Link>
                ))}
                <div className={styles.sugFooter}>
                  <span>
                    <kbd>↑</kbd><kbd>↓</kbd> naviguer &nbsp;·&nbsp; <kbd>Entrée</kbd> sélectionner &nbsp;·&nbsp; <kbd>Échap</kbd> fermer
                  </span>
                  <Link
                    to={`/aide/recherche?q=${encodeURIComponent(search.trim())}`}
                    className={styles.sugAll}
                    onClick={() => setSugOpen(false)}
                  >
                    Voir tous les résultats <i className="fas fa-chevron-right" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className={styles.heroLinks}>
            <Link to="/aide/categories/commandes">Commandes</Link>
            <Link to="/aide/categories/livraisons">Livraisons</Link>
            <Link to="/aide/categories/paiements">Paiements</Link>
            <Link to="/aide/categories/compte">Mon compte</Link>
            <Link to="/contact">Contacter le support</Link>
          </div>
        </div>
      </section>

      <div className={styles.content}>

        {/* ── Catégories ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Parcourir par catégorie</h2>
          {loading && (
            <div className={styles.loadingRow}>
              {[...Array(6)].map((_, i) => <div key={i} className={styles.catSkeleton} />)}
            </div>
          )}
          {error && <p className={styles.errorMsg}>{error}</p>}
          {!loading && categories.length > 0 && (
            <div className={styles.catGrid}>
              {categories.map(cat => (
                <Link key={cat.id} to={`/aide/categories/${cat.slug}`} className={styles.catCard}>
                  <div className={styles.catIcon}><i className={`fas ${cat.icon}`} /></div>
                  <div className={styles.catName}>{cat.name}</div>
                  {cat.description && <div className={styles.catDesc}>{cat.description}</div>}
                  <div className={styles.catCount}>{cat.articleCount} article{cat.articleCount !== 1 ? 's' : ''}</div>
                </Link>
              ))}
            </div>
          )}
          {!loading && categories.length === 0 && !error && (
            <div className={styles.emptyState}>
              <i className="fas fa-folder-open" />
              <p>Aucune catégorie disponible pour l'instant.</p>
            </div>
          )}
        </section>

        {/* ── Articles populaires ── */}
        {popular.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Articles populaires</h2>
            <div className={styles.artList}>
              {popular.map(art => (
                <Link key={art.id} to={`/aide/articles/${art.slug}`} className={styles.artItem}>
                  <i className="fas fa-file-lines" />
                  <span>{art.title}</span>
                  <span className={styles.artViews}><i className="fas fa-eye" /> {art.viewCount}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        {faq.length > 0 && (
          <section className={styles.section} id="faq">
            <h2 className={styles.sectionTitle}>Questions fréquentes</h2>
            {faq.map(group => (
              <div key={group.slug} className={styles.faqGroup}>
                <h3 className={styles.faqGroupTitle}>
                  {FAQ_LABELS[group.slug] ?? group.slug}
                </h3>
                {group.faqs.map(item => (
                  <div
                    key={item.id}
                    className={`${styles.faqItem} ${openFaq === item.id ? styles.faqOpen : ''}`}
                  >
                    <button
                      className={styles.faqQ}
                      onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)}
                    >
                      {item.question}
                      <i className={`fas fa-chevron-${openFaq === item.id ? 'up' : 'down'}`} />
                    </button>
                    {openFaq === item.id && (
                      <div className={styles.faqA}>{item.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {/* ── CTA Contact ── */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaCard}>
            <div className={styles.ctaIcon}><i className="fas fa-comments" /></div>
            <div>
              <div className={styles.ctaTitle}>Vous n'avez pas trouvé votre réponse ?</div>
              <div className={styles.ctaSub}>Notre équipe de support est disponible pour vous aider.</div>
            </div>
            <Link to="/contact" className={styles.ctaBtn}>Contacter le support</Link>
          </div>
        </section>

      </div>
    </div>
  );
}
