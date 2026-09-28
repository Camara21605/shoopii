/* ================================================================
 * src/modules/home/components/settings/components/Toggle.tsx
 * ================================================================ */

import React from 'react';
import s from '../styles/SettingsCard.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Nom lu par les lecteurs d'écran (avant : « case à cocher » sans nom) */
  label?: string;
}

export function Toggle({ checked, onChange, disabled = false, label }: ToggleProps) {
  return (
    <label className={s.tog}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      <span className={s.togSl} />
    </label>
  );
}