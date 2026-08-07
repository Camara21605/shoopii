/* ================================================================
 * FICHIER : src/modules/home/components/profil-livreur/components/TabTarifs.tsx
 *
 * Onglet "Tarifs" : grille tarifaire du livreur.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilLivreur.module.css';
import type { LivreurProfile } from '../types';

const fmt = (n: number) => `${n.toLocaleString('fr-FR')} GNF`;

export default function TabTarifs({ profile }: { profile: LivreurProfile }) {
  const { t } = useTranslation();
  const { tarifs } = profile;
  const lignes = [
    { icon: 'fa-flag',          label: t('profilLivreur.tabTarifs.tarifBase'),        value: fmt(tarifs.base) },
    { icon: 'fa-route',         label: t('profilLivreur.tabTarifs.parKm'),        value: fmt(tarifs.parKm) },
    { icon: 'fa-weight-hanging',label: t('profilLivreur.tabTarifs.supplementLourd'), value: fmt(tarifs.supplementLourd) },
    { icon: 'fa-moon',          label: t('profilLivreur.tabTarifs.majorationNocturne'),  value: `+${tarifs.majorationNocturne}%` },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.ch}><div className={styles.ct}><i className="fas fa-tag" /> {t('profilLivreur.tabTarifs.title')}</div></div>
      <div className={styles.infoGrid}>
        {lignes.map(l => (
          <div key={l.label} className={styles.tarifRow}>
            <div className={styles.trSvc}><i className={`fas ${l.icon}`} /> {l.label}</div>
            <div className={styles.trPrice}>{l.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}