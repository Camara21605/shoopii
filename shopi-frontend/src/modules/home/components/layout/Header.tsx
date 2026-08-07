/* ================================================================
 * src/modules/home/components/layout/Header.tsx
 *
 * FIX :
 *   ✅ Badge panier → useCart().count (temps réel)
 *   ✅ Bouton ⚙️ mobile → navigate('/parametres') via clientAction
 *   ✅ Badge notifications → API à connecter (mock conservé pour l'instant)
 *   ✅ Bottom nav mobile → état actif sur /livreurs, /correspondants, /boutiques
 *   ✅ Menu avatar "Mon profil" → /mon-profil (page profil client)
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation }           from 'react-router-dom';
import { useTranslation }                     from 'react-i18next';
import styles                                 from './Header.module.css';
import { tokenStorage }                       from '../../../../shared/services/apiFetch';
import { getRoleFromToken, getDashboardPath } from '../../../../shared/services/authUtils';
import { useCart }                            from '../../../../shared/context/CartContext';
import { useGlobalCall }                      from '../../../../shared/context/GlobalCallContext';
import { settingsApi }                        from '../settings/api/settings.api';
import { NotificationProvider }               from '../../../../shared/notifications/NotificationContext';
import NotificationToastStack                 from '../../../../shared/notifications/NotificationToastStack';
import NotificationCenter                     from '../../../../shared/notifications/NotificationCenter';
import { useAuthGate }                        from '../../../../shared/hooks/useAuthGate';
import AuthPromptModal                        from '../../../../shared/components/AuthPromptModal';
import { useForceDarkTheme }                  from '../../../../shared/context/ThemeContext';
import WalletQuickBar                         from '../../../../shared/components/portefeuille/WalletQuickBar';

type NavKey = 'explorer' | 'boutiques' | 'livreurs' | 'relais' | 'offres';

interface HeaderProps {
  onToast:    (msg: string) => void;
  onLogin:    () => void;
  onRegister: () => void;
}

export default function Header({ onToast, onLogin, onRegister }: HeaderProps) {
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
  const [loginGateOpen, setLoginGateOpen] = useState(false);
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null);
  const [activeNav,    setActiveNav]    = useState<NavKey | null>(null);
  const avatarRefDesktop = useRef<HTMLDivElement>(null);
  const avatarRefMobile  = useRef<HTMLDivElement>(null);

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
  const isAide           = location.pathname.startsWith('/aide');

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

  /* ✅ "Se connecter" n'ouvre plus /login directement — on demande d'abord
   *    si le visiteur préfère créer un compte client. */
  function handleLoginClick() {
    setLoginGateOpen(true);
  }

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
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
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  /* Onglet actif dérivé de la route courante (source de vérité principale) */
  const routeKey: NavKey | null = (() => {
    const p = location.pathname;
    if (p === '/livreurs')      return 'livreurs';
    if (p === '/correspondants') return 'relais';
    if (p === '/offres')        return 'offres';
    return null;
  })();

  /* Quand on arrive sur une route connue, effacer l'état des onglets sans route */
  useEffect(() => {
    if (routeKey) setActiveNav(null);
  }, [routeKey]);

  const NAV_LINKS: { key: NavKey; label: string; icon: string; action: () => void }[] = [
    { key: 'explorer', label:t('publicHeader.nav.explorer'), icon:'fa-compass',
      action:() => { setActiveNav('explorer'); document.querySelector('#blocs')?.scrollIntoView({behavior:'smooth'}); setMobileOpen(false); } },
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

  function handleLogout() {
    tokenStorage.remove();
    setAvatarOpen(false);
    navigate('/login');
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
              <div className={styles.lm}>Sh</div>
              <div className={styles.lw}>Sho<b>pi</b></div>
            </button>

            {/* Nav Desktop */}
            <nav className={styles.navDesktop}>
              {NAV_LINKS.map(l => (
                <button key={l.label}
                  className={`${styles.navLink} ${isNavActive(l) ? styles.navLinkActive : ''}`}
                  onClick={l.action}>
                  <i className={`fas ${l.icon}`} />{l.label}
                </button>
              ))}
            </nav>

            {/* Recherche */}
            <div className={`${styles.srch} ${searchFocus ? styles.srchFocus : ''}`}>
              <div className={styles.srchBox}>
                <span className={styles.srchCat}><i className="fas fa-th-large" /> {t('publicHeader.searchAll')}</span>
                <input className={styles.srchIn} type="text"
                  placeholder={t('publicHeader.searchPlaceholder')} autoComplete="off"
                  onFocus={() => setSearchFocus(true)}
                  onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
                />
                <button className={styles.srchGo} aria-label={t('publicHeader.searchAria')}>
                  <i className="fas fa-magnifying-glass" />
                </button>
              </div>
              {searchFocus && (
                <div className={styles.srchSugg}>
                  {[
                    { icon:'fa-arrow-trend-up', text:t('publicHeader.searchSuggestions.tendances')          },
                    { icon:'fa-mobile-screen',  text:t('publicHeader.searchSuggestions.smartphones')        },
                    { icon:'fa-store',          text:t('publicHeader.searchSuggestions.boutiquesPopulaires')},
                    { icon:'fa-motorcycle',     text:t('publicHeader.searchSuggestions.livreursDispo')      },
                    { icon:'fa-tag',            text:t('publicHeader.searchSuggestions.offresDuJour')       },
                  ].map((s, i) => (
                    <div key={i} className={styles.ssIt}
                      onClick={() => { onToast(t('publicHeader.searchToast', { text: s.text })); setSearchFocus(false); }}>
                      <i className={`fas ${s.icon}`} />{s.text}
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

              <button className={`${styles.iconBtn} ${isAide ? styles.iconBtnActive : ''}`}
                onClick={() => navigate('/aide')} title={t('publicHeader.aide')}>
                <i className="fas fa-circle-question" />
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
                      <div style={{ height:1, background:'var(--bdr)', margin:'4px 0' }} />
                      <button onClick={handleLogout}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--red,#DC2626)', cursor:'pointer', textAlign:'left' }}>
                        <i className="fas fa-right-from-bracket" style={{ width:14 }} /> {t('publicHeader.seDeconnecter')}
                      </button>
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
              <button className={styles.iconBtn} onClick={() => setMobileSearch(s => !s)} title={t('publicHeader.searchAria')}>
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
                onClick={() => clientAction(() => navigate('/parametres'))} title={t('publicHeader.parametres')}>
                <i className="fas fa-gear" />
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
                      <div style={{ height:1, background:'var(--bdr)', margin:'4px 0' }} />
                      <button onClick={handleLogout}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--red,#DC2626)', cursor:'pointer' }}>
                        <i className="fas fa-right-from-bracket" style={{ width:14 }} /> {t('publicHeader.deconnexion')}
                      </button>
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
                  autoComplete="off" autoFocus />
                <button className={styles.srchGo} aria-label={t('publicHeader.searchAria')}>
                  <i className="fas fa-magnifying-glass" />
                </button>
              </div>
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
                <div className={styles.lm}>Sh</div><div className={styles.lw}>Sho<b>pi</b></div>
              </button>
              <button className={styles.drawerClose} onClick={() => setMobileOpen(false)}>
                <i className="fas fa-xmark" />
              </button>
            </div>

            {/* ✅ Solde du portefeuille Shopi — toujours visible en ouvrant le menu */}
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
                <>
                  <button className={styles.drawerBtnUp}
                    onClick={() => { navigate(getDashboardPath(role)); setMobileOpen(false); }}>
                    <i className="fas fa-layer-group" /> {t('publicHeader.monEspaceProShort')}
                  </button>
                  <button className={styles.drawerBtnIn} onClick={handleLogout}>
                    <i className="fas fa-right-from-bracket" /> {t('publicHeader.deconnexion')}
                  </button>
                </>
              ) : (
                <button className={styles.drawerBtnIn} onClick={handleLogout}>
                  <i className="fas fa-right-from-bracket" /> {t('publicHeader.seDeconnecter')}
                </button>
              )}
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
          title={t('publicHeader.accueil')}
        >
          <i className="fas fa-house" /><span>{t('publicHeader.accueil')}</span>
        </button>

        {/* ✅ Boutiques — actif sur /boutiques */}
        <button
          className={`${styles.bnItem} ${isBoutiques ? styles.bnActive : ''}`}
          onClick={() => navigate('/boutiques')}
          title={t('publicHeader.nav.boutiques')}
        >
          <i className="fas fa-store" /><span>{t('publicHeader.nav.boutiques')}</span>
        </button>

        {/* ✅ Livreurs — actif sur /livreurs */}
        <button
          className={`${styles.bnItem} ${isLivreurs ? styles.bnActive : ''}`}
          onClick={() => navigate('/livreurs')}
          title={t('publicHeader.nav.livreurs')}
        >
          <i className="fas fa-motorcycle" /><span>{t('publicHeader.nav.livreurs')}</span>
        </button>

        {/* Panier — badge dynamique CartContext */}
        <button
          className={styles.bnItem}
          onClick={() => clientAction(() => navigate('/commande'))}
          title={t('publicHeader.panier')}
        >
          <i className="fas fa-bag-shopping" /><span>{t('publicHeader.panier')}</span>
          {isClient && cartCount > 0 && (
            <span className={styles.bnBadge}>{cartCount > 99 ? '99+' : cartCount}</span>
          )}
        </button>

        {/* Mon espace — switcher home ↔ dashboard */}
        <button
          className={`${styles.bnItem} ${styles.bnSwitcher}`}
          onClick={handleSwitchDashboard}
          title={inDashboard ? t('publicHeader.retourAccueil') : t('publicHeader.monEspace')}
        >
          <div className={styles.bnSwitcherIco}>
            <i className={`fas ${inDashboard ? 'fa-house' : 'fa-layer-group'}`} />
          </div>
          <span>{inDashboard ? t('publicHeader.accueil') : t('publicHeader.monEspace')}</span>
        </button>

      </nav>

      {authModal}

      <AuthPromptModal
        open={loginGateOpen}
        onClose={() => setLoginGateOpen(false)}
        variant="anonymous"
        title={t('publicHeader.avantDeVousConnecter')}
        onLoginClick={onLogin}
        onRegisterClick={onRegister}
      />
    </NotificationProvider>
  );
}