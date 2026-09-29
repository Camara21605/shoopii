/*
 * FICHIER : src/dashboards/livreur/pages/params/SecSecurite.tsx
 * ✅ CONNECTÉ — changement de mot de passe + 2FA vers l'API
 *
 * BUGS CORRIGÉS :
 *   - règles du mot de passe différentes de celles du serveur (une jauge « force »
 *     laissait passer « aaaaaaa1 ») → mêmes règles, vérifiées en direct ;
 *   - après un changement de mot de passe, toutes les sessions sont fermées par le
 *     serveur mais l'écran restait « connecté » → déconnexion propre ;
 *   - 2FA : choix « SMS » / « e-mail » proposé alors que seule l'application
 *     d'authentification existe ; il fallait basculer l'interrupteur PUIS cliquer
 *     « Enregistrer » ; après activation, l'écran ignorait qu'elle était active
 *     (un 2e clic relançait la configuration) → l'interrupteur ouvre directement
 *     l'activation / la désactivation et reflète l'état réel ;
 *   - date de la session toujours en français.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';
import TwoFaSetupModal from '../../../../shared/components/TwoFaSetupModal';
import DisableTwoFaModal from '../../../../shared/components/DisableTwoFaModal';

interface Props {
  data:         LivreurData | null;
  saving:       boolean;
  dirty:        () => void;
  clean?:       () => void;
  onPop:        (m: string, t?: string) => void;
  savePassword: (b: { currentPassword: string; newPassword: string; confirmPassword: string }) => Promise<void>;
  saveTwoFa:    (b: { twoFaEnabled: boolean; twoFaMethod?: string; currentPassword?: string; code?: string }) => Promise<void>;
  /** Relit les paramètres (état réel de la 2FA après activation). */
  reload?:      () => Promise<unknown> | void;
  /** Déconnexion réelle — voir "Se déconnecter" sur la carte Session. */
  onLogout:     () => void;
}

