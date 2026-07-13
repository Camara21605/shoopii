/**
 * @file   NotificationsTab.tsx
 * @module settings/tabs
 *
 * Onglet 6 — Notifications
 *
 * Contenu :
 *   1. Canaux de notification — email / push / SMS (toggles)
 *   2. Alertes système       — seuils CPU et RAM avec barres visuelles
 *   3. Cartes statut canaux  — résumé visuel de l'état de chaque canal
 */

import React from 'react';
import { SettingGroup, SettingRow, Toggle } from './components';
import type { PlatformSettings }           from './types';

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 */
interface Props {
  settings: PlatformSettings;
  set: <K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => void;
}

/* ─────────────────────────────────────────────────────────────
 * DONNÉES : Canaux de notification
 * ─────────────────────────────────────────────────────────────
 * Chaque canal a sa clé dans PlatformSettings, une icône,
 * un label et un texte descriptif.
 */
const CHANNELS = [
  {
    key:   'emailNotifEnabled' as keyof PlatformSettings,
    icon:  '📧',
    name:  'Email',
    desc:  'Emails transactionnels (commande, facture, mot de passe oublié…)',
    color: '#3b82f6',
  },
  {
    key:   'pushNotifEnabled' as keyof PlatformSettings,
    icon:  '🔔',
    name:  'Push',
    desc:  'Notifications push navigateur et mobile en temps réel',
    color: '#8b5cf6',
  },
  {
    key:   'smsNotifEnabled' as keyof PlatformSettings,
    icon:  '💬',
    name:  'SMS',
    desc:  'Messages texte pour codes OTP et alertes urgentes',
    color: '#10b981',
  },
] as const;

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function NotificationsTab({ settings, set }: Props) {
  // Nombre de canaux actifs (pour le résumé)
  const activeChannels = CHANNELS.filter(c => settings[c.key] as boolean).length;

  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : Canaux de notification ── */}
      <SettingGroup icon="📬" iconBg="var(--sky-dim)" title="Canaux de notification">

        {CHANNELS.map(channel => (
          <SettingRow
            key={String(channel.key)}
            label={`${channel.icon} ${channel.name}`}
            desc={channel.desc}
          >
            <Toggle
              checked={settings[channel.key] as boolean}
              onChange={v => set(channel.key, v as PlatformSettings[typeof channel.key])}
            />
          </SettingRow>
        ))}

      </SettingGroup>

      {/* ── GROUPE 2 : Alertes système ── */}
      {/* Seuils au-dessus desquels une notification d'alerte est envoyée aux admins */}
      <SettingGroup icon="⚠️" iconBg="var(--gold-dim)" title="Alertes système (admins)">

        {/* Seuil CPU — alerte si l'utilisation du processeur dépasse ce % */}
        <SettingRow
          label="Seuil alerte CPU (%)"
          desc="Une alerte est envoyée aux admins quand le CPU dépasse ce seuil"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              className="input-field"
              type="number"
              value={settings.cpuAlertPct}
              min={10}
              max={99}
              onChange={e => set('cpuAlertPct', parseInt(e.target.value) || 80)}
              style={{ width: 70 }}
            />
            {/* Barre de progression visuelle montrant le seuil sur 100% */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 90, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${settings.cpuAlertPct}%`,
                  height: '100%',
                  borderRadius: 4,
                  // Vert jusqu'à 70%, orange de 70 à 85%, rouge au-delà
                  background: settings.cpuAlertPct > 85 ? 'var(--rose)' : settings.cpuAlertPct > 70 ? 'var(--gold)' : 'var(--acid)',
                  transition: 'width .3s ease',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{settings.cpuAlertPct}%</span>
            </div>
          </div>
        </SettingRow>

        {/* Seuil RAM — alerte si la mémoire vive dépasse ce % */}
        <SettingRow
          label="Seuil alerte RAM (%)"
          desc="Une alerte est envoyée aux admins quand la RAM dépasse ce seuil"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              className="input-field"
              type="number"
              value={settings.ramAlertPct}
              min={10}
              max={99}
              onChange={e => set('ramAlertPct', parseInt(e.target.value) || 85)}
              style={{ width: 70 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 90, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${settings.ramAlertPct}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: settings.ramAlertPct > 85 ? 'var(--rose)' : settings.ramAlertPct > 70 ? 'var(--gold)' : 'var(--sky)',
                  transition: 'width .3s ease',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{settings.ramAlertPct}%</span>
            </div>
          </div>
        </SettingRow>

      </SettingGroup>

      {/* ── CARTES STATUT CANAUX (lecture seule) ── */}
      {/* Vue rapide de l'état actuel de chaque canal */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {CHANNELS.map(channel => {
          const isActive = settings[channel.key] as boolean;
          return (
            <div
              key={String(channel.key)}
              style={{
                background: isActive ? `${channel.color}10` : 'var(--surface)',
                border: `1px solid ${isActive ? `${channel.color}40` : 'var(--border)'}`,
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 22 }}>{channel.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt-1)' }}>{channel.name}</div>
                {/* Pastille de statut */}
                <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? channel.color : 'var(--txt-3)', marginTop: 3 }}>
                  {isActive ? '● Actif' : '○ Inactif'}
                </div>
              </div>
            </div>
          );
        })}

        {/* Carte résumé global */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt-1)' }}>Résumé</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--acid)', marginTop: 3 }}>
              {activeChannels} / {CHANNELS.length} canaux actifs
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
