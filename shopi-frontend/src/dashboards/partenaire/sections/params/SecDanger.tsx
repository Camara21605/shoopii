/* ================================================================
 * FICHIER : sections/params/SecDanger.tsx
 * Section "Zone danger" — suspension et suppression du compte.
 * Actions IRRÉVERSIBLES — confirmation modale avec mot de passe.
 * API :
 *   onSuspendre(password) → PATCH  /dashboard/partenaire/parametres/danger/pause
 *   onSupprimer(password) → DELETE /dashboard/partenaire/parametres/danger/supprimer
 * ================================================================ */

import { useState } from 'react';
import s from '../../styles/ParamsShared.module.css';

interface Props {
  onSuspendre: (password: string) => Promise<void>;
  onSupprimer: (password: string) => Promise<void>;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
  saving:      boolean;
}

export default function SecDanger({ onSuspendre, onSupprimer, onToast, saving }: Props) {
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
      setPwdError('Le mot de passe est obligatoire pour confirmer cette action.');
      return;
    }
    setPwdError('');
    try {
      if (confirm === 'suspendre') {
        await onSuspendre(password);
        onToast('⏸️ Compte mis en pause', 's');
      } else {
        await onSupprimer(password);
        onToast('Compte programmé pour suppression', 's');
      }
      closeConfirm();
    } catch (err: any) {
      /* Le backend renvoie 401 si le mot de passe est incorrect */
      const msg = err?.message ?? '';
      if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('refusée')) {
        setPwdError('Mot de passe incorrect. Veuillez réessayer.');
      } else {
        onToast('❌ Opération impossible. Vérifiez votre connexion.', 'w');
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
              <i className="fas fa-triangle-exclamation" /> Zone danger
            </div>
            <div className={s.fcSub}>Actions irréversibles. Procédez avec prudence.</div>
          </div>
        </div>
        <div className={s.fcBody}>
          <div className={s.dangerRow}>
            <div className={s.dangerMain}>
              <div className={s.dangerT}>Mettre mon compte en pause</div>
              <div className={s.dangerD}>
                Suspend temporairement votre activité de partenaire. Vos acteurs et commissions sont conservés.
              </div>
            </div>
            <button
              style={{ background: 'var(--g100)', color: 'var(--t2)', fontSize: 12.5, fontWeight: 700, padding: '10px 18px', borderRadius: 'var(--pill)' }}
              onClick={() => openConfirm('suspendre')}
              disabled={saving}
            >
              Mettre en pause
            </button>
          </div>

          <div className={s.dangerRow}>
            <div className={s.dangerMain}>
              <div className={s.dangerT}>Supprimer mon compte partenaire</div>
              <div className={s.dangerD}>
                Toutes vos données seront définitivement effacées. Cette action ne peut pas être annulée.
              </div>
            </div>
            <button
              className={s.btnDanger}
              onClick={() => openConfirm('supprimer')}
              disabled={saving}
            >
              Supprimer
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
              {confirm === 'suspendre' ? 'Mettre en pause ?' : 'Supprimer votre compte ?'}
            </h3>
            <p>
              {confirm === 'suspendre'
                ? 'Votre activité sera suspendue. Vous pourrez la réactiver depuis ce même écran à tout moment.'
                : 'Cette action est irréversible. Vos acteurs recrutés, commissions et historique seront définitivement perdus.'}
            </p>

            {/* Champ mot de passe obligatoire */}
            <div style={{ marginTop: 18, textAlign: 'left' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 7 }}>
                Confirmez avec votre mot de passe
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
                Annuler
              </button>
              <button
                className={s.cmConfirm}
                onClick={handleConfirm}
                disabled={saving || !password.trim()}
              >
                {saving
                  ? <><i className="fas fa-spinner fa-spin" /> En cours…</>
                  : confirm === 'suspendre' ? 'Mettre en pause' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
