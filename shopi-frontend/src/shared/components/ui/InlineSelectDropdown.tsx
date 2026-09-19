/* ================================================================
 * FICHIER : src/shared/components/ui/InlineSelectDropdown.tsx
 *
 * PROBLÈME — sur téléphone, un <select> natif ouvre le sélecteur du système
 * (feuille plein écran) : la liste « jaillit » hors du champ.
 *
 * SOLUTION GLOBALE (aucun <select> du projet à modifier) — sur petit écran /
 * écran tactile, ce composant :
 *   1. désactive l'ouverture native de TOUS les <select> (pointer-events:none,
 *      voir <style> ci-dessous — un tap ne peut alors plus ouvrir le sélecteur
 *      système) ;
 *   2. intercepte le tap, retrouve le <select> sous le doigt et affiche une
 *      liste COLLÉE AU CHAMP (même largeur, juste dessous — ou dessus s'il n'y
 *      a pas la place), défilante, aux couleurs/police du champ lui-même ;
 *   3. à la sélection, écrit la valeur dans le <select> et déclenche ses
 *      événements `input`/`change` : les composants React (contrôlés ou non)
 *      réagissent exactement comme avec le sélecteur natif.
 *
 * Sur ordinateur (souris) rien ne change : le <select> natif reste utilisé.
 * Exclusions : <select multiple>, <select disabled>, <select data-native>.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MOBILE_MQ = '(max-width: 768px), (pointer: coarse)';
const SELECTOR  = 'select:not([multiple]):not([disabled]):not([data-native])';
/** Au-delà, un champ de recherche apparaît en haut de la liste. */
const SEARCH_THRESHOLD = 14;

/* Rend le tap inopérant sur les <select> : le sélecteur système ne s'ouvre plus. */
const STYLE_ID = 'inline-select-dropdown-style';
const CSS = `html[data-inline-select] ${SELECTOR}{pointer-events:none}`;

interface Opt { value: string; label: string; disabled: boolean; group: string | null; }

interface OpenState {
  sel:    HTMLSelectElement;
  opts:   Opt[];
  value:  string;
  style:  React.CSSProperties;          // position + dimensions
  theme:  { bg: string; fg: string; font: string; size: string; radius: string; border: string };
}

/** Couleur de fond réelle du champ (remonte les parents si transparent). */
function effectiveBackground(el: HTMLElement): string {
  let cur: HTMLElement | null = el;
  while (cur) {
    const bg = getComputedStyle(cur).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg)) return bg;
    cur = cur.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor || '#fff';
}

function readOptions(sel: HTMLSelectElement): Opt[] {
  return Array.from(sel.options).map(o => ({
    value:    o.value,
    label:    o.text,
    disabled: o.disabled,
    group:    o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : null,
  }));
}

/** Le champ est-il réellement AU-DESSUS à cet endroit ? On lui rend brièvement les
 *  événements souris pour demander au navigateur quel élément est visible sous
 *  le doigt : si c'est une modale/un menu superposé, ce n'est pas le champ et on
 *  n'ouvre rien (évite d'ouvrir un <select> resté DERRIÈRE une modale). */
function isTopmostAt(sel: HTMLSelectElement, x: number, y: number): boolean {
  const prev = sel.style.pointerEvents;
  sel.style.pointerEvents = 'auto';
  const hit = document.elementFromPoint(x, y);
  sel.style.pointerEvents = prev;
  return hit === sel;
}

function findSelectAt(x: number, y: number): HTMLSelectElement | null {
  let best: HTMLSelectElement | null = null;
  let bestArea = Infinity;
  document.querySelectorAll<HTMLSelectElement>(SELECTOR).forEach(sel => {
    const r = sel.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
    if (getComputedStyle(sel).visibility === 'hidden') return;
    if (!isTopmostAt(sel, x, y)) return;
    const area = r.width * r.height;
    if (area < bestArea) { best = sel; bestArea = area; }
  });
  return best;
}

