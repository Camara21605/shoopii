/**
 * @file   SecurityTab.tsx
 * @module settings/tabs
 *
 * Onglet 2 — Sécurité
 *
 * Contenu :
 *   1. Authentification  — vérif email, 2FA admins, tentatives max
 *   2. Sessions & Tokens — timeout session, validité JWT
 *   3. Protection réseau — rate limiting, score de sécurité
 *   4. Encart bonnes pratiques (lecture seule)
 *
 * Score de sécurité : calculé localement à partir des paramètres
 * actuels, sans appel API. Met en avant les points à améliorer.
 */

import React, { memo } from 'react';
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
 * SOUS-COMPOSANT : SecurityScore
 * ─────────────────────────────────────────────────────────────
 * Calcule un score 0/5 basé sur les 5 critères de sécurité
 * essentiels. Affiche une barre de progression colorée +
 * un label textuel (Excellent / Moyen / Faible).
 *
 * Critères :
 *   1. emailVerifRequired activé
 *   2. adminTwoFaRequired activé
 *   3. maxLoginAttempts ≤ 5
 *   4. sessionTimeoutMin ≤ 120 minutes
 *   5. rateLimitPerMin ≤ 200 requêtes/min
 */
const SecurityScore = memo(function SecurityScore({
  settings,
}: {
  settings: PlatformSettings;
}) {
  // Chaque critère vaut 1 point
  const checks = [
    settings.emailVerifRequired,
    settings.adminTwoFaRequired,
    settings.maxLoginAttempts <= 5,
    settings.sessionTimeoutMin <= 120,
    settings.rateLimitPerMin <= 200,
  ];

  const score = checks.filter(Boolean).length; // 0 à 5
  const pct   = (score / checks.length) * 100;

  // Couleur selon le score
  const color = score >= 4 ? '#10b981' : score >= 3 ? '#f59e0b' : '#ef4444';
  const label = score >= 4 ? 'Excellent' : score >= 3 ? 'Moyen' : 'Faible';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 4,
          transition: 'width .5s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>
        {score}/5 — {label}
      </span>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function SecurityTab({ settings, set }: Props) {
  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : Authentification ── */}
      <SettingGroup icon="🔐" iconBg="var(--rose-dim)" title="Authentification">

        <SettingRow
          label="Vérification email obligatoire"
          desc="Les utilisateurs doivent confirmer leur email à l'inscription"
        >
          <Toggle
            checked={settings.emailVerifRequired}
            onChange={v => set('emailVerifRequired', v)}
          />
        </SettingRow>

        <SettingRow
          label="2FA pour les admins"
          desc="Double authentification obligatoire pour tous les administrateurs"
        >
          <Toggle
            checked={settings.adminTwoFaRequired}
            onChange={v => set('adminTwoFaRequired', v)}
          />
        </SettingRow>

        {/* Nombre max d'échecs avant verrouillage temporaire du compte */}
        <SettingRow
          label="Tentatives max avant blocage"
          desc="Nombre d'échecs de connexion avant verrouillage temporaire (1–20)"
        >
          <input
            className="input-field"
            type="number"
            value={settings.maxLoginAttempts}
            min={1}
            max={20}
            onChange={e => set('maxLoginAttempts', parseInt(e.target.value) || 1)}
            style={{ width: 80 }}
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 2 : Sessions & Tokens ── */}
      <SettingGroup icon="⏱️" iconBg="var(--sky-dim)" title="Sessions & Tokens">

        {/* Inactivité avant déconnexion automatique */}
        <SettingRow
          label="Timeout session (min)"
          desc="Durée d'inactivité avant déconnexion automatique"
        >
          <input
            className="input-field"
            type="number"
            value={settings.sessionTimeoutMin}
            min={5}
            max={1440}
            onChange={e => set('sessionTimeoutMin', parseInt(e.target.value) || 60)}
            style={{ width: 80 }}
          />
        </SettingRow>

        {/* Durée du token JWT — après expiration, l'utilisateur doit se reconnecter */}
        <SettingRow
          label="Validité token JWT (heures)"
          desc="Durée avant expiration automatique du token d'accès (1–168h)"
        >
          <input
            className="input-field"
            type="number"
            value={settings.tokenValidityHours}
            min={1}
            max={168}
            onChange={e => set('tokenValidityHours', parseInt(e.target.value) || 24)}
            style={{ width: 80 }}
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 3 : Protection réseau ── */}
      <SettingGroup icon="🛡️" iconBg="var(--violet-dim)" title="Protection réseau">

        {/* Nombre maximal de requêtes API acceptées par minute par IP */}
        <SettingRow
          label="Rate limit (req/min par IP)"
          desc="Nombre maximum de requêtes par minute depuis la même adresse IP"
        >
          <input
            className="input-field"
            type="number"
            value={settings.rateLimitPerMin}
            min={10}
            max={10000}
            onChange={e => set('rateLimitPerMin', parseInt(e.target.value) || 100)}
            style={{ width: 100 }}
          />
        </SettingRow>

        {/* Score calculé en temps réel selon les paramètres ci-dessus */}
        <SettingRow
          label="Score de sécurité"
          desc="Calculé selon vos paramètres actuels (5 critères)"
        >
          <SecurityScore settings={settings} />
        </SettingRow>

      </SettingGroup>

      {/* ── ENCART BONNES PRATIQUES (lecture seule) ── */}
      <div style={{
        background: 'var(--rose-dim)',
        border: '1px solid rgba(255,68,100,.2)',
        borderRadius: 14,
        padding: '16px 20px',
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--rose)' }}>
          ⚠️ Bonnes pratiques de sécurité
        </div>
        <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 11.5, color: 'var(--txt-2)', lineHeight: 2.1 }}>
          <li>Activez le 2FA pour tous les comptes administrateurs</li>
          <li>Gardez le timeout de session ≤ 120 minutes</li>
          <li>Limitez les tentatives de connexion à 3–5 maximum</li>
          <li>Régénérez les clés API tous les 90 jours (onglet Intégrations)</li>
          <li>Maintenez le rate limit en dessous de 200 req/min par IP</li>
        </ul>
      </div>

    </div>
  );
}
