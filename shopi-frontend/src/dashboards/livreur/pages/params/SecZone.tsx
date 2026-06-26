/*
 * FICHIER : src/dashboards/livreur/pages/params/SecZone.tsx
 * ✅ CONNECTÉ — zones, horaires et disponibilité auto via l'API
 */
import React, { useState, useEffect } from 'react';
import { ZONES_DATA, JOURS, AUTO_DISPO } from '../../data/parametresData';
import type { ZoneItem } from '../../data/parametresData';
import type { LivreurData, HoraireJour } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

const JOURS_API = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];

interface Props {
  data:          LivreurData | null;
  saving:        boolean;
  dirty:         () => void;
  onPop:         (m: string, t?: string) => void;
  saveZones:     (body: Partial<LivreurData>) => Promise<void>;
  saveHoraires:  (h: HoraireJour[]) => Promise<void>;
}

export default function SecZone({ data, saving, dirty, onPop, saveZones, saveHoraires }: Props) {
  const [zones,    setZones]    = useState<ZoneItem[]>(ZONES_DATA.map(z => ({ ...z })));
  const [dist,     setDist]     = useState(25);
  const [horOn,    setHorOn]    = useState(JOURS.map((_, i) => i < 6)); // lun-sam ON
  const [horOpen,  setHorOpen]  = useState(JOURS.map(() => '07:00'));
  const [horClose, setHorClose] = useState(JOURS.map(() => '21:00'));
  const [autoDisp, setAutoDisp] = useState(AUTO_DISPO.map(a => a.on));

  /* Pré-remplir depuis l'API */
  useEffect(() => {
    if (!data) return;
    setDist(data.distanceMax ?? 25);

    // Communes actives → synchroniser les zones
    if (data.communesActives?.length) {
      setZones(prev => prev.map(z => ({ ...z, on: data.communesActives!.includes(z.nm) })));
    }

    // Horaires
    if (data.horaires?.length) {
      const sorted = [...data.horaires].sort(
        (a, b) => JOURS_API.indexOf(a.jour) - JOURS_API.indexOf(b.jour)
      );
      setHorOn(sorted.map(h => h.actif));
      setHorOpen(sorted.map(h => h.ouverture ?? '07:00'));
      setHorClose(sorted.map(h => h.fermeture ?? '21:00'));
    }

    // Disponibilité auto
    if (data.autoDispoSettings) {
      const vals = Object.values(data.autoDispoSettings);
      setAutoDisp(prev => prev.map((v, i) => vals[i] ?? v));
    }
  }, [data]);

  function toggleZone(id: string) {
    setZones(prev => prev.map(z => z.id === id ? { ...z, on: !z.on } : z));
    const z = zones.find(x => x.id === id);
    onPop(`📍 ${z?.nm} ${z?.on ? 'désactivée' : 'activée'}`, 'i');
    dirty();
  }

  function setAllDays(on: boolean) {
    setHorOn(JOURS.map(() => on));
    dirty();
    onPop(on ? '✅ Tous les jours activés' : '⚠️ Planning effacé', on ? 's' : 'w');
  }

  async function handleSaveZones() {
    try {
      await saveZones({
        communesActives:  zones.filter(z => z.on).map(z => z.nm),
        distanceMax:      dist,
        autoDispoSettings: Object.fromEntries(
          AUTO_DISPO.map((item, i) => [item.key ?? `auto${i}`, autoDisp[i]])
        ),
      });
      onPop('✅ Zones et disponibilité sauvegardées', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  async function handleSaveHoraires() {
    try {
      const horaires: HoraireJour[] = JOURS_API.map((jour, i) => ({
        id:        data?.horaires?.find(h => h.jour === jour)?.id ?? '',
        jour,
        actif:     horOn[i],
        ouverture: horOn[i] ? horOpen[i]  : null,
        fermeture: horOn[i] ? horClose[i] : null,
      }));
      await saveHoraires(horaires);
      onPop('✅ Horaires sauvegardés', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  const activeCount = zones.filter(z => z.on).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-map-location-dot" /> Zones & Horaires</h2>
        <p>Définissez où et quand vous acceptez des missions.</p>
      </div>

      {/* Zones */}
      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-location-dot" /> Communes actives</div>
          <span style={{ fontSize:12, color:'var(--teal)', fontWeight:700 }}>{activeCount} zones</span>
        </div>
        <div className={ps.cb}>
          <div className={ps.zoneGrid}>
            {zones.map(z => (
              <div key={z.id} className={`${ps.zoneOpt} ${z.on ? ps.zoneOn : ''}`} onClick={() => toggleZone(z.id)}>
                <div className={ps.zoEm}>{z.em}</div>
                <div className={ps.zoNm}>{z.nm}</div>
                <div className={ps.zoStat}>{z.stat}</div>
              </div>
            ))}
          </div>

          {/* Slider distance */}
          <div style={{ marginTop:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:7 }}>
              <span style={{ color:'var(--t2)', fontWeight:600 }}>Distance maximale par livraison</span>
              <span style={{ fontFamily:'var(--fd)', fontWeight:800, color:'var(--teal)' }}>{dist} km</span>
            </div>
            <input type="range" min={5} max={50} value={dist} step={5}
              onChange={e => { setDist(+e.target.value); dirty(); }}
              style={{ width:'100%', accentColor:'var(--teal)', cursor:'pointer' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--t4)', marginTop:4 }}>
              <span>5 km</span><span>50 km</span>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
            <button onClick={handleSaveZones} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'10px 22px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:7 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder les zones</>}
            </button>
          </div>
        </div>
      </div>

      {/* Horaires */}
      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-clock" /> Planning hebdomadaire</div>
          <div style={{ display:'flex', gap:6 }}>
            <button className={ps.chAction} onClick={() => setAllDays(true)}>Tout activer</button>
            <button onClick={() => setAllDays(false)}
              style={{ background:'var(--g50)', color:'var(--t2)', border:'1px solid var(--bdr2)',
                borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              Effacer
            </button>
          </div>
        </div>
        <div className={ps.cb}>
          <div className={ps.horGrid}>
            {JOURS.map((j, i) => (
              <div key={j} className={`${ps.horRow} ${!horOn[i] ? ps.horOff : ''}`}>
                <div className={ps.horDay}>{j}</div>
                <div className={ps.horT}>
                  <input className={ps.horInp} type="time" value={horOpen[i]} disabled={!horOn[i]}
                    onChange={e => { const n=[...horOpen]; n[i]=e.target.value; setHorOpen(n); dirty(); }} />
                  <span className={ps.horSep}>→</span>
                  <input className={ps.horInp} type="time" value={horClose[i]} disabled={!horOn[i]}
                    onChange={e => { const n=[...horClose]; n[i]=e.target.value; setHorClose(n); dirty(); }} />
                </div>
                <label className={ps.tog}>
                  <input type="checkbox" checked={horOn[i]}
                    onChange={e => { const n=[...horOn]; n[i]=e.target.checked; setHorOn(n); dirty(); }} />
                  <span className={ps.togs} />
                </label>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
            <button onClick={handleSaveHoraires} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'10px 22px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:7 }}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder les horaires</>}
            </button>
          </div>
        </div>
      </div>

      {/* Disponibilité auto */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-robot" /> Disponibilité automatique</div></div>
        <div className={ps.cb}>
          {AUTO_DISPO.map((item, i) => (
            <div key={i} className={ps.setRow}>
              <div>
                <div className={ps.srLbl}>
                  {item.l}
                  {item.badge && (
                    <span className={`${ps.srBadge} ${item.badge==='rec'?ps.badgeRec:ps.badgeNew}`}>
                      {item.badge==='rec' ? 'Auto' : 'Nouveau'}
                    </span>
                  )}
                </div>
                <div className={ps.srSub}>{item.sub}</div>
              </div>
              <label className={ps.tog}>
                <input type="checkbox" checked={autoDisp[i]}
                  onChange={e => { const n=[...autoDisp]; n[i]=e.target.checked; setAutoDisp(n); dirty(); }} />
                <span className={ps.togs} />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}