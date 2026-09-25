/* ================================================================
 * src/modules/home/components/settings/pages/SettingsPage.tsx
 *
 * ✅ Header intégré — même que les pages home
 * ✅ Sections connectées au backend via settingsApi
 * ================================================================ */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAppContext } from '../../../../../shared/context/AppContext';
import { useIsNarrowScreen } from '../../../../../shared/hooks/useIsNarrowScreen';

/* ✅ Même Header que toutes les pages home */
import Header from '../../layout/Header';

import p from './styles/SettingsPage.module.css';

import { isPanelId, type PanelId }          from './components/panels';
import SettingsTabs                         from './components/SettingsTabs';
import SettingsMobileMenu                   from './components/SettingsMobileMenu';
import SecurityScoreBanner                  from './components/SecurityScoreBanner';

/* ── Sections connectées au backend ── */
import ProfilSection        from './sections/ProfilSection';
import AdressesSection      from './sections/AdressesSection';
import { PointsSection }    from './sections/PointsSection';
import PaiementSection      from './sections/PaiementSection';
import SessionsSection      from './sections/SessionsSection';
import ActiviteSection      from './sections/ActiviteSection';
import SecuriteSection      from './sections/SecuriteSection';
import NotifsSection        from './sections/NotifsSection';
import ConfidentialiteSection from './sections/ConfidentialiteSection';
import ApparenceSection     from './sections/ApparenceSection';
import LangueSection        from './sections/LangueSection';

import DonneesSection       from './sections/DonneesSection';
import DangerSection        from './sections/DangerSection';

/* ── Toast local (si pas de ToastContext disponible) ── */
function useLocalToast() {
  const [msg,     setMsg]     = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(message: string) {
    setMsg(message);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3000);
  }

  return { msg, visible, showToast };
}

/** Lit `?panel=` dans l'URL courante (chargement initial / rechargement de page) — utilisé
 *  une seule fois comme état initial de `activePanel`, voir son useState ci-dessous. */
function readInitialPanelFromUrl(): PanelId {
  if (typeof window === 'undefined') return 'profil';
  const fromUrl = new URLSearchParams(window.location.search).get('panel');
  return isPanelId(fromUrl) ? fromUrl : 'profil';
}

