/*
 * FICHIER : src/dashboards/livreur/pages/params/SecConfidentialite.tsx
 * ✅ CONNECTÉ
 */
import React, { useState, useEffect } from 'react';
import { PRIVACY_ITEMS } from '../../data/parametresData';
import type { LivreurData } from '../../hooks/useLivreurParametres';
import ps from '../../styles/ParamsShared.module.css';

interface Props {
  data:        LivreurData | null;
  saving:      boolean;
  dirty:       () => void;
  onPop:       (m: string, t?: string) => void;
  savePrivacy: (body: Record<string, boolean>) => Promise<void>;
}

const PRIVACY_KEYS = ['showInSearch','showRating','showDeliveryCount','shareLocation','improveAlgo','anonymizedStats'];

export default function SecConfidentialite({ data, saving, dirty, onPop, savePrivacy }: Props) {
  const [vals, setVals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const defaults = Object.fromEntries(PRIVACY_ITEMS.map((item, i) => [PRIVACY_KEYS[i] ?? `p${i}`, item.on]));
    setVals({ ...defaults, ...(data?.privacySettings ?? {}) });
  }, [data]);

  function handleChange(key: string, v: boolean) { setVals(prev => ({ ...prev, [key]: v })); dirty(); }

  async function handleSave() {
    try {
      await savePrivacy(vals);
      onPop('✅ Paramètres de confidentialité sauvegardés', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-shield-halved" /> Confidentialité</h2>
        <p>Contrôlez la visibilité de vos informations.</p>
      </div>
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-eye" /> Visibilité & Données</div></div>
        <div className={ps.cb}>
          {PRIVACY_ITEMS.map((item, i) => {
            const key = PRIVACY_KEYS[i] ?? `p${i}`;
            return (
              <div key={key} className={ps.setRow}>
                <div>
                  <div className={ps.srLbl}>{item.l}</div>
                  <div className={ps.srSub}>{item.sub}</div>
                </div>
                <label className={ps.tog}>
                  <input type="checkbox" checked={vals[key] ?? item.on}
                    onChange={e => handleChange(key, e.target.checked)} />
                  <span className={ps.togs} />
                </label>
              </div>
            );
          })}
        </div>
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