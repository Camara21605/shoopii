/**
 * @file   DangerTab.tsx
 * @module settings/tabs
 *
 * Onglet 9 — Zone Danger
 *
 * Contenu :
 *   1. Mode maintenance     — met la plateforme hors ligne pour les utilisateurs
 *   2. Purge du cache       — vide le cache serveur sans perte de données
 *   3. Export configuration — télécharge un JSON des paramètres actuels
 *   4. Informations sauvegarde — dernière date de sauvegarde
 *
 * État local géré ici :
 *   - cachePurging (boolean) — loading pendant l'appel API de purge
 *
 * Chaque action destructive a son propre composant DangerCard
 * pour être claire et éviter les erreurs de manipulation.
 */

import React, { useState } from 'react';
import type { PlatformSettings } from './types';

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 */
interface Props {
  settings:       PlatformSettings;
  set:            <K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => void;
  toast:          (msg: string, type?: 'success' | 'error' | 'info') => void;
  handleSave:     () => void;        // Sauvegarde immédiate après toggle maintenance
  settingsSaving: boolean;           // true pendant la sauvegarde globale
  lastSaved:      string | null;     // ISO date de la dernière sauvegarde
  onPurgeCache:   () => Promise<void>; // Appel API POST /maintenance/cache-purge
}

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANT : DangerCard
 * ─────────────────────────────────────────────────────────────
 * Carte action à risque avec : icône colorée, titre, description,
 * badge de niveau de risque et bouton d'action.
 *
 * Le niveau de risque ("Élevé", "Moyen", "Faible") est codé
 * couleur pour aider l'admin à évaluer l'impact.
 */
