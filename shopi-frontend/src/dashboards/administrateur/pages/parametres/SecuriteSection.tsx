/* ================================================================
 * FICHIER : pages/parametres/SecuriteSection.tsx
 *
 * Section Sécurité — données réelles via le backend :
 *   GET   /dashboard/super-admin/my-securite          → score + 2FA + session
 *   PATCH /dashboard/super-admin/my-securite/password → changer mot de passe
 *   PATCH /dashboard/super-admin/my-securite/2fa      → activer / désactiver 2FA
 *
 * FONCTIONNALITÉS :
 *   - Score de sécurité calculé depuis les vrais champs User/Admin
 *   - Changement de mot de passe avec validation bcrypt côté backend
 *   - 2FA TOTP (Google Authenticator / Authy) : activation retourne un
 *     URI otpauth:// affiché en lien cliquable + secret texte pour saisie manuelle
 *   - Infos de dernière connexion (IP + timestamp) depuis User.lastLoginAt/Ip
 *   - Clé API : UI informative seulement (non implémentée côté backend)
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import { apiFetch } from '../../../../shared/services/apiFetch';
import TwoFaSetupModal from '../../../../shared/components/TwoFaSetupModal';

/* ── Types retournés par GET /my-securite ── */
interface ScoreItem {
  label: string;
  ok:    boolean;
  key:   string;
}

interface SecuriteData {
  score:         number;
  scoreItems:    ScoreItem[];
  twoFaEnabled:  boolean;
  twoFaMethod:   string | null;
  lastLoginAt:   string | null;
  lastLoginIp:   string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

/* ── Formatte un timestamp ISO en texte lisible ── */
function fmtDate(iso: string | null): string {
  if (!iso) return 'Jamais';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── Couleur du score de sécurité ── */
function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return 'var(--amber)';
  return '#dc2626';
}

/* ── Badge CSS selon score ── */
function scoreBadgeCls(score: number, s: Record<string, string>): string {
  if (score >= 80) return s.bdgGreen;
  if (score >= 60) return s.bdgAmber;
  return s.bdgRed;
}

/* ═══════════════════════════════════════════════════════════════ */

export default function SecuriteSection({ onToast }: SectionProps) {

  /* ── État principal ── */
  const [data,    setData]    = useState<SecuriteData | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── Formulaire mot de passe ── */
  const [showPwd,   setShowPwd]   = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwd, setPwd] = useState({ old: '', new1: '', new2: '' });

  /* ── 2FA ── */
  const [saving2fa,    setSaving2fa]    = useState(false);
  const [show2fa,      setShow2fa]      = useState(false);

  /* ── Chargement des données de sécurité ── */
  useEffect(() => {
    apiFetch<SecuriteData>('/dashboard/super-admin/my-securite')
      .then(d => setData(d))
      .catch(() => onToast('Impossible de charger les données de sécurité', 'w'))
      .finally(() => setLoading(false));
  }, []);

  /* ──────────────────────────────────────────────────────────
   * Changement de mot de passe
   * ────────────────────────────────────────────────────────── */
  async function changePwd() {
    /* Validations front simples avant l'appel réseau */
    if (!pwd.old || !pwd.new1 || !pwd.new2) {
      onToast('Remplissez tous les champs', 'w'); return;
    }
    if (pwd.new1 !== pwd.new2) {
      onToast('Les nouveaux mots de passe ne correspondent pas', 'w'); return;
    }
    if (pwd.new1.length < 8) {
      onToast('Le mot de passe doit contenir au moins 8 caractères', 'w'); return;
    }

    setSavingPwd(true);
    try {
      await apiFetch('/dashboard/super-admin/my-securite/password', {
        method: 'PATCH',
        body: {
          currentPassword: pwd.old,
          newPassword:     pwd.new1,
          confirmPassword: pwd.new2,
        },
      });
      onToast('Mot de passe modifié avec succès', 's');
      setPwd({ old: '', new1: '', new2: '' });
      setShowPwd(false);
    } catch (err: any) {
      onToast(err.message ?? 'Erreur lors du changement de mot de passe', 'w');
    } finally {
      setSavingPwd(false);
    }
  }

