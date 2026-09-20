/* ================================================================
 * src/modules/home/components/settings/sections/SecuriteSection.tsx
 * DYNAMIQUE — GET securite + PATCH password/2fa + codes de secours + alertes
 *
 *  ✅ Mot de passe : règles vérifiées en direct (8+ caractères, minuscule,
 *     majuscule, chiffre, différent de l'actuel, confirmation) — avant : la
 *     seule règle affichée était fausse (il faut aussi une minuscule) et rien
 *     n'était contrôlé avant l'envoi. Un changement révoque toutes les sessions :
 *     la personne est renvoyée à la connexion (avant : page « connectée » mais
 *     déjà invalide).
 *  ✅ Codes de secours : réservés aux comptes avec 2FA ; vraiment acceptés à la
 *     connexion à la place du code de l'application ; copie + téléchargement.
 *  ✅ « Questions de sécurité » supprimées : aucune procédure de récupération ne
 *     les lisait jamais (fausse protection, et pratique déconseillée).
 *  ✅ Textes traduits (settingsPage.securite.*).
 * ================================================================ */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { Toggle } from '../components/Toggle';
import { settingsApi, type SecuriteData, type AlertSettings, type AlertType } from '../../api/settings.api';
import TwoFaSetupModal from '../../../../../../shared/components/TwoFaSetupModal';
import DisableTwoFaModal from '../../../../../../shared/components/DisableTwoFaModal';
import { useAppContext } from '../../../../../../shared/context/AppContext';

interface Props { onToast: (msg: string) => void; }

const ALERTS = [
  { key: 'connex',      ico: 'icoEmerald', icon: 'fa-right-to-bracket'     },
  { key: 'mdp',         ico: 'icoRose',    icon: 'fa-key'                  },
  { key: 'tentatives',  ico: 'icoAmber',   icon: 'fa-triangle-exclamation' },
  { key: 'transaction', ico: 'icoViolet',  icon: 'fa-credit-card'          },
  { key: 'pays',        ico: 'icoRed',     icon: 'fa-user-slash'           },
] as const;

const announce = () => window.dispatchEvent(new CustomEvent('security-updated'));

