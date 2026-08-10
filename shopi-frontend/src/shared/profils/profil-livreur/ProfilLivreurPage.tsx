/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/ProfilLivreurPage.tsx
 *
 * RÔLE : Page profil complet d'un livreur (route /livreurs/:id).
 *        Utilise le MÊME Header que le reste du site (cohérence).
 *        Assemble : Header global + header profil + onglets + sidebar.
 *
 * DONNÉES : hook useLivreurProfile (GET /client/livreurs/:id)
 * ================================================================ */

import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStartConversation } from '../../../shared/hooks/useStartConversation';
import { useProfileCall } from '../../../shared/hooks/useProfileCall';
import { useAuthGate } from '../../hooks/useAuthGate';

/* ── Header global partagé (même que HomePage) ── */
import Header from '../../../modules/home/components/layout/Header';

import { useLivreurProfile } from './hooks/useLivreurProfile';
import FollowButton   from '../../components/FollowButton';
import ProfilHeader   from './components/ProfilHeader';
import ProfilTabs     from './components/ProfilTabs';
import TabInfo        from './components/TabInfo';
import TabVehicule    from './components/TabVehicule';
import TabZones       from './components/TabZones';
import TabTarifs      from './components/TabTarifs';
import TabPlaceholder from './components/TabPlaceholder';
import ProfilSidebar  from './components/ProfilSidebar';
import styles from './styles/ProfilLivreur.module.css';

interface Props {
  /* Fournis par le parent (comme HomePage) pour alimenter le Header */
  onToast?: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function ProfilLivreurPage({ onToast = () => {} }: Props) {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { openAuthModal, authModal } = useAuthGate();
  const { profile, loading, error, tab, setTab, updateFollowState } =
    useLivreurProfile(id);
  const { start: startConv } = useStartConversation();
  const { call: callProfile, loading: callLoading } = useProfileCall();

  /* ── Header global — mêmes handlers que HomePage ── */
  const header = (
    <Header
      onToast={(m) => onToast(m)}
      onLogin={() => navigate('/login')}
      onRegister={() => navigate('/register')}
    />
  );

  /* ── États de chargement / erreur ── */
  if (loading) {
    return (
      <>
        {header}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-spinner fa-spin" />
            {t('profilLivreur.loading')}
          </div>
        </div>
        {authModal}
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        {header}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-triangle-exclamation" />
            {error ?? t('profilLivreur.notFound')}
            <div style={{ marginTop: 16 }}>
              <button className={`${styles.btn} ${styles.btnMsg}`} onClick={() => navigate('/livreurs')}>
                <i className="fas fa-arrow-left" /> {t('profilLivreur.retourLivreurs')}
              </button>
            </div>
          </div>
        </div>
        {authModal}
      </>
    );
  }

  const onContact = () => {
    if (!profile.isSuivi) {
      onToast(t('profilLivreur.publicPage.abonnezVousMessage'), 'w');
      return;
    }
    startConv('delivery', id!, msg => onToast(t('profilLivreur.publicPage.erreurToast', { msg }), 'e'));
  };

  const onCall = () => {
    if (!profile.isSuivi) {
      onToast(t('profilLivreur.publicPage.abonnezVousAppel'), 'w');
      return;
    }
    callProfile('delivery', id!, profile.fullName, profile.profilePicture, msg => onToast(t('profilLivreur.publicPage.erreurToast', { msg }), 'e'));
  };

  return (
    <>
      {/* Header global partagé */}
      {header}

      <div className={styles.page}>
        <ProfilHeader
          profile={profile}
          callLoading={callLoading}
          onToast={onToast}
          onRequireAuth={openAuthModal}
          onFollowChange={updateFollowState}
          onContact={onContact}
          onCall={onCall}
        />

        <div className={styles.pw}>
          {/* COLONNE PRINCIPALE */}
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

          {/* SIDEBAR */}
          <ProfilSidebar profile={profile} onToast={onToast} />
        </div>

        {/* BARRE D'ACTIONS MOBILE */}
        <div className={styles.actionBar}>
          <button className={styles.abMsg} onClick={onContact}>
            <i className="fas fa-message" /> {t('profilLivreur.contacter')}
          </button>
          <FollowButton
            actorType="livreur"
            id={profile.id}
            name={profile.fullName}
            isSuivi={profile.isSuivi}
            onToast={onToast}
            onRequireAuth={openAuthModal}
            onChange={updateFollowState}
          />
        </div>
      </div>

      {authModal}
    </>
  );
}