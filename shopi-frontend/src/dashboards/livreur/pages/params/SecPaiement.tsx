/*
 * FICHIER : src/dashboards/livreur/pages/params/SecPaiement.tsx
 * ✅ CONNECTÉ — données chargées + save API
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtGNF } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:        LivreurData | null;
  saving:      boolean;
  dirty:       () => void;
  onPop:       (m: string, t?: string) => void;
  savePaiement:(body: Partial<LivreurData>) => Promise<void>;
}

/* BUG CORRIGÉ — ce tableau était zippé PAR INDEX avec FREQ_VALUES
 * ('daily','weekly','bimonthly','monthly', voir IsIn() du DTO backend) :
 * seulement 3 options étaient affichées ("Instantané" en 3e position)
 * pour 4 valeurs backend réelles — "Instantané" enregistrait donc en
 * réalité 'bimonthly' (aucun rapport), et 'monthly' n'était accessible
 * depuis aucune UI. Chaque fréquence porte maintenant sa vraie valeur
 * backend explicitement — plus aucun zip par position possible. */
function buildVirementFreq(t: (key: string) => string) {
  return [
    { value:'daily',     em:'📅', nm: t('livreurSecPaiement.freq.quotidien.nm'), sub: t('livreurSecPaiement.freq.quotidien.sub'), badge: t('livreurSecPaiement.freq.quotidien.badge'), badgeColor:'var(--emerald)' },
    { value:'weekly',    em:'📆', nm: t('livreurSecPaiement.freq.hebdo.nm'),     sub: t('livreurSecPaiement.freq.hebdo.sub'),     badge: t('livreurSecPaiement.freq.hebdo.badge'),     badgeColor:'var(--emerald)' },
    { value:'bimonthly', em:'🗓️', nm: t('livreurSecPaiement.freq.bimensuel.nm'), sub: t('livreurSecPaiement.freq.bimensuel.sub'), badge: t('livreurSecPaiement.freq.bimensuel.badge'), badgeColor:'var(--emerald)' },
    { value:'monthly',   em:'🌙', nm: t('livreurSecPaiement.freq.mensuel.nm'),   sub: t('livreurSecPaiement.freq.mensuel.sub'),   badge: t('livreurSecPaiement.freq.mensuel.badge'),   badgeColor:'var(--emerald)' },
  ];
}

export default function SecPaiement({ data, saving, dirty, onPop, savePaiement }: Props) {
  const { t } = useTranslation();
  const VIREMENT_FREQ = buildVirementFreq(t);
  const [selFreq, setSelFreq] = useState('weekly');
  const [seuil,   setSeuil]   = useState(50000);

  useEffect(() => {
    if (!data) return;
    setSelFreq(data.virementFrequence ?? 'weekly');
    setSeuil(Number(data.virementSeuil) || 50000);
  }, [data]);

  async function handleSave() {
    try {
      await savePaiement({
        virementFrequence: selFreq,
        virementSeuil:     seuil,
      });
      onPop(t('livreurSecPaiement.toasts.saved'), 's');
    } catch (err: any) {
      onPop(err?.message ?? t('livreurSecPaiement.toasts.saveError'), 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-wallet" /> {t('livreurSecPaiement.header.titre')}</h2>
        <p>{t('livreurSecPaiement.header.sub')}</p>
      </div>

      {/* Fréquence de virement */}
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-calendar-check" /> {t('livreurSecPaiement.freqCard.titre')}</div></div>
        <div className={ps.cb}>
          <div className={ps.radioGroup}>
            {VIREMENT_FREQ.map(f => (
              <div key={f.value} className={`${ps.radioOpt} ${selFreq===f.value ? ps.radioSel : ''}`}
                onClick={() => { setSelFreq(f.value); dirty(); }}>
                <div className={ps.roDot} />
                <span className={ps.roEm}>{f.em}</span>
                <div style={{ flex:1 }}>
                  <div className={ps.roTtl}>{f.nm}</div>
                  <div className={ps.roSub}>{f.sub}</div>
                </div>
                <span className={ps.roBadge} style={{ color: f.badgeColor }}>{f.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wallet */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-coins" /> {t('livreurSecPaiement.walletCard.titre')}</div></div>
        <div className={ps.cb}>
          {/* Solde — depuis l'API */}
          <div style={{ background:'var(--tl-bg)', border:'1px solid rgba(0,0,0,.2)', borderRadius:'var(--r-lg)', padding:18,
            display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--teal)', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:4 }}>
                {t('livreurSecPaiement.walletCard.soldeDisponible')}
              </div>
              <div style={{ fontFamily:'var(--fd)', fontSize:28, fontWeight:800, color:'var(--navy)', letterSpacing:-1 }}>
                {fmtGNF(data?.totalEarnings ?? 0)}
                <span style={{ fontSize:14, fontWeight:400, color:'var(--t3)', marginLeft:6 }}>GNF</span>
              </div>
            </div>
            {/* BUG CORRIGÉ — "Retirer"/"Historique" ne faisaient qu'un
             * toast factice ("Retrait vers Orange Money"…) sans jamais
             * déclencher le moindre virement ni afficher le moindre
             * historique : aucune route de retrait n'existe encore pour
             * le wallet livreur (RevenusPage.tsx, la page revenus, est
             * elle-même en lecture seule). Marqué honnêtement "Bientôt
             * disponible" plutôt que de prétendre fonctionner. */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <button disabled title={t('livreurSecPaiement.walletCard.comingSoon')}
                style={{ background:'var(--g200)', color:'var(--t3)', border:'none', borderRadius:'var(--pill)',
                  padding:'10px 20px', fontSize:12, fontWeight:700, cursor:'not-allowed', display:'flex', alignItems:'center', gap:6 }}>
                <i className="fas fa-money-bill-transfer" /> {t('livreurSecPaiement.walletCard.retirer')}
              </button>
              <button disabled title={t('livreurSecPaiement.walletCard.comingSoon')}
                style={{ background:'var(--white)', color:'var(--t3)', border:'1.5px solid var(--bdr2)',
                  borderRadius:'var(--pill)', padding:'10px 16px', fontSize:12, fontWeight:600, cursor:'not-allowed' }}>
                {t('livreurSecPaiement.walletCard.historique')}
              </button>
              <span style={{ fontSize:9, fontWeight:800, padding:'3px 9px', borderRadius:'var(--pill)', background:'var(--g100)', color:'var(--t3)', border:'1px solid var(--bdr2)', textTransform:'uppercase' as const }}>
                {t('livreurSecPaiement.walletCard.comingSoon')}
              </span>
            </div>
          </div>

          {/* Seuil */}
          <div style={{ marginTop:14 }}>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>{t('livreurSecPaiement.seuil.label')}</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-coins" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} type="number" value={seuil} step={10000} min={0}
                  onChange={e => { setSeuil(+e.target.value); dirty(); }} />
                <span style={{ position:'absolute', right:13, fontSize:12, fontWeight:700, color:'var(--t3)' }}>GNF</span>
              </div>
              <div className={ps.fiHint}>
                <i className="fas fa-circle-info" /> {t('livreurSecPaiement.seuil.hint')}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:8 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecPaiement.saving')}</> : <><i className="fas fa-cloud-arrow-up" /> {t('livreurSecPaiement.saveButton')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}