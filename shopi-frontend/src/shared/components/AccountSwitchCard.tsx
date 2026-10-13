/* ================================================================
 * FICHIER : src/shared/components/AccountSwitchCard.tsx
 *
 * RÔLE : carte « compte » avec bascule pro ↔ client, identique à celle de
 * l'application mobile (shopi-mobile/src/features/account-switch) :
 *
 *   [avatar]  Nom du compte            (⟲ mini-avatar)  (⌄ 9+)
 *             Espace entreprise
 *
 *   · les flèches (⟲) autour du mini-avatar de l'autre compte = basculer
 *     tout de suite sur le compte lié ; sans compte lié (compte pro), elles
 *     portent un « + » et ouvrent MonEspaceClientModal (créer / lier
 *     l'espace client) ;
 *   · le chevron (⌄) ouvre « Vos comptes » : compte actuel, compte lié ou
 *     proposition, notifications non lues (badge rouge) ;
 *   · un compte sans lien et sans rôle pro ne voit pas les flèches.
 *
 * Montée en haut de la barre latérale (ordinateur) et du menu ☰ (téléphone)
 * de chaque espace pro. Dans une barre réduite à des icônes (rail de 68px),
 * une requête de conteneur ne garde que l'avatar et les flèches.
 *
 * Toute la logique de bascule (2FA, appel en cours, sockets, rechargement)
 * reste dans useAccountSwitch() ; la création / liaison dans
 * MonEspaceClientModal.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getClientAccountStatus, type ClientAccountStatus } from '../services/accountLink';
import { getRoleFromToken } from '../services/authUtils';
import { useAccountSwitch } from '../hooks/useAccountSwitch';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { useOptionalNotifications } from '../notifications/NotificationContext';
import { TwoFaChallenge } from '../../modules/auth/pages/TwoFaChallenge';
import MonEspaceClientModal from './MonEspaceClientModal';
import './AccountSwitchCard.css';

/** Rôles professionnels pouvant posséder un compte client lié (PRO_ROLES du serveur). */
const PRO_ROLES = ['company', 'delivery', 'correspondent', 'partner', 'admin'];

/** Libellé court d'un espace — mêmes textes que l'application mobile. */
const SPACE_LABEL: Record<string, string> = {
  client:        'Espace client',
  company:       'Espace entreprise',
  delivery:      'Espace livreur',
  correspondent: 'Espace point relais',
  partner:       'Espace partenaire',
  admin:         'Espace administrateur',
};

/** Icône représentant un espace (mini-avatar du compte lié). */
const SPACE_ICON: Record<string, string> = {
  client:        'fa-cart-shopping',
  company:       'fa-store',
  delivery:      'fa-motorcycle',
  correspondent: 'fa-location-dot',
  partner:       'fa-briefcase',
  admin:         'fa-shield-halved',
};

/* Statut du lien partagé entre les cartes montées en même temps (barre
 * latérale + menu ☰) : une seule requête, rafraîchie après 5 minutes. */
