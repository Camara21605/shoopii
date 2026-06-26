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

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation }           from 'react-router-dom';
import styles                                 from './Header.module.css';
import { tokenStorage }                       from '../../../../shared/services/apiFetch';
import { getRoleFromToken, getDashboardPath } from '../../../../shared/services/authUtils';
import { useCart }                            from '../../../../shared/context/CartContext';
import { settingsApi }                        from '../settings/api/settings.api';

interface HeaderProps {
  onToast:    (msg: string) => void;
  onLogin:    () => void;
  onRegister: () => void;
}

export default function Header({ onToast, onLogin, onRegister }: HeaderProps) {
  const [scrolled,     setScrolled]     = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [searchFocus,  setSearchFocus]  = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [avatarOpen,   setAvatarOpen]   = useState(false);
  const [clientModal,  setClientModal]  = useState(false);
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null);
  const avatarRefDesktop = useRef<HTMLDivElement>(null);
  const avatarRefMobile  = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  /* ✅ Badge panier depuis le contexte global */
  const { count: cartCount } = useCart();

  const role        = getRoleFromToken();
  const isLoggedIn  = !!role;
  const isClient    = role === 'client';
  const isNonClient = isLoggedIn && !isClient;
  const isAnonymous = !isLoggedIn;
  const isHome      = location.pathname === '/home';
  const inDashboard = location.pathname.startsWith('/dashboard');

  /* ✅ États actifs du bottom nav pour chaque page publique */
  const isLivreurs       = location.pathname === '/livreurs';
  const isCorrespondants = location.pathname === '/correspondants';
  const isBoutiques      = location.pathname === '/boutiques';
  const isMessagerie     = location.pathname === '/messagerie';

  const userInitial = (() => {
    try {
      const token = tokenStorage.get();
      if (!token) return '';
      const p = JSON.parse(atob(token.split('.')[1]));
      return (p.firstName?.[0] ?? p.email?.[0] ?? 'U').toUpperCase();
    } catch { return 'U'; }
  })();

  function clientAction(action: () => void) {
    if (isClient)    { action(); return; }
    if (isAnonymous) { navigate('/login'); return; }
    setClientModal(true);
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

  const NOTIFS = [
    { ico:'📦', cls:styles.niO, text:"Commande #SH-4521 expédiée — livraison prévue aujourd'hui.", time:'Il y a 5 min',  unread:true  },
    { ico:'📢', cls:styles.niP, text:"Flash Sale : −40% sur l'électronique jusqu'à minuit !",      time:'Il y a 24 min', unread:true  },
    { ico:'🤝', cls:styles.niF, text:'FashionHub GN vous invite à sa nouvelle collection.',          time:'Il y a 1 h',   unread:true  },
    { ico:'❤️', cls:styles.niL, text:"Votre avis sur iPhone 15 Pro a reçu 12 mentions J'aime.",     time:'Il y a 2 h',   unread:false },
    { ico:'🛵', cls:styles.niD, text:"Mamadou D. est en route — arrivée dans 18 min.",              time:'Hier',         unread:false },
  ];
  const unreadCount = NOTIFS.filter(n => n.unread).length;

  const NAV_LINKS = [
  { label:'Explorer',    icon:'fa-compass',
    action:() => { document.querySelector('#blocs')?.scrollIntoView({behavior:'smooth'}); setMobileOpen(false); } },
  { label:'Boutiques',   icon:'fa-store',
    action:() => { navigate('/boutiques'); setMobileOpen(false); } },
  { label:'Livreurs',    icon:'fa-motorcycle',
    action:() => { navigate('/livreurs'); setMobileOpen(false); } },
  { label:'Relais',      icon:'fa-map-pin',
    action:() => { navigate('/correspondants'); setMobileOpen(false); } },
  { label:'Offres',      icon:'fa-tag',
    action:() => { onToast('🏷️ Offres'); setMobileOpen(false); } },
];

  function handleSwitchDashboard() {
    if (!isLoggedIn) { navigate('/login'); return; }
    if (inDashboard)  navigate('/home');
    else              navigate(getDashboardPath(role));
  }

  function handleLogout() {
    tokenStorage.remove();
    setAvatarOpen(false);
    navigate('/login');
  }

  return (
    <>
      <header className={`${styles.hdr} ${scrolled ? styles.hdrScrolled : ''}`}>
        <div className={styles.wrap}>
          <div className={styles.row}>

            {/* Logo */}
            <button className={styles.logo}
              onClick={() => navigate(isLoggedIn ? '/home' : '/')} title="Accueil Shopi">
              <div className={styles.lm}>Sh</div>
              <div className={styles.lw}>Sho<b>pi</b></div>
            </button>

            {/* Nav Desktop */}
            <nav className={styles.navDesktop}>
              {NAV_LINKS.map(l => (
                <button key={l.label} className={styles.navLink} onClick={l.action}>
                  <i className={`fas ${l.icon}`} />{l.label}
                </button>
              ))}
            </nav>

            {/* Recherche */}
            <div className={`${styles.srch} ${searchFocus ? styles.srchFocus : ''}`}>
              <div className={styles.srchBox}>
                <span className={styles.srchCat}><i className="fas fa-th-large" /> Tout</span>
                <input className={styles.srchIn} type="text"
                  placeholder="Produits, boutiques, livreurs…" autoComplete="off"
                  onFocus={() => setSearchFocus(true)}
                  onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
                />
                <button className={styles.srchGo} aria-label="Rechercher">
                  <i className="fas fa-magnifying-glass" />
                </button>
              </div>
              {searchFocus && (
                <div className={styles.srchSugg}>
                  {[
                    { icon:'fa-arrow-trend-up', text:'Tendances du moment'              },
                    { icon:'fa-mobile-screen',  text:'Smartphones — 4 200 résultats'   },
                    { icon:'fa-store',          text:'Boutiques populaires'             },
                    { icon:'fa-motorcycle',     text:'Livreurs disponibles près de vous'},
                    { icon:'fa-tag',            text:'Offres du jour'                   },
                  ].map((s, i) => (
                    <div key={i} className={styles.ssIt}
                      onClick={() => { onToast(`🔍 ${s.text}`); setSearchFocus(false); }}>
                      <i className={`fas ${s.icon}`} />{s.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions Desktop */}
            <div className={styles.actions}>
              <button className={`${styles.iconBtn} ${isHome ? styles.iconBtnActive : ''}`}
                onClick={() => navigate(isLoggedIn ? '/home' : '/')} title="Accueil">
                <i className="fas fa-house" />
              </button>

              <button className={styles.iconBtn}
                onClick={() => clientAction(() => navigate('/messagerie'))} title="Messagerie">
                <i className="fas fa-comment-dots" />
                {isClient && <span className={styles.badge}>3</span>}
              </button>

              <div className={styles.notifWrap}>
                <button className={styles.iconBtn}
                  onClick={() => clientAction(() => setNotifOpen(o => !o))} title="Notifications">
                  <i className="fas fa-bell" />
                  {isClient && unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
                </button>
                {notifOpen && isClient && (
                  <div className={styles.notifPanel}>
                    <div className={styles.notifHd}>
                      <span>Notifications</span>
                      <button onClick={() => { onToast('✅ Tout marqué'); setNotifOpen(false); }}>Tout lire</button>
                    </div>
                    <div className={styles.notifBody}>
                      {NOTIFS.map((n, i) => (
                        <div key={i} className={`${styles.notifItem} ${n.unread ? styles.notifUnread : ''}`}
                          onClick={() => setNotifOpen(false)}>
                          <div className={`${styles.notifIco} ${n.cls}`}>{n.ico}</div>
                          <div className={styles.notifTxt}><p>{n.text}</p><time>{n.time}</time></div>
                          {n.unread && <div className={styles.notifDot} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ✅ Badge panier dynamique depuis CartContext */}
              <button className={styles.iconBtn}
                onClick={() => clientAction(() => navigate('/commande'))} title="Panier">
                <i className="fas fa-bag-shopping" />
                {isClient && cartCount > 0 && (
                  <span className={styles.badge}>{cartCount > 99 ? '99+' : cartCount}</span>
                )}
              </button>

              <span className={styles.sep} />

              <button className={styles.iconBtn} onClick={() => onToast("❓ Centre d'aide")} title="Centre d'aide">
                <i className="fas fa-circle-question" />
              </button>
              <span className={styles.sep} />

              {isAnonymous && (
                <>
                  <button className={styles.btnIn} onClick={onLogin}>
                    <i className="fas fa-right-to-bracket" /> Connexion
                  </button>
                  <button className={styles.btnUp} onClick={onRegister}>
                    S'inscrire <i className="fas fa-arrow-right" />
                  </button>
                </>
              )}

              {isClient && (
                <div ref={avatarRefDesktop} style={{ position:'relative' }}>
                  <button className={styles.avatar} onClick={() => setAvatarOpen(o => !o)} title="Mon compte">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="profil" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : userInitial}
                  </button>
                  {avatarOpen && (
                    <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'var(--white)', border:'1px solid var(--bdr2)', borderRadius:14, padding:6, minWidth:190, boxShadow:'0 8px 32px rgba(11,31,58,.14)', zIndex:600 }}>
                      {/* ✅ Mon profil → /mon-profil */}
                      <button onClick={() => { navigate('/mon-profil'); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer', textAlign:'left' }}>
                        <i className="fas fa-user" style={{ color:'var(--blue)', width:14 }} /> Mon profil
                      </button>
                      <button onClick={() => { navigate(getDashboardPath(role)); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer', textAlign:'left' }}>
                        <i className="fas fa-layer-group" style={{ color:'var(--blue)', width:14 }} /> Mon espace
                      </button>
                      <div style={{ height:1, background:'var(--bdr)', margin:'4px 0' }} />
                      <button onClick={handleLogout}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--red,#DC2626)', cursor:'pointer', textAlign:'left' }}>
                        <i className="fas fa-right-from-bracket" style={{ width:14 }} /> Se déconnecter
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isNonClient && (
                <button className={styles.btnUp}
                  onClick={() => navigate(getDashboardPath(role))} title="Mon espace professionnel">
                  <i className="fas fa-layer-group" /> Mon espace
                </button>
              )}

              <span className={styles.sep} />

              {/* ✅ Menu trois lignes — aussi visible en grand écran */}
              <button className={styles.iconBtn} data-mobile-menu
                onClick={() => setMobileOpen(o => !o)} aria-label="Menu" title="Menu">
                <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
              </button>
            </div>

            {/* Actions Mobile Top Bar */}
            <div className={styles.mobileTopActions}>
              <button className={styles.iconBtn} onClick={() => setMobileSearch(s => !s)} title="Rechercher">
                <i className={`fas ${mobileSearch ? 'fa-xmark' : 'fa-magnifying-glass'}`} />
              </button>

              {/* ✅ Messagerie — ajouté en mobile */}
              <button className={styles.iconBtn}
                onClick={() => clientAction(() => navigate('/messagerie'))} title="Messagerie">
                <i className="fas fa-comment-dots" />
                {isClient && <span className={styles.badge}>3</span>}
              </button>

              <button className={styles.iconBtn}
                onClick={() => clientAction(() => setNotifOpen(o => !o))} title="Notifications">
                <i className="fas fa-bell" />
                {isClient && unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
              </button>
              <button className={styles.iconBtn}
                onClick={() => clientAction(() => navigate('/parametres'))} title="Paramètres">
                <i className="fas fa-gear" />
              </button>
              <button className={styles.iconBtn} data-mobile-menu
                onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
                <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
              </button>

              {isAnonymous && (
                <button className={styles.avatar} onClick={onLogin} title="Connexion" style={{ fontSize:11, fontWeight:700 }}>
                  <i className="fas fa-right-to-bracket" />
                </button>
              )}
              {isClient && (
                <div ref={avatarRefMobile} style={{ position:'relative' }}>
                  <button className={styles.avatar} onClick={() => setAvatarOpen(o => !o)} title="Mon compte">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="profil" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : userInitial}
                  </button>
                  {avatarOpen && (
                    <div style={{ position:'fixed', top:66, right:8, background:'var(--white)', border:'1px solid var(--bdr2)', borderRadius:14, padding:6, minWidth:190, boxShadow:'0 8px 32px rgba(11,31,58,.14)', zIndex:600 }}>
                      {/* ✅ Mon profil → /mon-profil (mobile) */}
                      <button onClick={() => { navigate('/mon-profil'); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer' }}>
                        <i className="fas fa-user" style={{ color:'var(--blue)', width:14 }} /> Mon profil
                      </button>
                      <button onClick={() => { navigate(getDashboardPath(role)); setAvatarOpen(false); }}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--t1)', cursor:'pointer' }}>
                        <i className="fas fa-layer-group" style={{ color:'var(--blue)', width:14 }} /> Mon espace
                      </button>
                      <div style={{ height:1, background:'var(--bdr)', margin:'4px 0' }} />
                      <button onClick={handleLogout}
                        style={{ width:'100%', display:'flex', alignItems:'center', gap:9, background:'none', border:'none', padding:'10px 12px', borderRadius:9, fontSize:13, fontWeight:600, color:'var(--red,#DC2626)', cursor:'pointer' }}>
                        <i className="fas fa-right-from-bracket" style={{ width:14 }} /> Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              )}
              {isNonClient && (
                <button className={styles.avatar}
                  onClick={() => navigate(getDashboardPath(role))}
                  title="Mon espace" style={{ fontSize:11 }}>
                  <i className="fas fa-layer-group" />
                </button>
              )}
            </div>
          </div>

          {mobileSearch && (
            <div className={styles.mobileSearchBar}>
              <div className={styles.srchBox} style={{ borderRadius:12 }}>
                <input className={styles.srchIn} type="text"
                  placeholder="Produits, boutiques, livreurs…"
                  autoComplete="off" autoFocus />
                <button className={styles.srchGo} aria-label="Rechercher">
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
            <nav className={styles.drawerNav}>
              {NAV_LINKS.map(l => (
                <button key={l.label} className={styles.drawerLink} onClick={l.action}>
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
                <span>Paramètres</span>
                <i className="fas fa-chevron-right" style={{ color:'var(--t4)', fontSize:11 }} />
              </button>

              {/* ✅ Mon espace — bascule home ↔ dashboard */}
              <button className={styles.drawerLink}
                onClick={() => { setMobileOpen(false); handleSwitchDashboard(); }}>
                <div className={styles.drawerLinkIco}>
                  <i className={`fas ${inDashboard ? 'fa-house' : 'fa-layer-group'}`} />
                </div>
                <span>{inDashboard ? "Retour à l'accueil" : 'Mon espace'}</span>
                <i className="fas fa-chevron-right" style={{ color:'var(--t4)', fontSize:11 }} />
              </button>
            </nav>
            <div className={styles.drawerDivider} />
            <div className={styles.drawerCta}>
              {isAnonymous ? (
                <>
                  <button className={styles.drawerBtnIn} onClick={() => { onLogin(); setMobileOpen(false); }}>
                    <i className="fas fa-right-to-bracket" /> Connexion
                  </button>
                  <button className={styles.drawerBtnUp} onClick={() => { onRegister(); setMobileOpen(false); }}>
                    S'inscrire <i className="fas fa-arrow-right" />
                  </button>
                </>
              ) : isNonClient ? (
                <>
                  <button className={styles.drawerBtnUp}
                    onClick={() => { navigate(getDashboardPath(role)); setMobileOpen(false); }}>
                    <i className="fas fa-layer-group" /> Mon espace pro
                  </button>
                  <button className={styles.drawerBtnIn} onClick={handleLogout}>
                    <i className="fas fa-right-from-bracket" /> Déconnexion
                  </button>
                </>
              ) : (
                <button className={styles.drawerBtnIn} onClick={handleLogout}>
                  <i className="fas fa-right-from-bracket" /> Se déconnecter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Bottom Nav Mobile — états actifs sur /livreurs, /correspondants, /boutiques */}
      <nav className={styles.bottomNav} aria-label="Navigation principale mobile">

        {/* Accueil */}
        <button
          className={`${styles.bnItem} ${isHome ? styles.bnActive : ''}`}
          onClick={() => navigate(isLoggedIn ? '/home' : '/')}
          title="Accueil"
        >
          <i className="fas fa-house" /><span>Accueil</span>
        </button>

        {/* ✅ Boutiques — actif sur /boutiques */}
        <button
          className={`${styles.bnItem} ${isBoutiques ? styles.bnActive : ''}`}
          onClick={() => navigate('/boutiques')}
          title="Boutiques"
        >
          <i className="fas fa-store" /><span>Boutiques</span>
        </button>

        {/* ✅ Messagerie — actif sur /messagerie */}
        <button
          className={`${styles.bnItem} ${isMessagerie ? styles.bnActive : ''}`}
          onClick={() => clientAction(() => navigate('/messagerie'))}
          title="Messagerie"
        >
          <i className="fas fa-comment-dots" />
          <span>Messages</span>
          {isClient && (
            <span className={styles.bnBadge}>3</span>
          )}
        </button>

        {/* ✅ Livreurs — actif sur /livreurs */}
        <button
          className={`${styles.bnItem} ${isLivreurs ? styles.bnActive : ''}`}
          onClick={() => navigate('/livreurs')}
          title="Livreurs"
        >
          <i className="fas fa-motorcycle" /><span>Livreurs</span>
        </button>

        {/* Panier — badge dynamique CartContext */}
        <button
          className={styles.bnItem}
          onClick={() => clientAction(() => navigate('/commande'))}
          title="Panier"
        >
          <i className="fas fa-bag-shopping" /><span>Panier</span>
          {isClient && cartCount > 0 && (
            <span className={styles.bnBadge}>{cartCount > 99 ? '99+' : cartCount}</span>
          )}
        </button>

        {/* Mon espace — switcher home ↔ dashboard */}
        <button
          className={`${styles.bnItem} ${styles.bnSwitcher}`}
          onClick={handleSwitchDashboard}
          title={inDashboard ? "Retour à l'accueil" : 'Mon espace'}
        >
          <div className={styles.bnSwitcherIco}>
            <i className={`fas ${inDashboard ? 'fa-house' : 'fa-layer-group'}`} />
          </div>
          <span>{inDashboard ? 'Accueil' : 'Mon espace'}</span>
        </button>

      </nav>

      {/* Modal non-client */}
      {clientModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(11,31,58,.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}
          onClick={() => setClientModal(false)}>
          <div style={{ background:'var(--white)', borderRadius:22, padding:32, maxWidth:420, width:'100%', boxShadow:'0 24px 64px rgba(11,31,58,.3)', textAlign:'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:68, height:68, borderRadius:'50%', background:'linear-gradient(135deg,var(--blue,#1A4FC4),#5B8EF4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 18px' }}>🛒</div>
            <div style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:20, color:'var(--navy,#0B1F3A)', marginBottom:10 }}>Fonctionnalité réservée aux clients</div>
            <p style={{ fontSize:14, color:'var(--t2)', lineHeight:1.7, marginBottom:24 }}>
              Cette fonctionnalité est réservée aux <strong>comptes clients Shopi</strong>.<br />
              Créez un compte client gratuit pour accéder à votre panier, vos commandes et vos messages.
            </p>
            {isNonClient && (
              <div style={{ background:'rgba(26,79,196,.08)', border:'1px solid rgba(26,79,196,.2)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--blue,#1A4FC4)', marginBottom:20, textAlign:'left' }}>
                💡 Vous avez un compte <strong>{role}</strong>. Vous pouvez créer un compte client séparé avec une autre adresse email.
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexDirection:'column' }}>
              <button onClick={() => { setClientModal(false); navigate('/register'); }}
                style={{ background:'linear-gradient(135deg,var(--navy,#0B1F3A),var(--blue,#1A4FC4))', color:'#fff', border:'none', borderRadius:12, padding:'14px 24px', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <i className="fas fa-user-plus" /> Créer mon compte client
              </button>
              <button onClick={() => setClientModal(false)}
                style={{ background:'none', color:'var(--t3)', border:'1px solid var(--bdr2)', borderRadius:12, padding:'12px 24px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}