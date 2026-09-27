/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/PaiementSection.tsx
 * Section 6 — Paiement & Facturation
 *
 * CORRIGÉ — « canal de réception », « numéro », « fréquence des virements » et
 * « montant minimum » étaient enregistrés sur la fiche entreprise mais lus
 * NULLE PART : les vrais retraits passent par le Portefeuille (GET /wallet),
 * qui a ses propres moyens de retrait (avec un moyen par défaut). Et aucun
 * virement automatique n'existe : fréquence et minimum ne promettaient rien
 * de réel. Cette section affiche maintenant les VRAIES données du Portefeuille
 * (solde retirable, moyens de retrait, plafond du jour) avec un lien direct
 * pour les gérer, et garde les informations fiscales (NIF, RCCM, raison
 * sociale), consultées par l'administration.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import { apiFetch } from '../../../../shared/services/apiFetch';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: ToastType) => void;
  savePaiement: (b: Partial<ParametresData>) => Promise<void>;
}

interface WalletMethod { id: string; type: string; label: string; number: string; isDefault: boolean }
interface WalletSummary {
  withdrawableBalance: number;
  settlementLocked:    number;
  dailyWithdrawLimit:  number;
  todayWithdrawAmount: number;
  paymentMethods:      WalletMethod[];
}

const METHOD_ICON: Record<string, string> = {
  orange_money: 'fa-mobile-screen', mtn_money: 'fa-mobile-screen', kulu: 'fa-mobile-screen',
  paycard: 'fa-credit-card', card: 'fa-credit-card', bank: 'fa-building-columns', cash: 'fa-money-bill',
};
const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;
const masquer = (num: string) => { const d = num.replace(/\s+/g, ''); return d.length > 4 ? `•••• ${d.slice(-4)}` : num; };

