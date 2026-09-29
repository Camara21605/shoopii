/* ================================================================
 * FICHIER : sections/params/SecPaiement.tsx
 * Section "Paiement" — portefeuille réel du partenaire (commissions).
 *
 * BUG CORRIGÉ — la section fonctionnait « en mode local » : moyens de
 * paiement, fréquence de virement, NIF… saisis ici n'étaient enregistrés
 * NULLE PART (aucune colonne côté serveur), tout en affichant « enregistré ».
 * Les commissions du partenaire arrivent pourtant bien dans son portefeuille
 * (GET /wallet, voir PartenaireDashboardService.getCommissions) : la section
 * affiche désormais ce portefeuille réel — solde retirable, fonds en attente,
 * moyens de retrait — et mène à la page « Paiements » (retraits, historique).
 * ================================================================ */

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../shared/services/apiFetch';
import s from '../../styles/ParamsShared.module.css';

interface Props {
  onToast:            (msg: string, type?: 's' | 'i' | 'w') => void;
  /** Ouvre la page « Paiements » (portefeuille complet : retraits, historique) */
  onOuvrirPaiements?: () => void;
}

interface WalletMethod { id: string; type: string; label: string; number: string; isDefault: boolean }
interface WalletSummary {
  withdrawableBalance?: number;
  balance:              number;
  settlementLocked?:    number;
  dailyWithdrawLimit:   number;
  todayWithdrawAmount:  number;
  paymentMethods:       WalletMethod[];
}

const METHOD_ICON: Record<string, string> = {
  orange_money: 'fa-mobile-screen', mtn_money: 'fa-mobile-screen', kulu: 'fa-mobile-screen',
  paycard: 'fa-credit-card', card: 'fa-credit-card', bank: 'fa-building-columns', cash: 'fa-money-bill',
};
const masquer = (num: string) => { const d = num.replace(/\s+/g, ''); return d.length > 4 ? `•••• ${d.slice(-4)}` : num; };
const gnf = (n: number) => `${Math.round(n || 0).toLocaleString('fr-FR')} GNF`;

export default function SecPaiement({ onToast, onOuvrirPaiements }: Props) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;
    apiFetch<WalletSummary>('/wallet')
      .then(w => { if (!annule) setWallet(w); })
      .catch(() => { if (!annule) { setErreur(true); onToast('Portefeuille momentanément indisponible.', 'w'); } });
    return () => { annule = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retirable = wallet ? (wallet.withdrawableBalance ?? wallet.balance) : 0;
  const plafondRestant = wallet && wallet.dailyWithdrawLimit > 0
    ? Math.max(0, wallet.dailyWithdrawLimit - wallet.todayWithdrawAmount) : null;

  const tuile = (label: string, valeur: string, fort = false) => (
    <div style={{ background: fort ? 'var(--tl-bg, var(--g50))' : 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-lg, 14px)', padding: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: fort ? 22 : 18, fontWeight: 800, color: 'var(--t1)', marginTop: 4 }}>{valeur}</div>
    </div>
  );

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div>
          <div className={s.fcTtl}><i className="fas fa-wallet" /> Portefeuille & commissions</div>
          <div className={s.fcSub}>Vos commissions sont créditées automatiquement sur votre portefeuille Shoneya.</div>
        </div>
      </div>
      <div className={s.fcBody}>
        {erreur ? (
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>Portefeuille momentanément indisponible. Réessayez plus tard.</div>
        ) : !wallet ? (
          <div style={{ textAlign: 'center', color: 'var(--t3)', padding: 18 }}><i className="fas fa-spinner fa-spin" /></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              {tuile('Solde retirable', gnf(retirable), true)}
              {!!wallet.settlementLocked && tuile('En attente', gnf(wallet.settlementLocked))}
              {plafondRestant !== null && tuile('Retrait encore possible aujourd’hui', gnf(plafondRestant))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', margin: '16px 0 8px' }}>Moyens de retrait</div>
            {wallet.paymentMethods.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>Aucun moyen de retrait enregistré — ajoutez-en un depuis la page Paiements.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {wallet.paymentMethods.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md, 10px)' }}>
                    <i className={`fas ${METHOD_ICON[m.type] ?? 'fa-wallet'}`} style={{ width: 18, textAlign: 'center', color: 'var(--t2)' }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{m.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{masquer(m.number)}</span>
                    {m.isDefault && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--emerald, #059669)' }}>Par défaut</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {onOuvrirPaiements && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={onOuvrirPaiements}
              style={{ background: 'var(--btn, #111113)', color: '#fff', border: 'none', borderRadius: 'var(--pill, 999px)',
                padding: '11px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-wallet" /> Retirer / voir l’historique
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