export default function SecSecurite({ data, saving, dirty, clean, onPop, savePassword, saveTwoFa, reload, onLogout }: Props) {
  const { t, i18n } = useTranslation();
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showPwd,     setShowPwd]     = useState([false, false, false]);
  const [show2fa,     setShow2fa]     = useState(false);
  const [showDisable2fa, setShowDisable2fa] = useState(false);
  const twoFaOn = !!data?.twoFaEnabled;

  /* Mêmes règles que le serveur (securite-livreur.service.ts) */
  const rules = useMemo(() => [
    { key: 'longueur',     ok: newPwd.length >= 8 },
    { key: 'minuscule',    ok: /[a-z]/.test(newPwd) },
    { key: 'majuscule',    ok: /[A-Z]/.test(newPwd) },
    { key: 'chiffre',      ok: /\d/.test(newPwd) },
    { key: 'different',    ok: !!newPwd && newPwd !== currentPwd },
    { key: 'confirmation', ok: !!newPwd && newPwd === confirmPwd },
  ], [newPwd, confirmPwd, currentPwd]);
  const pwdValid = !!currentPwd && rules.every(r => r.ok);

  async function handlePasswordSave() {
    if (!pwdValid) return;
    try {
      await savePassword({ currentPassword: currentPwd, newPassword: newPwd, confirmPassword: confirmPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      clean?.();
      /* Le serveur a fermé toutes les sessions : on quitte proprement */
      onPop(t('livreurSecSecurite.toasts.pwdChangedLogout'), 's');
      setTimeout(onLogout, 1500);
    } catch (err: unknown) {
      onPop((err as Error)?.message ?? t('livreurSecSecurite.toasts.currentWrong'), 'e');
    }
  }

  async function confirmDisable2fa(currentPassword: string, code: string) {
    await saveTwoFa({ twoFaEnabled: false, currentPassword, code });
    onPop(t('livreurSecSecurite.toasts.twoFaDisabled'), 'w');
  }

  const eye = (i: number) => (
    <button type="button" onClick={() => setShowPwd(s => s.map((v, k) => k === i ? !v : v))}
      aria-label={showPwd[i] ? t('livreurSecSecurite.pwdCard.masquer') : t('livreurSecSecurite.pwdCard.afficher')}
      style={{ position:'absolute', right:12, background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:13 }}>
      <i className={`fas ${showPwd[i] ? 'fa-eye-slash' : 'fa-eye'}`} />
    </button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-lock" /> {t('livreurSecSecurite.header.titre')}</h2>
        <p>{t('livreurSecSecurite.header.sub')}</p>
      </div>

      {/* Mot de passe */}
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-key" /> {t('livreurSecSecurite.pwdCard.titre')}</div></div>
        <div className={ps.cb}>
          <form onSubmit={e => { e.preventDefault(); void handlePasswordSave(); }}>
            <div className={ps.fiGroup} style={{ marginBottom:14 }}>
              <label className={ps.fiLabel} htmlFor="pwd-actuel">{t('livreurSecSecurite.pwdCard.actuel')}</label>
              <div className={ps.fiWrap}>
                <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input id="pwd-actuel" className={ps.fiInput} type={showPwd[0] ? 'text' : 'password'} value={currentPwd} autoComplete="current-password"
                  onChange={e => { setCurrentPwd(e.target.value); dirty(); }} placeholder="••••••••" />
                {eye(0)}
              </div>
            </div>
            <div className={ps.grid2}>
              <div className={ps.fiGroup}>
                <label className={ps.fiLabel} htmlFor="pwd-nouveau">{t('livreurSecSecurite.pwdCard.nouveau')}</label>
                <div className={ps.fiWrap}>
                  <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                  <input id="pwd-nouveau" className={ps.fiInput} type={showPwd[1] ? 'text' : 'password'} value={newPwd} autoComplete="new-password"
                    onChange={e => { setNewPwd(e.target.value); dirty(); }} placeholder={t('livreurSecSecurite.pwdCard.nouveauPlaceholder')} />
                  {eye(1)}
                </div>
              </div>
              <div className={ps.fiGroup}>
                <label className={ps.fiLabel} htmlFor="pwd-confirmer">{t('livreurSecSecurite.pwdCard.confirmer')}</label>
                <div className={ps.fiWrap}>
                  <i className="fas fa-lock" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                  <input id="pwd-confirmer" className={ps.fiInput} type={showPwd[2] ? 'text' : 'password'} value={confirmPwd} autoComplete="new-password"
                    onChange={e => { setConfirmPwd(e.target.value); dirty(); }} placeholder={t('livreurSecSecurite.pwdCard.confirmerPlaceholder')} />
                  {eye(2)}
                </div>
              </div>
            </div>
            {newPwd && (
              <ul style={{ listStyle:'none', padding:0, margin:'12px 0 0', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))', gap:'4px 12px' }}>
                {rules.map(r => (
                  <li key={r.key} style={{ fontSize:11.5, color: r.ok ? 'var(--emerald)' : 'var(--t3)', display:'flex', alignItems:'center', gap:6 }}>
                    <i className={`fas ${r.ok ? 'fa-circle-check' : 'fa-circle'}`} style={{ fontSize:10 }} /> {t(`livreurSecSecurite.regles.${r.key}`)}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
              <button type="submit" disabled={saving || !pwdValid}
                style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                  padding:'10px 24px', fontSize:12, fontWeight:700, cursor:'pointer', opacity: saving || !pwdValid ? 0.6 : 1,
                  display:'flex', alignItems:'center', gap:7 }}>
                {saving ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecSecurite.saving')}</> : <><i className="fas fa-key" /> {t('livreurSecSecurite.modifierMdp')}</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 2FA — application d'authentification (seule méthode réellement disponible) */}
      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-mobile-screen" /> {t('livreurSecSecurite.twoFaCard.titre')}</div>
          <div style={{ background: twoFaOn ? 'var(--em-bg)' : 'var(--g50)',
            color: twoFaOn ? 'var(--emerald)' : 'var(--red)', fontSize:11, fontWeight:700,
            padding:'4px 11px', borderRadius:'var(--pill)', border:'1px solid var(--bdr)' }}>
            <i className={`fas ${twoFaOn ? 'fa-shield-check' : 'fa-shield-xmark'}`} />{' '}
            {twoFaOn ? t('livreurSecSecurite.twoFaCard.active') : t('livreurSecSecurite.twoFaCard.inactive')}
          </div>
        </div>
        <div className={ps.cb}>
          <div className={ps.setRow}>
            <div>
              <div className={ps.srLbl}>{t('livreurSecSecurite.twoFaCard.activerLabel')}</div>
              <div className={ps.srSub}>{t('livreurSecSecurite.twoFaCard.appSeulement')}</div>
            </div>
            <label className={ps.tog}>
              <input type="checkbox" role="switch" aria-label={t('livreurSecSecurite.twoFaCard.activerLabel')}
                checked={twoFaOn} disabled={saving}
                onChange={e => (e.target.checked ? setShow2fa(true) : setShowDisable2fa(true))} />
              <span className={ps.togs} />
            </label>
          </div>
        </div>
      </div>

      {/* Session réelle (une seule session active à la fois sur Shoneya) */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-clock-rotate-left" /> {t('livreurSecSecurite.sessionsCard.titre')}</div>
        </div>
        <div className={ps.cb}>
          {data?.currentSession ? (
            <div className={ps.sessionItem}>
              <div className={ps.sessionIc}><i className="fas fa-mobile-screen" /></div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                  {data.currentSession.device} · {data.currentSession.browser}
                  <span style={{ background:'var(--t1)', color:'var(--white)', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:'var(--pill)' }}>{t('livreurSecSecurite.sessionsCard.sessionActuelle')}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                  {data.currentSession.ipAddress ?? '—'} · {t('livreurSecSecurite.sessionsCard.connecteDepuis', {
                    date: new Date(data.currentSession.connectedSince).toLocaleString(i18n.language, { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
                  })}
                </div>
              </div>
              <button type="button" onClick={onLogout}
                style={{ background:'var(--g50)', color:'var(--red)', border:'1px solid var(--bdr)',
                  borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {t('livreurSecSecurite.sessionsCard.deconnecter')}
              </button>
            </div>
          ) : (
            <div style={{ fontSize:12, color:'var(--t3)' }}>
              <i className="fas fa-circle-info" /> {t('livreurSecSecurite.sessionsCard.unavailable')}
            </div>
          )}
        </div>
      </div>

      {show2fa && (
        <TwoFaSetupModal
          onClose={() => setShow2fa(false)}
          onEnabled={() => {
            void reload?.();                 // l'écran reflète l'état réel (2FA active)
            onPop(t('livreurSecSecurite.toasts.twoFaEnabledModal'), 's');
          }}
        />
      )}

      {showDisable2fa && (
        <DisableTwoFaModal
          onClose={() => setShowDisable2fa(false)}
          onConfirm={confirmDisable2fa}
        />
      )}
    </div>
  );
}
