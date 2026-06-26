/* SecColis.tsx — VERSION CONNECTÉE */
import React, { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import ToggleRow from './ToggleRow';
import { pop } from '../../components/Toast';
import { COLIS_TYPES, INCIDENT_RULES, type ToggleRow as TRow } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

interface Props {
  data: CorrespondantData | null; saving: boolean;
  dirty: () => void; markClean: () => void; saveTrigger: number;
  onSave: (body: Partial<CorrespondantData>) => Promise<any>;
}

const INCIDENT_KEYS = ['retourAuto7j', 'alerteSupport', 'bloquerLivreur3', 'photoObligatoire'];

export default function SecColis({ data, saving, dirty, markClean, saveTrigger, onSave }: Props) {
  const [delai,     setDelai]     = useState('7');
  const [capMax,    setCapMax]    = useState('50');
  const [valMax,    setValMax]    = useState('30000000');
  const [poids,     setPoids]     = useState("Jusqu'à 25 kg");
  const [types,     setTypes]     = useState<boolean[]>(COLIS_TYPES.map((_, i) => i < 6));
  const [incidents, setIncidents] = useState<TRow[]>(INCIDENT_RULES.map(t => ({ ...t })));

  /* ── Init depuis API ── */
  useEffect(() => {
    if (!data) return;
    setDelai(String(data.colisDelaiMax    ?? 7));
    setCapMax(String(data.colisCapaciteMax ?? 50));
    setValMax(String(data.colisValeurMax  ?? 30000000));
    setPoids(data.colisPoids ?? "Jusqu'à 25 kg");
    if (data.colisTypesAcceptes) {
      setTypes(COLIS_TYPES.map((_, i) => data.colisTypesAcceptes!.includes(i)));
    }
    if (data.colisIncidentRules) {
      setIncidents(prev => prev.map((t, i) => ({ ...t, checked: data.colisIncidentRules?.[INCIDENT_KEYS[i]] ?? t.checked })));
    }
  }, [data]);

  useEffect(() => { if (saveTrigger > 0) handleSave(); }, [saveTrigger]);

  async function handleSave() {
    const colisTypesAcceptes = types.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const colisIncidentRules: Record<string, boolean> = {};
    incidents.forEach((t, i) => { colisIncidentRules[INCIDENT_KEYS[i]] = t.checked; });
    try {
      await onSave({ colisDelaiMax: Number(delai), colisCapaciteMax: Number(capMax),
        colisValeurMax: Number(valMax), colisPoids: poids, colisTypesAcceptes, colisIncidentRules });
      markClean();
      pop('✅ Règles colis sauvegardées', 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1><i className="fas fa-box" /> Gestion des colis</h1>
        <p>Règles de traitement, délais maximaux et comportement en cas d'incident.</p>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-sliders" /> Règles de dépôt</div></div></div>
        <div className={s.fcBody}>
          <div className={s.grid2} style={{ marginBottom:14 }}>
            {[
              { label:'Délai max (jours)', val:delai, set:setDelai, ic:'fa-calendar', type:'number', min:1, max:30, hint:'Au-delà, alerte retour automatique' },
              { label:'Capacité max', val:capMax, set:setCapMax, ic:'fa-boxes-stacked', type:'number', min:1, hint:'Au-delà, nouvelles demandes refusées' },
              { label:'Valeur max (GNF)', val:valMax, set:setValMax, ic:'fa-coins', type:'number', step:1000000 },
            ].map(f => (
              <div key={f.label} className={s.fg}>
                <div className={s.fl}>{f.label}</div>
                <div className={s.fw}>
                  <i className={`fas ${f.ic}`} style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                  <input className={s.fin} type={f.type} value={f.val} min={f.min} max={f.max} step={f.step}
                    onChange={e => { f.set(e.target.value); dirty(); }} />
                </div>
                {f.hint && <div className={s.fiHint}><i className="fas fa-circle-info" /> {f.hint}</div>}
              </div>
            ))}
            <div className={s.fg}>
              <div className={s.fl}>Poids max accepté</div>
              <div className={s.fw}>
                <i className="fas fa-weight-hanging" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
                <select className={s.fin} value={poids} onChange={e => { setPoids(e.target.value); dirty(); }}>
                  {["Jusqu'à 10 kg","Jusqu'à 25 kg","Jusqu'à 50 kg","Tout type"].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Types de colis acceptés</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
              {COLIS_TYPES.map((ct, i) => (
                <label key={ct} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--g50)', border:`1.5px solid ${types[i]?'var(--cor,#B45309)':'var(--bdr2)'}`, borderRadius:'var(--pill)', padding:'6px 13px', cursor:'pointer', fontSize:12, fontWeight:600, color:types[i]?'var(--cor,#B45309)':'var(--t2)', userSelect:'none' }}>
                  <input type="checkbox" checked={types[i]} style={{ accentColor:'var(--cor,#B45309)', width:13, height:13 }}
                    onChange={e => { setTypes(prev => prev.map((v, j) => j === i ? e.target.checked : v)); dirty(); }} />
                  {ct}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-triangle-exclamation" /> Règles incidents</div></div></div>
        <div className={s.fcBody}>
          {incidents.map((t, i) => (
            <ToggleRow key={t.label} label={t.label} sub={t.sub} checked={t.checked} badge={t.badge}
              onChange={v => { setIncidents(p => p.map((x, j) => j === i ? { ...x, checked:v } : x)); dirty(); }} />
          ))}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}