export default function PaiementSection({ data, saving, onDirty, onToast, savePaiement }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nif,           setNif]           = useState('');
  const [rccm,          setRccm]          = useState('');
  const [raisonSociale, setRaisonSociale] = useState('');
  const [wallet,        setWallet]        = useState<WalletSummary | null>(null);
  const [walletError,   setWalletError]   = useState(false);

  useEffect(() => {
    if (!data) return;
    setNif(data.nif                     ?? '');
    setRccm(data.rccm                   ?? '');
    setRaisonSociale(data.raisonSociale ?? '');
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<WalletSummary>('/wallet')
      .then(w => { if (!cancelled) setWallet(w); })
      .catch(() => { if (!cancelled) setWalletError(true); });
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    try {
      await savePaiement({ nif: nif.trim(), rccm: rccm.trim().toUpperCase(), raisonSociale: raisonSociale.trim() });
      onToast(t('parametres.paiement.savedToast'), 's');
    } catch (e: unknown) {
      onToast(e instanceof Error && e.message ? `❌ ${e.message}` : t('parametres.paiement.errorToast'), 'e');
    }
  }

  const methods = wallet?.paymentMethods ?? [];
  const resteAujourdhui = wallet ? Math.max(wallet.dailyWithdrawLimit - wallet.todayWithdrawAmount, 0) : 0;

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-credit-card" /> {t('parametres.paiement.title')}</h1>
        <p>{t('parametres.paiement.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.paiement.receptionTitle')} icon="fa-wallet" subtitle={t('parametres.paiement.gainsSubtitle')}>
        {walletError ? (
          <div className={s.hint}><i className="fas fa-circle-exclamation" /> {t('parametres.paiement.walletErreur')}</div>
        ) : !wallet ? (
          <div className={s.hint}><i className="fas fa-spinner fa-spin" /> {t('parametres.paiement.chargement')}</div>
        ) : (
          <>
            <div className={s.grid2}>
              <div style={{ padding:'12px 14px', borderRadius:'var(--r-lg)', background:'var(--g100)', border:'1px solid var(--bdr)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.04em' }}>{t('parametres.paiement.soldeRetirable')}</div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginTop:2 }}>{gnf(wallet.withdrawableBalance)}</div>
                {wallet.settlementLocked > 0 && (
                  <div style={{ fontSize:11.5, color:'var(--t3)', marginTop:2 }}>{t('parametres.paiement.enAttenteReglement', { montant: gnf(wallet.settlementLocked) })}</div>
                )}
              </div>
              <div style={{ padding:'12px 14px', borderRadius:'var(--r-lg)', background:'var(--g100)', border:'1px solid var(--bdr)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.04em' }}>{t('parametres.paiement.plafondJour')}</div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginTop:2 }}>{gnf(resteAujourdhui)}</div>
                <div style={{ fontSize:11.5, color:'var(--t3)', marginTop:2 }}>{t('parametres.paiement.surPlafond', { montant: gnf(wallet.dailyWithdrawLimit) })}</div>
              </div>
            </div>

            <div className={s.fl} style={{ marginTop:16 }}>{t('parametres.paiement.moyensRetrait')}</div>
            {methods.length === 0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:'var(--r-lg)',
                background:'var(--am-bg, rgba(180,83,9,.09))', color:'var(--amber)', fontSize:13, fontWeight:600 }}>
                <i className="fas fa-triangle-exclamation" /> {t('parametres.paiement.aucunMoyen')}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {methods.map(m => (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:'var(--r-lg)', border:'1.5px solid var(--bdr2)' }}>
                    <i className={`fas ${METHOD_ICON[m.type] ?? 'fa-wallet'}`} style={{ color:'var(--t2)', width:16, textAlign:'center' }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{m.label}</div>
                      <div style={{ fontSize:12, color:'var(--t3)', fontFamily:'ui-monospace, monospace' }}>{masquer(m.number)}</div>
                    </div>
                    {m.isDefault && (
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999, background:'var(--em-bg, rgba(4,120,87,.09))', color:'var(--emerald)' }}>
                        {t('parametres.paiement.parDefaut')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className={s.hint} style={{ marginTop:10 }}><i className="fas fa-circle-info" /> {t('parametres.paiement.retraitsInfo')}</div>
            <div className={s.saveRow}>
              <button type="button" className={s.saveBtn} onClick={() => navigate('/dashboard/entreprise/portefeuille')}>
                <i className="fas fa-wallet" /> {t('parametres.paiement.gererPortefeuille')}
              </button>
            </div>
          </>
        )}
      </FormCard>

      <FormCard title={t('parametres.paiement.fiscalesTitle')} icon="fa-building-columns" subtitle={t('parametres.paiement.fiscalesSubtitle')}>
        <div className={s.grid2}>
          <div className={s.fg}><div className={s.fl}>{t('parametres.paiement.nifLabel')}</div><div className={s.fw}><i className={`fas fa-id-card ${s.fi}`} /><input className={s.fin} value={nif} maxLength={50} onChange={e => { setNif(e.target.value); onDirty(); }} placeholder={t('parametres.paiement.nifPlaceholder')} /></div></div>
          <div className={s.fg}><div className={s.fl}>{t('parametres.paiement.rccmLabel')}</div><div className={s.fw}><i className={`fas fa-registered ${s.fi}`} /><input className={s.fin} value={rccm} maxLength={100} onChange={e => { setRccm(e.target.value); onDirty(); }} placeholder="GN-CNK-2024-B-00123" /></div></div>
        </div>
        <div className={s.fg}><div className={s.fl}>{t('parametres.paiement.raisonSocialeLabel')}</div><div className={s.fw}><i className={`fas fa-briefcase ${s.fi}`} /><input className={s.fin} value={raisonSociale} maxLength={255} onChange={e => { setRaisonSociale(e.target.value); onDirty(); }} placeholder={t('parametres.paiement.raisonSocialePlaceholder')} /></div></div>
        <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.paiement.fiscalesHint')}</div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.paiement.sauvegardeEnCours')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.paiement.sauvegarderPaiement')}</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}