const STATUS_TTL = 5 * 60_000;
let statusCache: { at: number; p: Promise<ClientAccountStatus | null> } | null = null;
function loadStatus(): Promise<ClientAccountStatus | null> {
  if (!statusCache || Date.now() - statusCache.at > STATUS_TTL) {
    statusCache = { at: Date.now(), p: getClientAccountStatus().catch(() => { statusCache = null; return null; }) };
  }
  return statusCache.p;
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

interface Props {
  /** Nom affiché (boutique, livreur, partenaire…). */
  name:       string;
  /** Photo / logo du compte actuel (sinon initiales). */
  avatarUrl?: string | null;
  /** Remplace le libellé « Espace … » déduit du rôle. */
  spaceLabel?: string;
  /** Clic sur l'avatar / le nom (ex. ouvrir le profil). */
  onOpenProfile?: () => void;
  /** 'auto' suit le thème du site ; 'onDark' pour une barre latérale sombre. */
  tone?: 'auto' | 'onDark';
  /** Nom en cours de chargement : squelette au lieu d'un texte de remplacement. */
  loading?: boolean;
  className?: string;
}

export default function AccountSwitchCard({
  name, avatarUrl, spaceLabel, onOpenProfile, tone = 'auto', loading = false, className,
}: Props) {
  const role  = getRoleFromToken() ?? 'client';
  const isPro = PRO_ROLES.includes(role);
  const notif = useOptionalNotifications();
  const sw    = useAccountSwitch();

  const [status, setStatus]   = useState<ClientAccountStatus | null>(null);
  const [sheet, setSheet]     = useState<'accounts' | 'setup' | null>(null);
  /* Photo qui ne se charge pas → initiales (une nouvelle URL retente). */
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStatus().then(s => { if (!cancelled) setStatus(s); });
    return () => { cancelled = true; };
  }, []);

  const linked     = !!status?.linked;
  const otherRole  = linked ? (status?.otherRole ?? (isPro ? 'client' : 'company')) : 'client';
  /* Flèches visibles : compte lié, ou compte pro (proposition de créer l'espace client). */
  const showSwitch = linked || (isPro && !!status);
  const label      = spaceLabel ?? SPACE_LABEL[role] ?? role;
  const unread     = notif?.unreadCount ?? 0;
  const otherLabel = SPACE_LABEL[otherRole] ?? 'autre compte';

  function doSwitch() {
    if (!linked) { setSheet('setup'); return; }
    void sw.performSwitch();
  }

  const avatar = (cls: string) => (
    <span className={cls}>
      {avatarUrl && brokenSrc !== avatarUrl
        ? <img src={avatarUrl} alt="" onError={() => setBrokenSrc(avatarUrl)} />
        : initialsOf(name)}
    </span>
  );

  return (
    <>
      <div className={`asc-wrap${className ? ` ${className}` : ''}`}>
        <div className={`asc asc-theme${tone === 'onDark' ? ' asc--ondark' : ''}`}>
          <button type="button" className="asc-who" onClick={onOpenProfile} disabled={!onOpenProfile}
            aria-label={`${name}, ${label}`} title={name}>
            {loading ? <span className="asc-ava asc-skel" aria-hidden="true" /> : avatar('asc-ava')}
            <span className="asc-txt">
              {loading
                ? <span className="asc-skel asc-skel-nm" aria-hidden="true" />
                : <span className="asc-nm">{name}</span>}
              <span className="asc-space">{label}</span>
            </span>
          </button>

          {showSwitch && (
            <button type="button" className="asc-switch" onClick={doSwitch} disabled={sw.pending}
              aria-label={linked ? `Basculer vers l’${otherLabel.toLowerCase()}` : 'Créer mon espace client'}
              title={linked ? `Basculer vers l’${otherLabel.toLowerCase()}` : 'Créer mon espace client'}>
              <i className="fas fa-arrows-rotate asc-arrows" aria-hidden="true" />
              <span className={`asc-mini${linked ? '' : ' asc-mini--ghost'}`}>
                <i className={`fas ${linked ? (SPACE_ICON[otherRole] ?? 'fa-user') : 'fa-plus'}`} aria-hidden="true" />
              </span>
            </button>
          )}

          <button type="button" className="asc-chev" onClick={() => setSheet('accounts')}
            aria-label={unread ? `Vos comptes, ${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Vos comptes'}
            title="Vos comptes">
            <i className="fas fa-chevron-down" aria-hidden="true" />
            {unread > 0 && <span className="asc-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </div>
      </div>

      {sheet === 'accounts' && (
        <AccountsSheet
          name={name}
          avatar={avatar('asc-acc-av')}
          label={label}
          isPro={isPro}
          status={status}
          otherRole={otherRole}
          unread={unread}
          pending={sw.pending}
          error={sw.error}
          onClose={() => setSheet(null)}
          onSwitch={() => { setSheet(null); doSwitch(); }}
          onSetup={() => setSheet('setup')}
          onNotifications={notif ? () => { setSheet(null); if (!notif.isOpen) notif.toggle(); } : undefined}
        />
      )}

      {sheet === 'setup' && (
        <MonEspaceClientModal onClose={() => { setSheet(null); statusCache = null; }} />
      )}

      {sw.twoFaChallengeToken && createPortal(
        <div className="asc-overlay asc-overlay--center" onClick={e => e.stopPropagation()}>
          <div className="asc-twofa">
            <TwoFaChallenge isLoading={sw.pending} error={sw.error} onVerify={sw.verifyTwoFa} onCancel={sw.cancelTwoFa} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── « Vos comptes » (chevron) ─────────────────────────────────── */

function AccountsSheet({
  name, avatar, label, isPro, status, otherRole, unread, pending, error,
  onClose, onSwitch, onSetup, onNotifications,
}: {
  name: string; avatar: React.ReactNode; label: string; isPro: boolean;
  status: ClientAccountStatus | null; otherRole: string; unread: number;
  pending: boolean; error: string;
  onClose: () => void; onSwitch: () => void; onSetup: () => void; onNotifications?: () => void;
}) {
  const linked = !!status?.linked;
  useBackDismiss(true, onClose);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  /* stopPropagation : le portail reste un enfant React de la carte — sans
   * cela, un clic remonterait jusqu'au fond du menu ☰ et le fermerait. */
  return createPortal(
    <div className="asc-overlay" onClick={e => { e.stopPropagation(); onClose(); }}>
      <div className="asc-sheet asc-theme" role="dialog" aria-modal="true" aria-label="Vos comptes"
        onClick={e => e.stopPropagation()}>
        <div className="asc-sheet-hd">
          <span className="asc-sheet-grab" aria-hidden="true" />
          <h2>Vos comptes</h2>
          <button type="button" className="asc-sheet-x" onClick={onClose} aria-label="Fermer">
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Compte actuel */}
        <div className="asc-acc asc-acc--on">
          {avatar}
          <span className="asc-acc-txt">
            <span className="asc-acc-nm">{name}</span>
            <span className="asc-acc-sub">{label} · connecté</span>
          </span>
          <i className="fas fa-circle-check asc-acc-check" aria-hidden="true" />
        </div>

        {/* Compte lié — ou proposition */}
        {linked ? (
          <button type="button" className="asc-acc asc-acc--btn" onClick={onSwitch} disabled={pending}>
            <span className="asc-acc-av asc-acc-av--space"><i className={`fas ${SPACE_ICON[otherRole] ?? 'fa-user'}`} /></span>
            <span className="asc-acc-txt">
              <span className="asc-acc-nm">{SPACE_LABEL[otherRole] ?? otherRole}</span>
              <span className="asc-acc-sub">Compte lié · même identité</span>
            </span>
            <span className="asc-go">
              <i className={`fas ${pending ? 'fa-circle-notch fa-spin' : 'fa-arrows-rotate'}`} /> Basculer
            </span>
          </button>
        ) : isPro && status ? (
          <button type="button" className="asc-acc asc-acc--btn asc-acc--dashed" onClick={onSetup}>
            <span className="asc-acc-av asc-acc-av--add"><i className="fas fa-plus" /></span>
            <span className="asc-acc-txt">
              <span className="asc-acc-nm">{status.existingClientFound ? 'Lier mon compte client' : 'Créer mon espace client'}</span>
              <span className="asc-acc-sub">
                {status.existingClientFound ? 'Un compte client utilise déjà vos coordonnées' : 'Acheter sur Shoneya sans quitter votre compte'}
              </span>
            </span>
            <i className="fas fa-chevron-right asc-row-chev" aria-hidden="true" />
          </button>
        ) : null}

        {error && <p className="asc-err">{error}</p>}

        {onNotifications && (
          <button type="button" className="asc-row" onClick={onNotifications}>
            <span className="asc-row-ic"><i className="fas fa-bell" /></span>
            <span className="asc-row-t">Notifications</span>
            {unread > 0
              ? <span className="asc-count">{unread > 99 ? '99+' : unread}</span>
              : <span className="asc-acc-sub">À jour</span>}
            <i className="fas fa-chevron-right asc-row-chev" aria-hidden="true" />
          </button>
        )}

        {(linked || isPro) && (
          <div className="asc-note">
            <i className="fas fa-circle-info" aria-hidden="true" />
            <span>Deux comptes distincts : commandes, portefeuille et mot de passe restent séparés. Cliquez sur les flèches pour passer de l’un à l’autre.</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
