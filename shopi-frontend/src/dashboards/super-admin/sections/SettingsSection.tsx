/**
 * @file   SettingsSection.tsx
 * @module sections
 *
 * ════════════════════════════════════════════════════════════════════
 *  ORCHESTRATEUR — Centre de contrôle plateforme Shoneya
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
 *   4. Gérer la sauvegarde automatique + la purge de cache
 *
 * ── SAUVEGARDE AUTOMATIQUE (plus de bouton "Sauvegarder") ──────────
 * set() met à jour l'état local ET planifie une sauvegarde :
 *   - valeur booléenne (toggle/switch) → sauvegarde IMMÉDIATE, aucun
 *     délai perceptible : c'est une action discrète, pas une saisie.
 *   - texte/nombre (ex: seuil SLA) → débounce de 600ms après la
 *     dernière frappe, pour ne pas envoyer une requête par caractère
 *     tapé tout en restant quasi instantané une fois la saisie finie.
 * Les sauvegardes sont "coalescées" (savingRef/pendingRef) : si une
 * requête est déjà en vol quand un nouveau changement arrive, on ne
 * lance PAS une deuxième requête en parallèle (risque de race condition
 * où une réponse plus ancienne écraserait un changement plus récent) —
 * on marque juste qu'un nouveau save est dû dès que l'actuel se termine.
 * Un flush au démontage garantit qu'un changement fait juste avant de
 * quitter la page n'est jamais perdu.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  toast:    (type: string, msg: string) => void;
  isActive: boolean;
  onLogout: () => void;
}

/* ═════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ═════════════════════════════════════════════════════════════ */
export default function SettingsSection({ toast, isActive, onLogout }: Props) {

  /* ── Onglet affiché ── */
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  /* ── Paramètres plateforme ── */
  const [settings,         setSettings]        = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [settingsLoading,  setSettingsLoading] = useState(false);

  /* ── Statut de la sauvegarde automatique (remplace le bouton) ── */
  type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError,  setSaveError]  = useState<string | null>(null);

  /* Refs de contrôle — voir le commentaire d'en-tête du fichier pour
   * le détail du mécanisme (débounce, coalescing, flush au démontage). */
  const settingsRef  = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const loadedRef    = useRef(false);      // true une fois le GET initial résolu
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef    = useRef(false);      // requête PATCH en vol
  const pendingRef   = useRef(false);      // un nouveau save est dû dès la fin du courant
  /* Clés réellement modifiées par set() depuis la dernière sauvegarde
   * réussie — voir le commentaire détaillé sur persistNow() : sans ça,
   * ce composant PATCHait l'objet settings ENTIER à chaque frappe, y
   * compris des champs qu'il n'affiche/ne modifie jamais (ex: les 10
   * ratios de commission, gérés exclusivement par CommissionsSection),
   * simplement parce que le GET initial les avait chargés dans l'état
   * local. Un toggle changé ici renvoyait alors une vieille valeur de
   * ratio (parfois 0/0/0) et déclenchait à tort la validation "somme
   * des ratios = 100 %" côté backend. */
  const dirtyKeysRef = useRef(new Set<keyof PlatformSettings>());

  /* ─────────────────────────────────────────────────────────────
   * CHARGEMENT au montage et à chaque fois que la section devient active
   * — non bloquant : DEFAULT_SETTINGS peuple déjà l'UI dès le premier
   * rendu, les onglets s'affichent immédiatement plutôt que d'attendre
   * ce fetch derrière un écran "Chargement…".
   * ─────────────────────────────────────────────────────────────
   */
  useEffect(() => {
    if (!isActive) return;
    // Pattern standard "fetch on mount" (cf. doc React, "Fetching data") —
    // setSettingsLoading(true) s'exécute avant le premier await, donc de
    // façon synchrone dans l'effet, ce qui est le comportement attendu ici.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsLoading(true);
    apiFetch<PlatformSettings>('/dashboard/super-admin/settings')
      .then(data => setSettings({ ...DEFAULT_SETTINGS, ...data }))
      .catch(() => toast('error', 'Impossible de charger les paramètres plateforme.'))
      .finally(() => { setSettingsLoading(false); loadedRef.current = true; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  /* ─────────────────────────────────────────────────────────────
   * SAUVEGARDE — PATCH /dashboard/super-admin/settings
   * N'envoie QUE les clés marquées "dirty" par set() (voir dirtyKeysRef
   * ci-dessus) — jamais l'objet settings entier, pour ne jamais
   * réexpédier des champs que cet écran n'a pas touchés.
   * Coalescée : une seule requête en vol à la fois (voir pendingRef).
   * Boucle plutôt que récursion (persistNow s'appelant elle-même) —
   * une fonction auto-référencée dans un useCallback empêche React
   * Compiler de préserver sa mémoïsation.
   * ─────────────────────────────────────────────────────────────
   */
  const persistNow = useCallback(async () => {
    if (savingRef.current) { pendingRef.current = true; return; }
    savingRef.current = true;
    do {
      pendingRef.current = false;
      if (dirtyKeysRef.current.size === 0) break; // rien à sauvegarder (ex: flush au démontage sans modif)
      setSaveStatus('saving');
      setSaveError(null);
      try {
        const payload: Partial<PlatformSettings> = {};
        for (const key of dirtyKeysRef.current) {
          (payload as Record<string, unknown>)[key] = settingsRef.current[key];
        }
        const updated = await apiFetch<PlatformSettings>('/dashboard/super-admin/settings', {
          method: 'PATCH',
          body: payload,
        });
        dirtyKeysRef.current.clear(); // seulement en cas de succès — un échec garde les clés pour le retry
        setSettings(prev => ({ ...prev, ...updated }));
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
        setSaveError(err instanceof ApiError ? err.message : 'Erreur réseau.');
      }
    } while (pendingRef.current);
    savingRef.current = false;
  }, []);

  /* Planifie une sauvegarde : immédiate pour un toggle (action discrète,
   * aucun délai perceptible attendu), débouncée 600ms pour du texte/
   * nombre (évite une requête par caractère tapé). */
  const scheduleSave = useCallback((immediate: boolean) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (immediate) { persistNow(); return; }
    debounceRef.current = setTimeout(() => { debounceRef.current = null; persistNow(); }, 600);
  }, [persistNow]);

  /* Flush au démontage — un changement fait juste avant de quitter la
   * page ne doit jamais rester bloqué dans un débounce jamais déclenché. */
  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      persistNow();
    }
  }, [persistNow]);

  /* ─────────────────────────────────────────────────────────────
   * HELPER set<K> — modifie un champ de settings de façon type-safe
   * ET planifie sa sauvegarde automatique. Utilisé par chaque onglet
   * pour remonter les modifications — plus besoin de bouton "Sauvegarder".
   * ─────────────────────────────────────────────────────────────
   */
  const set = useCallback(<K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    // Avant la fin du chargement initial, on laisse l'UI réagir mais on
    // ne sauvegarde pas encore — évite d'écraser les vraies valeurs
    // serveur avec DEFAULT_SETTINGS si une interaction survient dans la
    // fenêtre (très courte) du tout premier chargement.
    if (!loadedRef.current) return;
    dirtyKeysRef.current.add(key);
    scheduleSave(typeof val === 'boolean');
  }, [scheduleSave]);

  /* Réessai manuel après un échec de sauvegarde (seul cas où un clic
   * explicite reste nécessaire — l'auto-save ne se redéclenche pas tant
   * que rien de nouveau n'est modifié). */
  const retrySave = useCallback(() => { persistNow(); }, [persistNow]);

  /* ─────────────────────────────────────────────────────────────
   * PURGE CACHE — POST /dashboard/super-admin/maintenance/cache-purge
   * ─────────────────────────────────────────────────────────────
   */
  const handlePurgeCache = useCallback(async () => {
    await apiFetch('/dashboard/super-admin/maintenance/cache-purge', { method: 'POST' });
  }, []);

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
              {settings.platformName || 'Shoneya'} — Centre de contrôle total
              {/* Discret, ne bloque jamais l'affichage des onglets — juste un
                  indice que les valeurs par défaut affichées sont en cours de
                  remplacement par les vraies valeurs serveur. */}
              {settingsLoading && (
                <span style={{ marginLeft: 10, color: 'var(--txt-3)', fontWeight: 400 }}>
                  <i className="fas fa-spinner fa-spin" style={{ marginRight: 4 }} /> Actualisation…
                </span>
              )}
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

        {/* Indicateur de sauvegarde automatique — remplace le bouton
            "Sauvegarder" (masqué sur l'onglet catalogue, qui gère sa
            propre persistence indépendamment de ces settings). */}
        <div className="ph-actions">
          {activeTab !== 'catalogue' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700 }}>
              {saveStatus === 'saving' && (
                <span style={{ color: 'var(--txt-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-spinner fa-spin" /> Sauvegarde…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span style={{ color: 'var(--acid)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-circle-check" /> Sauvegardé automatiquement
                </span>
              )}
              {saveStatus === 'error' && (
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={retrySave}
                  title={saveError ?? ''}
                >
                  <i className="fas fa-triangle-exclamation" /> Échec — réessayer
                </button>
              )}
            </div>
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

      {/* ── RENDU DES ONGLETS ──────────────────────────────────────
          Toujours affiché, y compris pendant le chargement initial :
          DEFAULT_SETTINGS peuple déjà l'UI dès le premier rendu, donc
          plus d'écran "Chargement…" qui bloquait toute la page. */}
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
        />
      )}
      {activeTab === 'apparence'     && <ApparenceTab     settings={settings} set={set} />}
      {activeTab === 'danger'        && (
        <DangerTab
          settings={settings}
          set={set}
          toast={tabToast}
          saving={saveStatus === 'saving'}
          lastSaved={settings.updatedAt ?? null}
          onPurgeCache={handlePurgeCache}
        />
      )}

      {/* ── Déconnexion — en bas de Paramètres, visible quel que soit
          l'onglet actif (hors de la zone conditionnelle ci-dessus) ── */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--bdr, #E5E7EB)' }}>
        <button
          className="btn"
          onClick={onLogout}
          style={{ color: 'var(--rose, #DC2626)', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="fas fa-right-from-bracket" /> Se déconnecter
        </button>
      </div>

    </div>
  );
}
