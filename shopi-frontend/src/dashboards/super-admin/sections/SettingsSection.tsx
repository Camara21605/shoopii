/**
 * @file   SettingsSection.tsx
 * @module sections
 *
 * ════════════════════════════════════════════════════════════════════
 *  ORCHESTRATEUR — Centre de contrôle plateforme Shopi Africa
 * ════════════════════════════════════════════════════════════════════
 *
 * Ce fichier est volontairement mince (~150 lignes).
 * Toute la logique métier est dans les onglets :
 *
 *   settings/GeneralTab.tsx       → identité, localisation
 *   settings/SecurityTab.tsx      → auth, sessions, rate-limit
 *   settings/InscriptionsTab.tsx  → signup, KYC, rôles
 *   settings/CatalogueTab.tsx     → types / catégories / sous-cats (état propre)
 *   settings/PaiementsTab.tsx     → commission, seuils, mobile money
 *   settings/NotificationsTab.tsx → email, push, SMS, alertes CPU/RAM
 *   settings/IntegrationsTab.tsx  → API key, analytics, webhook
 *   settings/ApparenceTab.tsx     → thème, couleur, logo, favicon
 *   settings/DangerTab.tsx        → maintenance, cache, export JSON
 *
 * Responsabilités de cet orchestrateur :
 *   1. Charger / sauvegarder les settings via le backend
 *   2. Gérer l'état activeTab
 *   3. Passer settings + set() à chaque onglet
 *   4. Gérer le loading/saving global (Sauvegarder, Purge cache, Regen API key)
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { SuperAdminStore }                   from '../hooks/useSuperAdminState';
import { apiFetch, ApiError }                     from '../../../shared/services/apiFetch';

/* ── Composants partagés des settings ── */
import { TabNav }                    from './settings/components';
import type { SettingsTab, PlatformSettings } from './settings/types';
import { DEFAULT_SETTINGS }          from './settings/constants';

/* ── Onglets ── */
import GeneralTab       from './settings/GeneralTab';
import SecurityTab      from './settings/SecurityTab';
import InscriptionsTab  from './settings/InscriptionsTab';
import CatalogueTab     from './settings/CatalogueTab';
import PaiementsTab     from './settings/PaiementsTab';
import NotificationsTab from './settings/NotificationsTab';
import IntegrationsTab  from './settings/IntegrationsTab';
import ApparenceTab     from './settings/ApparenceTab';
import DangerTab        from './settings/DangerTab';

/* ─────────────────────────────────────────────────────────────
 * PROPS de l'orchestrateur
 * ─────────────────────────────────────────────────────────────
 */
interface Props {
  store:    SuperAdminStore;
  toast:    (type: string, msg: string) => void;
  isActive: boolean;
}

