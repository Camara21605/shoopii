/* ============================================================
 * FICHIER : src/modules/auth/components/RoleSelector.tsx
 *
 * CORRECTIONS :
 *
 *  1. prop onlyClientRole (nouvelle)
 *     → Sans invitation : seul "client" est cliquable.
 *     → Tous les autres rôles sont grisés, non cliquables,
 *       avec un tooltip expliquant pourquoi.
 *
 *  2. prop lockedRole (existante, comportement inchangé)
 *     → Avec invitation : seul le rôle invité est cliquable.
 *
 *  3. Priorité des règles :
 *     lockedRole > onlyClientRole > comportement normal
 *
 *  4. super_admin toujours filtré de la grille.
 * ============================================================ */

import React from 'react';
import { ROLE_CONFIGS } from '../roleConfigs';
import type { UserRole } from '../types';

interface RoleSelectorProps {
  /** Rôle actuellement sélectionné */
  selected: UserRole;
  /** Callback au clic sur un rôle non-grisé */
  onSelect: (role: UserRole, icon: string) => void;
  /** Afficher le sous-titre (inscription) */
  showSub?: boolean;
  /** Label au-dessus de la grille */
  label?: string;
  /**
   * Rôle imposé depuis le lien d'invitation (?role=delivery).
   * Seul ce rôle est cliquable — tous les autres sont grisés.
   */
  lockedRole?: UserRole | null;
  /**
   * Mode sans invitation : seul "client" est disponible.
   * Ignoré si lockedRole est défini.
   */
  onlyClientRole?: boolean;
  /**
   * PlatformSettings.openSignup désactivé côté super-admin — le rôle
   * "client" est grisé même hors mode invitation, avec un message dédié.
   * Prioritaire sur onlyClientRole (qui rendait justement "client" seul
   * disponible) : sans ce prop, le blocage serveur existait déjà mais
   * rien ne le signalait avant la soumission du formulaire.
   */
  clientRegistrationClosed?: boolean;
  /**
   * PlatformSettings.codeRequiredForCompany désactivé — "company" devient
   * sélectionnable en mode onlyClientRole (sans lien d'invitation), au même
   * titre que "client". true par défaut (comportement historique : code
   * toujours requis) tant que la politique publique n'a pas répondu.
   */
  companyCodeRequired?: boolean;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  selected,
  onSelect,
  showSub       = false,
  label         = 'Votre rôle',
  lockedRole    = null,
  onlyClientRole = false,
  clientRegistrationClosed = false,
  companyCodeRequired = true,
}) => {
  // Exclure super_admin de la grille publique
  const roles = (Object.entries(ROLE_CONFIGS) as [UserRole, (typeof ROLE_CONFIGS)[UserRole]][])
    .filter(([role]) => role !== 'super_admin');

  // Calcule si un rôle donné est grisé
  const isDisabled = (role: UserRole): boolean => {
    if (lockedRole !== null) {
      // Mode invitation : seul le rôle invité est accessible
      return role !== lockedRole;
    }
    // PlatformSettings.openSignup désactivé — "client" grisé même sans
    // mode onlyClientRole (un lien d'invitation vise toujours un rôle
    // pro, jamais "client", donc pas de conflit avec lockedRole ci-dessus).
    if (role === 'client' && clientRegistrationClosed) {
      return true;
    }
    if (onlyClientRole) {
      // Mode sans invitation : "client" est toujours accessible, et
      // "company" le devient aussi quand codeRequiredForCompany est
      // désactivé — voir companyCodeRequired ci-dessus.
      if (role === 'client') return false;
      if (role === 'company' && !companyCodeRequired) return false;
      return true;
    }
    return false;
  };

  // Tooltip pour les rôles grisés
  const getTitle = (role: UserRole): string | undefined => {
    if (!isDisabled(role)) return undefined;
    if (lockedRole !== null) {
      return `Ce formulaire est réservé au rôle ${ROLE_CONFIGS[lockedRole]?.label ?? lockedRole}`;
    }
    if (role === 'client' && clientRegistrationClosed) {
      return 'Les inscriptions clients sont temporairement fermées.';
    }
    if (onlyClientRole) {
      return 'Ce rôle nécessite une invitation par lien email';
    }
    return undefined;
  };

  return (
    <div className="role-selector">
      <div className="rs-label">
        {label}

        {/* Badge d'état */}
        {lockedRole && (
          <span style={{
            marginLeft: '8px', fontSize: '10px', fontWeight: 700,
            color: 'var(--blue)', background: 'var(--sky-2, #DCE8F8)',
            border: '1px solid rgba(37,99,235,.25)',
            borderRadius: '4px', padding: '1px 7px',
            letterSpacing: '.3px', textTransform: 'uppercase',
            verticalAlign: 'middle',
          }}>
            ✉️ Invitation
          </span>
        )}
        {!lockedRole && onlyClientRole && (
          <span style={{
            marginLeft: '8px', fontSize: '10px', fontWeight: 700,
            color: 'var(--t3, #94a3b8)', background: 'var(--g100, #F1F5F9)',
            border: '1px solid var(--bdr2)',
            borderRadius: '4px', padding: '1px 7px',
            letterSpacing: '.3px', textTransform: 'uppercase',
            verticalAlign: 'middle',
          }}>
            🔒 Invitation requise
          </span>
        )}
      </div>

      {/* Bandeau informatif en mode sans invitation — texte adapté aux 4
          combinaisons possibles (client ouvert/fermé × entreprise
          ouverte/fermée), plutôt que de supposer que seul "client" peut
          jamais être disponible en libre-service. */}
      {!lockedRole && onlyClientRole && (() => {
        const clientOpen  = !clientRegistrationClosed;
        const companyOpen = !companyCodeRequired;

        if (!clientOpen && !companyOpen) {
          return (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '9px',
              padding: '10px 13px', marginBottom: '12px',
              background: 'rgba(220,38,38,.06)',
              border: '1.5px solid rgba(220,38,38,.2)',
              borderRadius: '10px', fontSize: '12px',
              color: 'var(--rose, #DC2626)', lineHeight: 1.5,
            }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>🚫</span>
              <span>
                <strong>Inscriptions temporairement fermées.</strong> La création de nouveaux comptes
                sans invitation n'est pas disponible pour le moment. Réessayez plus tard ou
                contactez le support.
              </span>
            </div>
          );
        }

        const availableLabel = clientOpen && companyOpen
          ? 'les comptes Client et Entreprise sont disponibles'
          : clientOpen
            ? 'seul le compte Client est disponible'
            : 'seul le compte Entreprise est disponible';

        return (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '9px',
            padding: '10px 13px', marginBottom: '12px',
            background: 'rgba(245,158,11,.06)',
            border: '1.5px solid rgba(245,158,11,.2)',
            borderRadius: '10px', fontSize: '12px',
            color: 'var(--amber, #D97706)', lineHeight: 1.5,
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>ℹ️</span>
            <span>
              <strong>Inscription sans invitation :</strong> {availableLabel}.
              Les autres rôles nécessitent
              un <strong>lien d'invitation</strong> envoyé par un administrateur Shoneya.
            </span>
          </div>
        );
      })()}

      <div className="rs-grid">
        {roles.map(([role, config]) => {
          const disabled  = isDisabled(role);
          const isSelected = selected === role;
          const title     = getTitle(role);

          return (
            <div
              key={role}
              className={[
                'rs-opt',
                isSelected && !disabled ? 'selected' : '',
                disabled ? 'rs-locked' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { if (!disabled) onSelect(role, config.icon); }}
              data-role={role}
              title={title}
              style={{ pointerEvents: disabled ? 'none' : undefined, position: 'relative' }}
            >
              <div className="rs-icon">{config.icon}</div>
              <div className="rs-name">{config.label}</div>
              {showSub && config.sub && (
                <div className="rs-sub">{config.sub}</div>
              )}

              {/* Overlay cadenas sur les rôles grisés */}
              {disabled && (
                <div className="rs-lock-overlay">🔒</div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .rs-opt.rs-locked {
          opacity: 0.35;
          cursor: not-allowed;
          filter: grayscale(0.7);
          transform: none !important;
          box-shadow: none !important;
          pointer-events: none;
        }
        .rs-lock-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: inherit;
          background: rgba(255,255,255,.5);
          font-size: 14px;
          opacity: 0;
          transition: opacity .15s;
        }
        .rs-opt.rs-locked:hover .rs-lock-overlay {
          opacity: 1;
        }
        .rs-opt.rs-locked.selected {
          border-color: var(--bdr2) !important;
          background: var(--g50) !important;
        }
      `}</style>
    </div>
  );
};