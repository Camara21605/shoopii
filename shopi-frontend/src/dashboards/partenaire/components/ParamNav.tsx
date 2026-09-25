/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/ParamNav.tsx
 *
 * Navigation gauche des paramètres partenaire.
 *
 * Indicateurs dynamiques calculés depuis PartenaireData :
 *   pct      → pourcentage de complétude (0–100)
 *   dotColor → 'r' rouge (action urgente) ou 'a' amber (en attente)
 *
 * Si data est null (chargement) → skeleton affiché.
 * ================================================================ */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/ParamNav.module.css';
import { NAV_ITEMS, computeNavState, type SectionId, type NavGroupId } from '../data/parametresData';
import type { PartenaireData } from '../hooks/usePartenaireParametres';

interface Props {
  section:   SectionId;
  onSection: (id: SectionId) => void;
  /** null pendant le chargement initial */
  data:      PartenaireData | null;
}

/* Groupes dans l'ordre d'affichage */
const GROUPS: NavGroupId[] = ['identite', 'activite', 'finances', 'compte'];

// ─────────────────────────────────────────────────────────────
// COMPOSANT
// (le calcul des indicateurs — computeNavState — vit dans
// data/parametresData.ts, réutilisé par ParamMobileMenu.tsx)
// ─────────────────────────────────────────────────────────────

export default function ParamNav({ section, onSection, data }: Props) {
  const { t } = useTranslation();
  const navState = useMemo(() => computeNavState(data), [data]);

  return (
    <nav className={s.nav} aria-label={t('partenaireParametres.nav.ariaLabel')}>
      {GROUPS.map(grp => {
        const items = NAV_ITEMS.filter(i => i.group === grp);
        return (
          <div key={grp} className={s.group}>
            <div className={s.sect}>{t(`partenaireParametres.nav.groups.${grp}`)}</div>
            {items.map(item => {
              const indicator = navState[item.id] ?? {};
              return (
                <button
                  key={item.id}
                  className={[
                    s.item,
                    section === item.id ? s.itemOn : '',
                    item.isDanger ? s.itemDanger : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSection(item.id)}
                  aria-current={section === item.id ? 'page' : undefined}
                >
                  <i className={`fas ${item.icon} ${s.icon}`} />
                  <span>{t(`partenaireParametres.nav.items.${item.labelKey}`)}</span>

                  {/* % de complétion */}
                  {indicator.pct && !indicator.dotColor && (
                    <span
                      className={s.pct}
                      style={{
                        color:
                          parseInt(indicator.pct) < 50 ? 'var(--red)' :
                          parseInt(indicator.pct) < 80 ? 'var(--amber)' :
                          'var(--emerald)',
                      }}
                    >
                      {data ? indicator.pct : '—'}
                    </span>
                  )}

                  {/* Point coloré */}
                  {indicator.dotColor === 'r' && <span className={`${s.dot} ${s.dotR}`} />}
                  {indicator.dotColor === 'a' && <span className={`${s.dot} ${s.dotA}`} />}

                  {/* Skeleton chargement */}
                  {!data && (
                    <span style={{
                      display: 'inline-block', width: 28, height: 8,
                      borderRadius: 4, background: 'var(--g200)',
                      marginLeft: 'auto',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
