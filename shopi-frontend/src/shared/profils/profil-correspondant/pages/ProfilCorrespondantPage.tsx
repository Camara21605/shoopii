/* ================================================================
 * FICHIER : profil-correspondant/pages/ProfilCorrespondantPage.tsx
 *
 * Page profil public d'UN correspondant (/correspondants/:id).
 * Toutes les données proviennent de l'API (GET /client/correspondants/:id).
 * ================================================================ */

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStartConversation } from '../../../hooks/useStartConversation';

import Header from '../../../../modules/home/components/layout/Header';
import { useCorrespondantProfil } from '../hooks/useCorrespondantProfil';

import ProfilHeader  from '../components/ProfilHeader';
import ProfilTabs    from '../components/ProfilTabs';
import ProfilSidebar from '../components/ProfilSidebar';
import TabInfo       from '../sections/TabInfo';
import TabServices   from '../sections/TabServices';
import TabZones      from '../sections/TabZones';
import TabTarifs     from '../sections/TabTarifs';
import TabAvis       from '../sections/TabAvis';
import TabGalerie    from '../sections/TabGalerie';

import type { ProfilTab } from '../data/types';
import styles from '../styles/ProfilCorrespondant.module.css';

export default function ProfilCorrespondantPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    profil, loading, error, suivi, toggleSuivi,
    aboutTags, infosPratiques, schedule, services, zones, paysPartenaires,
    tarifs, avisScore, avis, galerie, contacts, statsSidebar, verifications, similaires,
  } = useCorrespondantProfil(id);

  const [tab, setTab] = useState<ProfilTab>('info');

  const onToast = useCallback((msg: string) => {
    window.dispatchEvent(new CustomEvent('shopi-toast', { detail: msg }));
  }, []);

  const { start: startConv } = useStartConversation();
  const onMessage = useCallback(() => {
    if (!suivi) {
      onToast('Abonnez-vous à ce correspondant pour lui envoyer un message.');
      return;
    }
    startConv('correspondent', id!, (msg: string) => onToast(`❌ ${msg}`));
  }, [suivi, startConv, id, onToast]);

  const onShare = useCallback(() => onToast('🔗 Lien du profil copié'), [onToast]);

  const handleToggle = useCallback(() => {
    toggleSuivi();
    if (profil) {
      onToast(suivi ? `👋 Désabonné de ${profil.nom}` : `✅ Abonné à ${profil.nom}`);
    }
  }, [toggleSuivi, suivi, profil, onToast]);

  const header = (
    <Header
      onToast={onToast}
      onLogin={() => navigate('/login')}
      onRegister={() => navigate('/register')}
    />
  );

  /* ── Chargement ── */
  if (loading) {
    return (
      <>
        {header}
        <div className={styles.page}>
          <div className={styles.state}><i className="fas fa-spinner fa-spin" /> Chargement du profil…</div>
        </div>
      </>
    );
  }

  /* ── Erreur / profil introuvable ── */
  if (!profil) {
    return (
      <>
        {header}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-triangle-exclamation" style={{ color: '#B45309' }} />
            <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16 }}>Profil introuvable</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #6B7280)', marginTop: 6, maxWidth: 320, textAlign: 'center' }}>
              {error ?? "Ce correspondant n'existe pas ou n'est plus disponible."}
            </div>
            <button
              onClick={() => navigate(-1)}
              style={{ marginTop: 20, background: 'var(--teal, #0E7490)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <i className="fas fa-arrow-left" /> Retour
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className={styles.page}>

        <ProfilHeader
          profil={profil}
          suivi={suivi}
          onToggle={handleToggle}
          onMessage={onMessage}
          onShare={onShare}
        />

        <div className={styles.pw}>
          <main>
            <ProfilTabs actif={tab} nbAvis={profil.nbAvis} onTab={setTab} />

            {tab === 'info'     && <TabInfo bio={profil.bio} tags={aboutTags} infosPratiques={infosPratiques} schedule={schedule} />}
            {tab === 'services' && <TabServices services={services} />}
            {tab === 'zones'    && <TabZones zones={zones} paysPartenaires={paysPartenaires} onToast={onToast} />}
            {tab === 'tarifs'   && <TabTarifs tarifs={tarifs} />}
            {tab === 'avis'     && <TabAvis score={avisScore} avis={avis} onToast={onToast} />}
            {tab === 'galerie'  && <TabGalerie galerie={galerie} onToast={onToast} />}
          </main>

          <ProfilSidebar
            nom={profil.nom}
            contacts={contacts}
            stats={statsSidebar}
            abonnes={profil.abonnes}
            verifications={verifications}
            similaires={similaires}
            suivi={suivi}
            onToggle={handleToggle}
            onMessage={onMessage}
            onToast={onToast}
          />
        </div>

        {/* Barre d'action mobile fixe */}
        <div className={styles.actionBar}>
          <button className={styles.abMsg} onClick={onMessage}>
            <i className="fas fa-comment-dots" /> Contacter
          </button>
          <button className={styles.abFollow} onClick={handleToggle}>
            {suivi ? <><i className="fas fa-user-check" /> Abonné</> : <><i className="fas fa-plus" /> Suivre</>}
          </button>
        </div>
      </div>
    </>
  );
}
