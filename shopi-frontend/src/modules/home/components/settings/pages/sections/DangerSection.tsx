/* ================================================================
 * src/modules/home/components/settings/sections/DangerSection.tsx
 * DANGER — routes danger avec confirmation
 *
 * « Désactiver » et « Supprimer » exigent le mot de passe actuel. Après l'une
 * ou l'autre, la personne est DÉCONNECTÉE et renvoyée à la connexion (avant :
 * elle restait connectée sur un compte désactivé/supprimé) ; la suppression
 * est refusée par le serveur tant qu'une commande est en cours ou que le
 * portefeuille contient des fonds — le message du serveur est affiché tel quel.
 * « Révoquer les accès tiers » est retiré : aucune intégration tierce n'existe.
 * ================================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi } from '../../api/settings.api';
import { useAppContext } from '../../../../../../shared/context/AppContext';

interface Props { onToast: (msg: string) => void; }

const PASSWORD_GATED = new Set(['desactiver', 'supprimer']);

export default function DangerSection({ onToast }: Props) {
  const { t } = useTranslation();
  const navigate   = useNavigate();
  const { logout } = useAppContext();
  const [loading,  setLoading]  = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [blocked,  setBlocked]  = useState<string | null>(null);   // raison serveur d'un refus (commande en cours, fonds…)

  function startConfirm(key: string) { setConfirm(key); setPassword(''); setPwdError(null); setBlocked(null); }
  function cancelConfirm() { setConfirm(null); setPassword(''); setPwdError(null); setBlocked(null); }

  async function handle(action: () => Promise<{ message: string }>, key: string) {
    if (confirm !== key) { startConfirm(key); return; }
    if (PASSWORD_GATED.has(key) && !password) { setPwdError(t('settingsPage.danger.passwordRequired')); return; }

    setLoading(key);
    try {
      const res = await action();
      cancelConfirm();
      if (PASSWORD_GATED.has(key)) {
        /* Compte désactivé / supprimé : plus de session valide — on quitte l'application */
        onToast(`✅ ${res.message}`);
        logout();
        navigate('/login');
        return;
      }
      onToast(`✅ ${res.message}`);
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (PASSWORD_GATED.has(key) && /mot de passe (actuel )?incorrect|action refus/i.test(msg)) setPwdError(t('settingsPage.danger.passwordIncorrect'));
      else if (key === 'supprimer' && /impossible de supprimer/i.test(msg)) setBlocked(msg);
      else onToast(`❌ ${msg}`);
    } finally { setLoading(null); }
  }

  const rows = [
    { key: 'desactiver',    hard: false, action: () => settingsApi.desactiver(password) },
    { key: 'reinitialiser', hard: false, action: () => settingsApi.reinitialiser() },
    { key: 'supprimer',     hard: true,  action: () => settingsApi.supprimer(password) },
  ] as const;

  return (
    <div className={`${s.card} ${s.cardDanger}`}>
      <div className={`${s.cardHd} ${s.cardHdDanger}`}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoRed}`}><i className="fas fa-triangle-exclamation" /></div>
          <div>
            <div className={`${s.cardH} ${s.cardHRed}`}>{t('settingsPage.danger.titre')}</div>
            <div className={s.cardSub}>{t('settingsPage.danger.subtitle')}</div>
          </div>
        </div>
      </div>
      <div className={s.cardBody}>
        {rows.map(({ key, hard, action }) => (
          <div key={key} className={s.dangerRow}>
            <div>
              <div className={hard ? `${s.dangerTitle} ${s.dangerTitleRed}` : s.dangerTitle}>
                {t(key === 'supprimer' ? 'settingsPage.danger.rowsLive.supprimer.titre' : `settingsPage.danger.rowsLive.${key}.title`)}
              </div>
              <div className={s.dangerDesc}>{t(`settingsPage.danger.rowsLive.${key}.desc`)}</div>

              {confirm === key && PASSWORD_GATED.has(key) && (
                <div style={{ marginTop: 10 }}>
                  <div className={s.dangerPwdRow}>
                    <input
                      type="password" className={s.dangerPwdInput} autoFocus autoComplete="current-password"
                      placeholder={t('settingsPage.danger.passwordPlaceholder')}
                      value={password} onChange={e => { setPassword(e.target.value); setPwdError(null); }}
                      onKeyDown={e => { if (e.key === 'Enter') handle(action as any, key); }}
                    />
                  </div>
                  {pwdError && <div className={s.dangerPwdError} role="alert">{pwdError}</div>}
                  {blocked && key === 'supprimer' && <div className={s.dangerPwdError} role="alert">{blocked}</div>}
                </div>
              )}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end', flexShrink:0 }}>
              {confirm === key && !PASSWORD_GATED.has(key) && (
                <div style={{ fontSize:11, fontWeight:600, color:'var(--red)', marginBottom:2, textAlign:'right' }}>{t('settingsPage.danger.clicAgain')}</div>
              )}
              <button
                className={hard ? `${s.dangerBtn} ${s.dangerBtnHard}` : s.dangerBtn}
                onClick={() => handle(action as any, key)}
                disabled={loading === key}
                style={{ opacity: confirm && confirm !== key ? 0.5 : 1 }}
              >
                {loading === key
                  ? <i className="fas fa-circle-notch fa-spin" />
                  : confirm === key
                    ? <><i className="fas fa-triangle-exclamation" /> {t('settingsPage.danger.confirmerBtn')}</>
                    : t(`settingsPage.danger.rowsLive.${key}.btn`)}
              </button>
              {confirm === key && (
                <button style={{ fontSize:10, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', padding:'2px 0' }} onClick={cancelConfirm}>
                  {t('settingsPage.danger.annulerBtn')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
