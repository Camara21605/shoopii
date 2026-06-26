/*
 * FICHIER : src/dashboards/livreur/pages/params/SecPaiement.tsx
 * ✅ CONNECTÉ — données chargées + save API
 */
import React, { useState, useEffect } from 'react';
import { VIREMENT_FREQ, fmtGNF } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:        LivreurData | null;
  saving:      boolean;
  dirty:       () => void;
  onPop:       (m: string, t?: string) => void;
  savePaiement:(body: Partial<LivreurData>) => Promise<void>;
}

// Correspondance index VIREMENT_FREQ → valeur backend
const FREQ_VALUES = ['daily', 'weekly', 'bimonthly', 'monthly'];

export default function SecPaiement({ data, saving, dirty, onPop, savePaiement }: Props) {
  const [selFreq, setSelFreq] = useState(1); // weekly par défaut
  const [seuil,   setSeuil]   = useState(50000);

  useEffect(() => {
    if (!data) return;
    const idx = FREQ_VALUES.indexOf(data.virementFrequence ?? 'weekly');
    if (idx >= 0) setSelFreq(idx);
    setSeuil(Number(data.virementSeuil) || 50000);
  }, [data]);

  async function handleSave() {
    try {
      await savePaiement({
        virementFrequence: FREQ_VALUES[selFreq],
        virementSeuil:     seuil,
      });
      onPop('✅ Paramètres de paiement sauvegardés', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-wallet" /> Modes de paiement</h2>
        <p>Configurez comment recevoir vos gains.</p>
      </div>

      {/* Fréquence de virement */}
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-calendar-check" /> Fréquence de virement</div></div>
        <div className={ps.cb}>
          <div className={ps.radioGroup}>
            {VIREMENT_FREQ.map((f, i) => (
              <div key={f.nm} className={`${ps.radioOpt} ${selFreq===i ? ps.radioSel : ''}`}
                onClick={() => { setSelFreq(i); dirty(); }}>
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
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-coins" /> Wallet Shopi</div></div>
        <div className={ps.cb}>
          {/* Solde — depuis l'API */}
          <div style={{ background:'var(--tl-bg)', border:'1px solid rgba(14,116,144,.2)', borderRadius:'var(--r-lg)', padding:18,
            display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--teal)', fontWeight:700, textTransform:'uppercase', letterSpacing:.5, marginBottom:4 }}>
                Solde disponible
              </div>
              <div style={{ fontFamily:'var(--fd)', fontSize:28, fontWeight:800, color:'var(--navy)', letterSpacing:-1 }}>
                {fmtGNF(data?.totalEarnings ?? 0)}
                <span style={{ fontSize:14, fontWeight:400, color:'var(--t3)', marginLeft:6 }}>GNF</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button onClick={() => onPop('💸 Retrait vers Orange Money', 'i')}
                style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                  padding:'10px 20px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <i className="fas fa-money-bill-transfer" /> Retirer
              </button>
              <button onClick={() => onPop("📊 Voir l'historique", 'i')}
                style={{ background:'var(--white)', color:'var(--t2)', border:'1.5px solid var(--bdr2)',
                  borderRadius:'var(--pill)', padding:'10px 16px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                Historique
              </button>
            </div>
          </div>

          {/* Seuil */}
          <div style={{ marginTop:14 }}>
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>Seuil de virement automatique</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-coins" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <input className={ps.fiInput} type="number" value={seuil} step={10000} min={0}
                  onChange={e => { setSeuil(+e.target.value); dirty(); }} />
                <span style={{ position:'absolute', right:13, fontSize:12, fontWeight:700, color:'var(--t3)' }}>GNF</span>
              </div>
              <div className={ps.fiHint}>
                <i className="fas fa-circle-info" /> En dessous de ce seuil, vos gains s'accumulent dans votre Wallet
              </div>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:8 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder le paiement</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}