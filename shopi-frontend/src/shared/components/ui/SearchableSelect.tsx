/* ================================================================
 * FICHIER : src/shared/components/ui/SearchableSelect.tsx
 *
 * Liste déroulante AVEC RECHERCHE, générique — même comportement que le
 * sélecteur de type d'entreprise de l'inscription (CompanyTypeCombobox) :
 *   • on clique dans le champ et on tape pour filtrer (sans tenir compte des
 *     accents ni de la casse : « ecole » trouve « École ») ;
 *   • liste triée par ordre alphabétique français (désactivable : `sort={false}`) ;
 *   • clavier : ↑ ↓ pour naviguer, Entrée pour choisir, Échap / Tab pour fermer ;
 *   • une option « épinglée » (`pinned`, ex: « Autre quartier… ») reste toujours
 *     affichée en bas de liste, même quand la recherche ne la trouve pas.
 * ================================================================ */

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';

export interface SearchableOption { value: string; label: string; }

interface Props {
  options:       SearchableOption[];
  value:         string;
  onChange:      (value: string) => void;
  /** Option toujours visible en bas de liste (ex: « Autre quartier (non listé)… »). */
  pinned?:       SearchableOption;
  disabled?:     boolean;
  loading?:      boolean;
  /** Texte du champ quand rien n'est choisi. */
  placeholder?:  string;
  /** Texte du champ quand il est désactivé (ex: « Choisissez d'abord un pays »). */
  disabledHint?: string;
  /** Tri alphabétique (français, accents ignorés). Vrai par défaut. */
  sort?:         boolean;
  /** Icône FontAwesome à gauche (ex: "fa-flag") ; devient une loupe pendant la saisie. */
  icon?:         string;
  inputClassName?: string;
  inputStyle?:   CSSProperties;
  noResultLabel?: (query: string) => string;
}

/** Sans accents, minuscules. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function SearchableSelect({
  options, value, onChange, pinned, disabled = false, loading = false,
  placeholder = 'Rechercher ou choisir…', disabledHint, sort = true,
  icon, inputClassName, inputStyle, noResultLabel,
}: Props) {
  const listId  = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState('');
  const [active, setActive] = useState(0);

  const sorted = useMemo(
    () => sort ? [...options].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })) : options,
    [options, sort],
  );

  // Liste affichée = résultats filtrés + option épinglée (toujours en dernier)
  const shown = useMemo(() => {
    const q = norm(query);
    const base = q ? sorted.filter(o => norm(o.label).includes(q)) : sorted;
    return pinned ? [...base, pinned] : base;
  }, [sorted, query, pinned]);

  const selected = value === pinned?.value ? pinned : options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => { setActive(0); }, [query]);

  // Si le champ devient inactif (ex: le pays parent change), on referme la liste.
  useEffect(() => { if (disabled || loading) { setOpen(false); setQuery(''); } }, [disabled, loading]);

  const choose = (o: SearchableOption) => { onChange(o.value); setOpen(false); setQuery(''); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setActive(a => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (open) { e.preventDefault(); if (shown[active]) choose(shown[active]); } }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); setQuery(''); }
  };

  const inactive = disabled || loading;
  const shownPlaceholder = loading ? 'Chargement…' : disabled ? (disabledHint ?? placeholder) : placeholder;
  const noResult = shown.filter(o => o.value !== pinned?.value).length === 0;

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        {icon && (
          <i
            className={`fas ${open ? 'fa-magnifying-glass' : icon}`} aria-hidden
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--blue, #1A4FC4)', fontSize: 13, zIndex: 1, pointerEvents: 'none' }}
          />
        )}
        <input
          className={inputClassName}
          type="text" role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls={listId}
          autoComplete="off" disabled={inactive}
          /* Fermé : le choix actuel ; ouvert : ce que l'utilisateur tape. */
          value={open ? query : (selected?.label ?? '')}
          placeholder={shownPlaceholder}
          style={{
            width: '100%', boxSizing: 'border-box', paddingRight: 34, paddingLeft: icon ? 36 : undefined,
            cursor: inactive ? 'not-allowed' : 'text', fontWeight: !open && selected ? 600 : undefined,
            ...inputStyle,
          }}
          onFocus={() => { if (!inactive) { setOpen(true); setQuery(''); } }}
          onClick={() => { if (!inactive) setOpen(true); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        <i
          className={`fas fa-chevron-${open ? 'up' : 'down'}`} aria-hidden
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3, #94A3B8)', fontSize: 11, pointerEvents: 'none' }}
        />
      </div>

      {open && (
        <ul
          ref={listRef} id={listId} role="listbox"
          style={{
            position: 'absolute', zIndex: 60, left: 0, right: 0, top: 'calc(100% + 4px)', margin: 0, padding: 4,
            listStyle: 'none', maxHeight: 240, overflowY: 'auto', overscrollBehavior: 'contain',
            background: 'var(--white, #fff)', border: '1.5px solid var(--bdr2, #E2E8F0)', borderRadius: 12,
            boxShadow: '0 10px 30px rgba(11,31,58,.14)',
          }}
        >
          {noResult && (
            <li style={{ padding: '10px 12px', fontSize: 13, color: 'var(--t3, #64748B)' }}>
              {noResultLabel ? noResultLabel(query) : `Aucun résultat pour « ${query} ».`}
            </li>
          )}
          {shown.map((o, i) => (
            <li
              key={`${o.value}-${i}`} role="option" aria-selected={o.value === value}
              // onMouseDown (pas onClick) : évite que le blur/clic extérieur ferme la liste avant la sélection
              onMouseDown={e => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
              style={{
                padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                fontWeight: o.value === value ? 700 : 500, color: 'var(--navy, #0B1F3A)',
                background: i === active ? 'var(--sky-2, #EEF3FD)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 8,
                ...(o.value === pinned?.value ? { fontStyle: 'italic', borderTop: '1px solid var(--bdr, #E2E8F0)', borderRadius: 0, marginTop: 2 } : {}),
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{o.label}</span>
              {o.value === value && <i className="fas fa-check" style={{ color: 'var(--blue, #1A4FC4)', fontSize: 11 }} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
