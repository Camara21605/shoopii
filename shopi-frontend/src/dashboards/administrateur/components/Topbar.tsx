/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/Topbar.tsx
 *
 * Barre supérieure : hamburger mobile + titre + sous-titre
 * + alertes rapides + cloche notifications (badge temps réel)
 * + bouton "Générer un code".
 * ================================================================ */

import styles from '../styles/Topbar.module.css';
import type { AdminPage } from '../data/types';

interface TopbarProps {
  activePage:  AdminPage;
  onBurger:    () => void;
  onGenerate:  () => void;
  onNavigate:  (page: AdminPage) => void;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
  unreadCount: number;
  onBell:      () => void;
  /* Permissions "Modules généraux" — masque l'icône Signalements si
   * l'admin n'a pas la permission 'reports' (cohérent avec Sidebar.tsx,
   * sinon le clic navigue vers une page aussitôt renvoyée vers "overview"
   * par le filet de sécurité d'AdministrateurApp.tsx). */
  geoPerms?:   Record<string, boolean | string | null>;
}

/* Titre + sous-titre par page */
const TITLES: Record<AdminPage, [string, string]> = {
  overview:      ["Vue d'ensemble",     'Pilotage de la zone Conakry'],
  codes:         ['Codes de création',  'Créez des comptes de tout type pour votre zone'],
  partenaires:   ['Partenaires',        'Les partenaires de votre zone'],
  acteurs:       ['Acteurs de la zone', 'Tous les comptes rattachés à votre zone'],
  clients:       ['Clients',            'Clients ayant commandé dans votre zone'],
  validations:   ['Validations',        "Comptes en attente d'approbation"],
  signalements:  ['Signalements',       'Centre de modération de la zone'],
  commandes:     ['Commandes',          'Activité commerciale de la zone'],
  finances:      ['Finances',           "Volume d'affaires et commissions"],
  stats:         ['Statistiques',       'Communes, litiges et activité de la zone'],
  support:       ['Support',            'File d’attente des tickets de votre zone'],
  audit:         ["Journal d'audit",    "Historique de vos actions d'administration"],
  parametres:    ['Paramètres',         'Configuration de votre compte administrateur'],
  geo:           ['Référentiel Géo',    'Gestion des communes et zones géographiques'],
};

export default function Topbar({
  activePage, onBurger, onGenerate, onNavigate, onToast,
  unreadCount, onBell, geoPerms,
}: TopbarProps) {
  const [title, sub] = TITLES[activePage] ?? ['', ''];
  void onToast; // prop conservée pour compatibilité ascendante
  const canSeeReports = geoPerms?.reports === true;

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
        {/* Alertes → page signalements (masqué sans la permission 'reports') */}
        {canSeeReports && (
          <button className={styles.ic} title="Signalements" onClick={() => onNavigate('signalements')}>
            <i className="fas fa-triangle-exclamation" />
            <span className={styles.dot} />
          </button>
        )}

        {/* Cloche notifications avec badge compteur temps réel */}
        <button
          className={`${styles.ic} ${unreadCount > 0 ? styles.icActive : ''}`}
          title={`${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`}
          onClick={onBell}>
          <i className="fas fa-bell" />
          {unreadCount > 0 && (
            <span className={styles.badge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* CTA générer un code */}
        <button className={styles.new} onClick={onGenerate}>
          <i className="fas fa-plus" /> <span>Générer un code</span>
        </button>
      </div>
    </header>
  );
}
