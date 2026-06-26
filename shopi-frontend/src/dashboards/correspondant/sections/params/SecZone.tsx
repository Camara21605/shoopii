/* ================================================================
 * sections/params/SecZone.tsx — VERSION CONNECTÉE
 *
 * Deux appels API :
 *   onSaveZone({ zonesActives, zoneAutoRules })
 *     → PATCH /correspondant/parametres/zone
 *   onSaveHoraires(horaires[])
 *     → PUT   /correspondant/parametres/zone/horaires
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import ToggleRow from './ToggleRow';
import { pop } from '../../components/Toast';
import {
  ZONES_INIT, HORAIRES_INIT, ZONE_AUTO_RULES,
  type Zone, type Horaire, type ToggleRow as TRow,
} from '../../data/parametresData';
import type { CorrespondantData, HoraireItem } from '../../hooks/useCorrespondantParametres';

interface Props {
  data:            CorrespondantData | null;
  saving:          boolean;
  dirty:           () => void;
  markClean:       () => void;
  saveTrigger:     number;
  onSaveZone:      (body: { zonesActives?: string[]; zoneAutoRules?: Record<string, boolean> }) => Promise<any>;
  onSaveHoraires:  (horaires: HoraireItem[]) => Promise<any>;
}

/* Mapping règle → clé JSON backend */
const RULE_KEYS = ['refusAutoCap', 'alerteRetard48h', 'urgenceWeekend', 'pauseFeries'];

export default function SecZone({ data, saving, dirty, markClean, saveTrigger, onSaveZone, onSaveHoraires }: Props) {
  const [zones,     setZones]     = useState<Zone[]>(ZONES_INIT.map(z => ({ ...z })));
  const [horaires,  setHoraires]  = useState<Horaire[]>(HORAIRES_INIT.map(h => ({ ...h })));
  const [autoRules, setAutoRules] = useState<TRow[]>(ZONE_AUTO_RULES.map(r => ({ ...r })));

  /* ── Init depuis API ── */
  useEffect(() => {
    if (!data) return;
    /* Zones : mettre on=true pour les zones actives */
    if (data.zonesActives) {
      setZones(prev => prev.map(z => ({ ...z, on: data.zonesActives!.includes(z.id) })));
    }
    /* Horaires */
    if (data.horaires?.length) {
      setHoraires(data.horaires.map(h => ({
        jour:   h.jour,
        ouvert: h.ouverture,
        ferme:  h.fermeture,
        actif:  h.actif,
      })));
    }
    /* Règles automatiques */
    if (data.zoneAutoRules) {
      setAutoRules(prev => prev.map((r, i) => ({
        ...r,
        checked: data.zoneAutoRules?.[RULE_KEYS[i]] ?? r.checked,
      })));
    }
  }, [data]);

  useEffect(() => { if (saveTrigger > 0) handleSaveAll(); }, [saveTrigger]);

  async function handleSaveAll() {
    try {
      const zonesActives  = zones.filter(z => z.on).map(z => z.id);
      const zoneAutoRules: Record<string, boolean> = {};
      autoRules.forEach((r, i) => { zoneAutoRules[RULE_KEYS[i]] = r.checked; });

      await onSaveZone({ zonesActives, zoneAutoRules });

      const horairePayload: HoraireItem[] = horaires.map(h => ({
        jour: h.jour, ouverture: h.ouvert, fermeture: h.ferme, actif: h.actif,
      }));
      await onSaveHoraires(horairePayload);

      markClean();
      pop('✅ Zone & Horaires sauvegardés', 's');
    } catch (e: any) {
      pop(`❌ ${e.message}`, 'e');
    }
  }

  function toggleZone(id: string) {
    setZones(prev => prev.map(z => z.id === id ? { ...z, on: !z.on } : z));
    const z = zones.find(z => z.id === id);
    if (z) pop(`📍 Zone ${z.nm} ${z.on ? 'désactivée' : 'activée'}`, 'i');
    dirty();
  }
  function setHeure(i: number, field: 'ouvert' | 'ferme', val: string) {
    setHoraires(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: val } : h));
    dirty();
  }
  function toggleJour(i: number, actif: boolean) {
    setHoraires(prev => prev.map((h, idx) => idx === i ? { ...h, actif } : h));
    dirty();
  }
  function setAll(on: boolean) {
    setHoraires(prev => prev.map(h => ({ ...h, actif: on })));
    pop(on ? '✅ Tous les jours activés' : '⚠️ Planning effacé', on ? 's' : 'w');
    dirty();
  }

  const activeCount = zones.filter(z => z.on).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1><i className="fas fa-map-location-dot" /> Zone & Horaires</h1>
        <p>Définissez votre zone de couverture et vos créneaux de disponibilité.</p>
      </div>

      {/* Zones */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div><div className={s.fcTtl}><i className="fas fa-location-dot" /> Zones de couverture</div></div>
          <span style={{ fontSize:12, color:'var(--cor,#B45309)', fontWeight:700 }}>
            {activeCount} zone{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''}
          </span>
        </div>
        <div className={s.fcBody}>
          <div className={s.zoneGrid}>
            {zones.map(zone => (
              <div key={zone.id} className={`${s.zoneOpt} ${zone.on ? s.zoneOn : ''}`}
                onClick={() => toggleZone(zone.id)} role="checkbox" aria-checked={zone.on} tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && toggleZone(zone.id)}>
                <div className={s.zoEm}>{zone.em}</div>
                <div className={s.zoNm}>{zone.nm}</div>
                <div className={s.zoStat}>{zone.stat}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Horaires */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div><div className={s.fcTtl}><i className="fas fa-clock" /> Horaires d'ouverture</div></div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setAll(true)} style={{ background:'var(--cor-bg)', color:'var(--cor,#B45309)', border:'1px solid var(--bdr-cor)', borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Tout activer</button>
            <button onClick={() => setAll(false)} style={{ background:'var(--g50)', color:'var(--t2)', border:'1px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, cursor:'pointer' }}>Effacer</button>
          </div>
        </div>
        <div className={s.fcBody}>
          <div className={s.horGrid}>
            {horaires.map((h, i) => (
              <div key={h.jour} className={`${s.horRow} ${!h.actif ? s.horOff : ''}`}>
                <div className={s.horDay}>{h.jour}</div>
                <div className={s.horT}>
                  <input className={s.horInp} type="time" value={h.ouvert} disabled={!h.actif} onChange={e => setHeure(i, 'ouvert', e.target.value)} />
                  <span className={s.horSep}>→</span>
                  <input className={s.horInp} type="time" value={h.ferme} disabled={!h.actif} onChange={e => setHeure(i, 'ferme', e.target.value)} />
                </div>
                <label className={s.tog}>
                  <input type="checkbox" checked={h.actif} onChange={e => toggleJour(i, e.target.checked)} />
                  <span className={s.togs} />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Règles auto */}
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-robot" /> Règles automatiques</div></div></div>
        <div className={s.fcBody}>
          {autoRules.map((r, i) => (
            <ToggleRow key={r.label} label={r.label} sub={r.sub} checked={r.checked} badge={r.badge}
              onChange={v => { setAutoRules(p => p.map((x, j) => j === i ? { ...x, checked:v } : x)); dirty(); }} />
          ))}
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className={s.saveBtn} onClick={handleSaveAll} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}