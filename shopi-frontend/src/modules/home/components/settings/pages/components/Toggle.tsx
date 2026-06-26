/* ================================================================
 * src/modules/home/components/settings/components/Toggle.tsx
 * ================================================================ */

import React from 'react';
import s from '../styles/SettingsCard.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <label className={s.tog}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className={s.togSl} />
    </label>
  );
}