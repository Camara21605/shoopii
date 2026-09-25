/* ================================================================
 * components/ParamNav.tsx — VERSION DYNAMIQUE
 *
 * Props :
 *   section       — section active
 *   onSection(id) — callback changement de section
 *   data          — données API réelles (CorrespondantData | null)
 *
 * Calcul dynamique de chaque indicateur :
 *   pct      → % de complétion calculé depuis data (0–100)
 *   dotColor → 'r' (rouge) ou 'a' (amber) si attention requise
 *
 * Si data est null (chargement) → indicateurs masqués (skeleton)
 * ================================================================ */

import React, { useMemo } from 'react';
import s from '../styles/ParamNav.module.css';
import { NAV_ITEMS, computeNavState, type SectionId } from '../data/parametresData';
import type { CorrespondantData } from '../hooks/useCorrespondantParametres';

interface Props {
  section:   SectionId;
  onSection: (id: SectionId) => void;
  /** Données API — null pendant le chargement */
  data:      CorrespondantData | null;
}

/* Groupes dans l'ordre d'affichage */
const GROUPS = ['Identité', 'Activité', 'Finances', 'Compte'] as const;

// ─────────────────────────────────────────────────────────────
// COMPOSANT
// (le calcul des indicateurs — computeNavState — vit dans
// data/parametresData.ts, réutilisé par ParamMobileMenu.tsx)
// ─────────────────────────────────────────────────────────────

export default function ParamNav({ section, onSection, data }: Props) {

  /* Calcul mémoïsé — ne se relance que si `data` change */
  const navState = useMemo(() => computeNavState(data), [data]);

  return (
    <nav className={s.nav} id="pnav" aria-label="Navigation paramètres">
      {GROUPS.map(grp => {
        const items = NAV_ITEMS.filter(i => i.group === grp);
        return (
          <div key={grp} className={s.group}>
            <div className={s.sect}>{grp}</div>

            {items.map(item => {
              /* Indicateur dynamique calculé depuis les données API */
              const indicator = navState[item.id] ?? {};

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={[
                    s.item,
                    section === item.id ? s.itemOn     : '',
                    item.isDanger       ? s.itemDanger : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSection(item.id)}
                  onKeyDown={e => e.key === 'Enter' && onSection(item.id)}
                  aria-current={section === item.id ? 'page' : undefined}
                  title={item.label}
                >
                  {/* Icône section */}
                  <i className={`fas ${item.icon} ${s.icon}`} />

                  {/* Libellé */}
                  <span>{item.label}</span>

                  {/* ── Indicateur droit : % calculé ── */}
                  {indicator.pct && !indicator.dotColor && (
                    <span
                      className={s.pct}
                      style={{
                        /* Couleur adaptée au % : rouge < 50%, amber < 80%, vert ≥ 80% */
                        color:
                          parseInt(indicator.pct) < 50 ? 'var(--t1)' :
                          parseInt(indicator.pct) < 80 ? 'var(--t2)' :
                          'var(--t2)',
                      }}
                    >
                      {data ? indicator.pct : '—'}
                    </span>
                  )}

                  {/* ── Indicateur droit : point coloré ── */}
                  {indicator.dotColor === 'r' && (
                    <span
                      className={`${s.dot} ${s.dotR}`}
                      title="Action requise"
                    />
                  )}
                  {indicator.dotColor === 'a' && (
                    <span
                      className={`${s.dot} ${s.dotA}`}
                      title="En attente"
                    />
                  )}

                  {/* Skeleton pendant le chargement */}
                  {!data && (
                    <span style={{
                      display:'inline-block', width:28, height:8,
                      borderRadius:4, background:'rgba(255,255,255,.06)',
                      animation:'pulse 1.5s ease infinite',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}