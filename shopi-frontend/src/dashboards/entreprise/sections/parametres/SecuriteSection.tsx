// src/dashboards/entreprise/sections/parametres/SecuriteSection.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import TwoFaSetupModal from '../../../../shared/components/TwoFaSetupModal';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data:     ParametresData | null;
  saving:   boolean;
  onDirty:  () => void;
  onToast:  (m: string, t?: string) => void;
  save2FA:      (body: { twoFaEnabled: boolean; twoFaMethod?: string }) => Promise<void>;
  savePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
  /** Recharge les paramètres depuis l'API — nécessaire après activation 2FA
   *  via TwoFaSetupModal, qui n'appelle pas save2FA (donc ne met pas
   *  data.twoFaEnabled à jour tout seul). */
  onReload:     () => void;
}

export default function SecuriteSection({ data, saving, onDirty, onToast, save2FA, savePassword, onReload }: Props) {
  const { t } = useTranslation();
  const SESSIONS = [
    { ic:'fa-desktop', nm:t('parametres.securite.sessions.chromeWindows'), sub:t('parametres.securite.sessions.chromeWindowsSub'), cur:true },
    { ic:'fa-mobile-screen', nm:t('parametres.securite.sessions.safariIphone'), sub:t('parametres.securite.sessions.safariIphoneSub'), cur:false },
    { ic:'fa-tablet-screen-button', nm:t('parametres.securite.sessions.chromeAndroid'), sub:t('parametres.securite.sessions.chromeAndroidSub'), cur:false },
  ];

  const [pwdVis, setPwdVis] = useState({ c:false, n:false, cf:false });
  const [pwdCur, setPwdCur] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConf, setPwdConf] = useState('');
  const [pwdStr, setPwdStr] = useState(0);
  const [savingPwd, setSavingPwd] = useState(false);
  const [show2fa, setShow2fa] = useState(false);
  const [saving2fa, setSaving2fa] = useState(false);

  function checkPwd(v: string) {
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    setPwdStr(score);
    setPwdNew(v);
    onDirty();
  }

  const PWD_COLORS = ['var(--t1)', 'var(--t2)', 'var(--t2)', 'var(--t1)'];
  const PWD_LABELS = [
    t('parametres.securite.pwdLabels.tropFaible'),
    t('parametres.securite.pwdLabels.faible'),
    t('parametres.securite.pwdLabels.bon'),
    t('parametres.securite.pwdLabels.fort'),
  ];

  async function handleChangePassword() {
    if (!pwdCur || !pwdNew) { onToast('Remplissez tous les champs', 'w'); return; }
    if (pwdNew !== pwdConf) { onToast('Les mots de passe ne correspondent pas', 'w'); return; }
    if (pwdNew.length < 8)  { onToast('Minimum 8 caractères requis', 'w'); return; }

    setSavingPwd(true);
    try {
      await savePassword({ currentPassword: pwdCur, newPassword: pwdNew, confirmPassword: pwdConf });
      onToast(t('parametres.securite.mdpMisAJourToast'), 's');
      setPwdCur(''); setPwdNew(''); setPwdConf(''); setPwdStr(0);
    } catch (err: any) {
      onToast(err?.message ?? 'Mot de passe actuel incorrect', 'e');
    } finally {
      setSavingPwd(false);
    }
  }

  /* Activation 2FA : passe par POST /auth/2fa/setup + /confirm (TwoFaService),
   * qui exige un code TOTP valide avant d'activer réellement — l'ancien
   * chemin direct (twoFaEnabled:true) est désormais rejeté côté backend. */
  async function handleDisable2fa() {
    setSaving2fa(true);
    try {
      await save2FA({ twoFaEnabled: false });
      onToast('2FA désactivée', 'w');
    } catch (err: any) {
      onToast(err?.message ?? 'Erreur lors de la désactivation', 'e');
    } finally {
      setSaving2fa(false);
    }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-lock" /> {t('parametres.securite.title')}</h1>
        <p>{t('parametres.securite.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.securite.changerMdpTitle')} icon="fa-key">
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.securite.mdpActuel')}</div>
          <div className={s.fw}>
            <i className={`fas fa-lock ${s.fi}`} />
            <input className={s.fin} type={pwdVis.c ? 'text' : 'password'} placeholder="••••••••"
              value={pwdCur} onChange={e => { setPwdCur(e.target.value); onDirty(); }} />
            <button onClick={() => setPwdVis(p => ({ ...p, c: !p.c }))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer' }}><i className={`fas fa-${pwdVis.c ? 'eye-slash' : 'eye'}`} /></button>
          </div>
        </div>
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.securite.nouveauMdp')}</div>
          <div className={s.fw}>
            <i className={`fas fa-lock-open ${s.fi}`} />
            <input className={s.fin} type={pwdVis.n ? 'text' : 'password'} placeholder={t('parametres.securite.nouveauMdpPlaceholder')}
              value={pwdNew} onChange={e => checkPwd(e.target.value)} />
            <button onClick={() => setPwdVis(p => ({ ...p, n: !p.n }))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer' }}><i className={`fas fa-${pwdVis.n ? 'eye-slash' : 'eye'}`} /></button>
          </div>
          {pwdStr > 0 && (
            <>
              <div className={s.pwdBars}>
                {[1,2,3,4].map(i => <div key={i} className={s.pwdBar} style={{ background: i <= pwdStr ? PWD_COLORS[pwdStr-1] : 'var(--g200)' }} />)}
              </div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:4, display:'flex', justifyContent:'space-between' }}>
                <span>{t('parametres.securite.force')}</span><span style={{ fontWeight:700, color: PWD_COLORS[pwdStr-1] }}>{PWD_LABELS[pwdStr-1]}</span>
              </div>
            </>
          )}
        </div>
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.securite.confirmerMdp')}</div>
          <div className={s.fw}>
            <i className={`fas fa-shield-check ${s.fi}`} />
            <input className={s.fin} type={pwdVis.cf ? 'text' : 'password'} placeholder={t('parametres.securite.confirmerMdpPlaceholder')}
              value={pwdConf} onChange={e => { setPwdConf(e.target.value); onDirty(); }} />
            <button onClick={() => setPwdVis(p => ({ ...p, cf: !p.cf }))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer' }}><i className={`fas fa-${pwdVis.cf ? 'eye-slash' : 'eye'}`} /></button>
          </div>
          {pwdConf && pwdNew !== pwdConf && (
            <div style={{ fontSize:11, color:'var(--red, #DC2626)', marginTop:4 }}>
              <i className="fas fa-triangle-exclamation" /> Les mots de passe ne correspondent pas
            </div>
          )}
        </div>
        <button
          className={s.saveBtn}
          style={{ marginTop:4 }}
          onClick={handleChangePassword}
          disabled={savingPwd || saving}
        >
          {savingPwd
            ? <><i className="fas fa-spinner fa-spin" /> Enregistrement…</>
            : <><i className="fas fa-key" /> {t('parametres.securite.mettreAJourMdp')}</>
          }
        </button>
      </FormCard>

      <FormCard title={t('parametres.securite.twoFaTitle')} icon="fa-mobile-screen-button" subtitle={t('parametres.securite.twoFaSubtitle')}
        action={
          <span className={`${s.badge} ${data?.twoFaEnabled ? s.green : s.amber}`} style={{ fontSize:11, padding:'4px 12px' }}>
            {data?.twoFaEnabled ? 'Activé' : t('parametres.securite.nonActive')}
          </span>
        }
      >
        {data?.twoFaEnabled ? (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6, marginBottom: 14 }}>
              <i className="fas fa-circle-check" style={{ color: 'var(--emerald, #16A34A)', marginRight: 6 }} />
              La 2FA est active sur ce compte via application d'authentification.
            </p>
            <button
              className={s.saveBtn}
              style={{ background: 'var(--red, #DC2626)' }}
              onClick={handleDisable2fa}
              disabled={saving2fa}
            >
              {saving2fa
                ? <><i className="fas fa-spinner fa-spin" /> …</>
                : <><i className="fas fa-shield-xmark" /> Désactiver la 2FA</>
              }
            </button>
          </>
        ) : (
          <button
            className={s.saveBtn}
            onClick={() => setShow2fa(true)}
          >
            <i className="fas fa-plus" /> Activer la 2FA
          </button>
        )}
      </FormCard>

      <FormCard title={t('parametres.securite.sessionsTitle')} icon="fa-desktop" subtitle={t('parametres.securite.sessionsSubtitle')}
        action={<button style={{ background:'rgba(0,0,0,.06)', color:'var(--t2)', border:'1px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer' }} onClick={() => onToast(t('parametres.securite.toutesSessionsToast'), 'w')}><i className="fas fa-right-from-bracket" /> {t('parametres.securite.deconnecterTout')}</button>}
      >
        {SESSIONS.map(session => (
          <div key={session.nm} className={s.item} style={{ border:'none', borderBottom:'1px solid var(--bdr)', borderRadius:0, padding:'12px 0' }}>
            <div className={s.itemIco} style={{ background:'rgba(0,0,0,.06)', borderRadius:10 }}><i className={`fas ${session.ic}`} style={{ color:'var(--t2)' }} /></div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>
                {session.nm}
                {session.cur && <span className={`${s.badge} ${s.green}`} style={{ marginLeft:8, fontSize:10, verticalAlign:'middle' }}>{t('parametres.securite.sessionActuelle')}</span>}
              </div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>{session.sub}</div>
            </div>
            {!session.cur && <button className={`${s.itemBtn} ${s.itemBtnDanger}`} onClick={() => onToast(t('parametres.securite.sessionTermineeToast'), 'w')}>{t('parametres.securite.revoquer')}</button>}
          </div>
        ))}
      </FormCard>

      {show2fa && (
        <TwoFaSetupModal
          onClose={() => setShow2fa(false)}
          onEnabled={() => { onReload(); onToast('2FA activée avec succès', 's'); }}
        />
      )}
    </>
  );
}
