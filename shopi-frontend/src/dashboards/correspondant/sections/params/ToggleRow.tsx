/* ================================================================
 * sections/params/ToggleRow.tsx
 * Composant toggle réutilisable dans toutes les sections paramètres
 * ================================================================ */

import React from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { BadgeType } from '../../data/parametresData';

interface Props {
  label:    string;
  sub:      string;
  checked:  boolean;
  badge?:   BadgeType;
  onChange: (checked: boolean) => void;
}

/** Texte et style d'un badge */
const BADGE_CFG: Record<Exclude<BadgeType, ''>, { label: string; cls: string }> = {
  rec:  { label:'Recommandé', cls: s.badgeRec  },
  new:  { label:'Nouveau',    cls: s.badgeNew  },
  warn: { label:'Attention',  cls: s.badgeWarn },
};

export default function ToggleRow({ label, sub, checked, badge = '', onChange }: Props) {
  const badgeCfg = badge ? BADGE_CFG[badge] : null;

  return (
    <div className={s.togRow}>
      <div>
        <div className={s.trLbl}>
          {label}
          {badgeCfg && (
            <span className={`${s.trBadge} ${badgeCfg.cls}`}>
              {badgeCfg.label}
            </span>
          )}
        </div>
        <div className={s.trSub}>{sub}</div>
      </div>

      {/* Toggle switch */}
      <label className={s.tog}>
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <span className={s.togs} />
      </label>
    </div>
  );
}