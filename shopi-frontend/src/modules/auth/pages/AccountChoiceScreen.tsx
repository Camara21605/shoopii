/* ============================================================
 * FICHIER : src/modules/auth/pages/AccountChoiceScreen.tsx
 *
 * Étape 2 du login quand l'identifiant + mot de passe saisis
 * correspondent à DEUX comptes liés (pro + client "Mon espace",
 * même email/téléphone, mot de passe coïncidant sur les deux —
 * cas rare). Le backend renvoie { requiresAccountChoice: true,
 * accounts } depuis POST /auth/login ; cet écran fait choisir le
 * compte visé puis appelle POST /auth/login/choose-account.
 * ============================================================ */

import React from 'react';
import type { UserRole } from '../types';

const ROLE_LABELS: Record<UserRole, { label: string; icon: string }> = {
  client:        { label: 'Compte client',        icon: 'fa-user' },
  company:       { label: 'Compte entreprise',     icon: 'fa-store' },
  delivery:      { label: 'Compte livreur',        icon: 'fa-motorcycle' },
  correspondent: { label: 'Compte correspondant',  icon: 'fa-warehouse' },
  admin:         { label: 'Compte administrateur', icon: 'fa-user-shield' },
  partner:       { label: 'Compte partenaire',     icon: 'fa-handshake' },
  super_admin:   { label: 'Super administrateur',  icon: 'fa-user-shield' },
};

interface Props {
  accounts:  { userId: string; role: UserRole }[];
  isLoading: boolean;
  error:     string;
  onChoose:  (userId: string) => void;
  onCancel:  () => void;
}

export const AccountChoiceScreen: React.FC<Props> = ({ accounts, isLoading, error, onChoose, onCancel }) => (
  <div style={{ animation: 'fadeSlideIn .3s ease' }}>
    <button
      onClick={onCancel}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
        color: 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20, padding: 0,
      }}
    >
      <i className="fas fa-arrow-left" /> Retour à la connexion
    </button>

    <h2 style={{ fontFamily: 'var(--fd, Fraunces, serif)', fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
      Plusieurs comptes trouvés
    </h2>
    <p style={{ fontSize: 13.5, color: 'var(--t2)', marginBottom: 22, lineHeight: 1.6 }}>
      Ces identifiants correspondent à deux comptes liés. Choisissez celui auquel vous connecter.
    </p>

    {error && (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', marginBottom: 14, background: 'var(--rose-dim, #fff0f0)', border: '1.5px solid rgba(220,38,38,.25)', borderRadius: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <span style={{ fontSize: 13, color: 'var(--rose, #DC2626)', fontWeight: 500 }}>{error}</span>
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {accounts.map(acc => {
        const meta = ROLE_LABELS[acc.role] ?? { label: acc.role, icon: 'fa-user' };
        return (
          <button
            key={acc.userId}
            disabled={isLoading}
            onClick={() => onChoose(acc.userId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: 'var(--white)', border: '1.5px solid var(--bdr2, #E2E8F0)', borderRadius: 12,
              cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? .6 : 1, textAlign: 'left',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--sky, #EEF3FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <i className={`fas ${meta.icon}`} style={{ color: 'var(--blue, #1A4FC4)', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{meta.label}</span>
            <i className="fas fa-chevron-right" style={{ marginLeft: 'auto', color: 'var(--t4)', fontSize: 12 }} />
          </button>
        );
      })}
    </div>
  </div>
);