export default function SettingsPage() {
  const navigate            = useNavigate();
  const { t } = useTranslation();
  const { logout, user } = useAppContext();
  const { msg, visible, showToast } = useLocalToast();
  const [activePanel, setActivePanel] = useState<PanelId>(readInitialPanelFromUrl);
  /* Un panneau n'est monté (et ne charge ses données) qu'à sa première ouverture — avant, les 12 panneaux
   * se chargeaient tous d'un coup, cachés : 12 séries d'appels API et une carte Leaflet dans un conteneur masqué. */
  const [visited, setVisited] = useState<Set<PanelId>>(() => new Set<PanelId>(['profil', activePanel]));
  const mainRef = useRef<HTMLDivElement>(null);

  const isNarrow = useIsNarrowScreen(640);

  /*
   * ── Mode téléphone : le "retour" du navigateur/appareil doit revenir
   *    au menu des paramètres, pas quitter vers /home ──
   *
   * Ouvrir une section AJOUTE une entrée d'historique (?panel=<id>),
   * exactement comme une vraie page — la touche/geste "retour" du
   * téléphone (et le bouton "Retour" de l'app) reviennent alors
   * naturellement à /parametres (menu) au lieu de sortir direct vers
   * /home comme avant (une seule entrée d'historique pour toute la page
   * paramètres, donc "retour" quittait toujours vers la page précédente,
   * peu importe la section ouverte).
   *
   * `panelParam` (et non un state React séparé) fait foi pour savoir si on
   * affiche le menu ou une section — sans état à désynchroniser, un retour
   * matériel qui vide l'URL suffit à revenir au menu automatiquement.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const panelParam    = searchParams.get('panel');
  const showMobileMenu = isNarrow && !isPanelId(panelParam);
  /* true seulement si CETTE session a elle-même empilé l'entrée d'historique
   * "détail" (clic sur une ligne) — distingue ce cas d'un lien direct vers
   * /parametres?panel=xyz (aucune entrée à dépiler dans ce cas). */
  const pushedDetailRef = useRef(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const handleSwitch = (id: PanelId) => {
    setActivePanel(id);
    setVisited(v => (v.has(id) ? v : new Set(v).add(id)));
    if (isNarrow) {
      pushedDetailRef.current = true;
      setSearchParams({ panel: id });
    }
    mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goBackToMenu = () => {
    if (pushedDetailRef.current) {
      pushedDetailRef.current = false;
      navigate(-1);
    } else {
      /* Arrivé directement sur /parametres?panel=xyz (lien externe, favori,
       * rechargement) — rien à dépiler, on efface juste le paramètre. */
      setSearchParams({}, { replace: true });
    }
  };

  /* Reveal animation */
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add(p.in); }),
      { threshold: 0.04 },
    );
    document.querySelectorAll(`.${p.rv}`).forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [activePanel]);

  const panel = (id: PanelId, children: React.ReactNode) => (
    <div style={{ display: activePanel === id ? 'block' : 'none' }}>{visited.has(id) || activePanel === id ? children : null}</div>
  );

  return (
    <>
      {/* ✅ Même Header que HomePage, BoutiquePage, etc. */}
      <Header
        onToast={showToast}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      <div className={p.pageWrap}>

        {showMobileMenu ? (
          /* ── Mode téléphone, écran racine : liste groupée façon réglages
              natifs — voir SettingsMobileMenu.tsx. Remplace entièrement la
              barre d'onglets + l'en-tête ci-dessous (elle a son propre
              titre et sa propre ligne de déconnexion). ── */
          <SettingsMobileMenu
            onOpen={handleSwitch}
            onLogout={handleLogout}
            onToast={showToast}
            displayName={user ? `${user.firstName} ${user.lastName}`.trim() : ''}
            email={user?.email}
          />
        ) : (
          <>
            {/* ── Barre d'onglets — masquée en mode téléphone (remplacée par
                 le menu ci-dessus) ; toujours en premier sur grand écran,
                 épinglée sous le header dès le chargement. ── */}
            {!isNarrow && <SettingsTabs active={activePanel} onSwitch={handleSwitch} />}

            {/* ── Entête page — en mode téléphone (vue "détail"), le retour
                 revient au menu racine plutôt qu'à l'accueil, et le titre
                 devient celui de la section ouverte. ── */}
            <div className={`${p.pageTop} ${p.rv}`}>
              <div className={p.pageTopRow}>
                <button className={p.pageBack} onClick={() => (isNarrow ? goBackToMenu() : navigate('/home'))}>
                  <i className="fas fa-arrow-left" /> {isNarrow ? t('settingsPage.mobileMenu.back') : t('settingsPage.page.retourAccueil')}
                </button>
                {/* ✅ Bouton clair/sombre retiré : le site n'a plus de mode
                    clair (voir useForceDarkTheme dans Header.tsx). */}
              </div>
              {isNarrow ? (
                <h1 className={p.pageTitle}>{t(`settingsPage.tabs.${activePanel}`)}</h1>
              ) : (
                <>
                  <h1 className={p.pageTitle}>{t('settingsPage.page.titrePart1')} <em>{t('settingsPage.page.titreEm')}</em></h1>
                  <p className={p.pageSub}>{t('settingsPage.page.sub')}</p>
                </>
              )}
            </div>

            {/* ── Score de sécurité : uniquement dans l'onglet Profil ── */}
            {activePanel === 'profil' && (
              <div className={`${p.rv} ${p.d1}`}>
                <SecurityScoreBanner onSwitch={handleSwitch} />
              </div>
            )}

            {/* ── Layout principal ── */}
            <div className={`${p.layout} ${p.rv} ${p.d2}`}>

              {/* Panels */}
              <div ref={mainRef}>
                {panel('profil',          <ProfilSection       onToast={showToast} />)}
                {panel('adresses',        <AdressesSection     onToast={showToast} />)}
                {panel('paiement',        <PaiementSection     onToast={showToast} />)}
                {panel('points',          <PointsSection />)}
                {panel('confidentialiteSecurite', <>
                  <SecuriteSection        onToast={showToast} />
                  <ConfidentialiteSection onToast={showToast} />
                </>)}
                {panel('sessions',        <SessionsSection     onToast={showToast} />)}
                {panel('activite',        <ActiviteSection     onToast={showToast} />)}
                {panel('notifs',          <NotifsSection       onToast={showToast} />)}
                {panel('confidentialite', <ConfidentialiteSection onToast={showToast} />)}
                {panel('apparence',       <ApparenceSection    onToast={showToast} />)}
                {panel('langue',          <LangueSection       onToast={showToast} />)}
                {panel('donnees',         <DonneesSection      onToast={showToast} />)}
                {panel('danger',          <DangerSection       onToast={showToast} />)}
              </div>
            </div>

            {/* ── Déconnexion — en bas de la page paramètres, sous toutes
                les sections. En mode téléphone (vue "détail"), déjà présente
                dans le menu racine : pas besoin de la répéter ici. ── */}
            {!isNarrow && (
              <div style={{ padding: '24px 4px 40px', borderTop: '1px solid var(--bdr)', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '10px 18px', borderRadius: 'var(--pill, 999px)',
                    fontSize: 13, fontWeight: 700, color: 'var(--red, #DC2626)',
                    background: 'none', border: '1px solid var(--red, #DC2626)', cursor: 'pointer',
                  }}
                >
                  <i className="fas fa-right-from-bracket" />
                  {t('publicHeader.seDeconnecter')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Toast local ── */}
      {visible && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--btn)', color: '#fff',
          padding: '10px 20px', borderRadius: 'var(--pill)',
          fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 8px 32px rgba(11,31,58,.3)',
          animation: 'fadeInUp .25s var(--ease)',
          whiteSpace: 'nowrap',
        }}>
          {msg}
        </div>
      )}
    </>
  );
}