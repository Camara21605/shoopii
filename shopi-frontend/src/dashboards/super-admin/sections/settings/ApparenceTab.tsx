/**
 * @file   ApparenceTab.tsx
 * @module settings/tabs
 *
 * Onglet 8 — Apparence
 *
 * Contenu :
 *   1. Thème global      — bascule clair / sombre
 *   2. Couleur principale — color picker + preview
 *   3. Identité visuelle — URL logo, favicon
 *   4. Preview branding  — carte live qui s'actualise en temps réel
 *
 * Remarque : le changement de thème appelle store.setTheme() depuis
 * le hook useSuperAdminState pour que le CSS variable --bg etc.
 * soit appliqué immédiatement à tout le dashboard.
 */

import React, { memo } from 'react';
import { SettingGroup, SettingRow, Toggle } from './components';
import type { PlatformSettings }           from './types';

/* ─────────────────────────────────────────────────────────────
 * TYPE du store minimal nécessaire pour changer le thème
 * ─────────────────────────────────────────────────────────────
 * On ne type que ce dont on a besoin depuis SuperAdminStore.
 * Le store expose state.theme et toggleTheme() — pas setTheme().
 */
interface ThemeStore {
  state: { theme: 'light' | 'dark' };
  toggleTheme: () => void;
}

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 */
interface Props {
  settings: PlatformSettings;
  set:      <K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => void;
  store:    ThemeStore;              // Accès au store global pour changer le thème
}

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANT : BrandingPreview
 * ─────────────────────────────────────────────────────────────
 * Carte de prévisualisation en temps réel qui montre à quoi
 * ressemblera la navbar avec les réglages actuels.
 * Mémoïsée pour éviter un re-render si les autres onglets changent.
 */
