/**
 * @file   Sidebar.tsx
 * @module administrateur/layout
 *
 * Barre de navigation latérale du dashboard Administrateur.
 * Même pattern que super-admin/layout/Sidebar.tsx :
 *   - reçoit la page active + callback navigate
 *   - affiche les groupes de navigation + carte branche
 */

import React from 'react';
import type { AdminPage } from '../types/admin.types';

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 */
interface SidebarProps {
  activePage:       AdminPage;
  navigate:         (page: AdminPage) => void;
  pendingCount:     number;    // Signalements en attente (badge rouge)
  isOpen:           boolean;   // Contrôle l'overlay mobile
  onClose:          () => void;
  onLogout:         () => void;
}

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANTS
 * ─────────────────────────────────────────────────────────────
 */
interface NavItemProps {
  icon:      string;
  label:     string;
  active?:   boolean;
  badge?:    string | number;
  badgeRed?: boolean;
  onClick:   () => void;
}

function NavItem({ icon, label, active, badge, badgeRed, onClick }: NavItemProps) {
  return (
    <button
      className={`nav__link${active ? ' nav__link--active' : ''}`}
      onClick={onClick}
    >
      <span className="nav__icon">{icon}</span>
      <span className="nav__label">{label}</span>
      {badge !== undefined && (
        <span className={`nav__count${badgeRed ? ' nav__count--red' : ''}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="nav__group-title">{label}</div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function Sidebar({
  activePage, navigate, pendingCount, isOpen, onClose, onLogout,
}: SidebarProps) {
  // Raccourci : navigue et ferme le menu mobile en même temps
  const go = (page: AdminPage) => () => { navigate(page); onClose(); };

  return (
    <>
      {/* Overlay sombre pour fermer la sidebar sur mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 199,
          }}
        />
      )}

      {/* Sidebar principale */}
      <aside className="admin-sidebar">

        {/* Logo + nom de la plateforme */}
        <div className="sidebar__logo">
          <div className="sidebar__logo-mark">S</div>
          <div className="sidebar__logo-text">
            <span className="sidebar__logo-name">Shopi Africa</span>
            <span className="sidebar__logo-role">Administrateur</span>
          </div>
        </div>

        {/* ── Groupe : Tableau de bord ── */}
        <NavGroup label="Tableau de bord">
          <NavItem
            icon="📊"
            label="Vue d'ensemble"
            active={activePage === 'overview'}
            onClick={go('overview')}
          />
        </NavGroup>

        {/* ── Groupe : Gestion ── */}
        <NavGroup label="Gestion">
          <NavItem
            icon="👥"
            label="Utilisateurs"
            active={activePage === 'utilisateurs'}
            onClick={go('utilisateurs')}
          />
          <NavItem
            icon="📦"
            label="Commandes"
            active={activePage === 'commandes'}
            onClick={go('commandes')}
          />
          <NavItem
            icon="🚩"
            label="Signalements"
            active={activePage === 'signalements'}
            badge={pendingCount > 0 ? pendingCount : undefined}
            badgeRed
            onClick={go('signalements')}
          />
        </NavGroup>

        {/* ── Groupe : Finance ── */}
        <NavGroup label="Finance">
          <NavItem
            icon="💼"
            label="Portefeuille"
            active={activePage === 'portefeuille'}
            onClick={go('portefeuille')}
          />
        </NavGroup>

        {/* ── Groupe : Compte ── */}
        <NavGroup label="Compte">
          <NavItem
            icon="⚙️"
            label="Paramètres"
            active={activePage === 'parametres'}
            onClick={go('parametres')}
          />
          <NavItem
            icon="🚪"
            label="Déconnexion"
            onClick={onLogout}
          />
        </NavGroup>

        {/* ── Carte branche (bas de la sidebar) ── */}
        <div className="sidebar__branch">
          <div className="sidebar__branch-label">BRANCHE</div>
          <div className="sidebar__branch-name">Admin Conakry</div>
          <span className="sidebar__branch-status">
            <span className="adm-dot" />
            Opérationnelle
          </span>
        </div>

      </aside>
    </>
  );
}
