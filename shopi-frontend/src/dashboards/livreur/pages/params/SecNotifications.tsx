/*
 * FICHIER : src/dashboards/livreur/pages/params/SecNotifications.tsx
 * ✅ CONNECTÉ
 */
import React, { useState, useEffect } from 'react';
import { NOTIFS_MISSIONS, NOTIFS_FINANCES, NOTIFS_CANAUX } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:       LivreurData | null;
  saving:     boolean;
  dirty:      () => void;
  onPop:      (m: string, t?: string) => void;
  saveNotifs: (body: Record<string, boolean>) => Promise<void>;
}

function ToggleGroup({ items, vals, onChange }: {
  items: { l: string; sub: string; key: string }[];
  vals:  Record<string, boolean>;
  onChange: (key: string, v: boolean) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <div key={item.key} className={ps.setRow}>
          <div>
            <div className={ps.srLbl}>{item.l}</div>
            <div className={ps.srSub}>{item.sub}</div>
          </div>
          <label className={ps.tog}>
            <input type="checkbox" checked={vals[item.key] ?? item['on' as any] ?? true}
              onChange={e => onChange(item.key, e.target.checked)} />
            <span className={ps.togs} />
          </label>
        </div>
      ))}
    </>
  );
}

/* Mapper les items mock vers des clés API */
const MISSIONS_KEYS  = ['nouvelleMission','missionAnnulee','missionLivree','rappelMission','messageClient'];
const FINANCES_KEYS  = ['gainRecu','virementEffectue','rapportHebdo'];
const CANAUX_KEYS    = ['pushNotif','smsNotif','emailNotif'];

export default function SecNotifications({ data, saving, dirty, onPop, saveNotifs }: Props) {
  const [vals, setVals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const defaults = Object.fromEntries([
      ...MISSIONS_KEYS.map(k => [k, true]),
      ...FINANCES_KEYS.map(k => [k, true]),
      ...CANAUX_KEYS.map(k   => [k, k !== 'emailNotif']),
    ]);
    setVals({ ...defaults, ...(data?.notifSettings ?? {}) });
  }, [data]);

  function handleChange(key: string, v: boolean) {
    setVals(prev => ({ ...prev, [key]: v }));
    dirty();
  }

  async function handleSave() {
    try {
      await saveNotifs(vals);
      onPop('✅ Préférences de notifications sauvegardées', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  const missionItems  = NOTIFS_MISSIONS.map((n, i)  => ({ ...n, key: MISSIONS_KEYS[i]  ?? `m${i}` }));
  const financeItems  = NOTIFS_FINANCES.map((n, i)  => ({ ...n, key: FINANCES_KEYS[i]  ?? `f${i}` }));
  const canauxItems   = NOTIFS_CANAUX.map((n,   i)  => ({ ...n, key: CANAUX_KEYS[i]    ?? `c${i}` }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-bell" /> Notifications</h2>
        <p>Choisissez quand et comment être alerté.</p>
      </div>
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-motorcycle" /> Missions & Livraisons</div></div>
        <div className={ps.cb}><ToggleGroup items={missionItems} vals={vals} onChange={handleChange} /></div>
      </div>
      <div className={ps.card}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-coins" /> Finances & Gains</div></div>
        <div className={ps.cb}><ToggleGroup items={financeItems} vals={vals} onChange={handleChange} /></div>
      </div>
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-mobile-screen" /> Canaux de notification</div></div>
        <div className={ps.cb}><ToggleGroup items={canauxItems} vals={vals} onChange={handleChange} /></div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
            padding:'12px 28px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
            display:'flex', alignItems:'center', gap:7 }}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}