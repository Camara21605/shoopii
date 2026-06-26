/* ================================================================
 * sections/params/RadioOption.tsx
 * Composant option radio réutilisable (virements, etc.)
 * ================================================================ */

import React from 'react';
import s from '../../styles/ParamsShared.module.css';

interface Props {
  em:      string;
  title:   string;
  sub:     string;
  badge:   string;
  color:   string;
  sel:     boolean;
  onClick: () => void;
}

export default function RadioOption({ em, title, sub, badge, color, sel, onClick }: Props) {
  return (
    <div
      className={`${s.radioOpt} ${sel ? s.radioSel : ''}`}
      onClick={onClick}
      role="radio"
      aria-checked={sel}
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Dot radio */}
      <div className={s.roDot} />

      {/* Emoji */}
      <span className={s.roEm}>{em}</span>

      {/* Texte */}
      <div style={{ flex: 1 }}>
        <div className={s.roTtl}>{title}</div>
        <div className={s.roSub}>{sub}</div>
      </div>

      {/* Badge prix */}
      <span className={s.roBadge} style={{ color }}>{badge}</span>
    </div>
  );
}