// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/components/EntityPickers.tsx
//
// Sélecteurs réutilisables pour les modales "type d'entreprise" :
// - IconPicker  : liste déroulante d'icônes (emoji) groupées par thème
// - ColorPicker : sélecteur de couleur à la souris (input natif) + presets
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';

// ── Icônes proposées, regroupées par univers métier ───────────
const ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: 'Commerce',     icons: ['🏪', '🏬', '🛍️', '🛒', '🏢', '🏭', '💳', '🏷️'] },
  { label: 'Restauration', icons: ['🍽️', '🍔', '🍕', '☕', '🍰', '🍷', '🥗', '🍣'] },
  { label: 'Santé',        icons: ['💊', '🏥', '⚕️', '🩺', '🧪', '🦷'] },
  { label: 'Services',     icons: ['🔧', '💇', '🧹', '🚗', '🏠', '📦', '🚚', '🛠️'] },
  { label: 'Loisirs',      icons: ['🎮', '🎬', '📚', '🎨', '⚽', '🎵', '🌸', '🎁'] },
  { label: 'Autre',        icons: ['📍', '⭐', '✨', '🌍', '🔑', '💼'] },
];

// ── Détermine les groupes d'icônes pertinents pour un type d'entreprise ──
// Se base sur le nom/slug du type (ex: "Restaurant" → groupe "Restauration").
// Le groupe "Autre" est toujours proposé en complément.
const TYPE_KEYWORDS: { match: RegExp; groups: string[] }[] = [
  { match: /restaur|resto|alimen|repas|food|boisson/i, groups: ['Restauration'] },
  { match: /pharma|sant|clinique|hopital|medic/i,       groups: ['Santé'] },
  { match: /servic|reparation|nettoy|transport|livr|garage|coiffure/i, groups: ['Services'] },
  { match: /loisir|divertiss|culture|sport|jeu|cinema/i, groups: ['Loisirs'] },
  { match: /boutique|commerce|shop|market|magasin/i,    groups: ['Commerce'] },
];

export function iconGroupsForType(type?: { nom?: string; slug?: string } | null): string[] {
  if (!type) return [];
  const ref = `${type.nom ?? ''} ${type.slug ?? ''}`;
  for (const { match, groups } of TYPE_KEYWORDS) {
    if (match.test(ref)) return groups;
  }
  return [];
}

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Limite les groupes affichés (ex: via iconGroupsForType). "Autre" est toujours inclus. */
  groups?: string[];
}

export function IconPicker({ value, onChange, placeholder = '🏢', groups }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const visibleGroups = groups && groups.length > 0
    ? ICON_GROUPS.filter(g => groups.includes(g.label) || g.label === 'Autre')
    : ICON_GROUPS;

  return (
    <div className="icon-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-picker-trigger input-field"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="icon-picker-current">{value.trim() || placeholder}</span>
        <span className="icon-picker-caret">▾</span>
      </button>

      {open && (
        <div className="icon-picker-pop">
          {visibleGroups.map(group => (
            <div key={group.label} className="icon-picker-group">
              <div className="icon-picker-group-label">{group.label}</div>
              <div className="icon-picker-grid">
                {group.icons.map(ic => (
                  <button
                    key={ic}
                    type="button"
                    className={`icon-picker-item${ic === value ? ' active' : ''}`}
                    onClick={() => { onChange(ic); setOpen(false); }}
                    title={ic}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Couleurs proposées en accès rapide ─────────────────────────
const COLOR_PRESETS = [
  '#059669', '#2563eb', '#dc2626', '#d97706',
  '#7c3aed', '#db2777', '#0891b2', '#65a30d',
  '#475569', '#ea580c',
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const safeHex = HEX_RE.test(value) ? value : '#94a3b8';

  return (
    <div className="color-picker">
      <div className="color-picker-row">
        <button
          type="button"
          className="color-picker-swatch"
          style={{ background: safeHex }}
          onClick={() => nativeRef.current?.click()}
          title="Choisir une couleur"
        />
        <input
          ref={nativeRef}
          type="color"
          className="color-picker-native"
          value={safeHex}
          onChange={e => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          className="input-field"
          placeholder="#059669"
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={7}
        />
      </div>
      <div className="color-picker-presets">
        {COLOR_PRESETS.map(c => (
          <button
            key={c}
            type="button"
            className={`color-picker-preset${c.toLowerCase() === value.toLowerCase() ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}
