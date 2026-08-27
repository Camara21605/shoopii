/* ================================================================
 * src/modules/home/components/layout/Header.tsx
 *
 * FIX :
 *   ✅ Badge panier → useCart().count (temps réel)
 *   ✅ Bouton 📍 mobile → navigate('/mes-adresses') via clientAction (remplace l'ancien bouton Paramètres)
 *   ✅ Bouton 📍 desktop → navigate('/mes-adresses') via clientAction (remplace l'ancien bouton Centre d'aide)
 *   ✅ Badge notifications → API à connecter (mock conservé pour l'instant)
 *   ✅ Bottom nav mobile → état actif sur /livreurs, /correspondants, /boutiques
 *   ✅ Menu avatar "Mon profil" → /mon-profil (page profil client)
 * ================================================================ */

import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useNavigate, useLocation }           from 'react-router-dom';
import { useTranslation }                     from 'react-i18next';
import styles                                 from './Header.module.css';
import { tokenStorage, apiFetch }             from '../../../../shared/services/apiFetch';
import { getRoleFromToken, getDashboardPath } from '../../../../shared/services/authUtils';
import { useCart }                            from '../../../../shared/context/CartContext';
import { useGlobalCall }                      from '../../../../shared/context/GlobalCallContext';
import { settingsApi }                        from '../settings/api/settings.api';
import { NotificationProvider }               from '../../../../shared/notifications/NotificationContext';
import NotificationToastStack                 from '../../../../shared/notifications/NotificationToastStack';
import NotificationCenter                     from '../../../../shared/notifications/NotificationCenter';
import { useAuthGate }                        from '../../../../shared/hooks/useAuthGate';
import { useForceDarkTheme }                  from '../../../../shared/context/ThemeContext';
import WalletQuickBar                         from '../../../../shared/components/portefeuille/WalletQuickBar';
import AccountSwitchLink                      from '../../../../shared/components/AccountSwitchLink';

type NavKey = 'explorer' | 'boutiques' | 'livreurs' | 'relais' | 'offres';

/** Délai de debounce avant d'interroger le backend pour les suggestions
 *  live de la recherche générale — évite un appel API par frappe. */
const SEARCH_DEBOUNCE_MS = 300;

interface HeaderProps {
  onToast:    (msg: string) => void;
  onLogin:    () => void;
  onRegister: () => void;
}

