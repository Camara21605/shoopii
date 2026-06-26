/*
 * FICHIER : src/dashboards/livreur/pages/params/SecVitesses.tsx
 * ✅ CONNECTÉ — données chargées + save API
 */
import React, { useState, useEffect } from 'react';
import { SPEED_MULS, fmtGNF } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

const SPEEDS_DEFAULT = [
  { id:'eco',      em:'🐢', nm:'Éco',      mul:'×1.0', color:'#84CC16', on:true  },
  { id:'standard', em:'🛵', nm:'Standard', mul:'×1.3', color:'#F59E0B', on:true  },
  { id:'express',  em:'⚡', nm:'Express',  mul:'×1.8', color:'#3B82F6', on:true  },
  { id:'ultra',    em:'🚀', nm:'Ultra',    mul:'×2.5', color:'#DC2626', on:false },
];

interface Props {
  data:         LivreurData | null;
  saving:       boolean;
  dirty:        () => void;
  onPop:        (m: string, t?: string) => void;
  saveVitesses: (body: Partial<LivreurData>) => Promise<void>;
}

export default function SecVitesses({ data, saving, dirty, onPop, saveVitesses }: Props) {
  const [speeds,   setSpeeds]   = useState(SPEEDS_DEFAULT.map(s => ({ ...s })));
  const [base,     setBase]     = useState(15000);
  const [perKm,    setPerKm]    = useState(1500);
  const [lourd,    setLourd]    = useState(5000);
  const [nocturne, setNocturne] = useState(30);

  useEffect(() => {
    if (!data) return;
    setBase(Number(data.tarifBase)          || 15000);
    setPerKm(Number(data.tarifParKm)        || 1500);
    setLourd(Number(data.supplementLourd)   || 5000);
    setNocturne(data.majorationNocturne     ?? 30);
    if (data.vitessesActives) {
      setSpeeds(prev => prev.map(s => ({ ...s, on: data.vitessesActives![s.id] ?? s.on })));
    }
  }, [data]);

  function toggleSpeed(id: string) { setSpeeds(prev => prev.map(s => s.id===id ? {...s,on:!s.on} : s)); dirty(); }

  async function handleSave() {
    const vitessesActives = Object.fromEntries(speeds.map(s => [s.id, s.on]));
    try {
      await saveVitesses({ vitessesActives, tarifBase:base, tarifParKm:perKm, supplementLourd:lourd, majorationNocturne:nocturne });
      onPop('✅ Grille tarifaire sauvegardée', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-gauge-high" /> Vitesses & Tarification</h2>
        <p>Modes de livraison proposés et tarifs de base. Les multiplicateurs sont appliqués automatiquement par Shopi.</p>
      </div>

      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-motorcycle" /> Modes proposés</div>
          <span style={{ fontSize:11, color:'var(--t3)' }}>Cliquez pour activer / désactiver</span>
        </div>
        <div className={ps.cb}>
          <div className={ps.speedGrid}>
            {speeds.map(s => (
              <div key={s.id} className={`${ps.speedOpt} ${s.on ? ps.speedOn : ''}`} onClick={() => toggleSpeed(s.id)}>
                <span className={ps.soEm}>{s.em}</span>
                <div className={ps.soNm}>{s.nm}</div>
                <div className={ps.soMul}>Multiplicateur {s.mul}</div>
                <div className={ps.soPrice} style={{ color:s.color }}>
                  ≈ {fmtGNF(Math.round(base * SPEED_MULS[s.id]))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:14, padding:'12px 14px', background:'var(--sky)', border:'1px solid var(--sky-3)', borderRadius:'var(--r-md)', fontSize:12, color:'var(--t2)', display:'flex', gap:8 }}>
            <i className="fas fa-circle-info" style={{ color:'var(--blue)', flexShrink:0, marginTop:1 }} />
            Multiplicateurs Shopi : <strong style={{ color:'var(--navy)' }}>Éco ×1.0 · Standard ×1.3 · Express ×1.8 · Ultra ×2.5</strong>
          </div>
        </div>
      </div>

      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-coins" /> Grille tarifaire de base</div></div>
        <div className={ps.cb}>
          <div className={ps.grid2} style={{ marginBottom:14 }}>
            {[
              { label:'Tarif de base / livraison', icon:'fa-coins',         val:base,     set:setBase,     min:5000,  step:1000, unit:'GNF',    hint:'Montant minimum avant multiplicateurs' },
              { label:'Tarif par kilomètre',        icon:'fa-road',          val:perKm,    set:setPerKm,    min:500,   step:100,  unit:'GNF/km', hint:'Ajouté selon la distance réelle' },
              { label:'Supplément colis lourd (+10 kg)', icon:'fa-weight-hanging', val:lourd,set:setLourd,min:0,step:500, unit:'GNF', hint:'Supplément pour colis > 10 kg' },
              { label:'Majoration nocturne (22h–6h)',icon:'fa-moon',         val:nocturne, set:setNocturne, min:0,     step:5,    unit:'%',      hint:'Appliqué automatiquement la nuit' },
            ].map(f => (
              <div key={f.label} className={ps.fiGroup}>
                <div className={ps.fiLabel}>{f.label}</div>
                <div className={ps.fiWrap}>
                  <i className={`fas ${f.icon}`} style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                  <input className={ps.fiInput} type="number" value={f.val} min={f.min} step={f.step}
                    onChange={e => { f.set(+e.target.value); dirty(); }} />
                  <span style={{ position:'absolute', right:13, fontSize:12, fontWeight:700, color:'var(--t3)' }}>{f.unit}</span>
                </div>
                <div className={ps.fiHint}><i className="fas fa-circle-info" /> {f.hint}</div>
              </div>
            ))}
          </div>

          {/* Simulateur */}
          <div style={{ background:'var(--g50)', border:'1px solid var(--bdr)', borderRadius:'var(--r-lg)', padding:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:.5, marginBottom:12, display:'flex', gap:6 }}>
              <i className="fas fa-calculator" style={{ color:'var(--teal)' }} /> Simulation (base 10 km)
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:9 }}>
              {speeds.filter(s => s.on).map(s => (
                <div key={s.id} style={{ background:'var(--white)', border:'1px solid var(--bdr)', borderRadius:'var(--r-lg)', padding:12, textAlign:'center' }}>
                  <div style={{ fontSize:18, marginBottom:5 }}>{s.em}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--navy)' }}>{s.nm}</div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:14, fontWeight:800, color:s.color, marginTop:5 }}>
                    {fmtGNF(Math.round((base + perKm * 10) * SPEED_MULS[s.id]))}
                  </div>
                  <div style={{ fontSize:10, color:'var(--t3)' }}>pour 10 km</div>
                </div>
              ))}
              {speeds.filter(s => s.on).length === 0 && (
                <div style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--t3)', fontSize:12, padding:12 }}>
                  Aucune vitesse sélectionnée
                </div>
              )}
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'12px 28px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:8,
                cursor:'pointer', opacity:saving ? 0.6 : 1 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder les tarifs</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}