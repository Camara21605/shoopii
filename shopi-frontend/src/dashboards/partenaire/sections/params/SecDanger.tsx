/* ================================================================
 * FICHIER : sections/params/SecDanger.tsx
 * Section "Zone danger" — suspension et suppression du compte.
 * Actions IRRÉVERSIBLES — confirmation modale avec mot de passe.
 * API :
 *   onSuspendre(password) → PATCH  /dashboard/partenaire/parametres/danger/pause
 *   onSupprimer(password) → DELETE /dashboard/partenaire/parametres/danger/supprimer
 * ================================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../../styles/ParamsShared.module.css';

interface Props {
  onSuspendre: (password: string) => Promise<void>;
  onSupprimer: (password: string) => Promise<void>;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
  saving:      boolean;
}

export default function SecDanger({ onSuspendre, onSupprimer, onToast, saving }: Props) {
  const { t } = useTranslation();
  const [confirm,  setConfirm]  = useState<'suspendre' | 'supprimer' | null>(null);
  const [password, setPassword] = useState('');
  const [pwdError, setPwdError] = useState('');

  function openConfirm(action: 'suspendre' | 'supprimer') {
    setConfirm(action);
    setPassword('');
    setPwdError('');
  }

  function closeConfirm() {
    setConfirm(null);
    setPassword('');
    setPwdError('');
  }

  async function handleConfirm() {
    if (!confirm) return;
    if (!password.trim()) {
      setPwdError(t('partenaireParametres.secDanger.modal.pwdRequired'));
      return;
    }
    setPwdError('');
    try {
      if (confirm === 'suspendre') {
        await onSuspendre(password);
        onToast(t('partenaireParametres.secDanger.pausedToast'), 's');
      } else {
        await onSupprimer(password);
        onToast(t('partenaireParametres.secDanger.deleteScheduledToast'), 's');
      }
      closeConfirm();
    } catch (err: any) {
      /* Le backend renvoie 401 si le mot de passe est incorrect */
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('refusée')) {
        setPwdError(t('partenaireParametres.secDanger.modal.pwdIncorrect'));
      } else {
        onToast(t('partenaireParametres.secDanger.genericErrorToast'), 'w');
        closeConfirm();
      }
    }
  }

  return (
    <>
      <div className={`${s.fc} ${s.fcDanger}`}>
        <div className={`${s.fcHd} ${s.fcHdDanger}`}>
          <div>
            <div className={`${s.fcTtl} ${s.fcTtlDanger}`}>
              <i className="fas fa-triangle-exclamation" /> {t('partenaireParametres.secDanger.title')}
            </div>
            <div className={s.fcSub}>{t('partenaireParametres.secDanger.sub')}</div>
          </div>
        </div>
        <div className={s.fcBody}>
          <div className={s.dangerRow}>
            <div className={s.dangerMain}>
              <div className={s.dangerT}>{t('partenaireParametres.secDanger.pauseRow.t')}</div>
              <div className={s.dangerD}>
                {t('partenaireParametres.secDanger.pauseRow.d')}
              </div>
            </div>
            <button
              style={{ background: 'var(--g100)', color: 'var(--t2)', fontSize: 12.5, fontWeight: 700, padding: '10px 18px', borderRadius: 'var(--pill)' }}
              onClick={() => openConfirm('suspendre')}
              disabled={saving}
            >
              {t('partenaireParametres.secDanger.pauseRow.btn')}
            </button>
          </div>

          <div className={s.dangerRow}>
            <div className={s.dangerMain}>
              <div className={s.dangerT}>{t('partenaireParametres.secDanger.deleteRow.t')}</div>
              <div className={s.dangerD}>
                {t('partenaireParametres.secDanger.deleteRow.d')}
              </div>
            </div>
            <button
              className={s.btnDanger}
              onClick={() => openConfirm('supprimer')}
              disabled={saving}
            >
              {t('partenaireParametres.secDanger.deleteRow.btn')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Modale de confirmation avec mot de passe ── */}
      {confirm && (
        <div className={s.mbg} onClick={e => { if (e.target === e.currentTarget) closeConfirm(); }}>
          <div className={s.cmodal}>
            <div className={s.cmodalIc}>
              <i className="fas fa-triangle-exclamation" />
            </div>

            <h3>
              {confirm === 'suspendre' ? t('partenaireParametres.secDanger.modal.pauseTitle') : t('partenaireParametres.secDanger.modal.deleteTitle')}
            </h3>
            <p>
              {confirm === 'suspendre'
                ? t('partenaireParametres.secDanger.modal.pauseDesc')
                : t('partenaireParametres.secDanger.modal.deleteDesc')}
            </p>

            {/* Champ mot de passe obligatoire */}
            <div style={{ marginTop: 18, textAlign: 'left' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 7 }}>
                {t('partenaireParametres.secDanger.modal.pwdLabel')}
              </label>
              <input
                className={s.fin}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setPwdError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                autoFocus
                style={{ borderColor: pwdError ? 'var(--red)' : undefined }}
              />
              {pwdError && (
                <p style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 6 }}>
                  <i className="fas fa-circle-exclamation" style={{ marginRight: 5 }} />
                  {pwdError}
                </p>
              )}
            </div>

            <div className={s.cmodalBtns}>
              <button className={s.cmCancel} onClick={closeConfirm} disabled={saving}>
                {t('partenaireParametres.secDanger.modal.cancelBtn')}
              </button>
              <button
                className={s.cmConfirm}
                onClick={handleConfirm}
                disabled={saving || !password.trim()}
              >
                {saving
                  ? <><i className="fas fa-spinner fa-spin" /> {t('partenaireParametres.secDanger.modal.enCours')}</>
                  : confirm === 'suspendre' ? t('partenaireParametres.secDanger.modal.confirmPauseBtn') : t('partenaireParametres.secDanger.modal.confirmDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
