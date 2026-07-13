/* ================================================================
 * FICHIER : pages/parametres/ApparenceSection.tsx
 *
 * RÔLE : Section « Apparence & personnalisation » du dashboard
 *        administrateur Shopi.
 *
 * FONCTIONNALITÉS :
 *   • Chargement des préférences persistées (GET /api/appearance)
 *   • Application immédiate via CSS variables → live preview
 *   • Bandeau « modifications non sauvegardées » avec Cancel / Save
 *   • Thème : clair / sombre / automatique (suit le système)
 *   • Couleur d'accent : 6 palettes (remplace --blue dans tout le DS)
 *   • Typographie : police + aperçu + taille du texte (3 paliers)
 *   • Mise en page : densité + arrondi des coins
 *   • Interface : animations + sidebar réduite
 *   • Accessibilité : contraste élevé + réduire les animations
 *   • Outils : export JSON / import JSON / réinitialisation avec confirmation
 * ================================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import {
  type AppearancePrefs,
  type FontFamily,
  type FontScale,
  type Density,
  type BorderRadius,
  DEFAULT_PREFS,
  applyPrefs,
  watchAutoTheme,
  fetchPrefs,
  savePrefs,
  resetPrefs  as apiResetPrefs,
  exportPrefsJson,
  importPrefsJson,
} from '../../../../shared/services/appearanceService';

/* ─── Données statiques des options disponibles ─────────────────── */

/** Modes de thème */
const THEMES = [
  { id: 'light' as const, label: 'Clair',        icon: 'fa-sun'                },
  { id: 'dark'  as const, label: 'Sombre',        icon: 'fa-moon'               },
  { id: 'auto'  as const, label: 'Automatique',   icon: 'fa-circle-half-stroke' },
];

/** Couleurs d'accent disponibles avec labels et hex pour l'aperçu */
const ACCENTS = [
  { id: 'blue'    as const, label: 'Bleu Shopi',  hex: '#1A4FC4' },
  { id: 'teal'    as const, label: 'Teal',         hex: '#0E7490' },
  { id: 'violet'  as const, label: 'Violet',       hex: '#7C3AED' },
  { id: 'emerald' as const, label: 'Émeraude',     hex: '#059669' },
  { id: 'amber'   as const, label: 'Ambre',        hex: '#D97706' },
  { id: 'rose'    as const, label: 'Rose',         hex: '#E11D48' },
];

/** Polices disponibles (DM Sans = défaut Shopi, autres chargées via Google Fonts) */
const POLICES: { id: FontFamily; label: string }[] = [
  { id: 'DM Sans', label: 'DM Sans (par défaut)' },
  { id: 'Inter',   label: 'Inter'                 },
  { id: 'Roboto',  label: 'Roboto'                },
  { id: 'Poppins', label: 'Poppins'               },
  { id: 'Nunito',  label: 'Nunito'                },
];

/** Échelles typographiques */
const SCALES: { id: FontScale; label: string; px: string }[] = [
  { id: 'normal',     label: 'Normal',     px: '15px' },
  { id: 'grand',      label: 'Grand',      px: '16px' },
  { id: 'tres-grand', label: 'Très grand', px: '17px' },
];

/** Densités d'espacement */
const DENSITES: { id: Density; label: string; icon: string }[] = [
  { id: 'compact',     label: 'Compact', icon: 'fa-table-cells'       },
  { id: 'normal',      label: 'Normal',  icon: 'fa-table-cells-large' },
  { id: 'comfortable', label: 'Aéré',    icon: 'fa-border-none'       },
];

/** Presets d'arrondi (rayon CSS en px référence) */
const RAYONS: { id: BorderRadius; label: string; px: string }[] = [
  { id: 'small',  label: 'Petit', px: '6px'  },
  { id: 'medium', label: 'Moyen', px: '12px' },
  { id: 'large',  label: 'Grand', px: '18px' },
];

