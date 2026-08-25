// src/dashboards/entreprise/pages/ProfilCorrespondantReseauPage.tsx
// Affiche le profil complet d'un correspondant du réseau, sans le Header
// public, intégré dans le dashboard entreprise.

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCorrespondantProfil } from '../../../shared/profils/profil-correspondant/hooks/useCorrespondantProfil';
import { useAuthGate } from '../../../shared/hooks/useAuthGate';

import ProfilHeader  from '../../../shared/profils/profil-correspondant/components/ProfilHeader';
import ProfilTabs    from '../../../shared/profils/profil-correspondant/components/ProfilTabs';
import ProfilSidebar from '../../../shared/profils/profil-correspondant/components/ProfilSidebar';
import TabInfo       from '../../../shared/profils/profil-correspondant/sections/TabInfo';
import TabServices   from '../../../shared/profils/profil-correspondant/sections/TabServices';
import TabZones      from '../../../shared/profils/profil-correspondant/sections/TabZones';
import TabTarifs     from '../../../shared/profils/profil-correspondant/sections/TabTarifs';
import TabAvis       from '../../../shared/profils/profil-correspondant/sections/TabAvis';
import TabGalerie    from '../../../shared/profils/profil-correspondant/sections/TabGalerie';

import type { ProfilTab } from '../../../shared/profils/profil-correspondant/data/types';
import styles from '../../../shared/profils/profil-correspondant/styles/ProfilCorrespondant.module.css';
import shared from './ReseauShared.module.css';

interface Props {
  id:     string;
  onBack: () => void;
  onPop:  (msg: string, type?: string) => void;
}

export default function ProfilCorrespondantReseauPage({ id, onBack, onPop }: Props) {
  const { t } = useTranslation();
  const {
    profil, loading, error, suivi, updateFollowState,
    aboutTags, infosPratiques, schedule, services, zones, paysPartenaires,
    tarifs, avisScore, avis, galerie, contacts, statsSidebar, verifications, similaires,
  } = useCorrespondantProfil(id);
  const { openAuthModal, authModal } = useAuthGate();

  const [tab, setTab] = useState<ProfilTab>('info');

  /* Relaie les toasts internes ('shoneya-toast') vers le toast du dashboard */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      onPop(detail, 'i');
    };
    window.addEventListener('shoneya-toast', handler);
    return () => window.removeEventListener('shoneya-toast', handler);
  }, [onPop]);

  const onToast = useCallback((msg: string) => onPop(msg, 'i'), [onPop]);
  const onMessage = useCallback(() => onPop(`💬 Message à ${profil?.nom}`, 'i'), [profil?.nom, onPop]);
  const onShare   = useCallback(() => onPop(t('profilCorrespondant.publicPage.lienCopieToast'), 'i'), [onPop, t]);

  const backBtn = (
    <div className={shared.page} style={{ paddingBottom: 0 }}>
      <button onClick={onBack} style={{ background: 'var(--white)', border: '1px solid var(--bdr)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <i className="fas fa-arrow-left" /> {t('profilCorrespondant.retourCorrespondants')}
      </button>
    </div>
  );

  if (loading) {
    return (
      <>
        {backBtn}
        <div className={styles.page}>
          <div className={styles.state}><i className="fas fa-spinner fa-spin" /> {t('profilCorrespondant.loading')}</div>
        </div>
      </>
    );
  }

  if (!profil) {
    return (
      <>
        {backBtn}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-triangle-exclamation" />
            {error ?? t('profilCorrespondant.notFoundFallback')}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {backBtn}
      <div className={styles.page}>
        <ProfilHeader
          profil={profil}
          suivi={suivi}
          onToast={onToast}
          onRequireAuth={openAuthModal}
          onFollowChange={updateFollowState}
          onMessage={onMessage}
          onShare={onShare}
        />

        {error && (
          <div style={{ maxWidth: 1160, margin: '14px auto 0', padding: '0 28px' }}>
            <div style={{ padding: '10px 14px', background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 10, fontSize: 12.5, color: 'var(--t2)' }}>
              <i className="fas fa-triangle-exclamation" /> {error}
            </div>
          </div>
        )}

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
            id={profil.id}
            nom={profil.nom}
            contacts={contacts}
            stats={statsSidebar}
            abonnes={profil.abonnes}
            verifications={verifications}
            similaires={similaires}
            suivi={suivi}
            onRequireAuth={openAuthModal}
            onFollowChange={updateFollowState}
            onMessage={onMessage}
            onToast={onToast}
          />
        </div>
      </div>

      {authModal}
    </>
  );
}
