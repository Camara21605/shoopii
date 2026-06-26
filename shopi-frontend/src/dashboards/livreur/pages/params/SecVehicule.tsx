/*
 * FICHIER : src/dashboards/livreur/pages/params/SecVehicule.tsx
 * ✅ CONNECTÉ — données chargées depuis l'API + save
 */
import React, { useState, useEffect } from 'react';
import { VEHICLE_TYPES, COLIS_TYPES } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:         LivreurData | null;
  saving:       boolean;
  dirty:        () => void;
  onPop:        (m: string, t?: string) => void;
  saveVehicule: (body: Partial<LivreurData>) => Promise<void>;
}

// Correspondance entre index VEHICLE_TYPES et valeur enum backend
const VEHICLE_VALUES = ['moto','voiture','velo','tricycle','camion','pieton'];

// Correspondance label capacité → valeur backend
const CAPACITE_MAP: Record<string, string> = {
  "Jusqu'à 10 kg": '10kg',
  "Jusqu'à 20 kg": '20kg',
  "Jusqu'à 50 kg": '50kg',
  '+50 kg':        '50kg+',
};
const CAPACITE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(CAPACITE_MAP).map(([k,v]) => [v,k])
);

export default function SecVehicule({ data, saving, dirty, onPop, saveVehicule }: Props) {
  const [selVehicle,    setSelVehicle]    = useState(0);
  const [colisOn,       setColisOn]       = useState(COLIS_TYPES.map((_, i) => i < 5));
  const [marque,        setMarque]        = useState('');
  const [modele,        setModele]        = useState('');
  const [annee,         setAnnee]         = useState('');
  const [couleur,       setCouleur]       = useState('');
  const [plaque,        setPlaque]        = useState('');
  const [selCapacite,   setSelCapacite]   = useState("Jusqu'à 20 kg");

  useEffect(() => {
    if (!data) return;
    // Type véhicule
    const idx = VEHICLE_VALUES.indexOf(data.VehicleType ?? 'moto');
    if (idx >= 0) setSelVehicle(idx);
    // Champs texte
    setMarque(data.vehiculeMarque  ?? '');
    setModele(data.vehiculeModele  ?? '');
    setAnnee(data.vehiculeAnnee    ? String(data.vehiculeAnnee) : '');
    setCouleur(data.vehiculeCouleur ?? '');
    setPlaque(data.vehiculePlaque  ?? '');
    // Capacité
    setSelCapacite(CAPACITE_REVERSE[data.vehiculeCapacite] ?? "Jusqu'à 20 kg");
    // Colis acceptés
    if (data.colisAcceptes) {
      setColisOn(COLIS_TYPES.map(c => data.colisAcceptes!.includes(c)));
    }
  }, [data]);

  async function handleSave() {
    try {
      await saveVehicule({
        VehicleType:     VEHICLE_VALUES[selVehicle] as any,
        vehiculeMarque:   marque   || undefined,
        vehiculeModele:   modele   || undefined,
        vehiculeAnnee:    annee    ? Number(annee) : undefined,
        vehiculeCouleur:  couleur  || undefined,
        vehiculePlaque:   plaque   || undefined,
        vehiculeCapacite: CAPACITE_MAP[selCapacite] ?? '20kg',
        colisAcceptes:    COLIS_TYPES.filter((_, i) => colisOn[i]),
      });
      onPop('✅ Informations véhicule sauvegardées', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-motorcycle" /> Véhicule & Capacité</h2>
        <p>Informations sur votre véhicule de livraison.</p>
      </div>

      {/* Type véhicule */}
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-truck" /> Type de véhicule</div></div>
        <div className={ps.cb}>
          <div className={ps.radioGroup}>
            {VEHICLE_TYPES.map((v, i) => (
              <div key={v.nm} className={`${ps.radioOpt} ${selVehicle===i ? ps.radioSel : ''}`}
                onClick={() => { setSelVehicle(i); dirty(); }}>
                <div className={ps.roDot} />
                <span className={ps.roEm}>{v.em}</span>
                <div><div className={ps.roTtl}>{v.nm}</div><div className={ps.roSub}>{v.sub}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Détails véhicule */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-info-circle" /> Détails du véhicule</div></div>
        <div className={ps.cb}>
          <div className={ps.grid2} style={{ marginBottom:14 }}>
            {[
              { label:'Marque',  icon:'fa-tag',            val:marque,  set:setMarque  },
              { label:'Modèle',  icon:'fa-motorcycle',     val:modele,  set:setModele  },
              { label:'Année',   icon:'fa-calendar',       val:annee,   set:setAnnee,  type:'number' },
              { label:'Couleur', icon:'fa-palette',        val:couleur, set:setCouleur },
              { label:'Plaque',  icon:'fa-rectangle-list', val:plaque,  set:setPlaque  },
            ].map(f => (
              <div key={f.label} className={ps.fiGroup}>
                <div className={ps.fiLabel}>{f.label}</div>
                <div className={ps.fiWrap}>
                  <i className={`fas ${f.icon}`} style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                  <input className={ps.fiInput} type={f.type ?? 'text'} value={f.val}
                    onChange={e => { f.set(e.target.value); dirty(); }} />
                </div>
              </div>
            ))}
            <div className={ps.fiGroup}>
              <div className={ps.fiLabel}>Capacité maximale</div>
              <div className={ps.fiWrap}>
                <i className="fas fa-weight-hanging" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none' }} />
                <select className={ps.fiInput} value={selCapacite}
                  onChange={e => { setSelCapacite(e.target.value); dirty(); }}
                  style={{ appearance:'none', paddingRight:30 }}>
                  {Object.keys(CAPACITE_MAP).map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className={ps.fiGroup}>
            <div className={ps.fiLabel}>Types de colis acceptés</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
              {COLIS_TYPES.map((c, i) => (
                <label key={c} style={{
                  display:'flex', alignItems:'center', gap:6,
                  background: colisOn[i] ? 'var(--tl-bg)' : 'var(--g50)',
                  border:`1.5px solid ${colisOn[i] ? 'var(--teal)' : 'var(--bdr2)'}`,
                  borderRadius:'var(--pill)', padding:'6px 13px', cursor:'pointer',
                  fontSize:12, fontWeight:600,
                  color: colisOn[i] ? 'var(--teal)' : 'var(--t2)', transition:'all .2s',
                }}>
                  <input type="checkbox" checked={colisOn[i]} style={{ accentColor:'var(--teal)', width:13, height:13 }}
                    onChange={e => { const n=[...colisOn]; n[i]=e.target.checked; setColisOn(n); dirty(); }} />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:8 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder le véhicule</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}