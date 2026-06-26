/* ================================================================
 * FICHIER : src/modules/home/components/profil-correspondant/pages/ProfilCorrespondantPage.tsx
 *
 * RÔLE : Page profil public d'UN correspondant (route /correspondants/:id).
 *        Header global + cover + identité + KPI + 6 onglets + sidebar
 *        + barre d'action mobile fixe.
 *
 * DONNÉES (hybride) :
 *   - Identité/KPI/bio/suivi → API /suivis/correspondants (filtré par :id)
 *   - Détails riches → mock (en attendant un endpoint profil dédié)
 *
 * AUTONOME : toasts via 'shopi-toast'.
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

  /* Toast global */
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
  const onShare   = useCallback(() => onToast('🔗 Lien du profil copié'), [onToast]);
  const handleToggle = useCallback(() => {
    toggleSuivi();
    onToast(suivi ? `👋 Désabonné de ${profil.nom}` : `✅ Abonné à ${profil.nom}`);
  }, [toggleSuivi, suivi, profil.nom, onToast]);

  const header = (
    <Header
      onToast={onToast}
      onLogin={() => navigate('/login')}
      onRegister={() => navigate('/register')}
    />
  );

  /* Chargement */
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

  return (
    <>
      {header}
      <div className={styles.page}>

        {/* Cover + identité + KPI */}
        <ProfilHeader
          profil={profil}
          suivi={suivi}
          onToggle={handleToggle}
          onMessage={onMessage}
          onShare={onShare}
        />

        {/* Erreur non bloquante */}
        {error && (
          <div style={{ maxWidth: 1160, margin: '14px auto 0', padding: '0 28px' }}>
            <div style={{ padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, fontSize: 12.5, color: '#78350F' }}>
              <i className="fas fa-triangle-exclamation" /> {error}
            </div>
          </div>
        )}

        {/* Corps : contenu + sidebar */}
        <div className={styles.pw}>
          <main>
            <ProfilTabs actif={tab} nbAvis={profil.nbAvis} onTab={setTab} />

            {tab === 'info' && (
              <TabInfo bio={profil.bio} tags={aboutTags} infosPratiques={infosPratiques} schedule={schedule} />
            )}
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