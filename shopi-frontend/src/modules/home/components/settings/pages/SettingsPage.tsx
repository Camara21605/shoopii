/* ================================================================
 * src/modules/home/components/settings/pages/SettingsPage.tsx
 *
 * ✅ Header intégré — même que les pages home
 * ✅ Sections connectées au backend via settingsApi
 * ================================================================ */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate }    from 'react-router-dom';

/* ✅ Même Header que toutes les pages home */
import Header from '../../layout/Header';

import p from './styles/SettingsPage.module.css';

import SettingsSidebar,    { type PanelId } from './components/SettingsSidebar';
import SecurityScoreBanner                  from './components/SecurityScoreBanner';

/* ── Sections connectées au backend ── */
import ProfilSection        from './sections/ProfilSection';
import AdressesSection      from './sections/AdressesSection';
import { PointsSection }    from './sections/PointsSection';
import PaiementSection      from './sections/PaiementSection';
import SessionsSection      from './sections/SessionsSection';
import ActiviteSection      from './sections/ActiviteSection';
import SecuriteSection      from './sections/SecuriteSection';

/* ── Toutes les sections restantes depuis OtherSections ── */
import {
  ApprobationsSection,    // ✅ déplacé ici depuis ActiviteApprobationsSection
  NotifsSection,
  ConfidentialiteSection,
  ApparenceSection,
  LangueSection,
  DonneesSection,
  DangerSection,
} from './sections/OtherSections';

/* ── Toast local (si pas de ToastContext disponible) ── */
function useLocalToast() {
  const [msg,     setMsg]     = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function showToast(message: string) {
    setMsg(message);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3000);
  }

  return { msg, visible, showToast };
}

export default function SettingsPage() {
  const navigate            = useNavigate();
  const { msg, visible, showToast } = useLocalToast();
  const [activePanel, setActivePanel] = useState<PanelId>('profil');
  const mainRef = useRef<HTMLDivElement>(null);

  const handleSwitch = (id: PanelId) => {
    setActivePanel(id);
    mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div style={{ display: activePanel === id ? 'block' : 'none' }}>{children}</div>
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

        {/* ── Entête page ── */}
        <div className={`${p.pageTop} ${p.rv}`}>
          <button className={p.pageBack} onClick={() => navigate('/home')}>
            <i className="fas fa-arrow-left" /> Retour à l'accueil
          </button>
          <h1 className={p.pageTitle}>Paramètres <em>du compte</em></h1>
          <p className={p.pageSub}>Gérez vos informations, sécurité et préférences Shopi</p>
        </div>

        {/* ── Security score banner ── */}
        <div className={`${p.rv} ${p.d1}`}>
          <SecurityScoreBanner onSwitch={handleSwitch} />
        </div>

        {/* ── Layout principal ── */}
        <div className={`${p.layout} ${p.rv} ${p.d2}`}>

          {/* Sidebar */}
          <SettingsSidebar
            active={activePanel}
            onSwitch={handleSwitch}
            onToast={showToast}
          />

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
            {panel('securite',        <SecuriteSection     onToast={showToast} />)}
            {panel('sessions',        <SessionsSection     onToast={showToast} />)}
            {panel('activite',        <ActiviteSection     onToast={showToast} />)}
            {panel('approbations',    <ApprobationsSection onToast={showToast} />)}
            {panel('notifs',          <NotifsSection       onToast={showToast} />)}
            {panel('confidentialite', <ConfidentialiteSection onToast={showToast} />)}
            {panel('apparence',       <ApparenceSection    onToast={showToast} />)}
            {panel('langue',          <LangueSection       onToast={showToast} />)}
            {panel('donnees',         <DonneesSection      onToast={showToast} />)}
            {panel('danger',          <DangerSection       onToast={showToast} />)}
          </div>
        </div>
      </div>

      {/* ── Toast local ── */}
      {visible && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--navy)', color: '#fff',
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