/* ============================================================
 * FICHIER : src/shared/components/ui/FieldInput.tsx
 * RÔLE    : Champ de formulaire réutilisable avec icône,
 *           toggle mot de passe, message d'erreur
 * ============================================================ */

import React, { useState } from 'react';

interface FieldInputProps {
  /** Label affiché au-dessus du champ */
  label?: string;
  /** Élément affiché à droite du label (ex : lien "Mot de passe oublié") */
  labelRight?: React.ReactNode;
  /** Icône Font Awesome à gauche (ex: "fas fa-envelope") */
  icon?: string;
  /** Type HTML du champ */
  type?: 'text' | 'email' | 'password' | 'tel';
  /** Placeholder */
  placeholder?: string;
  /** Valeur courante */
  value: string;
  /** Callback onChange */
  onChange: (value: string) => void;
  /** Message d'erreur (affiché si non vide) */
  error?: string;
  /** Classes CSS supplémentaires pour l'input */
  className?: string;
  /** Style inline pour l'input (ex: padding-left pour le préfixe téléphone) */
  inputStyle?: React.CSSProperties;
  /** Contenu préfixe à gauche (ex: drapeau + indicatif) */
  prefix?: React.ReactNode;
  /** Callback onInput (validation en temps réel) */
  onInput?: () => void;
  id?: string;
}

/**
 * FieldInput
 * Champ de formulaire universel du design system Shopi.
 * Supporte le toggle mot de passe, les icônes, les préfixes
 * et l'affichage conditionnel des erreurs.
 */
export const FieldInput: React.FC<FieldInputProps> = ({
  label,
  labelRight,
  icon,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  className = '',
  inputStyle,
  prefix,
  onInput,
  id,
}) => {
  /* Gestion du toggle mot de passe */
  const [showPwd, setShowPwd] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPwd ? 'text' : 'password') : type;

  /* Classes CSS de l'input selon l'état */
  const inputClass = [
    'field-input',
    error ? 'error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field-group">
      {/* Label + élément droit optionnel */}
      {label && (
        <div className="field-label">
          {label}
          {labelRight}
        </div>
      )}

      <div className="field-wrap">
        {/* Icône gauche */}
        {icon && !prefix && (
          <i className={`${icon} field-icon`} />
        )}

        {/* Préfixe texte (ex: 🇬🇳 +224) */}
        {prefix && (
          <div
            style={{
              position: 'absolute',
              left: '14px',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--t2)',
              fontWeight: 600,
              pointerEvents: 'none',
            }}
          >
            {prefix}
          </div>
        )}

        {/* Input */}
        <input
          id={id}
          type={inputType}
          className={inputClass}
          placeholder={placeholder}
          value={value}
          style={inputStyle}
          autoComplete="off"
          onChange={e => onChange(e.target.value)}
          onInput={onInput}
        />

        {/* Bouton toggle mot de passe */}
        {isPassword && (
          <button
            type="button"
            className="field-toggle"
            onClick={() => setShowPwd(p => !p)}
          >
            <i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
          </button>
        )}
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="field-error show">
          <i className="fas fa-circle-exclamation" />
          {error}
        </div>
      )}
    </div>
  );
};