export default function InlineSelectDropdown() {
  const [state, setState] = useState<OpenState | null>(null);
  const [query, setQuery] = useState('');
  const popupRef  = useRef<HTMLDivElement>(null);
  const openSelRef = useRef<HTMLSelectElement | null>(null);

  const close = useCallback(() => { openSelRef.current = null; setState(null); setQuery(''); }, []);

  /* ── Mode « liste intégrée » : actif sur petit écran / tactile ── */
  useEffect(() => {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);

    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => {
      if (mq.matches) document.documentElement.setAttribute('data-inline-select', '');
      else { document.documentElement.removeAttribute('data-inline-select'); close(); }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      document.documentElement.removeAttribute('data-inline-select');
      style.remove();
    };
  }, [close]);

  /* ── Ouverture / fermeture au tap ── */
  useEffect(() => {
    const open = (sel: HTMLSelectElement) => {
      const r  = sel.getBoundingClientRect();
      const cs = getComputedStyle(sel);
      const vw = window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const opts = readOptions(sel);

      const gap    = 4;
      const below  = vh - r.bottom - gap - 8;
      const above  = r.top - gap - 8;
      const wanted = Math.min(300, opts.length * 40 + (opts.length > SEARCH_THRESHOLD ? 52 : 0) + 8);
      const placeBelow = below >= Math.min(wanted, 180) || below >= above;
      const maxHeight  = Math.max(120, Math.min(300, placeBelow ? below : above));

      const width = Math.max(r.width, Math.min(180, vw - 16));
      const left  = Math.min(Math.max(8, r.left), Math.max(8, vw - width - 8));

      const fg = cs.color;
      openSelRef.current = sel;
      setQuery('');
      setState({
        sel, opts, value: sel.value,
        style: {
          position: 'fixed', left, width, maxHeight,
          ...(placeBelow ? { top: r.bottom + gap } : { bottom: window.innerHeight - r.top + gap }),
        },
        theme: {
          bg: effectiveBackground(sel), fg,
          font: cs.fontFamily, size: cs.fontSize,
          radius: cs.borderRadius && cs.borderRadius !== '0px' ? cs.borderRadius : '10px',
          border: `1px solid color-mix(in srgb, ${fg} 22%, transparent)`,
        },
      });
    };

    /* On travaille sur pointerdown/pointerup (et non sur `click`) : iOS Safari ne
     * remonte pas `click` jusqu'à `document` pour un tap sur un élément non
     * « cliquable » — or, avec pointer-events:none, le tap atterrit sur le
     * parent du <select>. pointerup, lui, est émis partout. Un tap = peu de
     * mouvement + court (sinon c'est un défilement, on ne fait rien). */
    let down: { x: number; y: number; t: number } | null = null;
    let swallowClickUntil = 0;

    const onPointerDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: Date.now() }; };

    const onPointerUp = (e: PointerEvent) => {
      const d = down; down = null;
      if (!window.matchMedia(MOBILE_MQ).matches) return;
      if (popupRef.current?.contains(e.target as Node)) return;          // tap DANS la liste : géré par ses options
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || Date.now() - d.t > 700) return;

      const sel = findSelectAt(e.clientX, e.clientY);
      if (!sel) { if (openSelRef.current) close(); return; }            // tap ailleurs : ferme (l'événement continue)

      // Le `click` qui suit ce tap ne doit rien déclencher sur les éléments sous le champ.
      swallowClickUntil = Date.now() + 500;
      if (openSelRef.current === sel) close(); else open(sel);
    };

    const onClick = (e: MouseEvent) => {
      if (Date.now() > swallowClickUntil) return;
      if (popupRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      swallowClickUntil = 0;
    };

    const onKey    = (e: KeyboardEvent) => { if (e.key === 'Escape' && openSelRef.current) close(); };
    const onScroll = (e: Event) => {
      if (!openSelRef.current) return;
      if (popupRef.current && e.target instanceof Node && popupRef.current.contains(e.target)) return;
      close();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [close]);

  /* Amène l'option actuelle dans la zone visible */
  useEffect(() => {
    if (!state) return;
    popupRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, [state]);

  const filtered = useMemo(() => {
    if (!state) return [];
    const q = query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (!q) return state.opts;
    return state.opts.filter(o => o.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q));
  }, [state, query]);

  if (!state) return null;
  const { sel, theme } = state;

  const choose = (o: Opt) => {
    if (o.disabled) return;
    // Setter natif : contourne le suivi de valeur de React pour que son onChange se déclenche.
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(sel, o.value);
    sel.dispatchEvent(new Event('input',  { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };

  let lastGroup: string | null = null;

  return createPortal(
    <div
      ref={popupRef} role="listbox"
      style={{
        ...state.style, zIndex: 2147483000, overflowY: 'auto', overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch', boxSizing: 'border-box',
        background: theme.bg, color: theme.fg, fontFamily: theme.font, fontSize: theme.size,
        borderRadius: theme.radius, border: theme.border, padding: 4,
        boxShadow: '0 12px 32px rgba(0,0,0,.28)',
      }}
    >
      {state.opts.length > SEARCH_THRESHOLD && (
        <input
          type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher…"
          style={{
            position: 'sticky', top: 0, width: '100%', boxSizing: 'border-box', marginBottom: 4, padding: '9px 10px',
            fontSize: 16 /* ≥16px : évite le zoom automatique d'iOS */, color: theme.fg, background: theme.bg,
            border: theme.border, borderRadius: 8, outline: 'none', fontFamily: theme.font,
          }}
        />
      )}
      {filtered.length === 0 && <div style={{ padding: '12px 10px', opacity: .6 }}>Aucun résultat</div>}
      {filtered.map((o, i) => {
        const groupHeader = o.group && o.group !== lastGroup ? o.group : null;
        lastGroup = o.group;
        const on = o.value === state.value;
        return (
          <div key={`${o.value}-${i}`}>
            {groupHeader && (
              <div style={{ padding: '8px 10px 4px', fontSize: '.8em', fontWeight: 700, opacity: .6, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                {groupHeader}
              </div>
            )}
            <div
              role="option" aria-selected={on} aria-disabled={o.disabled}
              onClick={() => choose(o)}
              style={{
                padding: '11px 10px', borderRadius: 8, cursor: o.disabled ? 'not-allowed' : 'pointer',
                opacity: o.disabled ? .4 : (o.value === '' ? .65 : 1), fontWeight: on ? 700 : 400,
                background: on ? `color-mix(in srgb, ${theme.fg} 12%, transparent)` : 'transparent',
                display: 'flex', alignItems: 'center', gap: 8,
                overflowWrap: 'anywhere',
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{o.label || '—'}</span>
              {on && <span aria-hidden style={{ fontSize: '.9em' }}>✓</span>}
            </div>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
