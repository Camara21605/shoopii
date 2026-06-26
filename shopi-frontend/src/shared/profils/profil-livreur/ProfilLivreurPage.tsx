/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/ProfilLivreurPage.tsx
 *
 * RÔLE : Page profil complet d'un livreur (route /livreurs/:id).
 *        Utilise le MÊME Header que le reste du site (cohérence).
 *        Assemble : Header global + header profil + onglets + sidebar.
 *
 * DONNÉES : hook useLivreurProfile (GET /client/livreurs/:id)
 * ================================================================ */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStartConversation } from '../../../shared/hooks/useStartConversation';

/* ── Header global partagé (même que HomePage) ── */
import Header from '../../../modules/home/components/layout/Header';

import { useLivreurProfile } from './hooks/useLivreurProfile';
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
  onToast: (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function ProfilLivreurPage({ onToast }: Props) {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { profile, loading, error, tab, setTab, follow, followLoading } =
    useLivreurProfile(id, onToast);
  const { start: startConv } = useStartConversation();

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
            Chargement du profil…
          </div>
        </div>
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
            {error ?? 'Livreur introuvable.'}
            <div style={{ marginTop: 16 }}>
              <button className={`${styles.btn} ${styles.btnMsg}`} onClick={() => navigate('/livreurs')}>
                <i className="fas fa-arrow-left" /> Retour aux livreurs
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const onContact = () => {
    if (!profile.isSuivi) {
      onToast('Abonnez-vous à ce livreur pour lui envoyer un message.', 'w');
      return;
    }
    startConv('delivery', id!, msg => onToast(`❌ ${msg}`, 'e'));
  };

  return (
    <>
      {/* Header global partagé */}
      {header}

      <div className={styles.page}>
        <ProfilHeader
          profile={profile}
          followLoading={followLoading}
          onFollow={follow}
          onContact={onContact}
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
              <TabPlaceholder icon="fa-star" title={`Avis (${profile.reviewsCount})`}
                text="Les avis clients seront affichés ici prochainement." />
            )}
            {tab === 'historique' && (
              <TabPlaceholder icon="fa-clock-rotate-left" title="Historique"
                text="L'historique des livraisons sera affiché ici prochainement." />
            )}
          </div>

          {/* SIDEBAR */}
          <ProfilSidebar profile={profile} onToast={onToast} />
        </div>

        {/* BARRE D'ACTIONS MOBILE */}
        <div className={styles.actionBar}>
          <button className={styles.abMsg} onClick={onContact}>
            <i className="fas fa-message" /> Contacter
          </button>
          <button className={styles.abFollow} onClick={follow} disabled={followLoading}>
            {profile.isSuivi
              ? <><i className="fas fa-user-check" /> Abonné(e)</>
              : <><i className="fas fa-plus" /> Suivre</>}
          </button>
        </div>
      </div>
    </>
  );
}