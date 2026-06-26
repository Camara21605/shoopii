/* ============================================================
 * FICHIER : src/modules/auth/components/CodeBlock.tsx
 * RÔLE    : Carte de saisie d'un code d'activation (avec
 *           icône source, label, note explicative et OTP input)
 * ============================================================ */

import React from 'react';
import { OtpCodeInput } from './OtpCodeInput';
import type { RoleConfig } from '../types';

interface CodeBlockProps {
  /** Configuration du rôle (contient codeIcon, codeLabel, etc.) */
  config: RoleConfig;
  /** Callback quand le code est entièrement saisi */
  onComplete?: (code: string) => void;
  /** Valeur actuelle du code (pour reset) */
  value?: string;
}

/**
 * CodeBlock
 * Affiche la carte glassmorphisme avec :
 *  - icône source + label + "Fourni par: X"
 *  - cases OTP
 *  - note explicative
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({ config, onComplete, value }) => {
  if (!config.code || config.codeType !== 'single') return null;

  return (
    <div className="code-block">
      {/* En-tête de la carte */}
      <div className="code-block-hd">
        <span className="code-block-icon">{config.codeIcon}</span>
        <div>
          <div className="code-block-title">{config.codeLabel}</div>
          <div className="code-block-from">
            Fourni par : <strong>{config.codeFrom}</strong>
          </div>
        </div>
      </div>

      {/* Cases de saisie OTP */}
      <OtpCodeInput
        length={config.codeLength ?? 6}
        onComplete={onComplete}
        value={value}
      />

      {/* Note explicative */}
      {config.codeNote && (
        <div className="code-note">
          <i className="fas fa-circle-info" style={{ color: 'var(--blue)' }} />
          <span>{config.codeNote}</span>
        </div>
      )}
    </div>
  );
};