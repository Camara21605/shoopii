/* ============================================================
 * FICHIER : src/modules/auth/components/PasswordStrengthBar.tsx
 * RÔLE    : Indicateur visuel de la force du mot de passe
 *           (barres colorées + liste des règles à cocher)
 * ============================================================ */

import type { PasswordStrength } from '../hooks/usePasswordStrength';

interface PasswordStrengthBarProps {
  strength: PasswordStrength;
  show: boolean;
}

const RULES: { key: keyof PasswordStrength['requirements']; label: string }[] = [
  { key: 'length',    label: '8 caractères minimum' },
  { key: 'lowercase', label: 'Une minuscule' },
  { key: 'uppercase', label: 'Une majuscule' },
  { key: 'digit',     label: 'Un chiffre' },
  { key: 'special',   label: 'Un caractère spécial' },
];

/**
 * PasswordStrengthBar
 * Affiche des barres colorées (score 0-5) + le détail de chaque règle
 * (✓/✗), pour que l'utilisateur sache EXACTEMENT ce qu'il manque plutôt
 * que de deviner face à un simple label ("Correct", "Fort"…).
 *
 * BUG CORRIGÉ — avant, seule une barre + un label vague étaient
 * affichés : un mot de passe pouvait sembler "Fort" sans satisfaire
 * toutes les règles réellement exigées par le formulaire/serveur (voir
 * usePasswordStrength.ts). La liste ci-dessous utilise exactement les
 * mêmes 5 règles.
 */
export function PasswordStrengthBar({ strength, show }: PasswordStrengthBarProps) {
  if (!show) return null;

  return (
    <div className="pwd-strength show">
      <div className="pwd-bars">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`pwd-bar${i < strength.score ? ` ${strength.colorClass}` : ''}`}
          />
        ))}
      </div>
      <div className="pwd-label">{strength.label}</div>
      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
        {RULES.map(rule => {
          const met = strength.requirements[rule.key];
          return (
            <li key={rule.key} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: met ? 'var(--green, #16A34A)' : 'var(--t3, #94a3b8)',
            }}>
              <i className={`fas ${met ? 'fa-circle-check' : 'fa-circle'}`} style={{ fontSize: 9 }} />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
