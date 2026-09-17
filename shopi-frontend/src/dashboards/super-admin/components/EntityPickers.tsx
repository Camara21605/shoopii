// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/components/EntityPickers.tsx
//
// Sélecteurs réutilisables pour les modales "type d'entreprise" :
// - IconPicker  : liste déroulante d'icônes (emoji) groupées par thème
// - ColorPicker : sélecteur de couleur à la souris (input natif) + presets
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';

// ── Icônes proposées, regroupées par univers métier ───────────
// Couvre les 15 grands domaines du référentiel de types d'entreprises
// vendant des produits (Alimentation, Mode, Beauté, Maison, Électronique,
// Bricolage, Automobile, Santé, Agriculture, Bébé, Papeterie/loisirs,
// Divers) + les 3 groupes génériques d'origine (Commerce/Services/Autre),
// conservés pour les types de services et les cas non couverts ailleurs.
const ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: 'Alimentation & boissons', icons: ['🥩', '🐟', '🍞', '🥐', '🧀', '🥛', '🍯', '🌶️', '🍚', '🍱', '🍽️', '🍔', '🍕', '🥗', '🍣', '☕', '🧃', '🍰'] },
  { label: 'Mode & habillement',      icons: ['👔', '👗', '🧥', '👖', '🧵', '🧶', '👘', '👞', '👟', '👜', '💍', '⌚', '👓', '🧣', '🥻', '👙'] },
  { label: 'Beauté & soins',          icons: ['💄', '🧴', '💅', '💇‍♀️', '💇‍♂️', '🧼', '🌿', '✨', '🪒'] },
  { label: 'Maison & décoration',     icons: ['🛋️', '🖼️', '🛏️', '🪟', '🍳', '🥘', '🔌', '💡', '🧺', '🧹', '🪴', '🕯️', '🚪'] },
  { label: 'Électronique & technologie', icons: ['📱', '💻', '🖥️', '📺', '🎮', '☀️', '🔋', '📷', '🤖', '⚡', '🎧', '🖨️'] },
  { label: 'Bricolage & quincaillerie', icons: ['🔨', '🧱', '🎨', '🚿', '🪚', '🔧', '🛠️', '🪛', '🔩', '🧰', '🏗️'] },
  { label: 'Automobile & transport',  icons: ['🚗', '🏍️', '🛞', '🚲', '🛢️', '⛽', '🚙', '🛺', '🔧'] },
  { label: 'Santé & pharmacie',       icons: ['💊', '🏥', '⚕️', '🩺', '🧪', '🦷', '💉', '🦴', '🩹'] },
  { label: 'Agriculture & élevage',   icons: ['🌱', '🌾', '🐄', '🐓', '🐐', '🚜', '🌳', '🐝', '🐖'] },
  { label: 'Bébé & enfants',          icons: ['🍼', '🧸', '👶', '🎲', '🚼', '🧷'] },
  { label: 'Papeterie, culture & loisirs', icons: ['📚', '📓', '✏️', '📿', '🎸', '⚽', '🎣', '🎨', '🎭', '📖', '🎻', '🎬', '🎁'] },
  { label: 'Divers & services',       icons: ['💐', '🐾', '🔥', '🪑', '🖨️', '📦', '💼', '🧳', '💒', '⛺', '🚚', '🏷️'] },
  { label: 'Commerce',     icons: ['🏪', '🏬', '🛍️', '🛒', '🏢', '🏭', '💳', '🏷️'] },
  { label: 'Services',     icons: ['🔧', '💇', '🧹', '🚗', '🏠', '📦', '🚚', '🛠️'] },
  { label: 'Autre',        icons: ['📍', '⭐', '✨', '🌍', '🔑', '💼'] },
];

// ── Détermine les groupes d'icônes pertinents pour un type d'entreprise ──
// Se base sur le nom/slug du type (ex: "Boucherie" → "Alimentation &
// boissons"). Un type peut recouper plusieurs domaines (ex: "Coiffure"
// → Beauté & soins + Services) : tous les groupes correspondants sont
// renvoyés, pas seulement le premier. Le groupe "Autre" est toujours
// proposé en complément par IconPicker.
const TYPE_KEYWORDS: { match: RegExp; groups: string[] }[] = [
  { match: /alimen|epicer|supermarch|boucher|poissonn|boulanger|patisser|fruit|legume|cereale|legumineuse|huile|condiment|torrefac|cafe|depot.*boisson|\beau\b|cremer|laitier|miel|ruche|epice|aromate|traiteur|snack|restaur|resto|repas|food|boisson/i, groups: ['Alimentation & boissons'] },
  { match: /pret-a-porter|friperie|tissu|pagne|wax|couture|tailleur|chaussure|maroquinerie|bijou|montre|optique|lunette|foulard|chapeau|boubou|traditionnel|lingerie|perruque|extension|mode|habill|vetement/i, groups: ['Mode & habillement'] },
  { match: /cosmetique|parfum|capillaire|soin.*peau|savon|manucure|onglerie|coiffure|beaut/i, groups: ['Beauté & soins'] },
  { match: /meuble|mobilier|decoration|literie|matelas|rideau|textile|vaisselle|ustensile|electromenager|luminaire|tapis|moquette|menager|maison/i, groups: ['Maison & décoration'] },
  { match: /telephon|informatique|ordinateur|televi|audio|console|jeu.*video|panneau.*solaire|batterie|onduleur|electronique|appareil.*photo|gadget|connect|technolog/i, groups: ['Électronique & technologie'] },
  { match: /quincaillerie|materiaux|construction|ciment|beton|peinture|revetement|plomberie|electricite|carrelage|menuiserie|serrurerie|outil|bricolage/i, groups: ['Bricolage & quincaillerie'] },
  { match: /piece.*auto|piece.*moto|pneu|\bmoto\b|velo|lubrifiant|huile.*moteur|station-service|automobile|\bauto\b|transport/i, groups: ['Automobile & transport'] },
  { match: /pharma|parapharma|materiel.*medical|herboriste|plante.*medic|complement.*aliment|orthopedi|sant|clinique|hopital|medic/i, groups: ['Santé & pharmacie'] },
  { match: /semence|intrant|engrais|pesticide|materiel.*agricole|betail|volaille|animaux|veterinaire|pepinier|agricult|elevage/i, groups: ['Agriculture & élevage'] },
  { match: /puericulture|jouet|couche|hygiene.*bebe|educatif|bebe|enfant/i, groups: ['Bébé & enfants'] },
  { match: /librairie|papeterie|fourniture.*bureau|instrument.*musique|article.*sport|artisanat|oeuvre.*art|materiel.*peche|religieux|loisir|divertiss|culture|sport|\bjeu\b|cinema/i, groups: ['Papeterie, culture & loisirs'] },
  { match: /fleuriste|animalerie|entretien|nettoyage|gaz.*domestique|charbon|bois.*chauffe|imprimerie|serigraphie|grossiste|vente.*gros|location-vente|evenementiel|valise|bagage|mariage/i, groups: ['Divers & services'] },
  { match: /reparation|transport|livr|garage/i, groups: ['Services'] },
  { match: /boutique|commerce|shop|market|magasin/i, groups: ['Commerce'] },
];

export function iconGroupsForType(type?: { nom?: string; slug?: string } | null): string[] {
  if (!type) return [];
  const ref = `${type.nom ?? ''} ${type.slug ?? ''}`;
  const matched = new Set<string>();
  for (const { match, groups } of TYPE_KEYWORDS) {
    if (match.test(ref)) groups.forEach(g => matched.add(g));
  }
  return [...matched];
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
