/* ================================================================
 * FICHIER : src/modules/auth/components/CompanyTypeCombobox.tsx
 *
 * Sélecteur de type d'entreprise de l'inscription : liste triée par ORDRE
 * ALPHABÉTIQUE (français, sans tenir compte des accents ni de la casse) et
 * champ de RECHERCHE intégré — on tape pour filtrer (« pharm » → PHARMACIE).
 * Clavier : ↑ ↓ pour naviguer, Entrée pour choisir, Échap pour fermer.
 * ================================================================ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { typeName } from '../../../shared/utils/catalogueCase';

export interface CompanyTypeOption {
  id: string; nom: string; icone: string | null;
  /** Catégories actives : 0 => type non sélectionnable (le choix de catégorie est obligatoire). */
  nbCategoriesActives?: number;
}

interface Props {
  options:     CompanyTypeOption[];
  value:       string;
  onChange:    (id: string) => void;
  disabled?:   boolean;
  loading?:    boolean;
  /** Texte affiché quand le champ est désactivé (ex: choisir d'abord Produits/Services). */
  disabledHint?: string;
}

/** Sans accents, minuscules — « Épicerie » et « epicerie » se valent. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function CompanyTypeCombobox({ options, value, onChange, disabled = false, loading = false, disabledHint }: Props) {
  const rootRef  = useRef<HTMLDivElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState('');
  const [active, setActive] = useState(0);

  // Tri alphabétique une seule fois par jeu d'options (ordre du backend = aléatoire pour un visiteur).
  const sorted = useMemo(
    () => [...options].sort((a, b) => typeName(a.nom).localeCompare(typeName(b.nom), 'fr', { sensitivity: 'base' })),
    [options],
  );

  const filtered = useMemo(() => {
    const q = norm(query);
    return q ? sorted.filter(o => norm(o.nom).includes(q)) : sorted;
  }, [sorted, query]);

  const selected = options.find(o => o.id === value);
  const label = (o: CompanyTypeOption) => `${o.icone ? `${o.icone} ` : ''}${typeName(o.nom)}`;

  // Ferme au clic extérieur
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Garde l'option active visible
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  // Nouvelle recherche → on revient sur le premier résultat
  useEffect(() => { setActive(0); }, [query]);

  const unavailable = (o: CompanyTypeOption) => o.nbCategoriesActives === 0;

  const choose = (o: CompanyTypeOption) => {
    if (unavailable(o)) return;
    onChange(o.id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (open) { e.preventDefault(); if (filtered[active]) choose(filtered[active]); } }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    else if (e.key === 'Tab') { setOpen(false); setQuery(''); }
  };

  const placeholder = disabled && !loading
    ? (disabledHint ?? '')
    : loading ? 'Chargement…' : "Rechercher ou choisir un type d'entreprise…";

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div className="field-wrap" style={{ position: 'relative' }}>
        <i
          className={`fas ${open ? 'fa-magnifying-glass' : 'fa-store'}`}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--blue)', fontSize: 13, zIndex: 1, pointerEvents: 'none' }}
        />
        <input
          className="field-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="company-type-listbox"
          autoComplete="off"
          disabled={disabled || loading}
          /* Fermé : le type choisi ; ouvert : ce que l'utilisateur tape. */
          value={open ? query : (selected ? label(selected) : '')}
          placeholder={placeholder}
          style={{ paddingLeft: 36, paddingRight: 34, cursor: disabled ? 'not-allowed' : 'text', fontWeight: !open && selected ? 600 : undefined }}
          onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
          onClick={() => { if (!disabled) setOpen(true); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        <i
          className={`fas fa-chevron-${open ? 'up' : 'down'}`}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 11, pointerEvents: 'none' }}
        />
      </div>

      {open && (
        <ul
          ref={listRef} id="company-type-listbox" role="listbox"
          style={{
            position: 'absolute', zIndex: 50, left: 0, right: 0, top: 'calc(100% + 4px)', margin: 0, padding: 4,
            listStyle: 'none', maxHeight: 260, overflowY: 'auto',
            background: 'var(--white, #fff)', border: '1.5px solid var(--bdr2, #E2E8F0)', borderRadius: 12,
            boxShadow: '0 10px 30px rgba(11,31,58,.14)',
          }}
        >
          {filtered.length === 0 && (
            <li style={{ padding: '12px 14px', fontSize: 13, color: 'var(--t3)' }}>
              Aucun type ne correspond à « {query} ».
            </li>
          )}
          {filtered.map((o, i) => (
            <li
              key={o.id} role="option" aria-selected={o.id === value}
              // onMouseDown (pas onClick) : évite que le blur/clic extérieur ferme la liste avant la sélection
              onMouseDown={e => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
              aria-disabled={unavailable(o)}
              title={unavailable(o) ? "Aucune catégorie disponible pour l'instant" : undefined}
              style={{
                padding: '9px 12px', borderRadius: 8, cursor: unavailable(o) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: o.id === value ? 700 : 500,
                color: 'var(--navy, #0B1F3A)', opacity: unavailable(o) ? 0.45 : 1,
                background: i === active ? 'var(--sky-2, #EEF3FD)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{label(o)}</span>
              {unavailable(o) && <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--t3)' }}>bientôt</span>}
              {o.id === value && <i className="fas fa-check" style={{ color: 'var(--blue)', fontSize: 11 }} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