const BrandingPreview = memo(function BrandingPreview({
  settings,
}: {
  settings: PlatformSettings;
}) {
  // Couleur principale avec fallback si non définie
  const primary = settings.primaryColor || '#00c88a';

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
        Aperçu en temps réel
      </div>
      {/* Simulation d'une navbar avec les paramètres actuels */}
      <div style={{
        background: primary,
        borderRadius: 12,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: `0 4px 20px ${primary}40`,
      }}>
        {/* Logo ou initiales */}
        {settings.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt="logo"
            style={{ height: 36, width: 36, objectFit: 'contain', borderRadius: 8, background: 'rgba(255,255,255,.2)' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div style={{
            height: 36, width: 36,
            background: 'rgba(255,255,255,.25)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 800,
            color: '#fff',
          }}>
            {(settings.platformName || 'S').charAt(0).toUpperCase()}
          </div>
        )}

        {/* Nom de la plateforme */}
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>
            {settings.platformName || 'Shopi Africa'}
          </div>
          {settings.platformTagline && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>
              {settings.platformTagline}
            </div>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {/* Bouton exemple avec la couleur principale */}
          <div style={{
            background: 'rgba(255,255,255,.2)',
            border: '1px solid rgba(255,255,255,.35)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 8,
          }}>
            Connexion
          </div>
          <div style={{
            background: '#fff',
            color: primary,
            fontSize: 11,
            fontWeight: 700,
            padding: '5px 12px',
            borderRadius: 8,
          }}>
            S'inscrire
          </div>
        </div>
      </div>

      {/* Info couleur hex */}
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--txt-3)', textAlign: 'right' }}>
        Couleur principale : <code style={{ fontFamily: 'var(--font-m)' }}>{primary}</code>
      </div>
    </div>
  );
});

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function ApparenceTab({ settings, set, store }: Props) {
  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : Thème ── */}
      <SettingGroup icon="🎨" iconBg="var(--violet-dim)" title="Thème de l'interface">

        {/* Bascule clair/sombre — agit immédiatement sur tout le dashboard via store */}
        <SettingRow
          label="Mode sombre"
          desc="Active le thème sombre pour tout le dashboard super-admin"
        >
          <Toggle
            checked={store.state.theme === 'dark'}
            onChange={() => store.toggleTheme()}
          />
        </SettingRow>

        {/* Indicateur du thème actif */}
        <SettingRow label="Thème actif" desc="Réglage appliqué immédiatement">
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 20,
            background: store.state.theme === 'dark' ? 'var(--raised)' : 'var(--acid-dim)',
            color: store.state.theme === 'dark' ? 'var(--txt-2)' : 'var(--acid)',
          }}>
            {store.state.theme === 'dark' ? '🌙 Sombre' : '☀️ Clair'}
          </span>
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 2 : Couleur principale ── */}
      <SettingGroup icon="🖌️" iconBg="var(--sky-dim)" title="Couleur principale">

        {/* Color picker natif HTML — renvoie une valeur hexadécimale */}
        <SettingRow
          label="Couleur de marque"
          desc="Couleur principale du header, des boutons CTA et des accents"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Sélecteur de couleur natif */}
            <input
              type="color"
              value={settings.primaryColor || '#00c88a'}
              onChange={e => set('primaryColor', e.target.value)}
              style={{
                width: 44, height: 44,
                border: '2px solid var(--border)',
                borderRadius: 10,
                cursor: 'pointer',
                padding: 2,
                background: 'transparent',
              }}
            />
            {/* Affichage hex éditable manuellement */}
            <input
              className="input-field"
              type="text"
              maxLength={7}
              value={settings.primaryColor || '#00c88a'}
              onChange={e => {
                // On accepte uniquement un format hex valide
                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                  set('primaryColor', e.target.value);
                }
              }}
              style={{ width: 100, fontFamily: 'var(--font-m)', letterSpacing: '.5px' }}
              placeholder="#00c88a"
            />
          </div>
        </SettingRow>

        {/* Palette de couleurs prédéfinies pour aller vite */}
        <SettingRow label="Palette rapide" desc="Cliquez pour appliquer une couleur prédéfinie">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { hex: '#00c88a', name: 'Vert Shopi'   },
              { hex: '#3b82f6', name: 'Bleu'         },
              { hex: '#8b5cf6', name: 'Violet'       },
              { hex: '#f59e0b', name: 'Ambre'        },
              { hex: '#ef4444', name: 'Rouge'        },
              { hex: '#ec4899', name: 'Rose'         },
              { hex: '#0f172a', name: 'Ardoise'      },
            ].map(c => (
              <button
                key={c.hex}
                title={c.name}
                onClick={() => set('primaryColor', c.hex)}
                style={{
                  width: 26, height: 26,
                  borderRadius: '50%',
                  background: c.hex,
                  border: settings.primaryColor === c.hex
                    ? '3px solid var(--txt-1)'
                    : '2px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'transform .15s ease',
                  transform: settings.primaryColor === c.hex ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 3 : Identité visuelle (URLs) ── */}
      <SettingGroup icon="🖼️" iconBg="var(--gold-dim)" title="Identité visuelle">

        {/* URL du logo — doit pointer vers une image accessible publiquement */}
        <SettingRow
          label="URL du logo"
          desc="Image .png/.svg recommandée — fond transparent, min 200×200px"
        >
          <input
            className="input-field"
            type="url"
            value={settings.logoUrl ?? ''}
            maxLength={500}
            onChange={e => set('logoUrl', e.target.value || null)}
            style={{ width: 280 }}
            placeholder="https://cdn.shopi.africa/logo.png"
          />
        </SettingRow>

        {/* URL du favicon — icône onglet navigateur (idéalement .ico ou 32×32px .png) */}
        <SettingRow
          label="URL du favicon"
          desc="Icône onglet navigateur — format .ico ou .png 32×32px"
        >
          <input
            className="input-field"
            type="url"
            value={settings.faviconUrl ?? ''}
            maxLength={500}
            onChange={e => set('faviconUrl', e.target.value || null)}
            style={{ width: 280 }}
            placeholder="https://cdn.shopi.africa/favicon.ico"
          />
        </SettingRow>

      </SettingGroup>

      {/* ── PRÉVISUALISATION LIVE ── */}
      <BrandingPreview settings={settings} />

    </div>
  );
}
