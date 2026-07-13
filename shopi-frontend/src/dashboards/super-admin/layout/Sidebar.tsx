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
  activeSection:   SectionId;
  navigate:        (section: SectionId) => void;
  navUsers:        (role: UserRole | 'all') => void;
  totalUsers:      number;
  /** Compteurs par rôle issus de /users/stats — clés : company, delivery, customer, partner, correspondent, admin */
  roleStats:       Record<string, number>;
  pendingAlerts:   number;
  totalUnread:     number;
  validCodesCount: number;
  slaViolations:   number;
  isOpen:          boolean;
  onClose:         () => void;
  onLogout:        () => void;
  /** Profil réel du super-admin connecté (chargé par SuperAdminApp) */
  profilName?:     string;
  profilAvatar?:   string | null;
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
  totalUsers, roleStats, pendingAlerts, totalUnread, validCodesCount,
  slaViolations,
  isOpen, onClose, onLogout,
  profilName, profilAvatar,
}: SidebarProps) {
  const rs = (role: string) => roleStats[role] || undefined;
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
        <div
          className={`sidebar-profile${activeSection === 'profil' ? ' active' : ''}`}
          onClick={go(() => navigate('profil'))}
          style={{ cursor: 'pointer' }}
          title="Modifier mon profil"
        >
          <div className="profile-av" style={{ overflow: 'hidden', padding: 0 }}>
            {profilAvatar
              ? <img src={profilAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : (profilName
                  ? (profilName.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'SA')
                  : 'SA')}
          </div>
          <div>
            <div className="profile-name">{profilName || 'Super Admin'}</div>
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
            badge={totalUsers || undefined} badgeClass="nc-sky"
            onClick={go(() => navUsers('all'))} />
          <NavItem icon="🏪" label="Entreprises"    badge={rs('company')}       badgeClass="nc-sky" onClick={go(() => navUsers('company'))} />
          <NavItem icon="🛵" label="Livreurs"       badge={rs('delivery')}      badgeClass="nc-sky" onClick={go(() => navUsers('delivery'))} />
          <NavItem icon="🛒" label="Clients"        badge={rs('client')}        badgeClass="nc-sky" onClick={go(() => navUsers('client'))} />
          <NavItem icon="🤝" label="Partenaires"    badge={rs('partner')}       badgeClass="nc-sky" onClick={go(() => navUsers('partner'))} />
          <NavItem icon="📦" label="Correspondants" badge={rs('correspondent')} badgeClass="nc-sky" onClick={go(() => navUsers('correspondent'))} />
          <NavItem icon="🛡" label="Administrateurs" badge={rs('admin')}        badgeClass="nc-sky" onClick={go(() => navUsers('admin'))} />
        </NavGroup>

        {/* ── Groupe : Contrôle ── */}
        <NavGroup label="Contrôle">
          <NavItem icon="🎫" label="Codes invitation" active={activeSection==='invitations'}
            badge={validCodesCount} badgeClass="nc-green"
            onClick={go(() => navigate('invitations'))} />
          <NavItem icon="🚨" label="Signalements" active={activeSection==='alerts'}
            badge={pendingAlerts || undefined} badgeClass="nc-red"
            onClick={go(() => navigate('alerts'))} />
          <NavItem icon="🔔" label="Notifications" active={activeSection==='notifications-admin'}
            onClick={go(() => navigate('notifications-admin'))} />
          {/* Support — badge rouge si des tickets SLA sont en retard */}
          <NavItem icon="🎫" label="Support client" active={activeSection==='support'}
            badge={slaViolations > 0 ? slaViolations : undefined} badgeClass="nc-red"
            onClick={go(() => navigate('support'))} />
          <NavItem icon="📜" label="Journal audit" active={activeSection==='audit'}
            onClick={go(() => navigate('audit'))} />
          <NavItem icon="❤️" label="Santé système" active={activeSection==='system'}
            onClick={go(() => navigate('system'))} />
        </NavGroup>

        {/* ── Groupe : Contenu éditorial ── */}
        <NavGroup label="Contenu">
          {/* Centre d'aide — gestion des articles, catégories et FAQ */}
          <NavItem icon="📚" label="Centre d'aide" active={activeSection==='help-center'}
            onClick={go(() => navigate('help-center'))} />
        </NavGroup>

        {/* ── Groupe : Configuration ── */}
        <NavGroup label="Configuration">
          <NavItem icon="⚙️" label="Paramètres"  active={activeSection==='settings'}
            onClick={go(() => navigate('settings'))} />
          <NavItem icon="🔐" label="Permissions" active={activeSection==='permissions'}
            onClick={go(() => navigate('permissions'))} />
          <NavItem icon="🗺️" label="Référentiel Géo" active={activeSection==='geo-referentiel'}
            onClick={go(() => navigate('geo-referentiel'))} />
          <NavItem icon="💸" label="Commissions" active={activeSection==='commissions'}
            onClick={go(() => navigate('commissions'))} />
          <NavItem icon="👤" label="Mon profil" active={activeSection==='profil'}
            onClick={go(() => navigate('profil'))} />
        </NavGroup>

        {/* ── Footer : Déconnexion ── */}
        <div className="sidebar-footer">
          <NavItem icon="🚪" label="Déconnexion" onClick={onLogout} />
        </div>

      </nav>
    </>
  );
}