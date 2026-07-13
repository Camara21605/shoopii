/**
 * @file   components.tsx
 * @module settings
 *
 * Composants React partagés entre tous les onglets du module Settings.
 * Ces briques sont petites, pures, mémoïsées (React.memo) pour
 * éviter les re-renders inutiles.
 *
 * Composants exportés :
 *   Toggle       — interrupteur booléen (style iOS)
 *   SettingGroup — carte contenant un groupe de paramètres
 *   SettingRow   — ligne label + contrôle dans un SettingGroup
 *   TabNav       — barre de navigation des 9 onglets
 */

import React, { memo } from 'react';
import type { SettingsTab } from './types';
import type { PlatformSettings } from './types';
import { TABS }  from './constants';

/* ─────────────────────────────────────────────────────────────
 * TOGGLE
 * ─────────────────────────────────────────────────────────────
 * Interrupteur ON/OFF stylé, utilisé pour tous les booléens
 * des paramètres (emailVerifRequired, maintenanceMode, etc.)
 *
 * Rendu CSS : .toggle > .toggle-track + .toggle-thumb
 * (défini dans super-admin.css)
 */
export const Toggle = memo(function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked:   boolean;
  onChange:  (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="toggle" style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  );
});

/* ─────────────────────────────────────────────────────────────
 * SETTING GROUP
 * ─────────────────────────────────────────────────────────────
 * Carte qui regroupe plusieurs SettingRow sous un même titre.
 *
 * Rendu CSS : .setting-group > .sg-head + .sg-body
 *
 * @param icon    Emoji affiché dans le rond coloré
 * @param iconBg  Couleur de fond du rond (ex: var(--sky-dim))
 * @param title   Titre du groupe (ex: "Authentification")
 * @param children SettingRow enfants
 */
export function SettingGroup({
  icon,
  iconBg,
  title,
  children,
}: {
  icon:     string;
  iconBg:   string;
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-group">
      <div className="sg-head">
        <div className="sg-icon" style={{ background: iconBg }}>{icon}</div>
        <div className="sg-title">{title}</div>
      </div>
      <div className="sg-body">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * SETTING ROW
 * ─────────────────────────────────────────────────────────────
 * Ligne dans un SettingGroup : label à gauche, contrôle à droite.
 *
 * Rendu CSS : .setting-row > .setting-info + {children}
 *
 * @param label    Texte principal du paramètre
 * @param desc     Description optionnelle sous le label
 * @param children Contrôle (Toggle, input, select…)
 */
export function SettingRow({
  label,
  desc,
  children,
}: {
  label:    string;
  desc?:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-info">
        <div className="setting-label">{label}</div>
        {desc && <div className="setting-desc">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * TAB NAV
 * ─────────────────────────────────────────────────────────────
 * Barre de navigation horizontale (scrollable) affichant les 9
 * onglets. Met en évidence l'onglet actif avec la couleur de l'onglet.
 *
 * Badges dynamiques :
 *   - Onglet "danger"   → 🔴 si maintenanceMode est activé
 *   - Onglet "catalogue" → nombre de types créés
 *
 * @param activeTab       Onglet actuellement sélectionné
 * @param onTabChange     Callback appelé au clic sur un onglet
 * @param settings        Nécessaire pour calculer les badges
 * @param catalogueCount  Nombre de types d'entreprise (pour le badge)
 */
export function TabNav({
  activeTab,
  onTabChange,
  settings,
  catalogueCount,
}: {
  activeTab:      SettingsTab;
  onTabChange:    (tab: SettingsTab) => void;
  settings:       PlatformSettings;
  catalogueCount: number;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      marginBottom: 20,
      overflowX: 'auto',
      paddingBottom: 2,
      borderBottom: '1px solid var(--border)',
    }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;

        // Badge rouge sur "danger" si le mode maintenance est actif
        const showMaintBadge = tab.id === 'danger' && settings.maintenanceMode;

        // Badge compteur sur "catalogue" si des types existent
        const showCatCount = tab.id === 'catalogue' && catalogueCount > 0;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              background: isActive ? 'var(--surface)' : 'none',
              color: isActive ? tab.color : 'var(--txt-3)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 12.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              // Soulignement de couleur = indicateur visuel de l'onglet actif
              borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
              transition: 'all .15s',
              flexShrink: 0,
              marginBottom: -1, // fusionne avec la bordure du container
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>

            {/* Badge maintenance */}
            {showMaintBadge && <span style={{ fontSize: 10 }}>🔴</span>}

            {/* Badge compteur catalogue */}
            {showCatCount && (
              <span style={{
                fontSize: 9.5,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 10,
                background: `${tab.color}25`,
                color: tab.color,
              }}>
                {catalogueCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