/* ═══════════════════════════════════════════════════════════════════
 * COMPOSANT PRINCIPAL
 * ═══════════════════════════════════════════════════════════════════ */
export default function ApparenceSection({ onToast }: SectionProps) {

  /* ── État local ─────────────────────────────────────────────── */
  const [prefs,     setPrefs]     = useState<AppearancePrefs>(DEFAULT_PREFS);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showReset, setShowReset] = useState(false);

  /**
   * Référence des préférences sauvegardées en base.
   * Permet de détecter les modifications non sauvegardées
   * et de rétablir l'état précédent sur "Annuler".
   */
  const savedRef = useRef<AppearancePrefs>(DEFAULT_PREFS);

  /** Référence à l'input file caché pour l'import JSON */
  const importInputRef = useRef<HTMLInputElement>(null);

  /* L'utilisateur a des modifications non sauvegardées si l'état courant
   * diffère de ce qui est en base (comparaison JSON, suffisant ici) */
  const isDirty = JSON.stringify(prefs) !== JSON.stringify(savedRef.current);

  /* ── Chargement initial depuis le backend ─────────────────── */
  useEffect(() => {
    fetchPrefs()
      .then(loaded => {
        savedRef.current = loaded;
        setPrefs(loaded);
        applyPrefs(loaded);
        watchAutoTheme(loaded);
      })
      .catch(() => {
        /* En cas d'erreur réseau, appliquer les defaults locaux
         * (l'utilisateur peut quand même personnaliser) */
        applyPrefs(DEFAULT_PREFS);
        onToast('Impossible de charger les préférences — valeurs par défaut appliquées', 'w');
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Modification avec live preview immédiat ─────────────── */
  /**
   * Met à jour un champ de préférence ET applique immédiatement
   * les CSS variables → l'utilisateur voit le résultat en temps réel
   * sans attendre la sauvegarde.
   */
  const update = useCallback(
    <K extends keyof AppearancePrefs>(key: K, value: AppearancePrefs[K]) => {
      setPrefs(prev => {
        const next = { ...prev, [key]: value };
        applyPrefs(next);
        /* Si le thème change, mettre à jour l'écouteur système */
        if (key === 'theme') watchAutoTheme(next);
        return next;
      });
    },
    [],
  );

  /* ── Sauvegarder ────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await savePrefs(prefs);
      savedRef.current = saved;
      setPrefs(saved);
      onToast('Préférences d\'apparence sauvegardées', 's');
    } catch {
      onToast('Erreur lors de la sauvegarde des préférences', 'e');
    } finally {
      setSaving(false);
    }
  }, [prefs, onToast]);

  /* ── Annuler (revenir à l'état sauvegardé) ─────────────────── */
  const handleCancel = useCallback(() => {
    const prev = savedRef.current;
    setPrefs(prev);
    applyPrefs(prev);
    watchAutoTheme(prev);
    onToast('Modifications annulées', 'i');
  }, [onToast]);

  /* ── Réinitialiser aux valeurs par défaut Shopi ──────────── */
  const handleReset = useCallback(async () => {
    setShowReset(false);
    setSaving(true);
    try {
      const defaults = await apiResetPrefs();
      savedRef.current = defaults;
      setPrefs(defaults);
      applyPrefs(defaults);
      watchAutoTheme(defaults);
      onToast('Apparence réinitialisée aux valeurs par défaut Shopi', 's');
    } catch {
      onToast('Erreur lors de la réinitialisation', 'e');
    } finally {
      setSaving(false);
    }
  }, [onToast]);

  /* ── Export JSON ─────────────────────────────────────────────── */
  const handleExport = useCallback(() => {
    exportPrefsJson(prefs);
    onToast('Préférences exportées en JSON', 's');
  }, [prefs, onToast]);

  /* ── Import JSON (via input[type=file] caché) ────────────────── */
  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      /* Reset pour permettre de ré-importer le même fichier */
      e.target.value = '';

      try {
        const imported = await importPrefsJson(file);
        setPrefs(imported);
        applyPrefs(imported);
        watchAutoTheme(imported);
        onToast('Préférences importées — cliquez Sauvegarder pour les appliquer', 'i');
      } catch (err: unknown) {
        onToast(
          err instanceof Error ? err.message : 'Fichier JSON invalide',
          'e',
        );
      }
    },
    [onToast],
  );

  /* ── Rendu : état de chargement ──────────────────────────────── */
  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', opacity: 0.5 }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28 }} />
        <p style={{ marginTop: 12, fontSize: 14 }}>Chargement des préférences d&apos;apparence…</p>
      </div>
    );
  }

  /* ── Helpers : couleur de l'accent courant ──────────────────── */
  const currentAccent = ACCENTS.find(a => a.id === prefs.accentColor) ?? ACCENTS[0];

  /* ════════════════════════════════════════════════════════════
   * RENDU PRINCIPAL
   * ════════════════════════════════════════════════════════════ */
  return (
    <div className={styles.secBody}>

      {/* ── Bandeau : modifications non sauvegardées ─────────── */}
      {isDirty && (
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
          padding:        '12px 16px',
          background:     'var(--sky)',
          border:         '1px solid var(--bdrb)',
          borderRadius:   'var(--r-md)',
          marginBottom:   4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-circle-dot" style={{ color: 'var(--blue)', fontSize: 12 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--blue)' }}>
              Modifications non sauvegardées
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={handleCancel}
              disabled={saving}
            >
              Annuler
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><i className="fas fa-circle-notch fa-spin" /> Sauvegarde…</>
                : <><i className="fas fa-check" /> Sauvegarder</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
       * CARTE 1 — Thème d'affichage
       * ════════════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>
              <i className="fas fa-circle-half-stroke" /> Mode d&apos;affichage
            </div>
            <div className={styles.cardSub}>
              Thème visuel du dashboard — clair, sombre ou automatique selon les préférences OS
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>

          {/* Boutons de sélection du thème */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {THEMES.map(m => (
              <button
                key={m.id}
                className={`${styles.btn} ${prefs.theme === m.id ? styles.btnPrimary : styles.btnSecondary}`}
                onClick={() => update('theme', m.id)}
              >
                <i className={`fas ${m.icon}`} /> {m.label}
              </button>
            ))}
          </div>

          {/* Info supplémentaire en mode auto */}
          {prefs.theme === 'auto' && (
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 10 }}>
              <i className="fas fa-info-circle" /> Le thème bascule automatiquement
              selon la préférence clair/sombre de votre système.
            </p>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
       * CARTE 2 — Couleur d'accent
       * ════════════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>
              <i className="fas fa-palette" /> Couleur d&apos;accent
            </div>
            <div className={styles.cardSub}>
              Couleur principale des boutons, liens actifs et éléments interactifs
            </div>
          </div>
          {/* Aperçu de la couleur sélectionnée */}
          <div style={{
            width:      28,
            height:     28,
            borderRadius: '50%',
            background: currentAccent.hex,
            border:     '3px solid white',
            boxShadow:  '0 0 0 2px rgba(0,0,0,.1)',
            flexShrink: 0,
          }} />
        </div>
        <div className={styles.cardBody}>

          {/* Palettes de couleurs */}
          <div className={styles.colorPills}>
            {ACCENTS.map(a => (
              <div
                key={a.id}
                title={a.label}
                className={`${styles.colorPill} ${prefs.accentColor === a.id ? styles.picked : ''}`}
                style={{ background: a.hex }}
                onClick={() => update('accentColor', a.id)}
              />
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 10 }}>
            Couleur active :{' '}
            <b style={{ color: currentAccent.hex }}>{currentAccent.label}</b>
            {prefs.accentColor === 'blue' && ' (défaut Shopi)'}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
       * CARTE 3 — Typographie
       * ════════════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>
              <i className="fas fa-font" /> Typographie
            </div>
            <div className={styles.cardSub}>
              Police d&apos;interface et taille du texte dans tout le dashboard
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>

          {/* Sélecteur de police */}
          <div className={styles.formGrid}>
            <div className={styles.fld}>
              <label className={styles.fldL}>Police d&apos;interface</label>
              <select
                className={styles.fldSel}
                value={prefs.fontFamily}
                onChange={e => update('fontFamily', e.target.value as FontFamily)}
              >
                {POLICES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Aperçu de la police sélectionnée */}
          <div style={{
            marginTop:   12,
            padding:     '10px 14px',
            background:  'var(--g50)',
            borderRadius:'var(--r-sm)',
            fontFamily:  `'${prefs.fontFamily}', 'DM Sans', sans-serif`,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Shopi Africa </span>
            <span style={{ fontSize: 13, color: 'var(--t2)' }}>
              — Tableau de bord administrateur · 1234 ₣
            </span>
          </div>

          <div className={styles.divider} />

          {/* Sélecteur de taille de texte */}
          <label className={styles.fldL} style={{ display: 'block', marginBottom: 8 }}>
            Taille du texte
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SCALES.map(s => (
              <button
                key={s.id}
                className={`${styles.btn} ${prefs.fontScale === s.id ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSm}`}
                onClick={() => update('fontScale', s.id)}
                title={`font-size: ${s.px}`}
              >
                {s.label}
                <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.65 }}>({s.px})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
       * CARTE 4 — Mise en page
       * ════════════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>
              <i className="fas fa-table-cells" /> Mise en page
            </div>
            <div className={styles.cardSub}>
              Densité d&apos;espacement et arrondi des éléments de l&apos;interface
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>

          {/* Densité */}
          <label className={styles.fldL} style={{ display: 'block', marginBottom: 8 }}>
            Densité
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {DENSITES.map(d => (
              <button
                key={d.id}
                className={`${styles.btn} ${prefs.density === d.id ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSm}`}
                onClick={() => update('density', d.id)}
              >
                <i className={`fas ${d.icon}`} /> {d.label}
              </button>
            ))}
          </div>

          <div className={styles.divider} />

          {/* Arrondi des coins */}
          <label className={styles.fldL} style={{ display: 'block', marginBottom: 8, marginTop: 14 }}>
            Arrondi des coins
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RAYONS.map(r => (
              <button
                key={r.id}
                className={`${styles.btn} ${prefs.borderRadius === r.id ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSm}`}
                onClick={() => update('borderRadius', r.id)}
                title={`Rayon : ${r.px}`}
              >
                {/* Carré illustrant l'arrondi correspondant */}
                <span style={{
                  display:      'inline-block',
                  width:        13,
                  height:       13,
                  border:       '2px solid currentColor',
                  borderRadius: r.id === 'small' ? 2 : r.id === 'medium' ? 5 : 8,
                  verticalAlign:'middle',
                  marginRight:  5,
                }} />
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
       * CARTE 5 — Interface
       * ════════════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>
              <i className="fas fa-sliders" /> Interface
            </div>
            <div className={styles.cardSub}>
              Comportement de la navigation et des animations de l&apos;interface
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>

          {/* Toggle : animations */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc} ${styles.tIcViolet}`}>
              <i className="fas fa-wand-magic-sparkles" />
            </div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Animations de l&apos;interface</div>
              <div className={styles.tDesc}>
                Transitions, hover-effects et animations des composants UI.
              </div>
            </div>
            <div
              className={`${styles.sw} ${prefs.animationsEnabled ? styles.swOn : ''}`}
              onClick={() => update('animationsEnabled', !prefs.animationsEnabled)}
            />
          </div>

          <div className={styles.divider} />

          {/* Toggle : sidebar réduite */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc} ${styles.tIcBlue}`}>
              <i className="fas fa-sidebar" />
            </div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Barre latérale réduite par défaut</div>
              <div className={styles.tDesc}>
                Afficher uniquement les icônes au démarrage pour plus d&apos;espace de contenu.
              </div>
            </div>
            <div
              className={`${styles.sw} ${prefs.sidebarCollapsed ? styles.swOn : ''}`}
              onClick={() => update('sidebarCollapsed', !prefs.sidebarCollapsed)}
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
       * CARTE 6 — Accessibilité
       * ════════════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>
              <i className="fas fa-universal-access" /> Accessibilité
            </div>
            <div className={styles.cardSub}>
              Améliorer la lisibilité et l&apos;ergonomie pour différents besoins
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>

          {/* Toggle : contraste élevé */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc} ${styles.tIcBlue}`}>
              <i className="fas fa-circle-half-stroke" />
            </div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Contraste élevé</div>
              <div className={styles.tDesc}>
                Renforce le contraste du texte et des bordures pour une meilleure lisibilité.
              </div>
            </div>
            <div
              className={`${styles.sw} ${prefs.highContrast ? styles.swOn : ''}`}
              onClick={() => update('highContrast', !prefs.highContrast)}
            />
          </div>

          <div className={styles.divider} />

          {/* Toggle : réduction des animations (pour motion sensitivity) */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc} ${styles.tIcViolet}`}>
              <i className="fas fa-stop-circle" />
            </div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Réduire les animations</div>
              <div className={styles.tDesc}>
                Désactive les animations longues — recommandé si vous êtes sensible aux mouvements.
              </div>
            </div>
            <div
              className={`${styles.sw} ${prefs.reduceMotion ? styles.swOn : ''}`}
              onClick={() => update('reduceMotion', !prefs.reduceMotion)}
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
       * CARTE 7 — Outils avancés
       * ════════════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}>
              <i className="fas fa-gear" /> Outils avancés
            </div>
            <div className={styles.cardSub}>
              Exporter, importer ou réinitialiser toutes vos préférences d&apos;apparence
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>

          {/* Section export / import JSON */}
          <label className={styles.fldL} style={{ display: 'block', marginBottom: 10 }}>
            Portabilité des préférences
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={handleExport}
            >
              <i className="fas fa-download" /> Exporter JSON
            </button>
            <button
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={() => importInputRef.current?.click()}
            >
              <i className="fas fa-upload" /> Importer JSON
            </button>
            {/* Input file caché déclenché par le bouton ci-dessus */}
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
            <i className="fas fa-info-circle" /> Le fichier JSON peut être utilisé pour
            synchroniser vos préférences sur d&apos;autres appareils.
          </p>

          <div className={styles.divider} />

          {/* Réinitialisation avec confirmation */}
          {!showReset ? (
            <button
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              style={{ marginTop: 14, color: 'var(--red)', borderColor: 'rgba(220,38,38,.3)' }}
              onClick={() => setShowReset(true)}
              disabled={saving}
            >
              <i className="fas fa-rotate-left" /> Réinitialiser aux valeurs par défaut
            </button>
          ) : (
            /* Zone de confirmation — visible seulement après clic sur Réinitialiser */
            <div style={{
              marginTop:    14,
              padding:      '14px 16px',
              background:   '#FEF2F2',
              border:       '1px solid rgba(220,38,38,.2)',
              borderRadius: 'var(--r-sm)',
            }}>
              <p style={{ fontSize: 13, color: '#991B1B', marginBottom: 12 }}>
                <i className="fas fa-triangle-exclamation" />{' '}
                Cette action remettra <strong>toutes les préférences d&apos;apparence</strong> aux
                valeurs par défaut Shopi. Cette opération est irréversible. Confirmer ?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => setShowReset(false)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  className={`${styles.btn} ${styles.btnSm}`}
                  style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
                  onClick={handleReset}
                  disabled={saving}
                >
                  {saving
                    ? <><i className="fas fa-circle-notch fa-spin" /> Réinitialisation…</>
                    : <><i className="fas fa-rotate-left" /> Confirmer</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
