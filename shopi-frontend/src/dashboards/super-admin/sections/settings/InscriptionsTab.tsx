/**
 * @file   InscriptionsTab.tsx
 * @module settings/tabs
 *
 * Onglet 3 — Inscriptions
 *
 * Contenu :
 *   1. Politique d'inscription  — signup libre clients, KYC, email
 *   2. Accès par invitation     — entreprise / livreur / partenaire :
 *                                 sur invitation (coché) ou inscription libre
 *   3. Validation vendeurs      — approbation manuelle, SLA SAV
 *   4. Modération automatique   — signalements avant suspension
 *   5. Grille des rôles         — mode d'accès actuel des 5 rôles
 */

import { SettingGroup, SettingRow, Toggle } from './components';
import type { PlatformSettings }           from './types';

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 */
interface Props {
  settings: PlatformSettings;
  set: <K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) => void;
}

/* ─────────────────────────────────────────────────────────────
 * DONNÉES : Rôles de la plateforme
 * ─────────────────────────────────────────────────────────────
 * mode() calcule le mode d'accès actuel du rôle selon les réglages :
 *   'libre'      — inscription sans code
 *   'invitation' — code / lien d'invitation obligatoire
 *   'ferme'      — inscription impossible (clients uniquement)
 */
type AccessMode = 'libre' | 'invitation' | 'ferme';

const ROLES_INFO: { icon: string; label: string; detail: string; mode: (s: PlatformSettings) => AccessMode }[] = [
  {
    icon:   '🛒',
    label:  'Clients',
    detail: 'Acheteurs',
    mode:   s => (s.openSignup ? 'libre' : 'ferme'),
  },
  {
    icon:   '🏪',
    label:  'Entreprises',
    detail: 'Vendeurs',
    mode:   s => (s.codeRequiredForCompany ? 'invitation' : 'libre'),
  },
  {
    icon:   '🛵',
    label:  'Livreurs',
    detail: 'Livraison',
    mode:   s => (s.codeRequiredForDelivery ? 'invitation' : 'libre'),
  },
  {
    icon:   '🤝',
    label:  'Partenaires',
    detail: 'Réseau',
    mode:   s => (s.codeRequiredForPartner ? 'invitation' : 'libre'),
  },
  {
    icon:   '📦',
    label:  'Correspondants',
    detail: 'Toujours rattachés à une entreprise ou un livreur',
    mode:   () => 'invitation',
  },
];

const MODE_LABEL: Record<AccessMode, { badge: string; desc: string; color: string; bg: string }> = {
  libre:      { badge: 'LIBRE',      desc: 'Inscription sans code',    color: 'var(--acid)',  bg: 'var(--acid-dim)' },
  invitation: { badge: 'INVITATION', desc: "Code d'invitation requis", color: 'var(--gold, #D97706)', bg: 'var(--gold-dim, rgba(245,158,11,.12))' },
  ferme:      { badge: 'FERMÉ',      desc: 'Inscriptions fermées',     color: 'var(--txt-3)', bg: 'transparent' },
};

