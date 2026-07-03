/* ================================================================
 * FICHIER : sections/params/SecSecurite.tsx
 * Section "Sécurité" — mot de passe, 2FA, sessions actives.
 * API :
 *   onSaveSecurite(dto)        → PATCH  /partenaire/parametres/securite
 *   onChangePassword(cur, new) → POST   /partenaire/parametres/securite/password
 * ================================================================ */

import { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:             PartenaireData | null;
  saving:           boolean;
  dirty:            () => void;
  markClean:        () => void;
  saveTrigger:      number;
  onSaveSecurite:   (body: { twoFaEnabled: boolean; twoFaMethod?: string | null }) => Promise<void>;
  onChangePassword: (current: string, next: string, confirm: string) => Promise<void>;
  onToast:          (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function SecSecurite({
  data, saving, dirty, markClean, saveTrigger,
  onSaveSecurite, onChangePassword, onToast
}: Props) {
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew,     setPwdNew]     = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdScore,   setPwdScore]   = useState(0);
  const [twoFa,      setTwoFa]      = useState(true);
  const [twoFaMethod,setTwoFaMethod]= useState('sms');

  useEffect(() => {
    if (!data) return;
    setTwoFa(data.twoFaEnabled ?? true);
    setTwoFaMethod(data.twoFaMethod ?? 'sms');
  }, [data]);

  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  /* Force mot de passe (0–4) */
  function checkPwd(v: string) {
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    setPwdScore(score);
  }

  const PWD_LABELS = ['Trop faible', 'Faible', 'Moyen', 'Bon', 'Excellent'];
  const PWD_COLORS = ['', s.pw1, s.pw2, s.pw3, s.pw4];

  async function handleSave() {
    /* Changement de mot de passe si les champs sont remplis */
    if (pwdCurrent && pwdNew) {
      if (pwdNew !== pwdConfirm) {
        onToast('⚠️ Les mots de passe ne correspondent pas', 'w');
        return;
      }
      try {
        await onChangePassword(pwdCurrent, pwdNew, pwdConfirm);
        setPwdCurrent(''); setPwdNew(''); setPwdConfirm(''); setPwdScore(0);
        onToast('✅ Mot de passe mis à jour', 's');
      } catch {
        onToast('❌ Mot de passe actuel incorrect', 'w');
        return;
      }
    }
    /* Paramètres 2FA */
    try {
      await onSaveSecurite({ twoFaEnabled: twoFa, twoFaMethod: twoFa ? twoFaMethod : null });
      markClean();
      onToast('✅ Sécurité sauvegardée', 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'w');
    }
  }

  return (
    <>
      {/* Mot de passe */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-lock" /> Mot de passe</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.fg}>
            <label className={s.fl}>Mot de passe actuel</label>
            <input className={s.fin} type="password" value={pwdCurrent}
              onChange={e => { setPwdCurrent(e.target.value); dirty(); }} placeholder="••••••••" />
          </div>
          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>Nouveau mot de passe</label>
              <input className={s.fin} type="password" value={pwdNew}
                onChange={e => { setPwdNew(e.target.value); dirty(); checkPwd(e.target.value); }} placeholder="••••••••" />
            </div>
            <div className={s.fg}>
              <label className={s.fl}>Confirmer</label>
              <input className={s.fin} type="password" value={pwdConfirm}
                onChange={e => { setPwdConfirm(e.target.value); dirty(); }} placeholder="••••••••" />
            </div>
          </div>
          {/* Barre de force */}
          <div className={s.pwdBar}>
            {[1,2,3,4].map(i => (
              <div key={i} className={`${s.pwdSeg} ${i <= pwdScore ? PWD_COLORS[pwdScore] : ''}`} />
            ))}
          </div>
          <div className={s.pwdLabel}>
            {pwdNew ? `Force : ${PWD_LABELS[pwdScore]}` : 'Utilisez au moins 8 caractères, une majuscule et un chiffre.'}
          </div>
        </div>
      </div>

      {/* 2FA */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-shield-halved" /> Double authentification (2FA)</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.trow}>
            <div className={s.trowIc}><i className="fas fa-mobile-screen" /></div>
            <div className={s.trowMain}>
              <div className={s.trowT}>2FA par SMS</div>
              <div className={s.trowD}>Un code vous est envoyé à chaque connexion.</div>
            </div>
            <div className={`${s.toggle} ${twoFa && twoFaMethod === 'sms' ? s.toggleOn : ''}`}
              onClick={() => { setTwoFa(true); setTwoFaMethod('sms'); dirty(); }} role="switch" />
          </div>
          <div className={s.trow}>
            <div className={s.trowIc}><i className="fas fa-key" /></div>
            <div className={s.trowMain}>
              <div className={s.trowT}>Application d'authentification</div>
              <div className={s.trowD}>Google Authenticator, Authy…</div>
            </div>
            <div className={`${s.toggle} ${twoFa && twoFaMethod === 'totp' ? s.toggleOn : ''}`}
              onClick={() => { setTwoFa(true); setTwoFaMethod('totp'); dirty(); }} role="switch" />
          </div>
        </div>
      </div>

      {/* Sessions actives */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-desktop" /> Sessions actives</div>
        </div>
        <div className={s.fcBody}>
          {/* TODO (backend) : GET /partenaire/parametres/sessions */}
          <div className={s.sess}>
            <div className={s.sessIc}><i className="fas fa-mobile-screen" /></div>
            <div className={s.sessMain}>
              <div className={s.sessNm}>Android · Conakry <span className={s.sessCur}>Cet appareil</span></div>
              <div className={s.sessMeta}>Chrome Mobile · Actif maintenant</div>
            </div>
          </div>
          <div className={s.sess}>
            <div className={s.sessIc}><i className="fas fa-laptop" /></div>
            <div className={s.sessMain}>
              <div className={s.sessNm}>Windows · Conakry</div>
              <div className={s.sessMeta}>Chrome · Il y a 2 jours</div>
            </div>
            <button className={s.sessOut} onClick={() => onToast('🔒 Session déconnectée', 's')}>
              Déconnecter
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
