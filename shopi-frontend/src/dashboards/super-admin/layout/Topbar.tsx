// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/layout/Topbar.tsx
//
// Barre supérieure : recherche globale, horloge, thème,
// badges messagerie et notifications.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SectionId } from '../types/codes.types';
import NotificationCenter from '../../../shared/notifications/NotificationCenter';

interface TopbarProps {
  onMenuClick: () => void;
  onSearchGlobal: (v: string) => void;
  totalUnread: number;
  pendingAlerts: number;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onNavigate: (section: SectionId) => void;
}

export default function Topbar({
  onMenuClick, onSearchGlobal, totalUnread, pendingAlerts,
  theme, onThemeToggle, onNavigate,
}: TopbarProps) {
  const [clock, setClock] = useState('');
  const navigate = useNavigate();

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

  return (
    <header className="topbar">
      <button
        className="tb-icon-btn"
        id="menuBtn"
        onClick={onMenuClick}
      >
        ☰
      </button>

      <div className="topbar-search">
        <span className="ts-icon">🔍</span>
        <input
          type="text"
          placeholder="Rechercher…"
          onChange={(e) => onSearchGlobal(e.target.value)}
        />
      </div>

      <div className="topbar-spacer" />

      <div className="live-chip">
        <div className="live-dot" />
        LIVE
      </div>

      <div className="tb-clock">{clock}</div>

      {/* Theme toggle */}
      <div className="theme-toggle" onClick={onThemeToggle} title="Basculer thème clair/sombre">
        <div className="theme-toggle-thumb">
          {theme === 'dark' ? '🌙' : '☀️'}
        </div>
      </div>

      {/* Messagerie */}
      <button
        className="tb-icon-btn"
        onClick={() => onNavigate('messaging')}
        title="Messagerie"
      >
        💬
        {totalUnread > 0 && <div className="tb-badge" />}
      </button>

      {/* Alertes */}
      <button
        className="tb-icon-btn"
        onClick={() => onNavigate('alerts')}
      >
        🔔
        {pendingAlerts > 0 && <div className="tb-badge" />}
      </button>

      {/* Notifications temps réel */}
      <NotificationCenter />

      {/* Centre d'aide — accès direct depuis le dashboard super-admin */}
      <button
        className="tb-icon-btn"
        onClick={() => navigate('/aide')}
        title="Centre d'aide"
        aria-label="Centre d'aide"
      >
        <i className="fas fa-circle-question" style={{ fontSize: 14 }} />
      </button>

      {/* Paramètres */}
      <button className="tb-icon-btn" onClick={() => onNavigate('settings')}>
        ⚙️
      </button>

      {/* Avatar Super Admin */}
      <div
        className="tb-icon-btn"
        style={{
          background: 'linear-gradient(135deg,var(--acid),var(--sky))',
          color: '#020408',
          fontFamily: 'var(--font-h)',
          fontWeight: 900,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        SA
      </div>
    </header>
  );
}