export default function SecuriteSection({ onToast }: Props) {
  const { t } = useTranslation();
  const navigate   = useNavigate();
  const { logout } = useAppContext();

  const [securite, setSecurite] = useState<SecuriteData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [editPwd,  setEditPwd]  = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [codes,    setCodes]    = useState<string[] | null>(null);
  const [show2faModal,   setShow2faModal]   = useState(false);
  const [showDisable2fa, setShowDisable2fa] = useState(false);

  /* Alertes : seul le canal e-mail est réellement branché (pas de passerelle SMS ni de push serveur) */
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [savingAlert,   setSavingAlert]   = useState<AlertType | null>(null);

  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const load = useCallback(async () => {
    setError(false);
    try { setSecurite(await settingsApi.getSecurite()); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    settingsApi.getAlertSettings().then(setAlertSettings).catch(() => { /* non bloquant */ });
  }, [load]);

  /* ── Règles du nouveau mot de passe, vérifiées en direct ── */
  const rules = useMemo(() => {
    const p = pwdForm.newPassword;
    return [
      { key: 'longueur',   ok: p.length >= 8 },
      { key: 'minuscule',  ok: /[a-z]/.test(p) },
      { key: 'majuscule',  ok: /[A-Z]/.test(p) },
      { key: 'chiffre',    ok: /\d/.test(p) },
      { key: 'different',  ok: !!p && p !== pwdForm.currentPassword },
      { key: 'confirmation', ok: !!p && p === pwdForm.confirmPassword },
    ];
  }, [pwdForm]);
  const pwdValid = !!pwdForm.currentPassword && rules.every(r => r.ok);

  async function savePassword() {
    if (!pwdValid) return;
    setSavingPwd(true);
    try {
      await settingsApi.changePassword({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      /* Le serveur révoque TOUTES les sessions : on quitte proprement plutôt que de laisser une page devenue invalide */
      onToast(t('settingsPage.securite.mdpChangeToast'));
      logout();
      navigate('/login');
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSavingPwd(false); }
  }

  function closePwd() { setEditPwd(false); setShowPwd(false); setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }

  /* ── 2FA : désactivation = mot de passe + code de l'application (voir DisableTwoFaModal) ── */
  async function handleDisable2fa(currentPassword: string, code: string) {
    await settingsApi.update2fa({ twoFaEnabled: false, currentPassword, code });
    setSecurite(prev => prev ? { ...prev, twoFaEnabled: false, codesSecours: 0 } : prev);   // les codes de secours sont effacés avec la 2FA
    setCodes(null);
    announce();
    onToast(t('settingsPage.securite.twofaDesactiveToast'));
  }

  /* ── Codes de secours ── */
  async function genererCodes() {
    setGeneratingCodes(true);
    try {
      const res = await settingsApi.genererCodesSecours();
      setCodes(res.codes);
      setSecurite(prev => prev ? { ...prev, codesSecours: res.codes.length } : prev);
      announce();
      onToast(t('settingsPage.securite.codesGeneresToast'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setGeneratingCodes(false); }
  }

  function downloadCodes() {
    if (!codes) return;
    const txt = `Shoneya — ${t('settingsPage.securite.codesTitle')}\n${new Date().toLocaleDateString()}\n\n${codes.join('\n')}\n\n${t('settingsPage.securite.codesFichierNote')}\n`;
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'shoneya-codes-de-secours.txt' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ── Alertes (sauvegarde immédiate, une case à la fois) ── */
  async function toggleAlertSetting(type: AlertType, email: boolean) {
    const prev = alertSettings;
    setAlertSettings(a => a ? { ...a, [type]: { email } } : a);   // optimiste
    setSavingAlert(type);
    try { setAlertSettings(await settingsApi.updateAlertSetting(type, email)); }
    catch (err: any) { setAlertSettings(prev); onToast(`❌ ${err.message ?? t('settingsPage.securite.alerteError')}`); }
    finally { setSavingAlert(null); }
  }

  const joursDepuisMdp = securite?.dernierChangementMdp
    ? Math.floor((Date.now() - new Date(securite.dernierChangementMdp).getTime()) / 86400000)
    : null;

  if (loading) return (
    <div className={s.card}>
      <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
      </div>
    </div>
  );

  if (error) return (
    <div className={s.card}>
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
        {t('settingsPage.securite.loadErrorInline')}{' '}
        <button type="button" className={s.linkBtn} onClick={() => { setLoading(true); load(); }}>{t('settingsPage.securite.reessayer')}</button>
      </div>
    </div>
  );

  const twoFa = !!securite?.twoFaEnabled;

  return (
    <>
      {/* ── Authentification & Accès ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoEmerald}`}><i className="fas fa-lock" /></div>
            <div>
              <div className={s.cardH}>{t('settingsPage.securite.authTitle')}</div>
              <div className={s.cardSub}>{t('settingsPage.securite.authSubtitle')}</div>
            </div>
          </div>
        </div>
        <div className={s.cardBody}>

          {/* ── Mot de passe ── */}
          <div className={s.secRow}>
            <div className={`${s.secIco} ${s.icoEmerald}`}><i className="fas fa-key" /></div>
            <div className={s.secInfo}>
              <div className={s.secTitle}>{t('settingsPage.securite.mdpTitle')}</div>
              <div className={s.secDesc}>
                {joursDepuisMdp !== null ? t('settingsPage.securite.dernierModifSuffix', { count: joursDepuisMdp }) : t('settingsPage.securite.jamaisModifie')}
              </div>
            </div>
            <span className={`${s.secStatus} ${s.statusOn}`}><i className="fas fa-circle" style={{ fontSize:6 }} /> {t('settingsPage.securite.actif')}</span>
            <button className={s.secBtn} onClick={() => (editPwd ? closePwd() : setEditPwd(true))} aria-expanded={editPwd}>{t('settingsPage.securite.modifier')}</button>
          </div>

          <form className={`${s.editForm} ${editPwd ? s.editFormOpen : ''}`} onSubmit={e => { e.preventDefault(); savePassword(); }}>
            <div className={s.editGrid}>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label htmlFor="sec-cur">{t('settingsPage.securite.mdpActuel')}</label>
                <input id="sec-cur" type={showPwd ? 'text' : 'password'} autoComplete="current-password" value={pwdForm.currentPassword}
                  onChange={e => setPwdForm(f => ({ ...f, currentPassword: e.target.value }))} />
              </div>
              <div className={s.field}>
                <label htmlFor="sec-new">{t('settingsPage.securite.nouveauMdp')}</label>
                <input id="sec-new" type={showPwd ? 'text' : 'password'} autoComplete="new-password" value={pwdForm.newPassword}
                  onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))} />
              </div>
              <div className={s.field}>
                <label htmlFor="sec-conf">{t('settingsPage.securite.confirmer')}</label>
                <input id="sec-conf" type={showPwd ? 'text' : 'password'} autoComplete="new-password" value={pwdForm.confirmPassword}
                  onChange={e => setPwdForm(f => ({ ...f, confirmPassword: e.target.value }))} />
              </div>
              <div className={`${s.fieldFull}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                {rules.map(r => (
                  <span key={r.key} className={`${s.pwdRule} ${r.ok ? s.pwdRuleOk : ''}`}>
                    <i className={`fas ${r.ok ? 'fa-circle-check' : 'fa-circle'}`} /> {t(`settingsPage.securite.regles.${r.key}`)}
                  </span>
                ))}
              </div>
              <div className={`${s.fieldFull}`}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--t2)' }}>
                  <input type="checkbox" checked={showPwd} onChange={e => setShowPwd(e.target.checked)} style={{ width: 'auto' }} /> {t('settingsPage.securite.afficher')}
                </label>
                <span className={s.fieldHint}>{t('settingsPage.securite.mdpDeconnexionHint')}</span>
              </div>
              <div className={s.fieldActions}>
                <button type="submit" className={s.btnSave} disabled={savingPwd || !pwdValid}>
                  {savingPwd ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.securite.enregistrement')}</> : t('settingsPage.securite.changerMdp')}
                </button>
                <button type="button" className={s.btnCancel} onClick={closePwd}>{t('settingsPage.securite.annuler')}</button>
              </div>
            </div>
          </form>

          {/* ── 2FA ── */}
          <div className={s.secRow}>
            <div className={`${s.secIco} ${s.icoAmber}`}><i className="fas fa-mobile-screen" /></div>
            <div className={s.secInfo}>
              <div className={s.secTitle}>{t('settingsPage.securite.twofaTitle')}</div>
              <div className={s.secDesc}>{t('settingsPage.securite.twofaDesc')}</div>
            </div>
            <span className={`${s.secStatus} ${twoFa ? s.statusOn : s.statusOff}`}>
              <i className="fas fa-circle" style={{ fontSize:6 }} /> {twoFa ? t('settingsPage.securite.active') : t('settingsPage.securite.desactive')}
            </span>
            <button className={`${s.secBtn} ${!twoFa ? s.secBtnPrim : ''}`} onClick={() => (twoFa ? setShowDisable2fa(true) : setShow2faModal(true))}>
              {twoFa ? t('settingsPage.securite.desactiver') : <><i className="fas fa-plus" /> {t('settingsPage.securite.activer')}</>}
            </button>
          </div>

          {/* ── Codes de secours (utiles seulement avec la 2FA) ── */}
          <div className={s.secRow} style={{ opacity: twoFa ? 1 : .65 }}>
            <div className={`${s.secIco} ${s.icoViolet}`}><i className="fas fa-life-ring" /></div>
            <div className={s.secInfo}>
              <div className={s.secTitle}>{t('settingsPage.securite.codesTitle')}</div>
              <div className={s.secDesc}>
                {!twoFa
                  ? t('settingsPage.securite.codesNeed2fa')
                  : securite?.codesSecours
                    ? t('settingsPage.securite.codesDescAvailable', { count: securite.codesSecours })
                    : t('settingsPage.securite.codesDescDefault')}
              </div>
            </div>
            {twoFa && (
              <span className={`${s.secStatus} ${securite?.codesSecours ? s.statusOn : s.statusWarn}`}>
                <i className="fas fa-circle" style={{ fontSize: 6 }} /> {securite?.codesSecours ? t('settingsPage.securite.generes') : t('settingsPage.securite.nonGeneres')}
              </span>
            )}
            <button className={`${s.secBtn} ${twoFa && !securite?.codesSecours ? s.secBtnWarn : ''}`} onClick={genererCodes} disabled={!twoFa || generatingCodes}>
              {generatingCodes ? <i className="fas fa-circle-notch fa-spin" /> : securite?.codesSecours ? t('settingsPage.securite.regenerer') : t('settingsPage.securite.generer')}
            </button>
          </div>

          {codes && (
            <div className={s.verifyBox} style={{ margin: '4px 0 12px' }}>
              <div className={s.verifyTxt}><i className="fas fa-triangle-exclamation" /> {t('settingsPage.securite.sauvegardezCodes')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
                {codes.map(c => (
                  <code key={c} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: 2, background: 'var(--white)', border: '1px solid var(--bdr2)', borderRadius: 8 }}>{c}</code>
                ))}
              </div>
              <div className={s.verifyRow}>
                <button className={s.secBtn} onClick={() => { navigator.clipboard.writeText(codes.join('\n')); onToast(t('settingsPage.securite.codesCopiesToast')); }}>
                  <i className="fas fa-copy" /> {t('settingsPage.securite.toutCopier')}
                </button>
                <button className={s.secBtn} onClick={downloadCodes}><i className="fas fa-download" /> {t('settingsPage.securite.telecharger')}</button>
                <button className={s.linkBtn} onClick={() => setCodes(null)}>{t('settingsPage.securite.masquer')}</button>
              </div>
              <div className={s.fieldHint}>{t('settingsPage.securite.codesUsage')}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Alertes de sécurité ── */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoAmber}`}><i className="fas fa-bell" /></div>
            <div><div className={s.cardH}>{t('settingsPage.securite.alertesTitle')}</div><div className={s.cardSub}>{t('settingsPage.securite.alertesSubtitle')}</div></div>
          </div>
        </div>
        <div className={s.cardBody}>
          {ALERTS.map(({ key, ico, icon }) => (
            <div key={key} className={s.notifRow}>
              <div className={s.notifLeft}>
                <div className={`${s.notifIco} ${s[ico]}`}><i className={`fas ${icon}`} /></div>
                <div>
                  <div className={s.notifTitle}>{t(`settingsPage.securite.alertRows.${key}.title`)}</div>
                  <div className={s.notifDesc}>{t(`settingsPage.securite.alertRows.${key}.desc`)}</div>
                </div>
              </div>
              <div className={s.notifChannels}>
                <div className={s.notifCh}>
                  <Toggle checked={alertSettings?.[key]?.email ?? true} onChange={v => toggleAlertSetting(key, v)} disabled={!alertSettings || savingAlert === key} />
                  <span>{t('settingsPage.securite.email')}</span>
                </div>
              </div>
            </div>
          ))}
          <div style={{ padding: '4px 24px 16px', fontSize: 11.5, color: 'var(--t3)' }}>{t('settingsPage.securite.alertesNote')}</div>
        </div>
      </div>

      {show2faModal && (
        <TwoFaSetupModal
          onClose={() => setShow2faModal(false)}
          onEnabled={() => {
            setSecurite(prev => prev ? { ...prev, twoFaEnabled: true } : prev);
            announce();
            onToast(t('settingsPage.securite.twofaActiveToast'));
          }}
        />
      )}

      {showDisable2fa && (
        <DisableTwoFaModal onClose={() => setShowDisable2fa(false)} onConfirm={handleDisable2fa} />
      )}
    </>
  );
}
