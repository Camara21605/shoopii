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
import { getRoleFromToken }                   from '../../../../shared/services/authUtils';
import { useCart }                            from '../../../../shared/context/CartContext';
import { useGlobalCall }                      from '../../../../shared/context/GlobalCallContext';
import { settingsApi }                        from '../settings/api/settings.api';
import { NotificationProvider }               from '../../../../shared/notifications/NotificationContext';
import NotificationToastStack                 from '../../../../shared/notifications/NotificationToastStack';
import NotificationCenter                     from '../../../../shared/notifications/NotificationCenter';
import { useAuthGate }                        from '../../../../shared/hooks/useAuthGate';
import WalletQuickBar                         from '../../../../shared/components/portefeuille/WalletQuickBar';
import AccountSwitchLink                      from '../../../../shared/components/AccountSwitchLink';

type NavKey = 'explorer' | 'boutiques' | 'livreurs' | 'relais' | 'offres';

/** Délai de debounce avant d'interroger le backend pour les suggestions
 *  live de la recherche générale — évite un appel API par frappe. */
const SEARCH_DEBOUNCE_MS = 200;

/** Réponse de GET /public/explore/suggest — un seul appel pour tous les types. */
interface SuggestItemDto {
  id: string; label: string; rank: number; image: string | null;
  location?: string | null; prix?: number | null; pricingType?: string | null; companyId?: string;
}
type SuggestDto = Record<'produits' | 'services' | 'boutiques' | 'livreurs' | 'correspondants', SuggestItemDto[]>;

/** Réponses déjà reçues (clé : scope + texte) — revenir sur un mot déjà
 *  tapé (retour arrière, correction) s'affiche instantanément. Partagé
 *  entre toutes les pages : le Header est remonté à chaque navigation. */
const suggestCache = new Map<string, SuggestDto>();
const SUGGEST_CACHE_MAX = 60;
const suggestKey = (scope: string, q: string) =>
  `${scope}|${q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')}`;

interface HeaderProps {
  onToast:    (msg: string) => void;
  onLogin:    () => void;
  onRegister: () => void;
}