function DangerCard({
  icon,
  title,
  desc,
  risk,
  children,
}: {
  icon:     string;
  title:    string;
  desc:     string;
  risk:     'high' | 'medium' | 'low';
  children: React.ReactNode;
}) {
  // Couleur et libellé selon le niveau de risque
  const riskConfig = {
    high:   { color: 'var(--rose)',   bg: 'var(--rose-dim)',   label: 'Risque élevé'  },
    medium: { color: 'var(--gold)',   bg: 'var(--gold-dim)',   label: 'Risque moyen'  },
    low:    { color: 'var(--acid)',   bg: 'var(--acid-dim)',   label: 'Sans risque'   },
  }[risk];

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${riskConfig.color}30`,
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      {/* Icône dans un cercle coloré selon le risque */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: riskConfig.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>

      <div style={{ flex: 1 }}>
        {/* En-tête : titre + badge de risque */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt-1)' }}>{title}</div>
          <span style={{
            fontSize: 9.5, fontWeight: 700,
            padding: '2px 8px', borderRadius: 20,
            background: riskConfig.bg,
            color: riskConfig.color,
            textTransform: 'uppercase',
            letterSpacing: '.5px',
          }}>
            {riskConfig.label}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt-3)', lineHeight: 1.6, marginBottom: 14 }}>
          {desc}
        </div>
        {/* Bouton(s) d'action passés en enfants */}
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function DangerTab({
  settings,
  set,
  toast,
  handleSave,
  settingsSaving,
  lastSaved,
  onPurgeCache,
}: Props) {
  // Loading local pour la purge du cache (indépendant du saving global)
  const [cachePurging, setCachePurging] = useState(false);

  // Toggle maintenance + sauvegarde immédiate pour que le changement soit actif
  const handleMaintenanceToggle = () => {
    const newVal = !settings.maintenanceMode;
    set('maintenanceMode', newVal);
    // On déclenche la sauvegarde globale directement (le parent save après set)
    // Délai minimal pour que le state local se mette à jour avant le save
    setTimeout(() => handleSave(), 50);
    toast(
      newVal
        ? '🔴 Mode maintenance activé — la plateforme est hors ligne'
        : '🟢 Mode maintenance désactivé — la plateforme est en ligne',
      newVal ? 'error' : 'success',
    );
  };

  // Purge du cache via API — opération sûre (pas de perte de données)
  const handleCachePurge = async () => {
    setCachePurging(true);
    try {
      await onPurgeCache();
      toast('✅ Cache purgé avec succès', 'success');
    } catch {
      toast('Erreur lors de la purge du cache', 'error');
    } finally {
      setCachePurging(false);
    }
  };

  // Export des paramètres actuels en fichier JSON téléchargeable
  const handleExportConfig = () => {
    // On exclut les champs système (id, updatedAt) de l'export
    const { ...exportable } = settings;
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    // Nom de fichier avec la date du jour pour faciliter la traçabilité
    a.download = `shopi-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('📥 Configuration exportée', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── BANNIÈRE D'AVERTISSEMENT ── */}
      <div style={{
        background: 'var(--rose-dim)',
        border: '1px solid rgba(255,68,100,.25)',
        borderRadius: 12,
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12.5,
        color: 'var(--rose)',
        fontWeight: 600,
      }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        Les actions ci-dessous affectent directement la plateforme en production. Procédez avec précaution.
      </div>

      {/* ── ACTION 1 : Mode maintenance ── */}
      <DangerCard
        icon="🔧"
        title="Mode maintenance"
        desc={
          settings.maintenanceMode
            ? '🔴 La plateforme est HORS LIGNE. Seuls les super-admins peuvent y accéder. Les utilisateurs voient la page de maintenance.'
            : '🟢 La plateforme est EN LIGNE et accessible à tous les utilisateurs.'
        }
        risk="high"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Indicateur d'état actuel */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20,
            background: settings.maintenanceMode ? 'var(--rose-dim)' : 'var(--acid-dim)',
            fontSize: 12.5, fontWeight: 700,
            color: settings.maintenanceMode ? 'var(--rose)' : 'var(--acid)',
          }}>
            <span style={{ fontSize: 8, display: 'inline-block', borderRadius: '50%', width: 6, height: 6, background: 'currentColor' }} />
            {settings.maintenanceMode ? 'MAINTENANCE ACTIVE' : 'PLATEFORME EN LIGNE'}
          </div>

          {/* Bouton d'activation/désactivation */}
          <button
            className={settings.maintenanceMode ? 'btn-accent' : 'btn-danger'}
            disabled={settingsSaving}
            onClick={handleMaintenanceToggle}
            style={{ padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: settingsSaving ? 'not-allowed' : 'pointer' }}
          >
            {settingsSaving ? '⏳ Sauvegarde…'
              : settings.maintenanceMode ? '🟢 Désactiver la maintenance'
              : '🔴 Activer la maintenance'}
          </button>
        </div>
      </DangerCard>

      {/* ── ACTION 2 : Purge du cache ── */}
      <DangerCard
        icon="🗑️"
        title="Purger le cache"
        desc="Vide le cache applicatif et la mémoire tampon. Aucune donnée n'est perdue. Les performances peuvent être temporairement réduites le temps que le cache se reconstituée."
        risk="medium"
      >
        <button
          className="btn-ghost"
          disabled={cachePurging}
          onClick={handleCachePurge}
          style={{
            padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            border: '1px solid var(--gold)',
            color: 'var(--gold)',
            background: 'var(--gold-dim)',
            cursor: cachePurging ? 'not-allowed' : 'pointer',
            opacity: cachePurging ? 0.7 : 1,
          }}
        >
          {cachePurging ? '⏳ Purge en cours…' : '🗑️ Purger le cache maintenant'}
        </button>
      </DangerCard>

      {/* ── ACTION 3 : Export configuration ── */}
      <DangerCard
        icon="📥"
        title="Exporter la configuration"
        desc="Télécharge un fichier JSON de tous les paramètres actuels de la plateforme. Utile pour la sauvegarde et la migration vers un autre environnement."
        risk="low"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button
            className="btn-ghost"
            onClick={handleExportConfig}
            style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              border: '1px solid var(--acid)',
              color: 'var(--acid)',
              background: 'var(--acid-dim)',
              cursor: 'pointer',
            }}
          >
            📥 Télécharger shopi-config.json
          </button>

          {/* Affiche la date de dernière sauvegarde si disponible */}
          {lastSaved && (
            <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>
              Dernière sauvegarde : {new Date(lastSaved).toLocaleString('fr-FR')}
            </span>
          )}
        </div>
      </DangerCard>

    </div>
  );
}