/* Description d'une ligne "sur invitation" selon son état actuel */
function inviteDesc(required: boolean, who: string): string {
  return required
    ? `Coché : les ${who} ne peuvent s'inscrire qu'avec un code ou un lien d'invitation.`
    : `Décoché : inscription libre des ${who}, sans code. Le compte est rattaché à l'administrateur de sa zone et reste en attente de validation.`;
}

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function InscriptionsTab({ settings, set }: Props) {
  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : Politique d'inscription ── */}
      <SettingGroup icon="👤" iconBg="var(--acid-dim)" title="Politique d'inscription">

        {/* Inscription sans code — accessible à tous les visiteurs */}
        <SettingRow
          label="Inscription libre (Clients)"
          desc="Les clients peuvent créer un compte sans code d'invitation"
        >
          <Toggle
            checked={settings.openSignup}
            onChange={v => set('openSignup', v)}
          />
        </SettingRow>

        {/* KYC = vérification d'identité avant que le compte soit activé */}
        <SettingRow
          label="Validation KYC obligatoire"
          desc="Vérification d'identité avant l'activation du compte"
        >
          <Toggle
            checked={settings.kycRequired}
            onChange={v => set('kycRequired', v)}
          />
        </SettingRow>

        {/* Activé : chaque création de compte (tous rôles) doit confirmer un
         *  code envoyé par email avant d'avoir accès à son compte (voir
         *  AuthService.register() côté backend — envoie l'OTP et ne délivre
         *  aucun token tant qu'il n'est pas validé).
         *  Désactivé : accès immédiat dès l'étape mot de passe franchie, sans
         *  étape supplémentaire. Ce réglage pilotait déjà cette logique côté
         *  backend, seul le contrôle manquait ici — il ne vivait jusque-là
         *  que dans l'onglet Sécurité (retiré de là, voir SecurityTab.tsx,
         *  pour ne garder qu'un seul endroit où le modifier). */}
        <SettingRow
          label="Validation par email obligatoire"
          desc="Chaque création de compte doit confirmer un code reçu par email avant d'accéder à son compte"
        >
          <Toggle
            checked={settings.emailVerifRequired}
            onChange={v => set('emailVerifRequired', v)}
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 2 : Accès par invitation ── */}
      {/* Coché = inscription sur invitation uniquement (code ou lien) ;
       *  décoché = inscription libre depuis la page d'inscription publique.
       *  Lu par GET /public/registration-policy (page d'inscription) et
       *  appliqué côté serveur par AuthService.register(). */}
      <SettingGroup icon="✉️" iconBg="var(--blue-dim, rgba(37,99,235,.12))" title="Accès par invitation">

        <SettingRow
          label="Entreprises : sur invitation uniquement"
          desc={inviteDesc(settings.codeRequiredForCompany, 'entreprises')}
        >
          <Toggle
            checked={settings.codeRequiredForCompany}
            onChange={v => set('codeRequiredForCompany', v)}
          />
        </SettingRow>

        <SettingRow
          label="Livreurs : sur invitation uniquement"
          desc={inviteDesc(settings.codeRequiredForDelivery, 'livreurs')}
        >
          <Toggle
            checked={settings.codeRequiredForDelivery}
            onChange={v => set('codeRequiredForDelivery', v)}
          />
        </SettingRow>

        <SettingRow
          label="Partenaires : sur invitation uniquement"
          desc={inviteDesc(settings.codeRequiredForPartner, 'partenaires')}
        >
          <Toggle
            checked={settings.codeRequiredForPartner}
            onChange={v => set('codeRequiredForPartner', v)}
          />
        </SettingRow>

        <SettingRow
          label="Correspondants"
          desc="Toujours sur invitation : un correspondant représente une entreprise ou un livreur précis."
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)' }}>🔒 Fixe</span>
        </SettingRow>

        <SettingRow
          label="Bon à savoir"
          desc="Une invitation reste toujours utilisable, même en inscription libre : son code rattache le compte au partenaire, à l'entreprise ou à l'administrateur qui l'a envoyée. Les comptes inscrits librement attendent la validation d'un administrateur."
        >
          <span />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 3 : Validation vendeurs ── */}
      <SettingGroup icon="🏪" iconBg="var(--gold-dim)" title="Validation vendeurs">

        {/* Si activé, un admin doit manuellement approuver chaque nouveau vendeur */}
        <SettingRow
          label="Approbation manuelle des vendeurs"
          desc="Un admin valide chaque nouveau compte entreprise avant activation"
        >
          <Toggle
            checked={settings.manualVendorApproval}
            onChange={v => set('manualVendorApproval', v)}
          />
        </SettingRow>

        {/* SLA = Service Level Agreement — délai de réponse maximal du SAV */}
        <SettingRow
          label="Délai SLA SAV (heures)"
          desc="Temps maximum de réponse au service après-vente (1–168h)"
        >
          <input
            className="input-field"
            type="number"
            value={settings.savResponseSlaHours}
            min={1}
            max={168}
            onChange={e => set('savResponseSlaHours', parseInt(e.target.value) || 24)}
            style={{ width: 80 }}
          />
        </SettingRow>

      </SettingGroup>

      {/* ── GROUPE 4 : Modération automatique ── */}
      <SettingGroup icon="⚖️" iconBg="var(--rose-dim)" title="Modération automatique">

        {/* Après N signalements, le compte est suspendu automatiquement */}
        <SettingRow
          label="Signalements avant suspension"
          desc="Nombre de signalements déclenchant une suspension automatique du compte (1–100)"
        >
          <input
            className="input-field"
            type="number"
            value={settings.reportsBeforeSuspend}
            min={1}
            max={100}
            onChange={e => set('reportsBeforeSuspend', parseInt(e.target.value) || 5)}
            style={{ width: 80 }}
          />
        </SettingRow>

        {/* Récapitulatif en lecture seule pour voir la politique d'un coup d'œil */}
        <SettingRow label="Récapitulatif politique" desc="Règles actuellement en vigueur">
          <div style={{ fontSize: 11, color: 'var(--txt-3)', textAlign: 'right', lineHeight: 1.9 }}>
            {settings.kycRequired ? '✅ KYC requis' : '⬜ KYC optionnel'}<br />
            {settings.codeRequiredForDelivery ? '✉️ Livreurs sur invitation' : '🔓 Livreurs en inscription libre'}<br />
            {settings.codeRequiredForPartner ? '✉️ Partenaires sur invitation' : '🔓 Partenaires en inscription libre'}<br />
            {settings.emailVerifRequired ? '✅ Email requis' : '⬜ Email non requis'}<br />
            {settings.manualVendorApproval ? '✅ Approbation manuelle' : '⬜ Auto-activation vendeurs'}<br />
            Suspension après{' '}
            <strong style={{ color: 'var(--txt-1)' }}>
              {settings.reportsBeforeSuspend} signalement{settings.reportsBeforeSuspend > 1 ? 's' : ''}
            </strong>
          </div>
        </SettingRow>

      </SettingGroup>

      {/* ── GRILLE DES RÔLES ACTIFS ── */}
      {/* Aperçu visuel des 5 rôles de la plateforme et de leur mode d'accès */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'var(--acid-dim)',
        border: '1px solid rgba(0,200,138,.2)',
        borderRadius: 14,
        padding: '16px 20px',
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--acid)' }}>
          ✅ Mode d'inscription par rôle
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ROLES_INFO.map(role => {
            const mode   = role.mode(settings);
            const m      = MODE_LABEL[mode];
            const isOpen = mode !== 'ferme';
            return (
              <div
                key={role.label}
                style={{
                  flex: '1 1 160px',
                  background: isOpen ? 'rgba(0,200,138,.08)' : 'var(--raised)',
                  border: `1px solid ${isOpen ? 'rgba(0,200,138,.2)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 20 }}>{role.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt-1)' }}>{role.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 2 }}>{role.detail} — {m.desc}</div>
                </div>
                {/* Badge : LIBRE / INVITATION / FERMÉ */}
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: m.bg,
                  color: m.color,
                }}>
                  {m.badge}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
