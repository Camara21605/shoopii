/**
 * @file   GeneralTab.tsx
 * @module settings/tabs
 *
 * Onglet 1 — Général
 *
 * Contenu :
 *   1. Identité de la plateforme (nom, slogan, email de support)
 *   2. Localisation (devise, langue, fuseau horaire)
 *   3. Carte récapitulative en lecture seule (snapshot des réglages actifs)
 *
 * Tous les champs sont controlés (valeur + onChange) et remontent
 * les modifications via la fonction `set()` reçue en prop.
 */

import React from 'react';
import { SettingGroup, SettingRow } from './components';
import { CURRENCIES, TIMEZONES }    from './constants';
import type { PlatformSettings }    from './types';

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 * settings  → état courant de PlatformSettings (lecture)
 * set       → modifie un champ dans PlatformSettings (écriture)
 *             Typé générique pour garantir que la valeur correspond au champ.
 */
interface Props {
  settings: PlatformSettings;
  set: <K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => void;
}

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT
 * ─────────────────────────────────────────────────────────────
 */
export default function GeneralTab({ settings, set }: Props) {
  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : Identité de la plateforme ── */}
      <SettingGroup icon="🏢" iconBg="var(--sky-dim)" title="Identité de la plateforme">

        {/* Nom affiché partout dans l'interface et les emails */}
        <SettingRow label="Nom de la plateforme">
          <input
            className="input-field"
            type="text"
            maxLength={100}
            value={settings.platformName}
            onChange={e => set('platformName', e.target.value)}
            style={{ width: 220 }}
            placeholder="Shopi Africa"
          />
        </SettingRow>

        {/* Slogan affiché sous le logo et dans les emails transactionnels */}
        <SettingRow
          label="Slogan"
          desc="Affiché sous le logo et dans les emails automatiques"
        >
          <input
            className="input-field"
            type="text"
            maxLength={200}
            value={settings.platformTagline ?? ''}
            onChange={e => set('platformTagline', e.target.value || null)}
            style={{ width: 220 }}
            placeholder="La marketplace de l'Afrique"
          />
        </SettingRow>

        {/* Email qui reçoit les tickets support des utilisateurs */}
        <SettingRow
          label="Email de support"
          desc="Reçoit les demandes d'aide des utilisateurs"
        >
          <input
            className="input-field"
            type="email"
            maxLength={150}
            value={settings.supportEmail ?? ''}
            onChange={e => set('supportEmail', e.target.value || null)}
            style={{ width: 220 }}
            placeholder="support@shopi.africa"
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 2 : Localisation ── */}
      <SettingGroup icon="🌍" iconBg="var(--gold-dim)" title="Localisation">

        {/* Devise utilisée pour afficher les prix et les montants financiers */}
        <SettingRow label="Devise principale">
          <select
            className="sel"
            value={settings.defaultCurrency}
            onChange={e => set('defaultCurrency', e.target.value)}
            style={{ width: 220 }}
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </SettingRow>

        {/* Langue de l'interface par défaut */}
        <SettingRow label="Langue par défaut">
          <select
            className="sel"
            value={settings.defaultLanguage}
            onChange={e => set('defaultLanguage', e.target.value)}
            style={{ width: 220 }}
          >
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
            <option value="ar">🇸🇦 العربية</option>
          </select>
        </SettingRow>

        {/* Fuseau horaire au format IANA — affecte les dates/heures affichées */}
        <SettingRow label="Fuseau horaire">
          <select
            className="sel"
            value={settings.timezone}
            onChange={e => set('timezone', e.target.value)}
            style={{ width: 220 }}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </SettingRow>

      </SettingGroup>

      {/* ── CARTE RÉCAPITULATIVE (lecture seule) ── */}
      {/* Snapshot des réglages clés — utile pour valider d'un coup d'œil */}
      <div style={{
        gridColumn: '1 / -1', // occupe toute la largeur de la grille
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        gap: 32,
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'Plateforme',  value: settings.platformName || '—'                                                     },
          { label: 'Devise',      value: settings.defaultCurrency                                                          },
          { label: 'Langue',      value: settings.defaultLanguage === 'fr' ? 'Français' : settings.defaultLanguage === 'en' ? 'English' : 'العربية' },
          { label: 'Fuseau',      value: settings.timezone                                                                 },
          { label: 'Maintenance', value: settings.maintenanceMode ? '🔴 Activée' : '🟢 Non'                               },
          { label: 'Commission',  value: `${settings.platformCommission}%`                                                 },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--txt-3)', marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--txt-1)' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
