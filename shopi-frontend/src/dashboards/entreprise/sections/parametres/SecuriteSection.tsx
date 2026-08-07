// src/dashboards/entreprise/sections/parametres/SecuriteSection.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props { onDirty: () => void; onToast: (m: string, t?: string) => void; }

export default function SecuriteSection({ onDirty, onToast }: Props) {
  const { t } = useTranslation();
  const SESSIONS = [
    { ic:'fa-desktop', nm:t('parametres.securite.sessions.chromeWindows'), sub:t('parametres.securite.sessions.chromeWindowsSub'), cur:true },
    { ic:'fa-mobile-screen', nm:t('parametres.securite.sessions.safariIphone'), sub:t('parametres.securite.sessions.safariIphoneSub'), cur:false },
    { ic:'fa-tablet-screen-button', nm:t('parametres.securite.sessions.chromeAndroid'), sub:t('parametres.securite.sessions.chromeAndroidSub'), cur:false },
  ];
  const TWO_FA = [
    { em:'📱', ttl:t('parametres.securite.twoFa.appTitle'), sub:t('parametres.securite.twoFa.appSub'), badge:t('parametres.securite.twoFa.appBadge'), sel:true },
    { em:'💬', ttl:t('parametres.securite.twoFa.smsTitle'), sub:t('parametres.securite.twoFa.smsSub'), badge:t('parametres.securite.twoFa.smsBadge'), sel:false },
    { em:'📧', ttl:t('parametres.securite.twoFa.emailTitle'), sub:t('parametres.securite.twoFa.emailSub'), badge:t('parametres.securite.twoFa.emailBadge'), sel:false },
  ];
  const [pwdVis, setPwdVis] = useState({ c:false, n:false, cf:false });
  const [pwdStr, setPwdStr] = useState(0);
  const [fa2, setFa2] = useState(0);

  function checkPwd(v: string) {
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v)) s++;
    if (/[0-9]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    setPwdStr(s);
    onDirty();
  }

  const PWD_COLORS = ['var(--t1)', 'var(--t2)', 'var(--t2)', 'var(--t1)'];
  const PWD_LABELS = [
    t('parametres.securite.pwdLabels.tropFaible'),
    t('parametres.securite.pwdLabels.faible'),
    t('parametres.securite.pwdLabels.bon'),
    t('parametres.securite.pwdLabels.fort'),
  ];

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
            <input className={s.fin} type={pwdVis.c ? 'text' : 'password'} placeholder="••••••••" onChange={onDirty} />
            <button onClick={() => setPwdVis(p => ({ ...p, c: !p.c }))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer' }}><i className={`fas fa-${pwdVis.c ? 'eye-slash' : 'eye'}`} /></button>
          </div>
        </div>
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.securite.nouveauMdp')}</div>
          <div className={s.fw}>
            <i className={`fas fa-lock-open ${s.fi}`} />
            <input className={s.fin} type={pwdVis.n ? 'text' : 'password'} placeholder={t('parametres.securite.nouveauMdpPlaceholder')} onChange={e => checkPwd(e.target.value)} />
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
            <input className={s.fin} type={pwdVis.cf ? 'text' : 'password'} placeholder={t('parametres.securite.confirmerMdpPlaceholder')} onChange={onDirty} />
            <button onClick={() => setPwdVis(p => ({ ...p, cf: !p.cf }))} style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer' }}><i className={`fas fa-${pwdVis.cf ? 'eye-slash' : 'eye'}`} /></button>
          </div>
        </div>
        <button className={s.saveBtn} style={{ marginTop:4 }} onClick={() => onToast(t('parametres.securite.mdpMisAJourToast'), 's')}><i className="fas fa-key" /> {t('parametres.securite.mettreAJourMdp')}</button>
      </FormCard>

      <FormCard title={t('parametres.securite.twoFaTitle')} icon="fa-mobile-screen-button" subtitle={t('parametres.securite.twoFaSubtitle')}
        action={<span className={`${s.badge} ${s.amber}`} style={{ fontSize:11, padding:'4px 12px' }}>{t('parametres.securite.nonActive')}</span>}
      >
        <div className={s.radioGroup}>
          {TWO_FA.map((p, i) => (
            <div key={p.ttl} className={`${s.radioOpt} ${fa2 === i ? s.selected : ''}`} onClick={() => { setFa2(i); onDirty(); }}>
              <div className={s.roDot} />
              <span className={s.roEm}>{p.em}</span>
              <div><div className={s.roTtl}>{p.ttl}</div><div className={s.roSub}>{p.sub}</div></div>
              <div className={s.roBadge}>{p.badge}</div>
            </div>
          ))}
        </div>
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
    </>
  );
}
