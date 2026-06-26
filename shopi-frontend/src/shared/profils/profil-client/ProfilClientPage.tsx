/* ================================================================
 * FICHIER : src/modules/home/components/profil-client/ProfilClientPage.tsx
 *
 * RÔLE : Page "Mon profil" du client connecté (route /mon-profil).
 *        Utilise le MÊME Header que le reste du site.
 *        Assemble : Header global + header profil + onglets + sidebar.
 *
 * AUTONOME : aucune prop. Toasts émis via 'shopi-toast'.
 *
 * DONNÉES (stratégie hybride mock → API) :
 *   ✅ DYNAMIQUE via useProfilClient() : identité, KPI, points,
 *      moyens de paiement, infos personnelles.
 *   🟡 MOCK pour l'instant : commandes, abonnements, favoris, avis,
 *      transactions wallet (pas encore d'endpoint dédié).
 * ================================================================ */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/* ── Header global partagé ── */
import Header from '../../../modules/home/components/layout/Header';

/* ── Hook de données dynamiques ── */
import  { useProfilClient } from './hooks/useProfilClient';

/* ── Sous-composants ── */
import ProfilHeaderClient  from './components/ProfilHeaderClient';
import ProfilTabsClient    from './components/ProfilTabsClient';
import ProfilSidebarClient from './components/ProfilSidebarClient';

/* ── Sections d'onglets (encore en mock) ── */
import SectionOrders    from './sections/SectionOrders';
import SectionSubs      from './sections/SectionSubs';
import SectionFavs      from './sections/SectionFavs';
import SectionReviews   from './sections/SectionReviews';
import SectionActivity  from './sections/SectionActivity';
import SectionAddresses from './sections/SectionAddresses';

import type { ClientTab } from './types';
import styles from './styles/ProfilClient.module.css';

export default function ProfilClientPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ClientTab>('orders');

  /* Toast global (même mécanisme que le routeur) */
  const onToast = useCallback((msg: string, _type?: 's' | 'i' | 'w' | 'e') => {
    window.dispatchEvent(new CustomEvent('shopi-toast', { detail: msg }));
  }, []);

  /* ── Données dynamiques du profil ── */
  const {
    profile, kpis, pays, infos, points, wallet,
    commandes, abonnements, favoris, avis, avisScore, activites,
    loading, error,
  } = useProfilClient();

  /* Header global — mêmes handlers que HomePage */
  const header = (
    <Header
      onToast={(m) => onToast(m)}
      onLogin={() => navigate('/login')}
      onRegister={() => navigate('/register')}
    />
  );

  /* ── État de chargement ── */
  if (loading) {
    return (
      <>
        {header}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-spinner fa-spin" /> Chargement de votre profil…
          </div>
        </div>
      </>
    );
  }

  /* ── État d'erreur ── */
  if (error || !profile) {
    return (
      <>
        {header}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-triangle-exclamation" />
            {error ?? 'Profil introuvable.'}
            <div style={{ marginTop: 16 }}>
              <button className={styles.abEdit} style={{ padding: '10px 18px', borderRadius: 9 }}
                onClick={() => navigate('/home')}>
                <i className="fas fa-arrow-left" /> Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <div className={styles.page}>
        {/* En-tête profil (cover + identité + KPI) — DYNAMIQUE */}
        <ProfilHeaderClient
          client={profile}
          kpis={kpis}
          onEdit={() => navigate('/parametres')}
          onShare={() => onToast('🔗 Lien du profil copié')}
          onMessage={() => navigate('/messagerie')}
        />

        <div className={styles.pw}>
          {/* COLONNE PRINCIPALE — onglets (mock pour l'instant) */}
          <div>
            <ProfilTabsClient active={tab} onChange={setTab} />

            {tab === 'orders'    && <SectionOrders    commandes={commandes} loading={loading} />}
            {tab === 'subs'      && <SectionSubs      onToast={onToast} abonnements={abonnements} loading={loading} />}
            {tab === 'favs'      && <SectionFavs      onToast={onToast} favoris={favoris} />}
            {tab === 'reviews'   && <SectionReviews   onToast={onToast} avis={avis} score={avisScore} />}
            {tab === 'activity'  && <SectionActivity  onToast={onToast} jours={activites} />}
            {tab === 'addresses' && <SectionAddresses onToast={onToast} />}
          </div>

          {/* SIDEBAR — paiement, infos & points DYNAMIQUES */}
          <ProfilSidebarClient
            onToast={onToast}
            pays={pays}
            infos={infos}
            points={points}
            wallet={wallet}
          />
        </div>

        {/* BARRE D'ACTIONS MOBILE */}
        <div className={styles.actionBar}>
          <button className={styles.abShare} onClick={() => onToast('🔗 Lien du profil copié')}>
            <i className="fas fa-share-nodes" /> Partager
          </button>
          <button className={styles.abEdit} onClick={() => navigate('/parametres')}>
            <i className="fas fa-pen" /> Modifier
          </button>
        </div>
      </div>
    </>
  );
}