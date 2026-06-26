/* ============================================================
 * FICHIER : src/modules/auth/components/PasswordStrengthBar.tsx
 * RÔLE    : Indicateur visuel de la force du mot de passe
 *           (4 barres colorées + label textuel)
 * ============================================================ */

import React from 'react';
import type { PasswordStrength } from '../hooks/usePasswordStrength';

interface PasswordStrengthBarProps {
  strength: PasswordStrength;
  show: boolean;
}

/**
 * PasswordStrengthBar
 * Affiche 4 barres colorées dont le remplissage
 * dépend du score (0-4) calculé par usePasswordStrength.
 */
export const PasswordStrengthBar: React.FC<PasswordStrengthBarProps> = ({
  strength,
  show,
}) => {
  if (!show) return null;

  return (
    <div className="pwd-strength show">
      <div className="pwd-bars">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`pwd-bar${i < strength.score ? ` ${strength.colorClass}` : ''}`}
          />
        ))}
      </div>
      <div className="pwd-label">{strength.label}</div>
    </div>
  );
};