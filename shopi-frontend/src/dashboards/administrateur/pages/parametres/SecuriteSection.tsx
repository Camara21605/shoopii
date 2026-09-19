/* ================================================================
 * FICHIER : pages/parametres/SecuriteSection.tsx
 *
 * Section Sécurité de l'administrateur — données réelles du backend :
 *   GET   /dashboard/super-admin/my-securite          → score, 2FA, session
 *   PATCH /dashboard/super-admin/my-securite/password → changer le mot de passe
 *   PATCH /dashboard/super-admin/my-securite/2fa      → désactiver la 2FA
 *   (activation 2FA : POST /auth/2fa/setup + /confirm via TwoFaSetupModal)
 *
 * - Score calculé depuis les vrais champs du compte, avec un conseil pour
 *   chaque critère manquant.
 * - Changement de mot de passe : règles vérifiées en direct (8+ caractères,
 *   majuscule, minuscule, chiffre). Le serveur révoque les sessions : on
 *   reconnecte l'administrateur juste après.
 * - Session actuelle : vrai appareil / navigateur / IP (lus côté serveur).
 * - Le badge « Sécurité » du menu se met à jour via l'événement
 *   'admin-security-updated'.
 *
 * Retiré : la carte « Clé API » (fonctionnalité qui n'a jamais existé côté
 * backend) et « Déconnecter les autres sessions » (Shoneya n'autorise
 * qu'UNE session active par compte).
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import { apiFetch } from '../../../../shared/services/apiFetch';
import { useAppContext } from '../../../../shared/context/AppContext';
import TwoFaSetupModal from '../../../../shared/components/TwoFaSetupModal';
import DisableTwoFaModal from '../../../../shared/components/DisableTwoFaModal';

interface ScoreItem { key: string; label: string; ok: boolean; hint: string }

interface SecuriteData {
  score:             number;
  level:             'faible' | 'moyen' | 'bon';
  pending:           number;
  scoreItems:        ScoreItem[];
  twoFaEnabled:      boolean;
  twoFaMethod:       string | null;
  lastLoginAt:       string | null;
  lastLoginIp:       string | null;
  passwordChangedAt: string | null;
  currentSession:    { device: string; browser: string; ipAddress: string | null; connectedSince: string } | null;
}

const fmtDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Jamais';

/* ::1 / 127.0.0.1 = navigateur sur la machine du serveur (développement) */
function fmtIp(ip: string | null): string | null {
  if (!ip) return null;
  const clean = ip.replace(/^::ffff:/, '');
  return clean === '::1' || clean === '127.0.0.1' ? 'Connexion locale' : clean;
}

const scoreColor = (score: number) => score >= 80 ? '#16a34a' : score >= 60 ? 'var(--amber)' : '#dc2626';

/* Règles du nouveau mot de passe — miroir de ChangeMyPasswordDto côté serveur */
const RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'len',   label: '8 caractères minimum',   test: p => p.length >= 8 },
  { id: 'lower', label: 'Une minuscule',           test: p => /[a-z]/.test(p) },
  { id: 'upper', label: 'Une majuscule',           test: p => /[A-Z]/.test(p) },
  { id: 'digit', label: 'Un chiffre',              test: p => /\d/.test(p) },
];

function strength(p: string): { pct: number; label: string; color: string } {
  if (!p) return { pct: 0, label: '', color: 'var(--g200)' };
  const met = RULES.filter(r => r.test(p)).length + (p.length >= 12 ? 1 : 0) + (/[^A-Za-z0-9]/.test(p) ? 1 : 0);
  if (met <= 2) return { pct: 33,  label: 'Faible', color: '#dc2626' };
  if (met <= 4) return { pct: 66,  label: 'Moyen',  color: 'var(--amber)' };
  return            { pct: 100, label: 'Fort',   color: '#16a34a' };
}

