/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/Topbar.tsx
 *
 * Barre supérieure : hamburger mobile + titre + sous-titre
 * + alertes rapides + bouton "Générer un code".
 * ================================================================ */

import styles from '../styles/Topbar.module.css';
import type { AdminPage } from '../data/types';

interface TopbarProps {
  activePage: AdminPage;
  onBurger:   () => void;
  onGenerate: () => void;
  onNavigate: (page: AdminPage) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Titre + sous-titre par page */
const TITLES: Record<AdminPage, [string, string]> = {
  overview:     ["Vue d'ensemble",  'Pilotage de la zone Conakry'],
  codes:        ['Codes de création', 'Créez des comptes de tout type pour votre zone'],
  partenaires:  ['Partenaires',     'Les partenaires de votre zone'],
  acteurs:      ['Acteurs de la zone', 'Tous les comptes rattachés à votre zone'],
  validations:  ['Validations',     "Comptes en attente d'approbation"],
  signalements: ['Signalements',    'Centre de modération de la zone'],
  commandes:    ['Commandes',       'Activité commerciale de la zone'],
  finances:     ['Finances',        "Volume d'affaires et commissions"],
  audit:        ["Journal d'audit", "Historique de vos actions d'administration"],
  parametres:   ['Paramètres',      'Configuration de votre compte administrateur'],
};

export default function Topbar({ activePage, onBurger, onGenerate, onNavigate, onToast }: TopbarProps) {
  const [title, sub] = TITLES[activePage] ?? ['', ''];

  return (
    <header className={styles.topbar}>
      {/* Hamburger (visible uniquement sur mobile) */}
      <button className={styles.burger} onClick={onBurger}><i className="fas fa-bars" /></button>

      {/* Titre + sous-titre de la page courante */}
      <div>
        <div className={styles.title}>{title}</div>
        <div className={styles.sub}>{sub}</div>
      </div>

      {/* Actions rapides : alertes, notifications, CTA */}
      <div className={styles.acts}>
        <button className={styles.ic} title="Alertes" onClick={() => onNavigate('signalements')}>
          <i className="fas fa-triangle-exclamation" /><span className={styles.dot} />
        </button>
        <button className={styles.ic} onClick={() => onToast('🔔 6 notifications', 'i')}>
          <i className="fas fa-bell" /><span className={styles.dot} />
        </button>
        <button className={styles.new} onClick={onGenerate}>
          <i className="fas fa-plus" /> <span>Générer un code</span>
        </button>
      </div>
    </header>
  );
}
