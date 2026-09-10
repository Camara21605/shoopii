/* ================================================================
 * FICHIER : sections/params/SecSecurite.tsx
 * Section "Sécurité" — mot de passe, 2FA, sessions actives.
 * API :
 *   onSaveSecurite(dto)        → PATCH  /partenaire/parametres/securite
 *   onChangePassword(cur, new) → POST   /partenaire/parametres/securite/password
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';
import TwoFaSetupModal from '../../../../shared/components/TwoFaSetupModal';

interface Props {
  data:             PartenaireData | null;
  saving:           boolean;
  dirty:            () => void;
  markClean:        () => void;
  saveTrigger:      number;
  onSaveSecurite:   (body: { twoFaEnabled: boolean; twoFaMethod?: string | null }) => Promise<void>;
  onChangePassword: (current: string, next: string, confirm: string) => Promise<void>;
  onLogout:         () => void;
  onToast:          (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function SecSecurite({
  data, saving, dirty, markClean, saveTrigger,
  onSaveSecurite, onChangePassword, onLogout, onToast
}: Props) {
  const { t } = useTranslation();
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew,     setPwdNew]     = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdScore,   setPwdScore]   = useState(0);
  const [twoFa,      setTwoFa]      = useState(false);
  const [twoFaMethod,setTwoFaMethod]= useState('totp');
  const [show2fa,    setShow2fa]    = useState(false);

  useEffect(() => {
    if (!data) return;
    setTwoFa(data.twoFaEnabled ?? false);
    setTwoFaMethod(data.twoFaMethod ?? 'totp');
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

  const PWD_COLORS = ['', s.pw1, s.pw2, s.pw3, s.pw4];

  async function handleSave() {
    /* Changement de mot de passe si les champs sont remplis */
    if (pwdCurrent && pwdNew) {
      if (pwdNew !== pwdConfirm) {
        onToast(t('partenaireParametres.secSecurite.toasts.pwdMismatch'), 'w');
        return;
      }
      try {
        await onChangePassword(pwdCurrent, pwdNew, pwdConfirm);
        setPwdCurrent(''); setPwdNew(''); setPwdConfirm(''); setPwdScore(0);
        onToast(t('partenaireParametres.secSecurite.toasts.pwdUpdated'), 's');
      } catch {
        onToast(t('partenaireParametres.secSecurite.toasts.pwdIncorrect'), 'w');
        return;
      }
    }
    /* Activation 2FA : passe par POST /auth/2fa/setup + /confirm (TwoFaService),
     * qui exige un code TOTP valide avant d'activer réellement — l'ancien
     * chemin direct (twoFaEnabled:true) est désormais rejeté côté backend.
     * Seule la méthode 'totp' est réellement implémentée (voir toggle SMS
     * désactivé ci-dessous) — cette condition ne peut donc plus être
     * atteinte avec twoFaMethod==='sms'. */
    if (twoFa && twoFaMethod === 'totp' && !data?.twoFaEnabled) {
      setShow2fa(true);
      return;
    }
    /* Paramètres 2FA (uniquement désactivation ou re-sauvegarde inchangée) */
    try {
      await onSaveSecurite({ twoFaEnabled: twoFa, twoFaMethod: twoFa ? twoFaMethod : null });
      markClean();
      onToast(t('partenaireParametres.secSecurite.toasts.securiteSaved'), 's');
    } catch {
      onToast(t('partenaireParametres.secSecurite.toasts.error'), 'w');
    }
  }

  return (
    <>
      {/* Mot de passe */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-lock" /> {t('partenaireParametres.secSecurite.pwdCard.title')}</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.fg}>
            <label className={s.fl}>{t('partenaireParametres.secSecurite.pwdCard.currentLabel')}</label>
            <input className={s.fin} type="password" value={pwdCurrent}
              onChange={e => { setPwdCurrent(e.target.value); dirty(); }} placeholder="••••••••" />
          </div>
          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>{t('partenaireParametres.secSecurite.pwdCard.newLabel')}</label>
              <input className={s.fin} type="password" value={pwdNew}
                onChange={e => { setPwdNew(e.target.value); dirty(); checkPwd(e.target.value); }} placeholder="••••••••" />
            </div>
            <div className={s.fg}>
              <label className={s.fl}>{t('partenaireParametres.secSecurite.pwdCard.confirmLabel')}</label>
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
            {pwdNew
              ? t('partenaireParametres.secSecurite.pwdCard.forceLabel', { label: t(`partenaireParametres.secSecurite.pwdCard.levels.${pwdScore}`) })
              : t('partenaireParametres.secSecurite.pwdCard.forceHint')}
          </div>
        </div>
      </div>

      {/* 2FA */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-shield-halved" /> {t('partenaireParametres.secSecurite.twoFaCard.title')}</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.trow}>
            <div className={s.trowIc}><i className="fas fa-mobile-screen" /></div>
            <div className={s.trowMain}>
              <div className={s.trowT}>
                {t('partenaireParametres.secSecurite.twoFaCard.smsTitle')} <span className={s.flOpt}>{t('partenaireParametres.secSecurite.twoFaCard.bientotDisponible')}</span>
              </div>
              <div className={s.trowD}>{t('partenaireParametres.secSecurite.twoFaCard.smsDesc')}</div>
            </div>
            {/* BUG CORRIGÉ — ce toggle activait en réalité la 2FA par
             * application (TOTP) sans jamais envoyer le moindre SMS : aucune
             * infrastructure d'envoi de code par SMS n'existe côté backend.
             * Désactivé plutôt que de continuer à tromper l'utilisateur sur
             * la méthode réellement activée. */}
            <div className={s.toggle} style={{ opacity: .4, cursor: 'not-allowed' }} role="switch" aria-disabled="true" />
          </div>
          <div className={s.trow}>
            <div className={s.trowIc}><i className="fas fa-key" /></div>
            <div className={s.trowMain}>
              <div className={s.trowT}>{t('partenaireParametres.secSecurite.twoFaCard.appTitle')}</div>
              <div className={s.trowD}>{t('partenaireParametres.secSecurite.twoFaCard.appDesc')}</div>
            </div>
            <div className={`${s.toggle} ${twoFa && twoFaMethod === 'totp' ? s.toggleOn : ''}`}
              onClick={() => { setTwoFa(!twoFa); setTwoFaMethod('totp'); dirty(); }} role="switch" />
          </div>
        </div>
      </div>

      {/* Sessions actives
       * BUG CORRIGÉ — cette carte affichait 2 lignes 100% inventées
       * ("Android · Conakry", "Windows · Conakry") avec un bouton
       * "Déconnecter" qui ne faisait qu'un toast local, sans jamais rien
       * révoquer côté serveur. Shoneya n'autorise qu'UNE SEULE session
       * active par compte (une nouvelle connexion remplace la précédente,
       * voir SessionService) — il ne peut donc jamais exister plusieurs
       * appareils "actifs" à lister : on affiche la vraie session actuelle
       * (device/navigateur/IP réels) et le bouton réutilise la vraie
       * déconnexion (POST /auth/logout, déjà testée en production). */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-desktop" /> {t('partenaireParametres.secSecurite.sessionCard.title')}</div>
        </div>
        <div className={s.fcBody}>
          {data?.currentSession ? (
            <div className={s.sess}>
              <div className={s.sessIc}>
                <i className={`fas ${data.currentSession.device === 'Android' || data.currentSession.device === 'iOS' ? 'fa-mobile-screen' : 'fa-laptop'}`} />
              </div>
              <div className={s.sessMain}>
                <div className={s.sessNm}>
                  {data.currentSession.device} <span className={s.sessCur}>{t('partenaireParametres.secSecurite.sessionCard.cetAppareil')}</span>
                </div>
                <div className={s.sessMeta}>
                  {data.currentSession.browser} · {t('partenaireParametres.secSecurite.sessionCard.actifMaintenant')}
                  {data.currentSession.ipAddress ? ` · ${data.currentSession.ipAddress}` : ''}
                </div>
              </div>
              <button
                className={s.sessOut}
                onClick={() => { onToast(t('partenaireParametres.secSecurite.toasts.loggingOut'), 'i'); onLogout(); }}
              >
                {t('partenaireParametres.secSecurite.sessionCard.deconnecterBtn')}
              </button>
            </div>
          ) : (
            <div className={s.sessMeta}>{t('partenaireParametres.secSecurite.sessionCard.unavailable')}</div>
          )}
        </div>
      </div>

      {show2fa && (
        <TwoFaSetupModal
          onClose={() => setShow2fa(false)}
          onEnabled={() => {
            setTwoFaMethod('totp');
            markClean();
            onToast(t('partenaireParametres.secSecurite.toasts.twoFaEnabled'), 's');
          }}
        />
      )}
    </>
  );
}
