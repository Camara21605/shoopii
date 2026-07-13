/**
 * @file   Topbar.tsx
 * @module administrateur/layout
 *
 * Barre supérieure du dashboard Administrateur.
 * Contient : bouton menu mobile, recherche globale,
 * statut de la branche, notifications, profil admin.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate }                 from 'react-router-dom';
import { tokenStorage }                from '../../../shared/services/apiFetch';
import { getRoleFromToken }            from '../../../shared/services/authUtils';

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 */
interface TopbarProps {
  onMenuClick:  () => void;           // Ouvre/ferme la sidebar mobile
  onSearch:     (v: string) => void;  // Remonte la recherche au parent
  pendingCount: number;               // Nombre de signalements en attente
}

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT
 * ─────────────────────────────────────────────────────────────
 */
export default function Topbar({ onMenuClick, onSearch, pendingCount }: TopbarProps) {
  const [clock, setClock] = useState('');
  const routerNavigate = useNavigate();

  // Horloge en temps réel (mise à jour chaque seconde)
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Récupère l'email de l'admin depuis le JWT
  const token = tokenStorage.get();
  const role  = token ? getRoleFromToken(token) : null;

  const handleLogout = () => {
    tokenStorage.remove();
    routerNavigate('/login');
  };

  return (
    <header className="admin-topbar">
      {/* Bouton hamburger (visible sur mobile) */}
      <button
        className="topbar__icon-btn"
        onClick={onMenuClick}
        title="Menu"
        style={{ display: 'grid', placeItems: 'center' }}
      >
        ☰
      </button>

      {/* Barre de recherche */}
      <div className="topbar__search">
        <span style={{ fontSize: '0.9rem' }}>🔍</span>
        <input
          type="text"
          placeholder="Rechercher un utilisateur, une commande…"
          onChange={e => onSearch(e.target.value)}
        />
        <kbd>⌘K</kbd>
      </div>

      {/* Statut de la branche (poussé à droite) */}
      <span className="topbar__branch-status">
        <span className="adm-dot" />
        Branche opérationnelle
      </span>

      {/* Horloge */}
      <span style={{ fontSize: '0.82rem', color: 'var(--adm-text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {clock}
      </span>

      {/* Bouton signalements (badge rouge si en attente) */}
      <button
        className="topbar__icon-btn"
        title={`${pendingCount} signalement${pendingCount > 1 ? 's' : ''} en attente`}
      >
        🚩
        {pendingCount > 0 && <span className="badge-dot" />}
      </button>

      {/* Bouton notifications */}
      <button className="topbar__icon-btn" title="Notifications">
        🔔
      </button>

      {/* Profil admin */}
      <div className="topbar__profile">
        <div className="topbar__profile-info">
          <div className="topbar__profile-name">Administrateur</div>
          <div className="topbar__profile-role">{role ?? 'admin'}</div>
        </div>
        {/* Avatar avec initiale */}
        <div
          className="adm-avatar"
          title="Déconnexion"
          style={{ cursor: 'pointer' }}
          onClick={handleLogout}
        >
          A
        </div>
      </div>
    </header>
  );
}