/* ═════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ═════════════════════════════════════════════════════════════ */
export default function SettingsSection({ store, toast, isActive }: Props) {

  /* ── Onglet affiché ── */
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  /* ── Paramètres plateforme ── */
  const [settings,         setSettings]        = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [settingsLoading,  setSettingsLoading] = useState(false);
  const [settingsSaving,   setSettingsSaving]  = useState(false);

  /* ── API key regen ── */
  const [apiKeyRegenning, setApiKeyRegenning] = useState(false);

  /* ─────────────────────────────────────────────────────────────
   * CHARGEMENT au montage et à chaque fois que la section devient active
   * ─────────────────────────────────────────────────────────────
   */
  useEffect(() => {
    if (!isActive) return;
    setSettingsLoading(true);
    apiFetch<PlatformSettings>('/dashboard/super-admin/settings')
      .then(data => setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(() => toast('error', 'Impossible de charger les paramètres plateforme.'))
      .finally(() => setSettingsLoading(false));
  }, [isActive]);

  /* ─────────────────────────────────────────────────────────────
   * HELPER set<K> — modifie un champ de settings de façon type-safe
   * ─────────────────────────────────────────────────────────────
   * Utilisé par chaque onglet pour remonter les modifications.
   */
  const set = useCallback(<K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  }, []);

  /* ─────────────────────────────────────────────────────────────
   * SAUVEGARDE — PATCH /dashboard/super-admin/settings
   * ─────────────────────────────────────────────────────────────
   */
  const handleSave = useCallback(async () => {
    setSettingsSaving(true);
    try {
      // On exclut id, updatedAt et apiKey — champs en lecture seule
      const { id, updatedAt, apiKey, ...payload } = settings;
      void id; void updatedAt; void apiKey;
      const updated = await apiFetch<PlatformSettings>('/dashboard/super-admin/settings', {
        method: 'PATCH',
        body: payload,
      });
      setSettings({ ...DEFAULT_SETTINGS, ...updated });
      toast('success', '💾 Paramètres sauvegardés avec succès');
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSettingsSaving(false);
    }
  }, [settings, toast]);

  /* ─────────────────────────────────────────────────────────────
   * PURGE CACHE — POST /dashboard/super-admin/maintenance/cache-purge
   * ─────────────────────────────────────────────────────────────
   */
  const handlePurgeCache = useCallback(async () => {
    await apiFetch('/dashboard/super-admin/maintenance/cache-purge', { method: 'POST' });
  }, []);

  /* ─────────────────────────────────────────────────────────────
   * RÉGÉNÉRATION CLÉ API (simulée — 1.2s délai)
   * ─────────────────────────────────────────────────────────────
   */
  const handleRegenApiKey = useCallback(async () => {
    setApiKeyRegenning(true);
    await new Promise(r => setTimeout(r, 1200));
    setApiKeyRegenning(false);
    toast('success', '🔑 Clé API régénérée. Mettez à jour vos intégrations.');
  }, [toast]);

  /* ─────────────────────────────────────────────────────────────
   * ADAPTER toast → signature (msg, type?) attendue par les onglets
   * L'orchestrateur reçoit toast(type, msg) mais les onglets veulent toast(msg, type?)
   * ─────────────────────────────────────────────────────────────
   */
  const tabToast = useCallback((msg: string, type?: 'success' | 'error' | 'info') => {
    toast(type ?? 'info', msg);
  }, [toast]);

  /* ─────────────────────────────────────────────────────────────
   * GUARD : ne rend rien si la section est inactive
   * ─────────────────────────────────────────────────────────────
   */
  if (!isActive) return null;

  const activeTabMeta = [
    { id: 'general',       icon: '🌍', color: 'var(--sky)'    },
    { id: 'securite',      icon: '🔐', color: 'var(--rose)'   },
    { id: 'inscriptions',  icon: '👥', color: 'var(--acid)'   },
    { id: 'catalogue',     icon: '🗂️', color: 'var(--gold)'   },
    { id: 'paiements',     icon: '💳', color: 'var(--violet)' },
    { id: 'notifications', icon: '🔔', color: 'var(--gold)'   },
    { id: 'integrations',  icon: '🔗', color: 'var(--sky)'    },
    { id: 'apparence',     icon: '🎨', color: 'var(--violet)' },
    { id: 'danger',        icon: '⚠️', color: 'var(--rose)'   },
  ].find(t => t.id === activeTab)!;

  /* ═══════════════════════════════════════════════════════════
   * RENDU
   * ═══════════════════════════════════════════════════════════ */
  return (
    <div className="section active">

      {/* ── EN-TÊTE ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: `${activeTabMeta.color}20`,
            border: `1px solid ${activeTabMeta.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            {activeTabMeta.icon}
          </div>
          <div>
            <div className="ph-title">Paramètres <mark>Plateforme</mark></div>
            <div className="ph-sub">
              {settings.platformName || 'Shopi Africa'} — Centre de contrôle total
              {settings.updatedAt && (
                <span style={{ marginLeft: 10, color: 'var(--txt-3)', fontWeight: 400 }}>
                  · Sauvegardé le {new Date(settings.updatedAt).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bouton sauvegarder (masqué sur l'onglet catalogue qui gère sa propre persistence) */}
        <div className="ph-actions">
          {activeTab !== 'catalogue' && (
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={settingsSaving || settingsLoading}
            >
              {settingsSaving ? '⏳ Sauvegarde…' : '💾 Sauvegarder'}
            </button>
          )}
        </div>
      </div>

      {/* ── NAVIGATION PAR ONGLETS ── */}
      <TabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        settings={settings}
        catalogueCount={0}  /* CatalogueTab gère son propre count en interne */
      />

      {/* ── LOADER (pendant le chargement initial) ── */}
      {settingsLoading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--txt-3)', fontSize: 13 }}>
          Chargement des paramètres…
        </div>
      )}

      {/* ── RENDU DES ONGLETS (conditionnel) ── */}
      {!settingsLoading && (
        <>
          {activeTab === 'general'       && <GeneralTab       settings={settings} set={set} />}
          {activeTab === 'securite'      && <SecurityTab      settings={settings} set={set} />}
          {activeTab === 'inscriptions'  && <InscriptionsTab  settings={settings} set={set} />}
          {activeTab === 'catalogue'     && <CatalogueTab     isActive={isActive} toast={tabToast} />}
          {activeTab === 'paiements'     && <PaiementsTab     settings={settings} set={set} />}
          {activeTab === 'notifications' && <NotificationsTab settings={settings} set={set} />}
          {activeTab === 'integrations'  && (
            <IntegrationsTab
              settings={settings}
              set={set}
              toast={tabToast}
              onRegenApiKey={handleRegenApiKey}
              apiKeyRegenning={apiKeyRegenning}
            />
          )}
          {activeTab === 'apparence'     && <ApparenceTab     settings={settings} set={set} store={store} />}
          {activeTab === 'danger'        && (
            <DangerTab
              settings={settings}
              set={set}
              toast={tabToast}
              handleSave={handleSave}
              settingsSaving={settingsSaving}
              lastSaved={settings.updatedAt ?? null}
              onPurgeCache={handlePurgeCache}
            />
          )}
        </>
      )}

    </div>
  );
}
