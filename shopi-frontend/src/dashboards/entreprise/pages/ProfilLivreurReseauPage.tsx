// src/dashboards/entreprise/pages/ProfilLivreurReseauPage.tsx
// Affiche le profil complet d'un livreur du réseau, sans le Header public,
// intégré dans le dashboard entreprise.

import { useTranslation } from 'react-i18next';
import { useLivreurProfile } from '../../../shared/profils/profil-livreur/hooks/useLivreurProfile';
import ProfilHeader   from '../../../shared/profils/profil-livreur/components/ProfilHeader';
import ProfilTabs     from '../../../shared/profils/profil-livreur/components/ProfilTabs';
import TabInfo        from '../../../shared/profils/profil-livreur/components/TabInfo';
import TabVehicule    from '../../../shared/profils/profil-livreur/components/TabVehicule';
import TabZones       from '../../../shared/profils/profil-livreur/components/TabZones';
import TabTarifs      from '../../../shared/profils/profil-livreur/components/TabTarifs';
import TabPlaceholder from '../../../shared/profils/profil-livreur/components/TabPlaceholder';
import ProfilSidebar  from '../../../shared/profils/profil-livreur/components/ProfilSidebar';
import styles from '../../../shared/profils/profil-livreur/styles/ProfilLivreur.module.css';
import shared from './ReseauShared.module.css';

interface Props {
  id:        string;
  onBack:    () => void;
  onPop:     (msg: string, type?: string) => void;
  backLabel?: string;
}

export default function ProfilLivreurReseauPage({ id, onBack, onPop, backLabel }: Props) {
  const { t } = useTranslation();
  const { profile, loading, error, tab, setTab, follow, followLoading } =
    useLivreurProfile(id, onPop);
  const backLabelResolved = backLabel ?? t('profilLivreur.retourLivreurs');

  const backBtn = (
    <div className={shared.page} style={{ paddingBottom: 0 }}>
      <button onClick={onBack} style={{ background: 'var(--white)', border: '1px solid var(--bdr)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <i className="fas fa-arrow-left" /> {backLabelResolved}
      </button>
    </div>
  );

  if (loading) {
    return (
      <>
        {backBtn}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-spinner fa-spin" />
            {t('profilLivreur.loading')}
          </div>
        </div>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        {backBtn}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-triangle-exclamation" />
            {error ?? t('profilLivreur.notFound')}
          </div>
        </div>
      </>
    );
  }

  const onContact = () => onPop(t('profilLivreur.reseauPage.contacterToast', { nom: profile.fullName }), 'i');

  return (
    <>
      {backBtn}
      <div className={styles.page}>
        <ProfilHeader
          profile={profile}
          followLoading={followLoading}
          onFollow={follow}
          onContact={onContact}
        />

        <div className={styles.pw}>
          <div>
            <ProfilTabs active={tab} onChange={setTab} avisCount={profile.reviewsCount} />

            {tab === 'info'       && <TabInfo     profile={profile} />}
            {tab === 'vehicule'   && <TabVehicule profile={profile} />}
            {tab === 'zones'      && <TabZones    profile={profile} />}
            {tab === 'tarifs'     && <TabTarifs   profile={profile} />}
            {tab === 'avis'       && (
              <TabPlaceholder icon="fa-star" title={t('profilLivreur.placeholders.avisTitle', { count: profile.reviewsCount })}
                text={t('profilLivreur.placeholders.avisText')} />
            )}
            {tab === 'historique' && (
              <TabPlaceholder icon="fa-clock-rotate-left" title={t('profilLivreur.placeholders.historiqueTitle')}
                text={t('profilLivreur.placeholders.historiqueText')} />
            )}
          </div>

          <ProfilSidebar profile={profile} onToast={onPop} />
        </div>
      </div>
    </>
  );
}
