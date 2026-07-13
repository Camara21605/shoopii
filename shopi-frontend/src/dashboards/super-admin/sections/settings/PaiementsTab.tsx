/**
 * @file   PaiementsTab.tsx
 * @module settings/tabs
 *
 * Onglet 5 — Paiements
 *
 * Contenu :
 *   1. Commission & Seuils — commission %, retrait min, transaction max, délai règlement
 *   2. Fournisseurs mobile money — 4 providers avec toggle actif/inactif
 *   3. Carte récapitulative financière (lecture seule)
 */

import React from 'react';
import { SettingGroup, SettingRow, Toggle } from './components';
import { PAYMENT_PROVIDERS }               from './constants';
import { fmtNumber }                       from './utils';
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
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function PaiementsTab({ settings, set }: Props) {
  // Nombre de providers actifs (pour l'affichage récap)
  const activeProviders = PAYMENT_PROVIDERS.filter(
    p => settings[p.key] as boolean,
  ).length;

  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : Commission & Seuils ── */}
      <SettingGroup icon="💰" iconBg="var(--acid-dim)" title="Commission & Seuils">

        {/* Pourcentage prélevé par Shopi sur chaque transaction vendeur */}
        <SettingRow
          label="Commission plateforme (%)"
          desc="Prélevée sur chaque transaction vendeur → Shopi (0–50%)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              className="input-field"
              type="number"
              value={settings.platformCommission}
              min={0}
              max={50}
              step={0.5}
              onChange={e => set('platformCommission', parseFloat(e.target.value) || 0)}
              style={{ width: 80 }}
            />
            {/* Badge coloré indiquant si le taux est normal ou élevé */}
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 8,
              background: settings.platformCommission > 15 ? 'var(--rose-dim)' : 'var(--acid-dim)',
              color: settings.platformCommission > 15 ? 'var(--rose)' : 'var(--acid)',
            }}>
              {settings.platformCommission > 15 ? 'Élevée'
               : settings.platformCommission === 0 ? 'Gratuit'
               : 'Standard'}
            </span>
          </div>
        </SettingRow>

        {/* Montant minimum pour qu'un vendeur puisse demander un retrait */}
        <SettingRow
          label={`Montant min. retrait (${settings.defaultCurrency})`}
          desc="Montant minimum pour déclencher une demande de retrait"
        >
          <input
            className="input-field"
            type="number"
            value={settings.minWithdrawalAmount}
            min={0}
            onChange={e => set('minWithdrawalAmount', parseFloat(e.target.value) || 0)}
            style={{ width: 140 }}
          />
        </SettingRow>

        {/* Plafond de sécurité pour éviter les transactions anormalement élevées */}
        <SettingRow
          label={`Montant max. par transaction (${settings.defaultCurrency})`}
          desc="Plafond de sécurité par transaction unique"
        >
          <input
            className="input-field"
            type="number"
            value={settings.maxTransactionAmount}
            min={0}
            onChange={e => set('maxTransactionAmount', parseFloat(e.target.value) || 0)}
            style={{ width: 140 }}
          />
        </SettingRow>

        {/* Délai avant que l'argent soit effectivement viré au vendeur */}
        <SettingRow
          label="Délai de règlement (jours)"
          desc="Jours ouvrés avant versement aux vendeurs après une vente confirmée"
        >
          <input
            className="input-field"
            type="number"
            value={settings.settlementDelayDays}
            min={0}
            max={30}
            onChange={e => set('settlementDelayDays', parseInt(e.target.value) || 0)}
            style={{ width: 80 }}
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 2 : Fournisseurs de paiement mobile ── */}
      {/* Chaque carte représente un opérateur de mobile money africain */}
      <div className="setting-group" style={{ gridColumn: '1 / -1' }}>
        <div className="sg-head">
          <div className="sg-icon" style={{ background: 'var(--violet-dim)' }}>💳</div>
          <div className="sg-title">Fournisseurs de paiement mobile</div>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
          padding: '16px 20px',
        }}>
          {PAYMENT_PROVIDERS.map(provider => {
            const enabled = settings[provider.key] as boolean;
            return (
              <div
                key={String(provider.key)}
                style={{
                  background: enabled ? `${provider.color}12` : 'var(--bg)',
                  border: `1px solid ${enabled ? `${provider.color}40` : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  transition: 'all .2s ease',
                }}
              >
                <span style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{provider.icon}</span>
                <div style={{ flex: 1 }}>
                  {/* Nom + toggle sur la même ligne */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt-1)' }}>
                      {provider.name}
                    </span>
                    <Toggle
                      checked={enabled}
                      onChange={v => set(provider.key, v as PlatformSettings[typeof provider.key])}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 8, lineHeight: 1.5 }}>
                    {provider.desc}
                  </div>
                  {/* Pays couverts par ce provider */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {provider.countries.map(country => (
                      <span
                        key={country}
                        style={{
                          fontSize: 9.5,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: 'var(--raised)',
                          color: 'var(--txt-3)',
                          fontWeight: 600,
                        }}
                      >
                        {country}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RÉCAPITULATIF FINANCIER (lecture seule) ── */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        gap: 32,
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'Commission',       value: `${settings.platformCommission}%`,                               color: 'var(--acid)'   },
          { label: 'Retrait minimum',  value: `${fmtNumber(Number(settings.minWithdrawalAmount))} ${settings.defaultCurrency}`, color: 'var(--sky)'    },
          { label: 'Transaction max',  value: `${fmtNumber(Number(settings.maxTransactionAmount))} ${settings.defaultCurrency}`, color: 'var(--violet)' },
          { label: 'Délai règlement',  value: `${settings.settlementDelayDays} jour${settings.settlementDelayDays > 1 ? 's' : ''}`,        color: 'var(--gold)'   },
          { label: 'Providers actifs', value: `${activeProviders} / ${PAYMENT_PROVIDERS.length}`,              color: 'var(--acid)'   },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--txt-3)', marginBottom: 4 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: item.color, fontFamily: 'var(--font-m)' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
