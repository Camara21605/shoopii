/* ================================================================
 * src/dashboards/correspondant/components/ParamMobileMenu.tsx
 *
 * Écran racine des paramètres correspondant en mode téléphone : liste
 * groupée avec icônes + libellés + chevrons/indicateurs (même esprit
 * qu'un écran de réglages natif), affichée à la place de la barre de
 * pills horizontale quand l'écran est étroit — voir ParametresPage.tsx.
 * Réutilise NAV_ITEMS + computeNavState() de data/parametresData.ts
 * (mêmes indicateurs réels — % de complétion, points d'alerte — que la
 * navigation desktop ParamNav.tsx, une seule source de vérité) — rien
 * n'est inventé ici, seule la présentation change.
 * ================================================================ */

import { useMemo } from 'react';
import { NAV_ITEMS, computeNavState, type SectionId } from '../data/parametresData';
import type { CorrespondantData } from '../hooks/useCorrespondantParametres';
import s from '../styles/ParamMobileMenu.module.css';

const GROUPS = ['Identité', 'Activité', 'Finances', 'Compte'] as const;

interface Props {
  data:        CorrespondantData | null;
  onOpen:      (id: SectionId) => void;
  onLogout:    () => void;
}

export default function ParamMobileMenu({ data, onOpen, onLogout }: Props) {
  const navState = useMemo(() => computeNavState(data), [data]);
  const initials = (data?.fullName ?? '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className={s.wrap}>
      {/* ── Résumé profil ── */}
      <button type="button" className={s.profileRow} onClick={() => onOpen('profil')}>
        <div className={s.profileAvatar}>
          {data?.profilePicture ? <img src={data.profilePicture} alt="" /> : initials}
        </div>
        <div className={s.profileName}>{data?.fullName || 'Profil & Identité'}</div>
        <i className={`fas fa-chevron-right ${s.chevron}`} />
      </button>

      {GROUPS.map(group => {
        const items = NAV_ITEMS.filter(i => i.group === group);
        return (
          <div className={s.group} key={group}>
            <div className={s.groupLabel}>{group}</div>
            <div className={s.card}>
              {items.map(item => {
                const indicator = navState[item.id] ?? {};
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${s.row} ${item.isDanger ? s.dangerRow : ''}`}
                    onClick={() => onOpen(item.id)}
                  >
                    <div className={s.icon}><i className={`fas ${item.icon}`} /></div>
                    <div className={s.label}>{item.label}</div>
                    {indicator.pct && !indicator.dotColor && <span className={s.pct}>{indicator.pct}</span>}
                    {indicator.dotColor && <span className={s.dot} title={indicator.dotColor === 'r' ? 'Action requise' : 'En attente'} />}
                    <i className={`fas fa-chevron-right ${s.chevron}`} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className={s.logoutGroup}>
        <div className={s.card}>
          <button type="button" className={`${s.row} ${s.logoutRow}`} onClick={onLogout}>
            <div className={s.icon}><i className="fas fa-right-from-bracket" /></div>
            <div className={s.label}>Se déconnecter</div>
          </button>
        </div>
      </div>
    </div>
  );
}
