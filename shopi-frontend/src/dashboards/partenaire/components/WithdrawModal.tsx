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
      onToast(`Retrait de ${fmtGnf(amountNum)} envoyé`, 's');
      onClose();
    } catch (err: any) {
      onToast(err?.message ?? 'Erreur lors du retrait', 'w');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>
        <div className={styles.head}>
          <div className={styles.title}>Retirer mes commissions</div>
          <div className={styles.sub}>Solde disponible : {fmtGnf(balance)}</div>
        </div>
        <div className={styles.body}>
          <div className={styles.fld}>
            <label className={styles.lbl}>Montant à retirer (GNF)</label>
            <input
              className={styles.in}
              type="number"
              min={1}
              max={balance}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`Max. ${balance.toLocaleString('fr-FR')}`}
              autoFocus
            />
            {amount.trim() !== '' && !valid && (
              <div style={{ fontSize: 11, color: 'var(--rose, #E11D48)', marginTop: 6 }}>
                {amountNum > balance ? 'Montant supérieur au solde disponible' : 'Montant invalide'}
              </div>
            )}
          </div>
          <button className={styles.btn} onClick={submit} disabled={busy || !valid}>
            {busy
              ? <><i className="fas fa-spinner fa-spin" /> Envoi…</>
              : <><i className="fas fa-arrow-up-from-bracket" /> Confirmer le retrait</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
