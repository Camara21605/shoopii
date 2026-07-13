/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/Topbar.tsx
 * ================================================================ */

import { useNavigate } from 'react-router-dom';
import styles from '../styles/Topbar.module.css';
import type { PartenairePage } from '../data/types';
import NotificationCenter from '../../../shared/notifications/NotificationCenter';

interface TopbarProps {
  activePage:    PartenairePage;
  onGenerate:    () => void;
  onReport:      () => void;
  onMenuToggle?: () => void;
}

const TITLES: Record<PartenairePage, [string, string]> = {
  overview:     ["Vue d'ensemble",          'Pilotez votre réseau et vos recrutements'],
  codes:        ['Codes de création',       'Générez et envoyez des codes aux acteurs'],
  acteurs:      ['Mes acteurs',             'Les acteurs que vous avez recrutés'],
  invitations:  ['Invitations',             'Suivi de vos parrainages'],
  commissions:  ['Commissions',             'Vos revenus de partenaire'],
  paiements:    ['Paiements',               'Historique de vos retraits'],
  stats:        ['Statistiques',            "Performance de votre acquisition"],
  signalements: ['Sécurité & Signalements', 'Signalez les utilisateurs malveillants'],
  parametres:   ['Paramètres',              'Configuration de votre compte partenaire'],
};

export default function Topbar({ activePage, onGenerate, onReport, onMenuToggle }: TopbarProps) {
  const navigate = useNavigate();
  const [title, sub] = TITLES[activePage] ?? ['', ''];

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {onMenuToggle && (
          <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="Menu">
            <i className="fas fa-bars" />
          </button>
        )}
        <div>
          <div className={styles.title}>{title}</div>
          <div className={styles.sub}>{sub}</div>
        </div>
      </div>

      <div className={styles.acts}>
        <button className={styles.ic} title="Signaler un utilisateur" onClick={onReport}>
          <i className="fas fa-flag" />
        </button>
        <NotificationCenter />
        <button className={styles.ic} onClick={() => navigate('/aide')} title="Centre d'aide">
          <i className="fas fa-circle-question" />
        </button>
        <button className={styles.new} onClick={onGenerate}>
          <i className="fas fa-plus" /> Générer un code
        </button>
      </div>
    </header>
  );
}
