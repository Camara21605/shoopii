/*
 * FICHIER : src/dashboards/livreur/pages/params/SecPaiement.tsx
 * ✅ CONNECTÉ — résumé RÉEL du portefeuille (GET /wallet)
 *
 * BUGS CORRIGÉS (même correctif que Paramètres > Paiement de l'entreprise) :
 *   - le « solde disponible » affiché était le TOTAL des gains depuis toujours
 *     (totalEarnings), pas l'argent réellement disponible dans le portefeuille ;
 *     le montant s'affichait en plus « … GNF GNF » ;
 *   - « Retirer » / « Historique » marqués « bientôt disponible » alors que la
 *     page Portefeuille (retraits réels, historique) existe → lien direct ;
 *   - « Fréquence des virements » et « Seuil » retirés : enregistrés mais
 *     exécutés nulle part (aucun virement automatique n'existe).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import { apiFetch } from '../../../../shared/services/apiFetch';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data?:   LivreurData | null;
  onPop:   (m: string, t?: string) => void;
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

export default function SecPaiement({ onPop }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [wallet,      setWallet]      = useState<WalletSummary | null>(null);
  const [walletError, setWalletError] = useState(false);
  const gnf = (n: number) => `${Math.round(n || 0).toLocaleString(i18n.language)} GNF`;

  useEffect(() => {
    let cancelled = false;
    apiFetch<WalletSummary>('/wallet')
      .then(w => { if (!cancelled) setWallet(w); })
      .catch(() => { if (!cancelled) { setWalletError(true); onPop(t('livreurSecPaiement.wallet.erreur'), 'e'); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retirable = wallet ? (wallet.withdrawableBalance ?? wallet.balance) : 0;
  const plafondRestant = wallet && wallet.dailyWithdrawLimit > 0
    ? Math.max(0, wallet.dailyWithdrawLimit - wallet.todayWithdrawAmount) : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-wallet" /> {t('livreurSecPaiement.header.titre')}</h2>
        <p>{t('livreurSecPaiement.wallet.sub')}</p>
      </div>

      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-coins" /> {t('livreurSecPaiement.walletCard.titre')}</div></div>
        <div className={ps.cb}>
          {walletError ? (
            <div style={{ fontSize:13, color:'var(--t3)' }}>{t('livreurSecPaiement.wallet.erreur')}</div>
          ) : !wallet ? (
            <div style={{ textAlign:'center', color:'var(--t3)', padding:18 }}><i className="fas fa-spinner fa-spin" /></div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))', gap:10 }}>
                <div style={{ background:'var(--tl-bg)', borderRadius:'var(--r-lg)', padding:16 }}>
                  <div style={{ fontSize:11, color:'var(--teal)', fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>{t('livreurSecPaiement.wallet.retirable')}</div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:24, fontWeight:800, color:'var(--navy)', marginTop:4 }}>{gnf(retirable)}</div>
                </div>
                {!!wallet.settlementLocked && (
                  <div style={{ background:'var(--g50)', border:'1px solid var(--bdr)', borderRadius:'var(--r-lg)', padding:16 }}>
                    <div style={{ fontSize:11, color:'var(--t3)', fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>{t('livreurSecPaiement.wallet.enAttente')}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginTop:4 }}>{gnf(wallet.settlementLocked)}</div>
                  </div>
                )}
                {plafondRestant !== null && (
                  <div style={{ background:'var(--g50)', border:'1px solid var(--bdr)', borderRadius:'var(--r-lg)', padding:16 }}>
                    <div style={{ fontSize:11, color:'var(--t3)', fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>{t('livreurSecPaiement.wallet.plafond')}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginTop:4 }}>{gnf(plafondRestant)}</div>
                  </div>
                )}
              </div>

              <div className={ps.fiLabel} style={{ marginTop:16, marginBottom:8 }}>{t('livreurSecPaiement.wallet.moyens')}</div>
              {wallet.paymentMethods.length === 0 ? (
                <div style={{ fontSize:12.5, color:'var(--t3)' }}>{t('livreurSecPaiement.wallet.aucunMoyen')}</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {wallet.paymentMethods.map(m => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:'1px solid var(--bdr)', borderRadius:'var(--r-md)' }}>
                      <i className={`fas ${METHOD_ICON[m.type] ?? 'fa-wallet'}`} style={{ color:'var(--teal)', width:18, textAlign:'center' }} />
                      <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--t1)' }}>{m.label}</span>
                      <span style={{ fontSize:12, color:'var(--t3)' }}>{masquer(m.number)}</span>
                      {m.isDefault && <span style={{ fontSize:10, fontWeight:700, color:'var(--emerald)' }}>{t('livreurSecPaiement.wallet.parDefaut')}</span>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
            <button type="button" onClick={() => navigate('/dashboard/livreur/wallet')}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'12px 24px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
              <i className="fas fa-wallet" /> {t('livreurSecPaiement.wallet.ouvrir')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
