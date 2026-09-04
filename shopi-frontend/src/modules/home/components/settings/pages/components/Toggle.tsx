/* ================================================================
 * src/modules/home/components/settings/components/Toggle.tsx
 * ================================================================ */

import React from 'react';
import s from '../styles/SettingsCard.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <label className={s.tog}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      <span className={s.togSl} />
    </label>
  );
}