  /* ──────────────────────────────────────────────────────────
   * Toggle 2FA
   *
   * Activation : passe désormais par POST /auth/2fa/setup + /confirm
   * (TwoFaService), qui exige un code TOTP valide avant d'activer
   * réellement — l'ancien chemin direct via ce PATCH est rejeté par
   * le backend pour twoFaEnabled:true. Seule la désactivation reste
   * gérée par cet endpoint.
   * ────────────────────────────────────────────────────────── */
  async function toggleTwoFa() {
    if (!data) return;

    if (!data.twoFaEnabled) {
      setShow2fa(true);
      return;
    }

    setSaving2fa(true);
    try {
      const res = await apiFetch<{ twoFaEnabled: boolean; message: string }>(
        '/dashboard/super-admin/my-securite/2fa',
        { method: 'PATCH', body: { twoFaEnabled: false } },
      );
      setData(prev => prev ? { ...prev, twoFaEnabled: res.twoFaEnabled, twoFaMethod: null } : prev);
      onToast(res.message, 'w');
    } catch (err: any) {
      onToast(err.message ?? 'Erreur lors de la modification 2FA', 'w');
    } finally {
      setSaving2fa(false);
    }
  }

  /* ── Skeleton de chargement ── */
  if (loading) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ textAlign: 'center', padding: '2rem', color: 'var(--adm-text-3)' }}>
            <i className="fas fa-spinner fa-spin" /> Chargement des données de sécurité…
          </div>
        </div>
      </div>
    );
  }

  /* Fallback si le profil n'a pas pu être chargé */
  const score      = data?.score      ?? 0;
  const scoreItems = data?.scoreItems ?? [];
  const color      = scoreColor(score);

  return (
    <div className={styles.secBody}>

      {/* ── Carte : Score de sécurité ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-shield-halved" /> Score de sécurité</div>
            <div className={styles.cardSub}>Évaluation dynamique de la protection de votre compte</div>
          </div>
          {/* Badge coloré selon la valeur du score */}
          <span className={`${styles.bdg} ${scoreBadgeCls(score, styles)}`}>
            {score >= 80 ? 'Bon' : score >= 60 ? 'Moyen' : 'Faible'}
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.secScoreWrap}>
            {/* Anneau conic-gradient — remplit proportionnellement au score */}
            <div className={styles.secRing}
              style={{ background: `conic-gradient(${color} ${score}%, var(--g100) 0%)` }}>
              <div className={styles.secRingIn}>
                <div className={styles.secRingV}>{score}</div>
                <div className={styles.secRingL}>/ 100</div>
              </div>
            </div>
            {/* Liste des critères avec leur état réel */}
            <div className={styles.secScoreList}>
              {scoreItems.map(it => (
                <div key={it.key} className={styles.secScoreItem}>
                  <i className={`fas ${it.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`}
                    style={{ color: it.ok ? 'var(--emerald)' : '#dc2626', fontSize: 14 }} />
                  <span>{it.label}</span>
                  <b style={{ color: it.ok ? 'var(--emerald)' : '#dc2626' }}>
                    {it.ok ? 'OK' : 'Manquant'}
                  </b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Carte : Mot de passe ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-lock" /> Mot de passe</div>
            {/* Affiche la date du dernier login comme approximation */}
            <div className={styles.cardSub}>
              Dernière connexion : {fmtDate(data?.lastLoginAt ?? null)}
            </div>
          </div>
          <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            onClick={() => setShowPwd(v => !v)}>
            <i className={`fas ${showPwd ? 'fa-chevron-up' : 'fa-pen'}`} />
            {showPwd ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        {/* Formulaire — visible seulement si l'utilisateur clique sur Modifier */}
        {showPwd && (
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.fld}>
                <label className={styles.fldL}>Mot de passe actuel</label>
                <input type="password" className={styles.fldIn} autoComplete="current-password"
                  value={pwd.old} onChange={e => setPwd(p => ({ ...p, old: e.target.value }))} />
              </div>
              <div />
              <div className={styles.fld}>
                <label className={styles.fldL}>Nouveau mot de passe</label>
                <input type="password" className={styles.fldIn} autoComplete="new-password"
                  value={pwd.new1} onChange={e => setPwd(p => ({ ...p, new1: e.target.value }))} />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Confirmer le nouveau</label>
                <input type="password" className={styles.fldIn} autoComplete="new-password"
                  value={pwd.new2} onChange={e => setPwd(p => ({ ...p, new2: e.target.value }))} />
              </div>
            </div>
            <span className={styles.fldHint}>Minimum 8 caractères.</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={changePwd} disabled={savingPwd}>
                {savingPwd
                  ? <><i className="fas fa-spinner fa-spin" /> En cours…</>
                  : <><i className="fas fa-check" /> Changer le mot de passe</>
                }
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Carte : Double authentification (2FA) ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-mobile-screen-button" /> Double authentification (2FA)</div>
            <div className={styles.cardSub}>
              {data?.twoFaEnabled
                ? `Activée via ${data.twoFaMethod === 'app' ? 'application TOTP' : data.twoFaMethod ?? 'app'}`
                : 'Couche de sécurité supplémentaire désactivée'}
            </div>
          </div>
          {/* Bascule (toggle) qui appelle l'API à chaque clic */}
          <div
            className={`${styles.sw} ${data?.twoFaEnabled ? styles.swOn : ''}`}
            style={saving2fa ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            onClick={() => !saving2fa && toggleTwoFa()}
          />
        </div>

        {/* Message d'aide si 2FA activée */}
        {data?.twoFaEnabled && (
          <div className={styles.cardBody}>
            <p style={{ fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6 }}>
              <i className="fas fa-circle-check" style={{ color: 'var(--emerald)', marginRight: 6 }} />
              La 2FA est active sur ce compte. Désactivez puis réactivez pour reconfigurer.
            </p>
          </div>
        )}
      </div>

      {show2fa && (
        <TwoFaSetupModal
          onClose={() => setShow2fa(false)}
          onEnabled={() => {
            setData(prev => prev ? { ...prev, twoFaEnabled: true, twoFaMethod: 'app' } : prev);
            onToast('2FA activée avec succès', 's');
          }}
        />
      )}

      {/* ── Carte : Dernière connexion ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-laptop" /> Session actuelle</div>
            <div className={styles.cardSub}>Informations de votre connexion en cours</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {/* Affiche les informations disponibles dans User.lastLoginAt / lastLoginIp */}
          <div className={styles.sessionItem}>
            <div className={styles.sessionIc}><i className="fas fa-laptop" /></div>
            <div className={styles.sessionInfo}>
              <div className={styles.sessionDevice}>Navigateur actuel</div>
              <div className={styles.sessionMeta}>
                {data?.lastLoginIp ? `IP : ${data.lastLoginIp} · ` : ''}
                Connecté le {fmtDate(data?.lastLoginAt ?? null)}
              </div>
            </div>
            <span className={styles.sessionCur}>Session actuelle</span>
          </div>
          <div className={styles.divider} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className={`${styles.btn} ${styles.btnRed} ${styles.btnSm}`}
              onClick={() => onToast('Déconnexion de toutes les autres sessions', 'w')}>
              <i className="fas fa-right-from-bracket" /> Déconnecter les autres sessions
            </button>
          </div>
        </div>
      </div>

      {/* ── Carte : Clé API (informatif) ── */}
      {/* Note : les clés API pour les admins ne sont pas encore
          implémentées côté backend — cette section est un placeholder UI. */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-key" /> Clé API</div>
            <div className={styles.cardSub}>Pour les intégrations avec des outils tiers (fonctionnalité à venir)</div>
          </div>
          <span className={`${styles.bdg} ${styles.bdgGray}`}>Bientôt disponible</span>
        </div>
        <div className={styles.cardBody}>
          <p style={{ fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6 }}>
            Les clés API administrateur seront disponibles dans une prochaine mise à jour.
            Elles permettront d&apos;accéder à l&apos;API Shopi depuis des outils tiers sécurisés.
          </p>
        </div>
      </div>

    </div>
  );
}
