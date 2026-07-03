// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/layout/Sidebar.tsx
//
// Barre de navigation latérale. Elle reçoit :
// - la section active (pour colorier le lien courant)
// - les compteurs de badges (alertes, messages, codes)
// - les fonctions navigate et navUsers du hook central
// ─────────────────────────────────────────────────────────────

import React from 'react';
import type { SectionId, UserRole } from '../types/codes.types';

interface SidebarProps {
  activeSection: SectionId;
  navigate: (section: SectionId) => void;
  navUsers: (role: UserRole | 'all') => void;
  totalUsers: number;
  pendingAlerts: number;
  totalUnread: number;
  validCodesCount: number;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

interface NavItemProps {
  icon: string;
  label: string;
  active?: boolean;
  badge?: string | number;
  badgeClass?: string;
  onClick: () => void;
}

// ─── Composant de ligne de navigation ──────────────────────
function NavItem({ icon, label, active, badge, badgeClass = 'nc-sky', onClick }: NavItemProps) {
  return (
    <div className={`nav-item${active ? ' active' : ''}`} onClick={onClick}>
      <span className="n-icon">{icon}</span>
      <span className="n-label">{label}</span>
      {badge !== undefined && (
        <span className={`n-count ${badgeClass}`}>{badge}</span>
      )}
    </div>
  );
}

// ─── Composant groupe (section du menu) ───────────────────
function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="nav-group">
      <div className="nav-group-label">{label}</div>
      {children}
    </div>
  );
}

export default function Sidebar({
  activeSection, navigate, navUsers,
  totalUsers, pendingAlerts, totalUnread, validCodesCount,
  isOpen, onClose, onLogout
}: SidebarProps) {
  // Sur petit écran, refermer le sidebar après avoir choisi une section
  const go = (fn: () => void) => () => { fn(); onClose(); };

  return (
    <>
      {/* Overlay mobile (fond foncé derrière le sidebar) */}
      {isOpen && (
        <div
          id="sidebarOverlay"
          className="show"
          onClick={onClose}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:199 }}
        />
      )}

      <nav className={`sidebar${isOpen ? ' open' : ''}`} id="sidebar">

        {/* ── Logo ── */}
        <div className="sidebar-logo">
          <div className="logo-mark">🛍</div>
          <div className="logo-text">Shopi<em>Africa</em></div>
          <span className="logo-badge">SUPER ADMIN</span>
        </div>

        {/* ── Profil connecté ── */}
        <div className="sidebar-profile">
          <div className="profile-av">SA</div>
          <div>
            <div className="profile-name">Super Admin</div>
            <div className="profile-role">Contrôle total</div>
          </div>
          <div className="profile-dot" />
        </div>

        {/* ── Groupe : Tableau de bord ── */}
        <NavGroup label="Tableau de bord">
          <NavItem icon="📊" label="Vue d'ensemble" active={activeSection==='overview'}
            onClick={go(() => navigate('overview'))} />
          <NavItem icon="📈" label="Analytiques" active={activeSection==='analytics'}
            badge="Live" badgeClass="nc-sky"
            onClick={go(() => navigate('analytics'))} />
          <NavItem icon="💰" label="Finances" active={activeSection==='finances'}
            onClick={go(() => navigate('finances'))} />
          <NavItem icon="👛" label="Portefeuille" active={activeSection==='portefeuille'}
            onClick={go(() => navigate('portefeuille'))} />
        </NavGroup>

        {/* ── Groupe : Utilisateurs ── */}
        <NavGroup label="Utilisateurs">
          <NavItem icon="👥" label="Tous les comptes" active={activeSection==='users'}
            badge={totalUsers} badgeClass="nc-sky"
            onClick={go(() => navUsers('all'))} />
          <NavItem icon="🏪" label="Entreprises"    onClick={go(() => navUsers('company'))} />
          <NavItem icon="🛵" label="Livreurs"       onClick={go(() => navUsers('delivery'))} />
          <NavItem icon="🛒" label="Clients"        onClick={go(() => navUsers('customer'))} />
          <NavItem icon="🤝" label="Partenaires"    onClick={go(() => navUsers('partner'))} />
          <NavItem icon="📦" label="Correspondants" onClick={go(() => navUsers('correspondent'))} />
          <NavItem icon="🛡" label="Administrateurs" onClick={go(() => navUsers('admin'))} />
        </NavGroup>

        {/* ── Groupe : Contrôle ── */}
        <NavGroup label="Contrôle">
          <NavItem icon="🎫" label="Codes invitation" active={activeSection==='invitations'}
            badge={validCodesCount} badgeClass="nc-green"
            onClick={go(() => navigate('invitations'))} />
          <NavItem icon="💬" label="Messagerie" active={activeSection==='messaging'}
            badge={totalUnread || undefined} badgeClass="nc-red"
            onClick={go(() => navigate('messaging'))} />
          <NavItem icon="🚨" label="Signalements" active={activeSection==='alerts'}
            badge={pendingAlerts || undefined} badgeClass="nc-red"
            onClick={go(() => navigate('alerts'))} />
          <NavItem icon="🔔" label="Notifications" active={activeSection==='notifications-admin'}
            onClick={go(() => navigate('notifications-admin'))} />
          <NavItem icon="📜" label="Journal audit" active={activeSection==='audit'}
            onClick={go(() => navigate('audit'))} />
          <NavItem icon="❤️" label="Santé système" active={activeSection==='system'}
            onClick={go(() => navigate('system'))} />
        </NavGroup>

        {/* ── Groupe : Configuration ── */}
        <NavGroup label="Configuration">
          <NavItem icon="⚙️" label="Paramètres"  active={activeSection==='settings'}
            onClick={go(() => navigate('settings'))} />
          <NavItem icon="🔐" label="Permissions" active={activeSection==='permissions'}
            onClick={go(() => navigate('permissions'))} />
        </NavGroup>

        {/* ── Footer : Déconnexion ── */}
        <div className="sidebar-footer">
          <NavItem icon="🚪" label="Déconnexion" onClick={onLogout} />
        </div>

      </nav>
    </>
  );
}