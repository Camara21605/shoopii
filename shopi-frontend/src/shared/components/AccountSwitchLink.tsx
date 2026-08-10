/* ================================================================
 * FICHIER : src/shared/components/AccountSwitchLink.tsx
 *
 * RÔLE : lien de bascule vers le compte lié (pro ↔ client) — se cache
 * lui-même si le compte connecté n'a aucun compte lié. Réutilisable des
 * deux côtés : dans un dashboard pro (bascule vers le client) comme
 * dans le header public (bascule vers le pro, côté compte client).
 * "Visible en permanence" (menu profil) — se place à côté de Déconnexion.
 *
 * Délègue toute la logique (step-up 2FA, avertissement action sensible,
 * déconnexion sockets, redirection) à useAccountSwitch() — voir ce fichier
 * pour le détail. Affiche lui-même l'écran de step-up 2FA via un portail
 * quand nécessaire, pour que les appelants n'aient rien à gérer de plus.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getClientAccountStatus } from '../services/accountLink';
import { useAccountSwitch } from '../hooks/useAccountSwitch';
import { TwoFaChallenge } from '../../modules/auth/pages/TwoFaChallenge';

interface Props {
  /** Rendu du lien — reçoit le libellé calculé ("pro" ou "client") et le onClick à brancher. */
  render: (props: { label: string; onClick: () => void; pending: boolean }) => React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  client:        'client',
  company:       'professionnel',
  delivery:      'professionnel',
  correspondent: 'professionnel',
  admin:         'professionnel',
  partner:       'professionnel',
};

export default function AccountSwitchLink({ render }: Props) {
  const [otherRole, setOtherRole] = useState<string | null>(null);
  const { performSwitch, pending, error, twoFaChallengeToken, verifyTwoFa, cancelTwoFa } = useAccountSwitch();

  useEffect(() => {
    let cancelled = false;
    getClientAccountStatus()
      .then(s => { if (!cancelled && s.linked && s.otherRole) setOtherRole(s.otherRole); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!otherRole) return null;

  return (
    <>
      {render({ label: ROLE_LABELS[otherRole] ?? otherRole, onClick: performSwitch, pending })}

      {twoFaChallengeToken && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(11,31,58,.55)', zIndex: 10001,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', padding: 28 }}>
            <TwoFaChallenge
              isLoading={pending}
              error={error}
              onVerify={verifyTwoFa}
              onCancel={cancelTwoFa}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
