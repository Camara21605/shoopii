// src/dashboards/livreur/pages/MonProfilLivreurPage.tsx
// Affiche le profil public du livreur connecté, tel que les clients le voient.

import { useTranslation } from 'react-i18next';
import { useLivreurParametres } from '../hooks/useLivreurParametres';
import ProfilLivreurReseauPage from './ProfilLivreurReseauPage';
import type { PageId } from '../data/livreurData';
import shared from '../styles/Shared.module.css';

interface Props {
  onPop:      (m: string, t?: string) => void;
  onNavigate: (p: PageId) => void;
}

export default function MonProfilLivreurPage({ onPop, onNavigate }: Props) {
  const { t } = useTranslation();
  const { data, loading, error } = useLivreurParametres();

  if (loading) {
    return (
      <div className={shared.page}>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)', fontSize: 13 }}>
          <i className="fas fa-spinner fa-spin" /> {t('livreurProfilReseau.chargementProfil')}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={shared.page}>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)', fontSize: 13 }}>
          <i className="fas fa-triangle-exclamation" /> {error ?? t('livreurMonProfil.profilIntrouvable')}
        </div>
      </div>
    );
  }

  return (
    <ProfilLivreurReseauPage
      id={data.id}
      onBack={() => onNavigate('overview')}
      onPop={onPop}
      backLabel={t('livreurMonProfil.retourAccueil')}
    />
  );
}
