/* ================================================================
 * FICHIER : src/shared/components/ClientSpaceGate.tsx
 *
 * RÔLE : écran affiché à un compte PRO (entreprise, livreur, point relais,
 * partenaire, administrateur…) qui arrive sur une page de l'espace client
 * (boutique, produit, explorer, panier, mon profil…) par un lien, une
 * notification ou une URL tapée à la main.
 *
 * Le seul passage prévu entre l'espace pro et l'espace client est la
 * bascule (AccountSwitchCard / useAccountSwitch) : on ne montre donc PAS
 * la page client sous l'identité pro. On propose à la place :
 *   · « Basculer vers mon espace client » (compte lié) ou « Créer mon
 *     espace client » (MonEspaceClientModal) ;
 *   · « Retour à mon espace » (dashboard du rôle connecté).
 * Garde utilisée par ClientSpaceRoute (app/router.tsx).
 * ================================================================ */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getClientAccountStatus, type ClientAccountStatus } from '../services/accountLink';
import { getDashboardPath } from '../services/authUtils';
import { useAccountSwitch } from '../hooks/useAccountSwitch';
import { TwoFaChallenge } from '../../modules/auth/pages/TwoFaChallenge';
import MonEspaceClientModal from './MonEspaceClientModal';
import './AccountSwitchCard.css';
import './ClientSpaceGate.css';

/** Rôles pouvant posséder un compte client lié (PRO_ROLES du serveur). */
const PRO_ROLES = ['company', 'delivery', 'correspondent', 'partner', 'admin'];

export default function ClientSpaceGate({ role }: { role: string }) {
  const navigate = useNavigate();
  const sw = useAccountSwitch();
  const canLink = PRO_ROLES.includes(role);
  const [status, setStatus] = useState<ClientAccountStatus | null>(null);
  const [setup, setSetup]   = useState(false);

  useEffect(() => {
    if (!canLink) return;
    let cancelled = false;
    getClientAccountStatus().then(s => { if (!cancelled) setStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [canLink]);

  const linked = !!status?.linked;

  return (
    <div className="csg asc-theme">
      <div className="csg-card">
        <span className="csg-ic"><i className="fas fa-arrows-rotate" aria-hidden="true" /></span>
        <h1 className="csg-title">Cette page fait partie de l’espace client</h1>
        <p className="csg-text">
          Vous êtes connecté à votre espace professionnel. Pour acheter, parcourir les boutiques
          ou gérer votre profil client, basculez vers votre espace client.
        </p>

        {canLink && status && (
          <button type="button" className="csg-btn csg-btn--primary" disabled={sw.pending}
            onClick={() => (linked ? void sw.performSwitch() : setSetup(true))}>
            <i className={`fas ${sw.pending ? 'fa-circle-notch fa-spin' : linked ? 'fa-arrows-rotate' : 'fa-plus'}`} aria-hidden="true" />
            {linked ? 'Basculer vers mon espace client' : 'Créer mon espace client'}
          </button>
        )}
        <button type="button" className="csg-btn" onClick={() => navigate(getDashboardPath(role), { replace: true })}>
          <i className="fas fa-arrow-left" aria-hidden="true" /> Retour à mon espace
        </button>

        {sw.error && <p className="csg-err">{sw.error}</p>}
      </div>

      {setup && <MonEspaceClientModal onClose={() => setSetup(false)} />}

      {sw.twoFaChallengeToken && createPortal(
        <div className="asc-overlay asc-overlay--center">
          <div className="asc-twofa">
            <TwoFaChallenge isLoading={sw.pending} error={sw.error} onVerify={sw.verifyTwoFa} onCancel={sw.cancelTwoFa} />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
