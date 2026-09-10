/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/WithdrawModal.tsx
 *
 * Modale de retrait des commissions — appelle réellement
 * POST /wallet/withdraw (voir shared/services/walletApi.ts).
 *
 * BUG CORRIGÉ — le bouton "Retirer" de CommissionsPage.tsx affichait un
 * toast de succès factice ("Demande de retrait envoyée") sans jamais
 * appeler le backend : une fausse confirmation sur une action financière.
 * ================================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/GenerateCodeModal.module.css';
import { withdrawWallet } from '@/shared/services/walletApi';
import { fmtGnf } from '../data/partenaireData';

interface Props {
  balance: number;
  onClose: () => void;
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
  onSuccess: (newBalance: number) => void;
}

export default function WithdrawModal({ balance, onClose, onToast, onSuccess }: Props) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [busy, setBusy]     = useState(false);

  const amountNum = Number(amount);
  const valid = amount.trim() !== '' && amountNum > 0 && amountNum <= balance;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      const res = await withdrawWallet({ amount: amountNum });
      onSuccess(res.balance);
      onToast(t('partenaireCommissions.withdrawModal.successToast', { amount: fmtGnf(amountNum) }), 's');
      onClose();
    } catch (err: any) {
      onToast(err?.message ?? t('partenaireCommissions.withdrawModal.errorToast'), 'w');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>
        <div className={styles.head}>
          <div className={styles.title}>{t('partenaireCommissions.withdrawModal.title')}</div>
          <div className={styles.sub}>{t('partenaireCommissions.withdrawModal.soldeDisponible', { balance: fmtGnf(balance) })}</div>
        </div>
        <div className={styles.body}>
          <div className={styles.fld}>
            <label className={styles.lbl}>{t('partenaireCommissions.withdrawModal.montantLabel')}</label>
            <input
              className={styles.in}
              type="number"
              min={1}
              max={balance}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={t('partenaireCommissions.withdrawModal.montantPlaceholder', { max: balance.toLocaleString('fr-FR') })}
              autoFocus
            />
            {amount.trim() !== '' && !valid && (
              <div style={{ fontSize: 11, color: 'var(--rose, #E11D48)', marginTop: 6 }}>
                {amountNum > balance ? t('partenaireCommissions.withdrawModal.erreurSuperieur') : t('partenaireCommissions.withdrawModal.erreurInvalide')}
              </div>
            )}
          </div>
          <button className={styles.btn} onClick={submit} disabled={busy || !valid}>
            {busy
              ? <><i className="fas fa-spinner fa-spin" /> {t('partenaireCommissions.withdrawModal.envoi')}</>
              : <><i className="fas fa-arrow-up-from-bracket" /> {t('partenaireCommissions.withdrawModal.confirmerBtn')}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
