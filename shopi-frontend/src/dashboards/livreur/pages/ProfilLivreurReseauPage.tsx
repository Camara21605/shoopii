// src/dashboards/livreur/pages/ProfilLivreurReseauPage.tsx
// Affiche le profil complet d'un livreur du réseau, sans le Header public,
// intégré dans le dashboard livreur.

import { useTranslation } from 'react-i18next';
import { useLivreurProfile } from '../../../shared/profils/profil-livreur/hooks/useLivreurProfile';
import { useAuthGate } from '../../../shared/hooks/useAuthGate';
import ProfilHeader   from '../../../shared/profils/profil-livreur/components/ProfilHeader';
import ProfilTabs     from '../../../shared/profils/profil-livreur/components/ProfilTabs';
import TabInfo          from '../../../shared/profils/profil-livreur/components/TabInfo';
import TabVehicule      from '../../../shared/profils/profil-livreur/components/TabVehicule';
import TabZones         from '../../../shared/profils/profil-livreur/components/TabZones';
import TabTarifs        from '../../../shared/profils/profil-livreur/components/TabTarifs';
import TabPlaceholder   from '../../../shared/profils/profil-livreur/components/TabPlaceholder';
import TabLocalisation  from '../../../shared/profils/profil-livreur/components/TabLocalisation';
import ProfilSidebar  from '../../../shared/profils/profil-livreur/components/ProfilSidebar';
import styles from '../../../shared/profils/profil-livreur/styles/ProfilLivreur.module.css';
import shared from '../styles/Shared.module.css';

interface Props {
  id:        string;
  onBack:    () => void;
  onPop:     (msg: string, type?: string) => void;
  backLabel?: string;
}

export default function ProfilLivreurReseauPage({ id, onBack, onPop, backLabel }: Props) {
  const { t } = useTranslation();
  const { profile, loading, error, tab, setTab, updateFollowState } = useLivreurProfile(id);
  const { openAuthModal, authModal } = useAuthGate();
  const label = backLabel ?? t('livreurProfilReseau.backLabelDefault');

  const backBtn = (
    <div className={shared.page} style={{ paddingBottom: 0 }}>
      <button onClick={onBack} style={{ background: 'var(--white)', border: '1px solid var(--bdr)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--teal)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <i className="fas fa-arrow-left" /> {label}
      </button>
    </div>
  );

  if (loading) {
    return (
      <>
        {backBtn}
        <div className={`${styles.page} ${styles.pageDark}`}>
          <div className={styles.state}>
            <i className="fas fa-spinner fa-spin" />
            {t('livreurProfilReseau.chargementProfil')}
          </div>
        </div>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        {backBtn}
        <div className={`${styles.page} ${styles.pageDark}`}>
          <div className={styles.state}>
            <i className="fas fa-triangle-exclamation" />
            {error ?? t('livreurProfilReseau.livreurIntrouvable')}
          </div>
        </div>
      </>
    );
  }

  const onContact = () => onPop(t('livreurProfilReseau.contacterToast', { name: profile.fullName }), 'i');

  return (
    <>
      {backBtn}
      <div className={`${styles.page} ${styles.pageDark}`}>
        <ProfilHeader
          profile={profile}
          onToast={onPop}
          onRequireAuth={openAuthModal}
          onFollowChange={updateFollowState}
          onContact={onContact}
          dark
        />

        <div className={styles.pw}>
          <div>
            <ProfilTabs active={tab} onChange={setTab} avisCount={profile.reviewsCount} />

            {tab === 'info'          && <TabInfo          profile={profile} />}
            {tab === 'vehicule'      && <TabVehicule      profile={profile} />}
            {tab === 'zones'         && <TabZones         profile={profile} />}
            {tab === 'localisation'  && <TabLocalisation  profile={profile} dark />}
            {tab === 'tarifs'        && <TabTarifs        profile={profile} />}
            {tab === 'avis'          && (
              <TabPlaceholder icon="fa-star" title={t('livreurProfilReseau.avisTitle', { count: profile.reviewsCount })}
                text={t('livreurProfilReseau.avisText')} />
            )}
            {tab === 'historique'    && (
              <TabPlaceholder icon="fa-clock-rotate-left" title={t('livreurProfilReseau.historiqueTitle')}
                text={t('livreurProfilReseau.historiqueText')} />
            )}
          </div>

          <ProfilSidebar profile={profile} onToast={onPop} />
        </div>
      </div>

      {authModal}
    </>
  );
}