export default function Header({ onLogin, onRegister }: HeaderProps) {
  /* Thème : les pages home suivent la préférence clair / sombre de
   * l'utilisateur (Paramètres → Apparence) — voir ThemeContext.tsx. */
  const { t } = useTranslation();

  const [scrolled,     setScrolled]     = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [searchFocus,  setSearchFocus]  = useState(false);
  const [avatarOpen,   setAvatarOpen]   = useState(false);
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null);
  const [activeNav,    setActiveNav]    = useState<NavKey | null>(null);
  const avatarRefDesktop = useRef<HTMLDivElement>(null);
  const avatarRefMobile  = useRef<HTMLDivElement>(null);

  /* ✅ Recherche générale — cherche réellement sur la plateforme, au lieu
   * de suggestions décoratives : "Tout"/"Produits" → Explorer (recherche
   * produits déjà fonctionnelle), "Boutiques" → /boutiques?search=,
   * "Livreurs"/"Correspondants" → leurs pages avec state.search (ces
   * pages n'ont pas d'entrée URL dédiée — voir useLivreurs.ts et
   * CorrespondantsPage.tsx). */
  type SearchScope = 'tout' | 'produits' | 'services' | 'boutiques' | 'livreurs' | 'correspondants';
  type SuggType = 'produit' | 'service' | 'boutique' | 'livreur' | 'correspondant';
  interface LiveSuggestion { id: string; type: SuggType; rank?: number; label: string; sublabel?: string; image?: string | null; action: () => void }
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('tout');
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [scopeActiveIndex, setScopeActiveIndex] = useState(0);
  const [suggActiveIndex, setSuggActiveIndex] = useState(-1);
  const [liveSuggestions, setLiveSuggestions] = useState<LiveSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  /* ✅ Badge panier depuis le contexte global */
  const { count: cartCount } = useCart();

  /* ✅ Badge messages non lus — temps réel via GlobalCallContext */
  const { msgUnread } = useGlobalCall();

  const role        = getRoleFromToken();
  const isLoggedIn  = !!role;
  const isClient    = role === 'client';
  const isAnonymous = !isLoggedIn;
  const canMessage  = isLoggedIn && ['client', 'company', 'delivery', 'correspondent'].includes(role ?? '');
  const isHome      = location.pathname === '/home';

  /* ✅ États actifs du bottom nav pour chaque page publique */
  const isLivreurs       = location.pathname === '/livreurs';
  const isCorrespondants = location.pathname === '/correspondants';
  const isBoutiques      = location.pathname === '/boutiques';
  const isCatalogue      = location.pathname === '/catalogue';
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
    { key: 'tout',           label: t('publicHeader.searchScopes.tout')           },
    { key: 'produits',       label: t('publicHeader.searchScopes.produits')       },
    { key: 'services',       label: t('publicHeader.searchScopes.services')       },
    { key: 'boutiques',      label: t('publicHeader.searchScopes.boutiques')      },
    { key: 'livreurs',       label: t('publicHeader.searchScopes.livreurs')       },
    { key: 'correspondants', label: t('publicHeader.searchScopes.correspondants') },
  ];

  /* Icône de la pastille de type, affichée sur la miniature d'une
   * suggestion uniquement en scope "Tout" (résultats mélangés — sinon
   * redondant puisque tous les résultats sont déjà du même type). */
  const TYPE_ICON: Record<SuggType, string> = {
    produit:       'fa-box',
    service:       'fa-concierge-bell',
    boutique:      'fa-store',
    livreur:       'fa-motorcycle',
    correspondant: 'fa-map-pin',
  };

  const SEARCH_SUGGESTIONS = [
    { icon: 'fa-arrow-trend-up', text: t('publicHeader.searchSuggestions.tendances'),           action: () => navigate('/explorer') },
    { icon: 'fa-mobile-screen',  text: t('publicHeader.searchSuggestions.smartphones'),         action: () => navigate('/explorer?q=smartphone') },
    { icon: 'fa-store',          text: t('publicHeader.searchSuggestions.boutiquesPopulaires'), action: () => navigate('/boutiques') },
    { icon: 'fa-motorcycle',     text: t('publicHeader.searchSuggestions.livreursDispo'),       action: () => navigate('/livreurs') },
    { icon: 'fa-tag',            text: t('publicHeader.searchSuggestions.offresDuJour'),        action: () => navigate('/offres') },
  ];

  /* Transforme la réponse du backend en lignes cliquables. En scope "Tout",
   * les types sont mélangés selon la pertinence calculée côté serveur : un
   * nom de boutique/livreur tapé en entier passe devant les produits qui ne
   * font que le contenir (avant, les produits venaient toujours en premier). */
  function toSuggestions(res: SuggestDto, scope: SearchScope): LiveSuggestion[] {
    const close = () => setSearchFocus(false);
    const fmtPrix = (p?: number | null) => (p != null ? `${Number(p).toLocaleString('fr')} GNF` : undefined);
    const groups: { type: SuggType; max: number; items: LiveSuggestion[] }[] = [
      { type: 'produit', max: 3, items: res.produits.map(p => ({
        id: p.id, type: 'produit', rank: p.rank, label: p.label, sublabel: fmtPrix(p.prix), image: p.image,
        action: () => { navigate(`/produit/${p.id}`); close(); },
      })) },
      { type: 'service', max: 2, items: res.services.map(sv => ({
        id: sv.id, type: 'service', rank: sv.rank, label: sv.label,
        sublabel: sv.pricingType === 'sur_devis' ? t('publicHeader.searchSurDevis') : fmtPrix(sv.prix),
        image: sv.image,
        action: () => { navigate(`/boutique/${sv.companyId}`); close(); },
      })) },
      { type: 'boutique', max: 2, items: res.boutiques.map(c => ({
        id: c.id, type: 'boutique', rank: c.rank, label: c.label, sublabel: c.location || undefined, image: c.image,
        action: () => { navigate(`/boutique/${c.id}`); close(); },
      })) },
      { type: 'livreur', max: 2, items: res.livreurs.map(l => ({
        id: l.id, type: 'livreur', rank: l.rank, label: l.label, sublabel: l.location || undefined, image: l.image,
        action: () => { navigate(`/livreurs/${l.id}`); close(); },
      })) },
      { type: 'correspondant', max: 2, items: res.correspondants.map(c => ({
        id: c.id, type: 'correspondant', rank: c.rank, label: c.label, sublabel: c.location || undefined, image: c.image,
        action: () => { navigate(`/correspondants/${c.id}`); close(); },
      })) },
    ];
    if (scope !== 'tout') return groups.flatMap(g => g.items);
    /* sort() est stable : à pertinence égale, l'ordre des types est conservé */
    return groups.flatMap(g => g.items.slice(0, g.max)).sort((a, b) => (a.rank ?? 5) - (b.rank ?? 5));
  }

  /* Suggestions live : dès que l'utilisateur tape (2 caractères mini),
   * UN seul appel GET /public/explore/suggest renvoie produits, services,
   * boutiques, livreurs et correspondants (avant : jusqu'à 5 requêtes par
   * frappe, chacune chargeant des fiches complètes — c'était le plus lent
   * sur réseau mobile). Debounce 200ms ; la requête précédente est annulée
   * dès qu'on tape à nouveau ; une recherche déjà faite s'affiche sans
   * attendre (suggestCache). */
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setLiveSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    const show = (res: SuggestDto) => {
      setLiveSuggestions(toSuggestions(res, searchScope));
      setSuggestLoading(false);
      setSuggActiveIndex(-1);
    };

    const key = suggestKey(searchScope, q);
    const cached = suggestCache.get(key);
    if (cached) { show(cached); return; }

    setSuggestLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      apiFetch<SuggestDto>('/public/explore/suggest', {
        public: true,
        params: { q, scope: searchScope, limit: searchScope === 'tout' ? 3 : 6 },
        signal: ctrl.signal,
      })
        .then(res => {
          if (suggestCache.size >= SUGGEST_CACHE_MAX) suggestCache.delete(suggestCache.keys().next().value!);
          suggestCache.set(key, res);
          show(res);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return; // remplacée par une frappe plus récente
          setLiveSuggestions([]);
          setSuggestLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => { clearTimeout(timer); ctrl.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchScope]);

  function handleSearchSubmit() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchFocus(false);
    setSuggActiveIndex(-1);
    if (searchScope === 'boutiques') {
      navigate(`/boutiques?search=${encodeURIComponent(q)}`);
    } else if (searchScope === 'services') {
      /* Pas de page de résultats service dédiée (hors scope MVP) — la
       * recherche services renvoie vers les boutiques de services dont
       * le nom correspond, filtrées par le toggle Produits/Services/Tout. */
      navigate(`/boutiques?mode=services&search=${encodeURIComponent(q)}`);
    } else if (searchScope === 'livreurs') {
      navigate('/livreurs', { state: { search: q } });
    } else if (searchScope === 'correspondants') {
      navigate('/correspondants', { state: { search: q } });
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
  const activeList: { icon?: string; type?: SuggType; image?: string | null; label: string; sublabel?: string; action: () => void }[] =
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

  /* Panneau de suggestions de recherche mobile — partagé par la barre dépliable (autres pages)
   * et par le champ intégré de l'accueil (2e rangée). */
  const mobileSuggestions = (wrapStyle: React.CSSProperties) =>
    (searchFocus && (hasQuery || activeList.length > 0)) ? (
                <div className={styles.srchSugg} role="listbox" style={wrapStyle}>
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
                        <span className={styles.ssImgWrap}>
                          {s.image
                            ? <img src={s.image} alt="" className={styles.ssImg} />
                            : <div className={styles.ssImgPlaceholder} />}
                          {searchScope === 'tout' && s.type && (
                            <span className={styles.ssTypeBadge}><i className={`fas ${TYPE_ICON[s.type]}`} /></span>
                          )}
                        </span>
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
    ) : null;

  /* Champ de recherche intégré à la 2e rangée de l'accueil (mobile) : il occupe tout
   * l'espace laissé par les icônes de droite. Mêmes états/handlers que la barre dépliable. */
  const searchField = (
    <div className={styles.subSearch}>
      <i className="fas fa-magnifying-glass" aria-hidden />
      <input
        className={styles.subSearchIn} type="text" enterKeyHint="search"
        placeholder={t('publicHeader.searchPlaceholder')}
        aria-label={t('publicHeader.searchInputAria')}
        autoComplete="off"
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); setSuggActiveIndex(-1); }}
        onKeyDown={handleSearchKeyDown}
        onFocus={() => setSearchFocus(true)}
        onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
      />
      {hasQuery && (
        <button
          type="button" className={styles.subSearchGo} aria-label={t('publicHeader.searchAria')}
          onMouseDown={e => e.preventDefault()} onClick={handleSearchSubmit}
        >
          <i className="fas fa-arrow-right" />
        </button>
      )}
    </div>
  );

  /* ── Éléments de la barre mobile (réutilisés par l'en-tête classique ET la barre scindée de l'accueil) ── */
  const msgBtn = (
              <button className={`${styles.iconBtn} ${isMessagerie ? styles.iconBtnActive : ''}`}
                onClick={() => isLoggedIn ? navigate('/messagerie') : openAuthModal()} title={t('publicHeader.messagerie')}>
                <i className="fas fa-comment-dots" />
                {canMessage && msgUnread > 0 && !isMessagerie && (
                  <span className={styles.badge}>{msgUnread > 99 ? '99+' : msgUnread}</span>
                )}
              </button>
  );
  const notifBtn = isLoggedIn ? <NotificationCenter /> : null;
  const cartBtn = (
              <button className={`${styles.iconBtn} ${isCommande ? styles.iconBtnActive : ''}`}
                onClick={() => clientAction(() => navigate('/commande'))}
                title={t('publicHeader.panier')} aria-label={t('publicHeader.panier')}>
                <i className="fas fa-bag-shopping" />
                {isClient && cartCount > 0 && (
                  <span className={styles.badge}>{cartCount > 99 ? '99+' : cartCount}</span>
                )}
              </button>
  );
  const locBtn = (
              <button className={styles.iconBtn}
                onClick={() => clientAction(() => navigate('/mes-adresses'))} title={t('publicHeader.adresses')}>
                <i className="fas fa-location-dot" />
              </button>
  );
  const menuBtn = (
              <button className={styles.iconBtn} data-mobile-menu
                onClick={() => setMobileOpen(o => !o)} aria-label={t('publicHeader.menu')}>
                <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
              </button>
  );
  const accountBtn = (
    <>
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
                    <div style={{ position:'fixed', top: 102, right:8, background:'var(--white)', border:'1px solid var(--bdr2)', borderRadius:14, padding:6, minWidth:190, boxShadow:'0 8px 32px rgba(11,31,58,.14)', zIndex:600 }}>
                      {/* ✅ Mon profil → /mon-profil (mobile) */}
                      <button onClick={() => { navigate('/mon-profil'); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer' }}>
                        <i className="fas fa-user" style={{ color:'var(--blue)', width:14 }} /> {t('publicHeader.monProfil')}
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
    </>
  );

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
                        <span className={styles.ssImgWrap}>
                          {s.image
                            ? <img src={s.image} alt="" className={styles.ssImg} />
                            : <div className={styles.ssImgPlaceholder} />}
                          {searchScope === 'tout' && s.type && (
                            <span className={styles.ssTypeBadge}><i className={`fas ${TYPE_ICON[s.type]}`} /></span>
                          )}
                        </span>
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

              <span className={styles.sep} />

              {/* ✅ Menu trois lignes — aussi visible en grand écran */}
              <button className={styles.iconBtn} data-mobile-menu
                onClick={() => setMobileOpen(o => !o)} aria-label={t('publicHeader.menu')} title={t('publicHeader.menu')}>
                <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
              </button>
            </div>

            {/* Actions Mobile Top Bar — 3 boutons ronds : localisation, messagerie, menu */}
            <div className={`${styles.mobileTopActions} ${styles.mobileTopRound}`}>
              {locBtn}
              {msgBtn}
              {menuBtn}
            </div>
          </div>

          {/* Mobile (toutes les pages) : 2e rangée — champ de recherche (tout l'espace restant) + notifications, panier, compte à droite */}
          <div className={styles.mobileSubBar}>
            {searchField}
            <div className={styles.subActions}>
              {notifBtn}
              {cartBtn}
              {accountBtn}
            </div>
          </div>
          {/* Suggestions sous l'en-tête (l'en-tête a une hauteur fixe : le panneau s'y superpose) */}
          <div className={styles.subSuggWrap}>{mobileSuggestions({ position: 'static' })}</div>
        </div>
      </header>
      {/* Mobile : l'en-tête fait 102px au lieu de 66px ; toutes les pages compensent 66px,
       * ce bloc réserve les 36px manquants dans le flux (voir --hdr-extra, tokens.css). */}
      <div className={styles.hdrExtraSpacer} aria-hidden />

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

        {/* ✅ Relais (correspondants) — à côté de Livreurs, actif sur /correspondants */}
        <button
          className={`${styles.bnItem} ${isCorrespondants ? styles.bnActive : ''}`}
          onClick={() => navigate('/correspondants')}
          title={t('publicHeader.nav.relais')} aria-label={t('publicHeader.nav.relais')}
        >
          <i className="fas fa-map-pin" />
        </button>

        {/* ✅ Catalogue — remplace le panier (désormais dans la barre du haut) */}
        <button
          className={`${styles.bnItem} ${isCatalogue ? styles.bnActive : ''}`}
          onClick={() => navigate('/catalogue')}
          title={t('cataloguePage.title')} aria-label={t('cataloguePage.title')}
        >
          <i className="fas fa-table-cells-large" />
        </button>

      </nav>

      {authModal}
    </NotificationProvider>
  );
}