export default function Header({ onLogin, onRegister }: HeaderProps) {
  // ✅ Le site public (pages "home" côté client) n'a plus de mode clair :
  // Header étant rendu par la quasi-totalité de ces pages (accueil,
  // boutique, produit, panier, paramètres, livreurs, correspondants…),
  // forcer le thème sombre ici suffit à couvrir toutes ces pages d'un
  // seul coup, sans avoir à répéter ce hook page par page.
  useForceDarkTheme();
  const { t } = useTranslation();

  const [scrolled,     setScrolled]     = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [searchFocus,  setSearchFocus]  = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [avatarOpen,   setAvatarOpen]   = useState(false);
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null);
  const [activeNav,    setActiveNav]    = useState<NavKey | null>(null);
  const avatarRefDesktop = useRef<HTMLDivElement>(null);
  const avatarRefMobile  = useRef<HTMLDivElement>(null);

  /* ✅ Recherche générale — cherche réellement sur la plateforme, au lieu
   * de suggestions décoratives : "Tout"/"Produits" → Explorer (recherche
   * produits déjà fonctionnelle), "Boutiques" → /boutiques?search=,
   * "Livreurs" → /livreurs avec state.search (cette page filtre déjà
   * côté client mais n'a pas d'entrée URL — voir useLivreurs.ts). */
  type SearchScope = 'tout' | 'produits' | 'boutiques' | 'livreurs';
  interface LiveSuggestion { id: string; label: string; sublabel?: string; image?: string | null; action: () => void }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('tout');
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [scopeActiveIndex, setScopeActiveIndex] = useState(0);
  const [suggActiveIndex, setSuggActiveIndex] = useState(-1);
  const [liveSuggestions, setLiveSuggestions] = useState<LiveSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const suggestSeqRef = useRef(0);

  const navigate = useNavigate();
  const location = useLocation();

  /* ✅ Badge panier depuis le contexte global */
  const { count: cartCount } = useCart();

  /* ✅ Badge messages non lus — temps réel via GlobalCallContext */
  const { msgUnread } = useGlobalCall();

  const role        = getRoleFromToken();
  const isLoggedIn  = !!role;
  const isClient    = role === 'client';
  const isNonClient = isLoggedIn && !isClient;
  const isAnonymous = !isLoggedIn;
  const canMessage  = isLoggedIn && ['client', 'company', 'delivery', 'correspondent'].includes(role ?? '');
  const isHome      = location.pathname === '/home';
  const inDashboard = location.pathname.startsWith('/dashboard');

  /* ✅ États actifs du bottom nav pour chaque page publique */
  const isLivreurs       = location.pathname === '/livreurs';
  const isCorrespondants = location.pathname === '/correspondants';
  const isBoutiques      = location.pathname === '/boutiques';
  const isMessagerie     = location.pathname === '/messagerie';
  const isCommande       = location.pathname.startsWith('/commande');
  const isAdresses       = location.pathname === '/mes-adresses';

  const userInitial = (() => {
    try {
      const token = tokenStorage.get();
      if (!token) return '';
      const p = JSON.parse(atob(token.split('.')[1]));
      return (p.firstName?.[0] ?? p.email?.[0] ?? 'U').toUpperCase();
    } catch { return 'U'; }
  })();

  const { openAuthModal, authModal } = useAuthGate();

  function clientAction(action: () => void) {
    if (isClient) { action(); return; }
    openAuthModal();
  }

  /* "Se connecter" navigue directement vers /login — l'étape intermédiaire
   * de confirmation (modal "Before you log in") a été retirée : elle
   * provoquait un blocage de navigation non résolu sur une reconnexion
   * après déconnexion, sans cause identifiable malgré investigation. */
  function handleLoginClick() {
    onLogin();
  }

  const SEARCH_SCOPES: { key: SearchScope; label: string }[] = [
    { key: 'tout',      label: t('publicHeader.searchScopes.tout')      },
    { key: 'produits',  label: t('publicHeader.searchScopes.produits')  },
    { key: 'boutiques', label: t('publicHeader.searchScopes.boutiques') },
    { key: 'livreurs',  label: t('publicHeader.searchScopes.livreurs')  },
  ];

  /* "Correspondants" n'a aucune recherche implémentée côté backend/UI
   * (page sans query param ni filtre) — plutôt que de le laisser
   * silencieusement absent, on l'affiche désactivé avec une infobulle
   * pour que sa présence future reste visible, sans construire la
   * fonctionnalité (hors périmètre de cette itération). */
  const CORRESPONDANTS_SOON = {
    label:   t('publicHeader.searchScopes.correspondants'),
    tooltip: t('publicHeader.searchScopeCorrespondantsSoon'),
  };

  const SEARCH_SUGGESTIONS = [
    { icon: 'fa-arrow-trend-up', text: t('publicHeader.searchSuggestions.tendances'),           action: () => navigate('/explorer') },
    { icon: 'fa-mobile-screen',  text: t('publicHeader.searchSuggestions.smartphones'),         action: () => navigate('/explorer?q=smartphone') },
    { icon: 'fa-store',          text: t('publicHeader.searchSuggestions.boutiquesPopulaires'), action: () => navigate('/boutiques') },
    { icon: 'fa-motorcycle',     text: t('publicHeader.searchSuggestions.livreursDispo'),       action: () => navigate('/livreurs') },
    { icon: 'fa-tag',            text: t('publicHeader.searchSuggestions.offresDuJour'),        action: () => navigate('/offres') },
  ];

  /* Suggestions live : dès que l'utilisateur tape (2 caractères mini),
   * interroge le vrai backend de recherche du scope actif et propose
   * les résultats directement cliquables — plus une entrée "Voir tous
   * les résultats" en fin de liste. Debounce 300ms pour ne pas spammer
   * l'API à chaque frappe ; un compteur de séquence ignore les réponses
   * d'une requête devenue obsolète (arrivée après une plus récente). */
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setLiveSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    const seq = ++suggestSeqRef.current;
    setSuggestLoading(true);

    const timer = setTimeout(() => {
      const finish = (items: LiveSuggestion[]) => {
        if (seq !== suggestSeqRef.current) return; // réponse obsolète
        setLiveSuggestions(items);
        setSuggestLoading(false);
        setSuggActiveIndex(-1);
      };

      if (searchScope === 'boutiques') {
        apiFetch<{ data: any[] }>(`/public/boutiques?search=${encodeURIComponent(q)}&limit=5`)
          .then(res => finish((res?.data ?? []).map(c => ({
            id: c.id, label: c.companyName, sublabel: c.ville || undefined, image: c.logo ?? null,
            action: () => { navigate(`/boutique/${c.id}`); setSearchFocus(false); },
          }))))
          .catch(() => finish([]));
      } else if (searchScope === 'livreurs') {
        apiFetch<{ data: any[] }>(`/suivis/livreurs?search=${encodeURIComponent(q)}&limit=5`)
          .then(res => finish((res?.data ?? []).map(l => ({
            id: l.id, label: l.fullName, sublabel: l.zone || undefined, image: l.profilePicture ?? null,
            action: () => { navigate(`/livreurs/${l.id}`); setSearchFocus(false); },
          }))))
          .catch(() => finish([]));
      } else {
        /* "tout" et "produits" — catalogue Explorer */
        apiFetch<{ data: any[] }>(`/public/explore?search=${encodeURIComponent(q)}&limit=5`)
          .then(res => finish((res?.data ?? []).map(p => ({
            id: p.id, label: p.nom,
            sublabel: p.prix != null ? `${Number(p.prix).toLocaleString('fr')} GNF` : undefined,
            image: p.images?.[0]?.url ?? null,
            action: () => { navigate(`/produit/${p.id}`); setSearchFocus(false); },
          }))))
          .catch(() => finish([]));
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, searchScope]);

  function handleSearchSubmit() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchFocus(false);
    setMobileSearch(false);
    setSuggActiveIndex(-1);
    if (searchScope === 'boutiques') {
      navigate(`/boutiques?search=${encodeURIComponent(q)}`);
    } else if (searchScope === 'livreurs') {
      navigate('/livreurs', { state: { search: q } });
    } else {
      /* "Tout" et "Produits" — Explorer couvre déjà la recherche produits
       * en temps réel via ?q=, le catalogue le plus large de la plateforme. */
      navigate(`/explorer?q=${encodeURIComponent(q)}`);
    }
  }

  /* Liste unifiée affichée sous le champ : suggestions statiques (champ
   * vide) OU résultats live du scope actif + une entrée finale "Voir
   * tous les résultats" — la navigation clavier (flèches/Entrée) opère
   * sur cette même liste quel que soit son contenu. */
  const hasQuery = searchQuery.trim().length > 0;
  const activeList: { icon?: string; image?: string | null; label: string; sublabel?: string; action: () => void }[] =
    hasQuery
      ? [
          ...liveSuggestions,
          {
            icon: 'fa-magnifying-glass',
            label: t('publicHeader.searchSeeAllResults', { query: searchQuery.trim() }),
            action: handleSearchSubmit,
          },
        ]
      : SEARCH_SUGGESTIONS.map(s => ({ icon: s.icon, label: s.text, action: s.action }));

  /* Navigation clavier dans le champ : gère à la fois la soumission
   * classique et le déplacement dans la liste ci-dessus, Échap referme
   * sans naviguer. */
  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const showSuggestions = searchFocus && activeList.length > 0;

    if (showSuggestions && e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggActiveIndex(i => (i + 1) % activeList.length);
      return;
    }
    if (showSuggestions && e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggActiveIndex(i => (i - 1 + activeList.length) % activeList.length);
      return;
    }
    if (e.key === 'Escape') {
      setSearchFocus(false);
      setSuggActiveIndex(-1);
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Enter') {
      if (showSuggestions && suggActiveIndex >= 0 && suggActiveIndex < activeList.length) {
        activeList[suggActiveIndex].action();
        setSearchFocus(false);
        setSuggActiveIndex(-1);
      } else {
        handleSearchSubmit();
      }
    }
  }

  /* Navigation clavier dans le menu déroulant Tout/Produits/Boutiques/
   * Livreurs, ouvert via le bouton .srchCat (pas un <select> natif). */
  function handleScopeKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!scopeMenuOpen) {
        setScopeMenuOpen(true);
        setScopeActiveIndex(SEARCH_SCOPES.findIndex(s => s.key === searchScope));
        return;
      }
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      setScopeActiveIndex(i => (i + dir + SEARCH_SCOPES.length) % SEARCH_SCOPES.length);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (scopeMenuOpen) {
        setSearchScope(SEARCH_SCOPES[scopeActiveIndex].key);
        setScopeMenuOpen(false);
      } else {
        setScopeMenuOpen(true);
        setScopeActiveIndex(SEARCH_SCOPES.findIndex(s => s.key === searchScope));
      }
      return;
    }
    if (e.key === 'Escape') {
      setScopeMenuOpen(false);
    }
  }

  useEffect(() => {
    /* Ferme aussi le menu de scope et les suggestions/barre de recherche
     * mobile au scroll (setState(false) est un no-op si déjà fermé). */
    const fn = () => {
      setScrolled(window.scrollY > 10);
      setScopeMenuOpen(false);
      setSearchFocus(false);
      setMobileSearch(false);
    };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* ✅ Charge la photo de profil du client depuis l'API */
  useEffect(() => {
    if (!isClient) return;
    settingsApi.getProfil()
      .then(data => setAvatarUrl(data.profilePicture ?? null))
      .catch(() => {});
  }, [isClient]);

  /* ✅ Rafraîchit la photo quand l'utilisateur la change dans les paramètres */
  useEffect(() => {
    const fn = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (url) setAvatarUrl(url);
    };
    window.addEventListener('avatar-updated', fn);
    return () => window.removeEventListener('avatar-updated', fn);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const fn = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-mobile-menu]')) setMobileOpen(false);
    };
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, [mobileOpen]);

  useEffect(() => {
    if (!avatarOpen) return;
    const fn = (e: MouseEvent) => {
      const node = e.target as Node;
      /* Ferme seulement si le clic est en dehors des DEUX menus avatar */
      const dansDesktop = avatarRefDesktop.current?.contains(node);
      const dansMobile  = avatarRefMobile.current?.contains(node);
      if (!dansDesktop && !dansMobile) setAvatarOpen(false);
    };
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, [avatarOpen]);

  useEffect(() => {
    if (!scopeMenuOpen) return;
    const fn = (e: MouseEvent) => {
      if (!scopeRef.current?.contains(e.target as Node)) setScopeMenuOpen(false);
    };
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, [scopeMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  /* Onglet actif dérivé de la route courante (source de vérité principale) */
  const routeKey: NavKey | null = (() => {
    const p = location.pathname;
    if (p === '/livreurs')      return 'livreurs';
    if (p === '/correspondants') return 'relais';
    if (p === '/offres')        return 'offres';
    if (p === '/explorer')      return 'explorer';
    return null;
  })();

  /* Quand on arrive sur une route connue, effacer l'état des onglets sans route */
  useEffect(() => {
    if (routeKey) setActiveNav(null);
  }, [routeKey]);

  const NAV_LINKS: { key: NavKey; label: string; icon: string; action: () => void }[] = [
    { key: 'explorer', label:t('publicHeader.nav.explorer'), icon:'fa-compass',
      action:() => { navigate('/explorer'); setMobileOpen(false); } },
    { key: 'boutiques', label:t('publicHeader.nav.boutiques'), icon:'fa-store',
      action:() => { setActiveNav('boutiques'); navigate('/boutiques'); setMobileOpen(false); } },
    { key: 'livreurs', label:t('publicHeader.nav.livreurs'), icon:'fa-motorcycle',
      action:() => { navigate('/livreurs'); setMobileOpen(false); } },
    { key: 'relais', label:t('publicHeader.nav.relais'), icon:'fa-map-pin',
      action:() => { navigate('/correspondants'); setMobileOpen(false); } },
    { key: 'offres', label:t('publicHeader.nav.offres'), icon:'fa-tag',
      action:() => { navigate('/offres'); setMobileOpen(false); } },
  ];

  function isNavActive(l: { key: NavKey }): boolean {
    /* Route dérivée prioritaire (Livreurs, Relais) */
    if (routeKey === l.key) return true;
    /* État local (Explorer, Offres, Boutiques) */
    return activeNav === l.key;
  }

  function handleSwitchDashboard() {
    if (!isLoggedIn) { openAuthModal(); return; }
    if (inDashboard)  navigate('/home');
    else              navigate(getDashboardPath(role));
  }

  return (
    <NotificationProvider>
      <NotificationToastStack />
      <header className={`${styles.hdr} ${scrolled ? styles.hdrScrolled : ''}`}>
        <div className={styles.wrap}>
          <div className={styles.row}>

            {/* Logo */}
            <button className={styles.logo}
              onClick={() => navigate(isLoggedIn ? '/home' : '/')} title={t('publicHeader.accueilTitle')}>
              <div className={styles.lw}>Sho<b>neya</b></div>
            </button>

            {/* Nav Desktop */}
            <nav className={styles.navDesktop}>
              {NAV_LINKS.map(l => (
                <button key={l.label}
                  className={`${styles.navLink} ${isNavActive(l) ? styles.navLinkActive : ''}`}
                  onClick={l.action} title={l.label} aria-label={l.label}>
                  <i className={`fas ${l.icon}`} />
                </button>
              ))}
            </nav>

            {/* Recherche — cherche réellement sur la plateforme (voir handleSearchSubmit) */}
            <div className={`${styles.srch} ${searchFocus ? styles.srchFocus : ''}`}>
              <div className={styles.srchBox}>
                <div className={styles.scopeWrap} ref={scopeRef}>
                  <button type="button" className={styles.srchCat}
                    onClick={() => { setScopeMenuOpen(o => !o); setScopeActiveIndex(SEARCH_SCOPES.findIndex(s => s.key === searchScope)); }}
                    onKeyDown={handleScopeKeyDown}
                    aria-haspopup="listbox" aria-expanded={scopeMenuOpen}
                    aria-label={t('publicHeader.searchScopeAria')}
                  >
                    <i className="fas fa-th-large" /> {SEARCH_SCOPES.find(s => s.key === searchScope)?.label}
                    <i className="fas fa-chevron-down" style={{ fontSize: 9, marginLeft: 2 }} />
                  </button>
                  {scopeMenuOpen && (
                    <div className={styles.scopeMenu} role="listbox">
                      {SEARCH_SCOPES.map((s, i) => (
                        <div
                          key={s.key}
                          role="option"
                          aria-selected={searchScope === s.key}
                          className={`${styles.scopeItem} ${searchScope === s.key ? styles.scopeItemActive : ''} ${scopeActiveIndex === i ? styles.scopeItemFocused : ''}`}
                          onMouseEnter={() => setScopeActiveIndex(i)}
                          onClick={() => { setSearchScope(s.key); setScopeMenuOpen(false); }}
                        >
                          {s.label}
                        </div>
                      ))}
                      <div
                        className={`${styles.scopeItem} ${styles.scopeItemDisabled}`}
                        role="option" aria-disabled="true"
                        title={CORRESPONDANTS_SOON.tooltip}
                      >
                        {CORRESPONDANTS_SOON.label}
                        <span className={styles.scopeSoonBadge}>{t('publicHeader.searchScopeSoonBadge')}</span>
                      </div>
                    </div>
                  )}
                </div>
                <input className={styles.srchIn} type="text"
                  placeholder={t('publicHeader.searchPlaceholder')} autoComplete="off"
                  aria-label={t('publicHeader.searchInputAria')}
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSuggActiveIndex(-1); }}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => setSearchFocus(true)}
                  onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
                />
                <button className={styles.srchGo} aria-label={t('publicHeader.searchAria')} onClick={handleSearchSubmit}>
                  <i className="fas fa-magnifying-glass" />
                </button>
              </div>
              {searchFocus && (hasQuery || activeList.length > 0) && (
                <div className={styles.srchSugg} role="listbox">
                  {hasQuery && suggestLoading && (
                    <div className={styles.ssLoading}>
                      <i className="fas fa-circle-notch fa-spin" /> {t('publicHeader.searchLoading')}
                    </div>
                  )}
                  {hasQuery && !suggestLoading && liveSuggestions.length === 0 && (
                    <div className={styles.ssEmpty}>{t('publicHeader.searchNoResults', { query: searchQuery.trim() })}</div>
                  )}
                  {activeList.map((s, i) => (
                    <div key={s.image !== undefined ? `${i}-${s.label}` : i} role="option" aria-selected={suggActiveIndex === i}
                      className={`${styles.ssIt} ${suggActiveIndex === i ? styles.ssItFocused : ''}`}
                      onMouseEnter={() => setSuggActiveIndex(i)}
                      onClick={() => { s.action(); setSearchFocus(false); setSuggActiveIndex(-1); }}>
                      {s.image !== undefined ? (
                        s.image
                          ? <img src={s.image} alt="" className={styles.ssImg} />
                          : <div className={styles.ssImgPlaceholder} />
                      ) : (
                        <i className={`fas ${s.icon}`} />
                      )}
                      <span className={styles.ssText}>
                        {s.label}
                        {s.sublabel && <span className={styles.ssSub}>{s.sublabel}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions Desktop */}
            <div className={styles.actions}>
              <button className={`${styles.iconBtn} ${isHome ? styles.iconBtnActive : ''}`}
                onClick={() => navigate(isLoggedIn ? '/home' : '/')} title={t('publicHeader.accueil')}>
                <i className="fas fa-house" />
              </button>

              <button className={`${styles.iconBtn} ${isMessagerie ? styles.iconBtnActive : ''}`}
                onClick={() => isLoggedIn ? navigate('/messagerie') : openAuthModal()} title={t('publicHeader.messagerie')}>
                <i className="fas fa-comment-dots" />
                {canMessage && msgUnread > 0 && !isMessagerie && (
                  <span className={styles.badge}>{msgUnread > 99 ? '99+' : msgUnread}</span>
                )}
              </button>

              {isLoggedIn && <NotificationCenter />}

              <button className={`${styles.iconBtn} ${isCommande ? styles.iconBtnActive : ''}`}
                onClick={() => clientAction(() => navigate('/commande'))} title={t('publicHeader.panier')}>
                <i className="fas fa-bag-shopping" />
                {isClient && cartCount > 0 && (
                  <span className={styles.badge}>{cartCount > 99 ? '99+' : cartCount}</span>
                )}
              </button>

              <span className={styles.sep} />

              <button className={`${styles.iconBtn} ${isAdresses ? styles.iconBtnActive : ''}`}
                onClick={() => clientAction(() => navigate('/mes-adresses'))} title={t('publicHeader.adresses')}>
                <i className="fas fa-location-dot" />
              </button>
              <span className={styles.sep} />

              {isAnonymous && (
                <>
                  <button className={styles.btnIn} onClick={handleLoginClick}>
                    <i className="fas fa-right-to-bracket" /> {t('publicHeader.connexion')}
                  </button>
                  <button className={styles.btnUp} onClick={onRegister}>
                    {t('publicHeader.inscription')} <i className="fas fa-arrow-right" />
                  </button>
                </>
              )}

              {isClient && (
                <div ref={avatarRefDesktop} style={{ position:'relative' }}>
                  <button className={styles.avatar} onClick={() => setAvatarOpen(o => !o)} title={t('publicHeader.monCompte')}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="profil" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : userInitial}
                  </button>
                  {avatarOpen && (
                    <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'var(--white)', border:'1px solid var(--bdr2)', borderRadius:14, padding:6, minWidth:190, boxShadow:'0 8px 32px rgba(11,31,58,.14)', zIndex:600 }}>
                      {/* ✅ Mon profil → /mon-profil */}
                      <button onClick={() => { navigate('/mon-profil'); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer', textAlign:'left' }}>
                        <i className="fas fa-user" style={{ color:'var(--blue)', width:14 }} /> {t('publicHeader.monProfil')}
                      </button>
                      <button onClick={() => { navigate(getDashboardPath(role)); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer', textAlign:'left' }}>
                        <i className="fas fa-layer-group" style={{ color:'var(--blue)', width:14 }} /> {t('publicHeader.monEspace')}
                      </button>
                      <AccountSwitchLink render={({ label, onClick, pending }) => (
                        <button disabled={pending} onClick={() => { onClick(); setAvatarOpen(false); }}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer', textAlign:'left' }}>
                          <i className="fas fa-right-left" style={{ color:'var(--blue)', width:14 }} /> Basculer vers mon espace {label}
                        </button>
                      )} />
                    </div>
                  )}
                </div>
              )}

              {isNonClient && (
                <button className={styles.btnUp}
                  onClick={() => navigate(getDashboardPath(role))} title={t('publicHeader.monEspacePro')}>
                  <i className="fas fa-layer-group" /> {t('publicHeader.monEspace')}
                </button>
              )}

              <span className={styles.sep} />

              {/* ✅ Menu trois lignes — aussi visible en grand écran */}
              <button className={styles.iconBtn} data-mobile-menu
                onClick={() => setMobileOpen(o => !o)} aria-label={t('publicHeader.menu')} title={t('publicHeader.menu')}>
                <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
              </button>
            </div>

            {/* Actions Mobile Top Bar */}
            <div className={styles.mobileTopActions}>
              <button className={`${styles.iconBtn} ${styles.mobileSearchToggle}`} onClick={() => setMobileSearch(s => !s)} title={t('publicHeader.searchAria')}>
                <i className={`fas ${mobileSearch ? 'fa-xmark' : 'fa-magnifying-glass'}`} />
              </button>

              {/* ✅ Messagerie — ajouté en mobile */}
              <button className={`${styles.iconBtn} ${isMessagerie ? styles.iconBtnActive : ''}`}
                onClick={() => isLoggedIn ? navigate('/messagerie') : openAuthModal()} title={t('publicHeader.messagerie')}>
                <i className="fas fa-comment-dots" />
                {canMessage && msgUnread > 0 && !isMessagerie && (
                  <span className={styles.badge}>{msgUnread > 99 ? '99+' : msgUnread}</span>
                )}
              </button>

              {isLoggedIn && <NotificationCenter />}
              <button className={styles.iconBtn}
                onClick={() => clientAction(() => navigate('/mes-adresses'))} title={t('publicHeader.adresses')}>
                <i className="fas fa-location-dot" />
              </button>
              <button className={styles.iconBtn} data-mobile-menu
                onClick={() => setMobileOpen(o => !o)} aria-label={t('publicHeader.menu')}>
                <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
              </button>

              {isAnonymous && (
                <button className={styles.avatar} onClick={handleLoginClick} title={t('publicHeader.connexion')} style={{ fontSize:11, fontWeight:700 }}>
                  <i className="fas fa-right-to-bracket" />
                </button>
              )}
              {isClient && (
                <div ref={avatarRefMobile} style={{ position:'relative' }}>
                  <button className={styles.avatar} onClick={() => setAvatarOpen(o => !o)} title={t('publicHeader.monCompte')}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="profil" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : userInitial}
                  </button>
                  {avatarOpen && (
                    <div style={{ position:'fixed', top:66, right:8, background:'var(--white)', border:'1px solid var(--bdr2)', borderRadius:14, padding:6, minWidth:190, boxShadow:'0 8px 32px rgba(11,31,58,.14)', zIndex:600 }}>
                      {/* ✅ Mon profil → /mon-profil (mobile) */}
                      <button onClick={() => { navigate('/mon-profil'); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer' }}>
                        <i className="fas fa-user" style={{ color:'var(--blue)', width:14 }} /> {t('publicHeader.monProfil')}
                      </button>
                      <button onClick={() => { navigate(getDashboardPath(role)); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer' }}>
                        <i className="fas fa-layer-group" style={{ color:'var(--blue)', width:14 }} /> {t('publicHeader.monEspace')}
                      </button>
                      <AccountSwitchLink render={({ label, onClick, pending }) => (
                        <button disabled={pending} onClick={() => { onClick(); setAvatarOpen(false); }}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer' }}>
                          <i className="fas fa-right-left" style={{ color:'var(--blue)', width:14 }} /> Basculer vers mon espace {label}
                        </button>
                      )} />
                    </div>
                  )}
                </div>
              )}
              {isNonClient && (
                <button className={styles.avatar}
                  onClick={() => navigate(getDashboardPath(role))}
                  title={t('publicHeader.monEspace')} style={{ fontSize:11 }}>
                  <i className="fas fa-layer-group" />
                </button>
              )}
            </div>
          </div>

          {mobileSearch && (
            <div className={styles.mobileSearchBar}>
              <div className={styles.srchBox} style={{ borderRadius:12 }}>
                <input className={styles.srchIn} type="text"
                  placeholder={t('publicHeader.searchPlaceholder')}
                  aria-label={t('publicHeader.searchInputAria')}
                  autoComplete="off" autoFocus
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSuggActiveIndex(-1); }}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && !hasQuery) { setMobileSearch(false); return; }
                    handleSearchKeyDown(e);
                  }}
                  onFocus={() => setSearchFocus(true)}
                  onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
                />
                <button className={styles.srchGo} aria-label={t('publicHeader.searchAria')} onClick={handleSearchSubmit}>
                  <i className="fas fa-magnifying-glass" />
                </button>
              </div>
              {searchFocus && (hasQuery || activeList.length > 0) && (
                <div className={styles.srchSugg} role="listbox" style={{ position: 'static', marginTop: 6 }}>
                  {hasQuery && suggestLoading && (
                    <div className={styles.ssLoading}>
                      <i className="fas fa-circle-notch fa-spin" /> {t('publicHeader.searchLoading')}
                    </div>
                  )}
                  {hasQuery && !suggestLoading && liveSuggestions.length === 0 && (
                    <div className={styles.ssEmpty}>{t('publicHeader.searchNoResults', { query: searchQuery.trim() })}</div>
                  )}
                  {activeList.map((s, i) => (
                    <div key={s.image !== undefined ? `${i}-${s.label}` : i} role="option" aria-selected={suggActiveIndex === i}
                      className={`${styles.ssIt} ${suggActiveIndex === i ? styles.ssItFocused : ''}`}
                      onMouseEnter={() => setSuggActiveIndex(i)}
                      onClick={() => { s.action(); setSearchFocus(false); setSuggActiveIndex(-1); setMobileSearch(false); }}>
                      {s.image !== undefined ? (
                        s.image
                          ? <img src={s.image} alt="" className={styles.ssImg} />
                          : <div className={styles.ssImgPlaceholder} />
                      ) : (
                        <i className={`fas ${s.icon}`} />
                      )}
                      <span className={styles.ssText}>
                        {s.label}
                        {s.sublabel && <span className={styles.ssSub}>{s.sublabel}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Drawer Mobile */}
      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)}>
          <div className={styles.mobileDrawer} data-mobile-menu onClick={e => e.stopPropagation()}>
            <div className={styles.drawerHd}>
              <button className={styles.logo} onClick={() => { navigate(isLoggedIn ? '/home' : '/'); setMobileOpen(false); }}>
                <div className={styles.lw}>Sho<b>neya</b></div>
              </button>
              <button className={styles.drawerClose} onClick={() => setMobileOpen(false)}>
                <i className="fas fa-xmark" />
              </button>
            </div>

            {/* ✅ Solde du portefeuille Shoneya — toujours visible en ouvrant le menu */}
            {isClient && (
              <div style={{ padding: '14px 16px 0' }}>
                <WalletQuickBar compact mini onManage={() => { setMobileOpen(false); navigate('/dashboard/client'); }} />
              </div>
            )}

            <nav className={styles.drawerNav}>
              {NAV_LINKS.map(l => (
                <button key={l.label}
                  className={`${styles.drawerLink} ${isNavActive(l) ? styles.drawerLinkActive : ''}`}
                  onClick={l.action}>
                  <div className={styles.drawerLinkIco}><i className={`fas ${l.icon}`} /></div>
                  <span>{l.label}</span>
                  <i className="fas fa-chevron-right" style={{ color:'var(--t4)', fontSize:11 }} />
                </button>
              ))}
            </nav>
            <div className={styles.drawerDivider} />
            <nav className={styles.drawerNav}>
              {/* ✅ Paramètres */}
              <button className={styles.drawerLink}
                onClick={() => { setMobileOpen(false); clientAction(() => navigate('/parametres')); }}>
                <div className={styles.drawerLinkIco}><i className="fas fa-gear" /></div>
                <span>{t('publicHeader.parametres')}</span>
                <i className="fas fa-chevron-right" style={{ color:'var(--t4)', fontSize:11 }} />
              </button>

              {/* ✅ Mon espace — bascule home ↔ dashboard */}
              <button className={styles.drawerLink}
                onClick={() => { setMobileOpen(false); handleSwitchDashboard(); }}>
                <div className={styles.drawerLinkIco}>
                  <i className={`fas ${inDashboard ? 'fa-house' : 'fa-layer-group'}`} />
                </div>
                <span>{inDashboard ? t('publicHeader.retourAccueil') : t('publicHeader.monEspace')}</span>
                <i className="fas fa-chevron-right" style={{ color:'var(--t4)', fontSize:11 }} />
              </button>

              {/* Bascule vers le compte pro lié (masqué si aucun compte lié) */}
              {isClient && (
                <AccountSwitchLink render={({ label, onClick, pending }) => (
                  <button className={styles.drawerLink} disabled={pending}
                    onClick={() => { setMobileOpen(false); onClick(); }}>
                    <div className={styles.drawerLinkIco}><i className="fas fa-right-left" /></div>
                    <span>Basculer vers mon espace {label}</span>
                    <i className="fas fa-chevron-right" style={{ color:'var(--t4)', fontSize:11 }} />
                  </button>
                )} />
              )}
            </nav>
            <div className={styles.drawerDivider} />
            <div className={styles.drawerCta}>
              {isAnonymous ? (
                <>
                  <button className={styles.drawerBtnIn} onClick={() => { setMobileOpen(false); handleLoginClick(); }}>
                    <i className="fas fa-right-to-bracket" /> {t('publicHeader.connexion')}
                  </button>
                  <button className={styles.drawerBtnUp} onClick={() => { onRegister(); setMobileOpen(false); }}>
                    {t('publicHeader.inscription')} <i className="fas fa-arrow-right" />
                  </button>
                </>
              ) : isNonClient ? (
                <button className={styles.drawerBtnUp}
                  onClick={() => { navigate(getDashboardPath(role)); setMobileOpen(false); }}>
                  <i className="fas fa-layer-group" /> {t('publicHeader.monEspaceProShort')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Bottom Nav Mobile — états actifs sur /livreurs, /correspondants, /boutiques */}
      <nav className={styles.bottomNav} aria-label={t('publicHeader.navMobileAria')}>

        {/* Accueil */}
        <button
          className={`${styles.bnItem} ${isHome ? styles.bnActive : ''}`}
          onClick={() => navigate(isLoggedIn ? '/home' : '/')}
          title={t('publicHeader.accueil')} aria-label={t('publicHeader.accueil')}
        >
          <i className="fas fa-house" />
        </button>

        {/* ✅ Boutiques — actif sur /boutiques */}
        <button
          className={`${styles.bnItem} ${isBoutiques ? styles.bnActive : ''}`}
          onClick={() => navigate('/boutiques')}
          title={t('publicHeader.nav.boutiques')} aria-label={t('publicHeader.nav.boutiques')}
        >
          <i className="fas fa-store" />
        </button>

        {/* ✅ Livreurs — actif sur /livreurs */}
        <button
          className={`${styles.bnItem} ${isLivreurs ? styles.bnActive : ''}`}
          onClick={() => navigate('/livreurs')}
          title={t('publicHeader.nav.livreurs')} aria-label={t('publicHeader.nav.livreurs')}
        >
          <i className="fas fa-motorcycle" />
        </button>

        {/* Panier — badge dynamique CartContext */}
        <button
          className={styles.bnItem}
          onClick={() => clientAction(() => navigate('/commande'))}
          title={t('publicHeader.panier')} aria-label={t('publicHeader.panier')}
        >
          <i className="fas fa-bag-shopping" />
          {isClient && cartCount > 0 && (
            <span className={styles.bnBadge}>{cartCount > 99 ? '99+' : cartCount}</span>
          )}
        </button>

        {/* Mon espace — switcher home ↔ dashboard */}
        <button
          className={`${styles.bnItem} ${styles.bnSwitcher}`}
          onClick={handleSwitchDashboard}
          title={inDashboard ? t('publicHeader.retourAccueil') : t('publicHeader.monEspace')}
          aria-label={inDashboard ? t('publicHeader.retourAccueil') : t('publicHeader.monEspace')}
        >
          <div className={styles.bnSwitcherIco}>
            <i className={`fas ${inDashboard ? 'fa-house' : 'fa-layer-group'}`} />
          </div>
        </button>

      </nav>

      {authModal}
    </NotificationProvider>
  );
}