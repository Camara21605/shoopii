/**
 * @file   InscriptionsTab.tsx
 * @module settings/tabs
 *
 * Onglet 3 — Inscriptions
 *
 * Contenu :
 *   1. Politique d'inscription  — signup libre, code requis, KYC
 *   2. Validation vendeurs      — approbation manuelle, SLA SAV
 *   3. Modération automatique   — signalements avant suspension
 *   4. Grille des rôles actifs  — aperçu visuel des 5 rôles
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
 * DONNÉES : Rôles de la plateforme
 * ─────────────────────────────────────────────────────────────
 * Chaque rôle a un mode d'accès différent (libre vs code d'invitation).
 * active() est une fonction qui calcule si le rôle est ouvert selon
 * les paramètres actuels.
 */
const ROLES_INFO = [
  {
    icon:  '🛒',
    label: 'Clients',
    desc:  'Acheteurs — inscription libre',
    active: (s: PlatformSettings) => s.openSignup,
  },
  {
    icon:  '🏪',
    label: 'Entreprises',
    desc:  'Vendeurs — code d\'invitation',
    active: (_: PlatformSettings) => true, // toujours ouvert via code
  },
  {
    icon:  '🛵',
    label: 'Livreurs',
    desc:  'Code d\'invitation',
    active: (_: PlatformSettings) => true,
  },
  {
    icon:  '🤝',
    label: 'Partenaires',
    desc:  'Code d\'invitation',
    active: (_: PlatformSettings) => true,
  },
  {
    icon:  '📦',
    label: 'Correspondants',
    desc:  'Code d\'invitation',
    active: (_: PlatformSettings) => true,
  },
];

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function InscriptionsTab({ settings, set }: Props) {
  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : Politique d'inscription ── */}
      <SettingGroup icon="👤" iconBg="var(--acid-dim)" title="Politique d'inscription">

        {/* Inscription sans code — accessible à tous les visiteurs */}
        <SettingRow
          label="Inscription libre (Clients)"
          desc="Les clients peuvent créer un compte sans code d'invitation"
        >
          <Toggle
            checked={settings.openSignup}
            onChange={v => set('openSignup', v)}
          />
        </SettingRow>

        {/* Entreprises : toujours protégées par code même si openSignup=true */}
        <SettingRow
          label="Code requis (Entreprises)"
          desc="Un code d'invitation est nécessaire pour les comptes entreprise"
        >
          <Toggle
            checked={settings.codeRequiredForCompany}
            onChange={v => set('codeRequiredForCompany', v)}
          />
        </SettingRow>

        {/* KYC = vérification d'identité avant que le compte soit activé */}
        <SettingRow
          label="Validation KYC obligatoire"
          desc="Vérification d'identité avant l'activation du compte"
        >
          <Toggle
            checked={settings.kycRequired}
            onChange={v => set('kycRequired', v)}
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 2 : Validation vendeurs ── */}
      <SettingGroup icon="🏪" iconBg="var(--gold-dim)" title="Validation vendeurs">

        {/* Si activé, un admin doit manuellement approuver chaque nouveau vendeur */}
        <SettingRow
          label="Approbation manuelle des vendeurs"
          desc="Un admin valide chaque nouveau compte entreprise avant activation"
        >
          <Toggle
            checked={settings.manualVendorApproval}
            onChange={v => set('manualVendorApproval', v)}
          />
        </SettingRow>

        {/* SLA = Service Level Agreement — délai de réponse maximal du SAV */}
        <SettingRow
          label="Délai SLA SAV (heures)"
          desc="Temps maximum de réponse au service après-vente (1–168h)"
        >
          <input
            className="input-field"
            type="number"
            value={settings.savResponseSlaHours}
            min={1}
            max={168}
            onChange={e => set('savResponseSlaHours', parseInt(e.target.value) || 24)}
            style={{ width: 80 }}
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 3 : Modération automatique ── */}
      <SettingGroup icon="⚖️" iconBg="var(--rose-dim)" title="Modération automatique">

        {/* Après N signalements, le compte est suspendu automatiquement */}
        <SettingRow
          label="Signalements avant suspension"
          desc="Nombre de signalements déclenchant une suspension automatique du compte (1–100)"
        >
          <input
            className="input-field"
            type="number"
            value={settings.reportsBeforeSuspend}
            min={1}
            max={100}
            onChange={e => set('reportsBeforeSuspend', parseInt(e.target.value) || 5)}
            style={{ width: 80 }}
          />
        </SettingRow>

        {/* Récapitulatif en lecture seule pour voir la politique d'un coup d'œil */}
        <SettingRow label="Récapitulatif politique" desc="Règles actuellement en vigueur">
          <div style={{ fontSize: 11, color: 'var(--txt-3)', textAlign: 'right', lineHeight: 1.9 }}>
            {settings.kycRequired ? '✅ KYC requis' : '⬜ KYC optionnel'}<br />
            {settings.manualVendorApproval ? '✅ Approbation manuelle' : '⬜ Auto-activation vendeurs'}<br />
            Suspension après{' '}
            <strong style={{ color: 'var(--txt-1)' }}>
              {settings.reportsBeforeSuspend} signalement{settings.reportsBeforeSuspend > 1 ? 's' : ''}
            </strong>
          </div>
        </SettingRow>

      </SettingGroup>

      {/* ── GRILLE DES RÔLES ACTIFS ── */}
      {/* Aperçu visuel des 5 rôles de la plateforme et de leur mode d'accès */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'var(--acid-dim)',
        border: '1px solid rgba(0,200,138,.2)',
        borderRadius: 14,
        padding: '16px 20px',
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--acid)' }}>
          ✅ Rôles actifs sur la plateforme
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ROLES_INFO.map(role => {
            const isActive = role.active(settings);
            return (
              <div
                key={role.label}
                style={{
                  flex: '1 1 160px',
                  background: isActive ? 'rgba(0,200,138,.08)' : 'var(--raised)',
                  border: `1px solid ${isActive ? 'rgba(0,200,138,.2)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 20 }}>{role.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt-1)' }}>{role.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 2 }}>{role.desc}</div>
                </div>
                {/* Badge statut : ACTIF ou FERMÉ */}
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: isActive ? 'var(--acid-dim)' : 'transparent',
                  color: isActive ? 'var(--acid)' : 'var(--txt-3)',
                }}>
                  {isActive ? 'ACTIF' : 'FERMÉ'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
