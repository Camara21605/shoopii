/**
 * @file   IntegrationsTab.tsx
 * @module settings/tabs
 *
 * Onglet 7 — Intégrations
 *
 * Contenu :
 *   1. Clé API — affichage masqué, révélation, régénération
 *   2. Analytics — Google Analytics ID, Facebook Pixel ID
 *   3. Webhook — URL + liste des événements déclencheurs
 *
 * État local géré ici :
 *   - apiKeyVisible (boolean) — si la clé est masquée ou visible
 *
 * Props spéciales :
 *   - toast    → fonction pour afficher un message de succès/erreur
 *   - onRegenApiKey → callback vers le parent pour régénérer la clé
 */

import React, { useState } from 'react';
import { SettingGroup, SettingRow } from './components';
import type { PlatformSettings }   from './types';

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 */
interface Props {
  settings:       PlatformSettings;
  set:            <K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => void;
  toast:          (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRegenApiKey:  () => void;        // Délégué au parent car déclenche un loading global
  apiKeyRegenning: boolean;          // true pendant la simulation de régénération
}

/* ─────────────────────────────────────────────────────────────
 * DONNÉES : Événements webhook disponibles
 * ─────────────────────────────────────────────────────────────
 * Liste des événements que le webhook peut recevoir.
 * Chaque item est informatif (lecture seule ici).
 */
const WEBHOOK_EVENTS = [
  { icon: '🛒', event: 'order.created',    desc: 'Nouvelle commande passée'          },
  { icon: '💳', event: 'payment.confirmed', desc: 'Paiement confirmé avec succès'     },
  { icon: '📦', event: 'shipment.updated',  desc: 'Statut de livraison mis à jour'    },
  { icon: '👤', event: 'user.registered',   desc: 'Nouveau compte créé'              },
  { icon: '🏪', event: 'vendor.approved',   desc: 'Vendeur approuvé par un admin'    },
  { icon: '⚠️', event: 'report.flagged',    desc: 'Contenu signalé par un utilisateur'},
];

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function IntegrationsTab({
  settings,
  set,
  toast,
  onRegenApiKey,
  apiKeyRegenning,
}: Props) {
  // Contrôle l'affichage de la clé API (masquée par défaut pour la sécurité)
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  // Copie la clé API dans le presse-papier
  const handleCopyKey = () => {
    if (!settings.apiKey) return;
    navigator.clipboard.writeText(settings.apiKey).then(() => {
      toast('Clé API copiée dans le presse-papier', 'success');
    });
  };

  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : Clé API ── */}
      <SettingGroup icon="🔑" iconBg="var(--gold-dim)" title="Clé API plateforme">

        {/* Affichage de la clé : masquée par défaut, révélable au clic */}
        <SettingRow
          label="Clé API"
          desc="Utilisée pour les intégrations externes et les webhooks"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Champ en lecture seule — la clé ne doit pas être modifiée manuellement */}
            <input
              className="input-field"
              type={apiKeyVisible ? 'text' : 'password'}
              readOnly
              value={settings.apiKey ?? 'Non générée'}
              style={{ width: 220, fontFamily: 'var(--font-m)', fontSize: 12 }}
            />

            {/* Bouton œil — alterne masqué/visible */}
            <button
              className="btn-ghost"
              title={apiKeyVisible ? 'Masquer' : 'Révéler'}
              onClick={() => setApiKeyVisible(v => !v)}
              style={{ padding: '6px 8px', borderRadius: 8, fontSize: 14 }}
            >
              {apiKeyVisible ? '🙈' : '👁️'}
            </button>

            {/* Bouton copie */}
            <button
              className="btn-ghost"
              title="Copier la clé"
              onClick={handleCopyKey}
              style={{ padding: '6px 8px', borderRadius: 8, fontSize: 14 }}
            >
              📋
            </button>
          </div>
        </SettingRow>

        {/* Régénération — opération destructive : l'ancienne clé sera immédiatement invalide */}
        <SettingRow
          label="Régénérer la clé"
          desc="⚠️ L'ancienne clé sera immédiatement invalide — toutes les intégrations devront être mises à jour"
        >
          <button
            className="btn-danger"
            disabled={apiKeyRegenning}
            onClick={onRegenApiKey}
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: apiKeyRegenning ? 'not-allowed' : 'pointer' }}
          >
            {apiKeyRegenning ? '⏳ Régénération…' : '🔄 Régénérer'}
          </button>
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 2 : Analytics & Tracking ── */}
      <SettingGroup icon="📊" iconBg="var(--acid-dim)" title="Analytics & Tracking">

        {/* Google Analytics 4 — identifiant de mesure (format: G-XXXXXXXXXX) */}
        <SettingRow
          label="Google Analytics ID"
          desc="Identifiant de mesure GA4 (ex: G-XXXXXXXXXX)"
        >
          <input
            className="input-field"
            type="text"
            value={settings.analyticsTrackingId ?? ''}
            maxLength={20}
            onChange={e => set('analyticsTrackingId', e.target.value || null)}
            style={{ width: 180 }}
            placeholder="G-XXXXXXXXXX"
          />
        </SettingRow>

        {/* Facebook Pixel — pour le tracking des conversions sur les publicités Meta */}
        <SettingRow
          label="Facebook Pixel ID"
          desc="Pour le suivi des conversions et le remarketing Meta Ads"
        >
          <input
            className="input-field"
            type="text"
            value={settings.facebookPixelId ?? ''}
            maxLength={20}
            onChange={e => set('facebookPixelId', e.target.value || null)}
            style={{ width: 180 }}
            placeholder="1234567890"
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 3 : Webhook ── */}
      <SettingGroup icon="🔗" iconBg="var(--violet-dim)" title="Webhook sortant">

        {/* URL de destination — l'endpoint externe qui recevra les événements POST */}
        <SettingRow
          label="URL de destination"
          desc="Endpoint HTTPS qui recevra les événements POST (ex: https://votre-app.com/webhook)"
        >
          <input
            className="input-field"
            type="url"
            value={settings.webhookUrl ?? ''}
            maxLength={500}
            onChange={e => set('webhookUrl', e.target.value || null)}
            style={{ width: 280 }}
            placeholder="https://votre-app.com/webhook"
          />
        </SettingRow>

        {/* Liste des événements qui déclenchent un appel vers le webhook */}
        <div style={{ padding: '8px 20px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            Événements déclencheurs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {WEBHOOK_EVENTS.map(ev => (
              <div
                key={ev.event}
                style={{
                  background: 'var(--raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{ev.icon}</span>
                <div>
                  {/* Nom technique de l'événement */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-1)', fontFamily: 'var(--font-m)' }}>
                    {ev.event}
                  </div>
                  {/* Description lisible */}
                  <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 2 }}>{ev.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </SettingGroup>

      {/* ── ENCART INFO SÉCURITÉ WEBHOOK ── */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'var(--sky-dim)',
        border: '1px solid rgba(56,189,248,.2)',
        borderRadius: 14,
        padding: '14px 18px',
        fontSize: 11.5,
        color: 'var(--txt-2)',
        lineHeight: 1.8,
      }}>
        <strong style={{ color: 'var(--sky)' }}>ℹ️ Signature des webhooks</strong><br />
        Chaque requête POST est signée avec la clé API via HMAC-SHA256.
        Vérifiez le header <code style={{ fontFamily: 'var(--font-m)', background: 'rgba(56,189,248,.15)', padding: '0 4px', borderRadius: 4 }}>X-Shopi-Signature</code> côté récepteur pour vous assurer de l'authenticité de la requête.
      </div>

    </div>
  );
}