export default function SecuriteSection({ onToast }: SectionProps) {
  const { logout } = useAppContext();
  const navigate   = useNavigate();

  const [data,    setData]    = useState<SecuriteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);

  /* ── Mot de passe ── */
  const [showPwd,   setShowPwd]   = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [reveal,    setReveal]    = useState(false);
  const [done,      setDone]      = useState(false);
  const [pwd,       setPwd]       = useState({ old: '', new1: '', new2: '' });
  const [pwdError,  setPwdError]  = useState<string | null>(null);

  /* ── 2FA ── */
  const [show2fa,        setShow2fa]        = useState(false);
  const [showDisable2fa, setShowDisable2fa] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    apiFetch<SecuriteData>('/dashboard/super-admin/my-securite')
      .then(setData)
      .catch(() => { setFailed(true); onToast('Impossible de charger les données de sécurité', 'w'); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Badge « Sécurité » du menu : nombre de critères manquants */
  useEffect(() => {
    if (data) window.dispatchEvent(new CustomEvent('admin-security-updated', { detail: data.pending }));
  }, [data?.pending]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Changement de mot de passe ── */
  const rulesOk   = RULES.every(r => r.test(pwd.new1));
  const mismatch  = pwd.new2.length > 0 && pwd.new1 !== pwd.new2;
  const sameAsOld = pwd.new1.length > 0 && pwd.new1 === pwd.old;
  const canSubmit = !!pwd.old && rulesOk && pwd.new1 === pwd.new2 && !sameAsOld && !savingPwd && !done;
  const st        = strength(pwd.new1);

  const closePwd = () => { setShowPwd(false); setPwd({ old: '', new1: '', new2: '' }); setPwdError(null); setReveal(false); };

  async function changePwd() {
    if (!canSubmit) return;
    setSavingPwd(true);
    setPwdError(null);
    try {
      await apiFetch('/dashboard/super-admin/my-securite/password', {
        method: 'PATCH',
        body: { currentPassword: pwd.old, newPassword: pwd.new1, confirmPassword: pwd.new2 },
      });
      setDone(true);
      onToast('Mot de passe modifié — reconnexion…', 's');
      /* Le serveur a révoqué les sessions : on reconnecte proprement */
      setTimeout(() => { logout(); navigate('/login'); }, 1800);
    } catch (err: any) {
      setPwdError(err?.message ?? 'Erreur lors du changement de mot de passe.');
    } finally {
      setSavingPwd(false);
    }
  }

  /* ── 2FA ── */
  function toggleTwoFa() {
    if (!data) return;
    if (data.twoFaEnabled) setShowDisable2fa(true);   /* mot de passe + code TOTP requis */
    else                   setShow2fa(true);
  }

  async function confirmDisable2fa(currentPassword: string, code: string) {
    const res = await apiFetch<{ twoFaEnabled: boolean; message: string }>(
      '/dashboard/super-admin/my-securite/2fa',
      { method: 'PATCH', body: { twoFaEnabled: false, currentPassword, code } },
    );
    onToast(res.message, 'w');
    load();   /* score et badge recalculés côté serveur */
  }

  /* ── États de chargement / erreur ── */
  if (loading && !data) {
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
  if (failed || !data) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ textAlign: 'center', padding: '2rem' }}>
            <i className="fas fa-triangle-exclamation" style={{ color: '#dc2626', marginRight: 8 }} />
            Impossible de charger les données de sécurité.
            <div style={{ marginTop: 12 }}>
              <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={load}>
                <i className="fas fa-rotate" /> Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const color   = scoreColor(data.score);
  const badge   = data.level === 'bon' ? styles.bdgGreen : data.level === 'moyen' ? styles.bdgAmber : styles.bdgRed;
  const missing = data.scoreItems.filter(i => !i.ok);
  const session = data.currentSession;
  const ip      = fmtIp(session?.ipAddress ?? data.lastLoginIp);

  return (
    <div className={styles.secBody}>

      {/* ── Score de sécurité ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-shield-halved" /> Score de sécurité</div>
            <div className={styles.cardSub}>Évaluation dynamique de la protection de votre compte</div>
          </div>
          <span className={`${styles.bdg} ${badge}`}>
            {data.level === 'bon' ? 'Bon' : data.level === 'moyen' ? 'Moyen' : 'Faible'}
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.secScoreWrap}>
            <div className={styles.secRing} style={{ background: `conic-gradient(${color} ${data.score}%, var(--g100) 0%)` }}>
              <div className={styles.secRingIn}>
                <div className={styles.secRingV}>{data.score}</div>
                <div className={styles.secRingL}>/ 100</div>
              </div>
            </div>
            <div className={styles.secScoreList}>
              {data.scoreItems.map(it => (
                <div key={it.key} className={styles.secScoreItem}>
                  <i className={`fas ${it.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`}
                    style={{ color: it.ok ? 'var(--emerald)' : '#dc2626', fontSize: 14 }} />
                  <span>{it.label}</span>
                  <b style={{ color: it.ok ? 'var(--emerald)' : '#dc2626' }}>{it.ok ? 'OK' : 'Manquant'}</b>
                </div>
              ))}
            </div>
          </div>
          {missing.length > 0 && (
            <ul style={{ margin: '14px 0 0', padding: '12px 16px 12px 32px', background: 'var(--g50)', borderRadius: 10, fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7 }}>
              {missing.map(m => <li key={m.key}><b>{m.label} :</b> {m.hint}</li>)}
            </ul>
          )}
        </div>
      </div>

      {/* ── Mot de passe ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-lock" /> Mot de passe</div>
            <div className={styles.cardSub}>
              {data.passwordChangedAt ? `Dernière modification : ${fmtDate(data.passwordChangedAt)}` : 'Jamais modifié depuis la création du compte'}
            </div>
          </div>
          <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            onClick={() => (showPwd ? closePwd() : setShowPwd(true))} disabled={done}>
            <i className={`fas ${showPwd ? 'fa-chevron-up' : 'fa-pen'}`} />
            {showPwd ? 'Annuler' : 'Modifier'}
          </button>
        </div>

        {showPwd && (
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.fld}>
                <label className={styles.fldL}>Mot de passe actuel</label>
                <input type={reveal ? 'text' : 'password'} className={styles.fldIn} autoComplete="current-password"
                  maxLength={128} value={pwd.old} onChange={e => { setPwd(p => ({ ...p, old: e.target.value })); setPwdError(null); }} />
              </div>
              <div className={styles.fld} style={{ justifyContent: 'flex-end' }}>
                <label style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer', paddingBottom: 10 }}>
                  <input type="checkbox" checked={reveal} onChange={e => setReveal(e.target.checked)} /> Afficher les mots de passe
                </label>
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Nouveau mot de passe</label>
                <input type={reveal ? 'text' : 'password'} className={styles.fldIn} autoComplete="new-password"
                  maxLength={72} value={pwd.new1} onChange={e => { setPwd(p => ({ ...p, new1: e.target.value })); setPwdError(null); }} />
                {sameAsOld && <span className={styles.fldHint} style={{ color: '#dc2626' }}>Doit être différent du mot de passe actuel.</span>}
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Confirmer le nouveau</label>
                <input type={reveal ? 'text' : 'password'} className={styles.fldIn} autoComplete="new-password"
                  maxLength={72} value={pwd.new2} onChange={e => { setPwd(p => ({ ...p, new2: e.target.value })); setPwdError(null); }} />
                {mismatch && <span className={styles.fldHint} style={{ color: '#dc2626' }}>Les deux mots de passe ne correspondent pas.</span>}
              </div>
            </div>

            {/* Jauge + règles vérifiées en direct */}
            {pwd.new1 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 6, borderRadius: 99, background: 'var(--g100)', overflow: 'hidden' }}>
                  <div style={{ width: `${st.pct}%`, height: '100%', background: st.color, transition: 'width .2s' }} />
                </div>
                <div style={{ fontSize: 11.5, color: st.color, fontWeight: 700, marginTop: 4 }}>{st.label}</div>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', marginTop: 8 }}>
              {RULES.map(r => {
                const ok = r.test(pwd.new1);
                return (
                  <span key={r.id} style={{ fontSize: 12, color: ok ? 'var(--emerald)' : 'var(--t3)' }}>
                    <i className={`fas ${ok ? 'fa-circle-check' : 'fa-circle'}`} style={{ fontSize: 10, marginRight: 5 }} />{r.label}
                  </span>
                );
              })}
            </div>

            <p style={{ fontSize: 12, color: 'var(--t3)', margin: '12px 0 0', lineHeight: 1.55 }}>
              <i className="fas fa-circle-info" style={{ marginRight: 5 }} />
              Après le changement, toutes vos sessions sont fermées : vous serez reconnecté(e) avec le nouveau mot de passe
              et un e-mail de confirmation vous sera envoyé.
            </p>

            {pwdError && (
              <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: '#dc2626', display: 'flex', gap: 7 }}>
                <i className="fas fa-triangle-exclamation" style={{ marginTop: 2 }} /> <span>{pwdError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={changePwd} disabled={!canSubmit}>
                {savingPwd
                  ? <><i className="fas fa-spinner fa-spin" /> En cours…</>
                  : done
                    ? <><i className="fas fa-check" /> Modifié</>
                    : <><i className="fas fa-check" /> Changer le mot de passe</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Double authentification ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-mobile-screen-button" /> Double authentification (2FA)</div>
            <div className={styles.cardSub}>
              {data.twoFaEnabled
                ? `Activée via ${data.twoFaMethod === 'app' || !data.twoFaMethod ? 'application d\'authentification (TOTP)' : data.twoFaMethod}`
                : 'Couche de sécurité supplémentaire désactivée'}
            </div>
          </div>
          <button type="button" role="switch" aria-checked={data.twoFaEnabled}
            aria-label={data.twoFaEnabled ? 'Désactiver la 2FA' : 'Activer la 2FA'}
            className={`${styles.sw} ${data.twoFaEnabled ? styles.swOn : ''}`}
            onClick={toggleTwoFa} />
        </div>
        <div className={styles.cardBody}>
          <p style={{ fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6, margin: 0 }}>
            {data.twoFaEnabled
              ? <><i className="fas fa-circle-check" style={{ color: 'var(--emerald)', marginRight: 6 }} />
                  La 2FA protège ce compte. Pour la désactiver, votre mot de passe et un code de l&apos;application seront demandés.</>
              : <>Un code temporaire de votre application (Google Authenticator, Authy…) sera demandé à chaque connexion.
                  Recommandé pour un compte administrateur.</>}
          </p>
        </div>
      </div>

      {show2fa && (
        <TwoFaSetupModal
          onClose={() => setShow2fa(false)}
          onEnabled={() => { onToast('2FA activée avec succès', 's'); load(); }}
        />
      )}
      {showDisable2fa && (
        <DisableTwoFaModal onClose={() => setShowDisable2fa(false)} onConfirm={confirmDisable2fa} />
      )}

      {/* ── Session actuelle ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-laptop" /> Session actuelle</div>
            <div className={styles.cardSub}>Informations de votre connexion en cours</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.sessionItem}>
            <div className={styles.sessionIc}><i className="fas fa-laptop" /></div>
            <div className={styles.sessionInfo}>
              <div className={styles.sessionDevice}>
                {session ? `${session.browser} · ${session.device}` : 'Navigateur actuel'}
              </div>
              <div className={styles.sessionMeta}>
                {ip ? `${ip} · ` : ''}Connecté le {fmtDate(session?.connectedSince ?? data.lastLoginAt)}
              </div>
            </div>
            <span className={styles.sessionCur}>Session actuelle</span>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--t3)', margin: '10px 0 0' }}>
            Une seule session est active à la fois : se connecter ailleurs ferme celle-ci.
          </p>
        </div>
      </div>

    </div>
  );
}
