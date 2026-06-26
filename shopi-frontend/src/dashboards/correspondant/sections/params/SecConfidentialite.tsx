/* SecConfidentialite.tsx — VERSION CONNECTÉE */
import React, { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import ToggleRow from './ToggleRow';
import { pop } from '../../components/Toast';
import { PRIV_VISIBILITE, PRIV_DATA, type ToggleRow as TRow } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

interface Props {
  data: CorrespondantData | null; saving: boolean;
  dirty: () => void; markClean: () => void; saveTrigger: number;
  onSave: (privacySettings: Record<string, Record<string, boolean>>) => Promise<any>;
}

const VISIB_KEYS  = ['afficherStats','afficherTelephone','apparaitreRecherche','partagerLocalisation'];
const DONNEES_KEYS = ['ameliorerAlgo','statsAnonymisees','rapportsPerso'];

export default function SecConfidentialite({ data, saving, dirty, markClean, saveTrigger, onSave }: Props) {
  const [visib, setVisib] = useState<TRow[]>(PRIV_VISIBILITE.map(t => ({ ...t })));
  const [datas, setDatas] = useState<TRow[]>(PRIV_DATA.map(t       => ({ ...t })));

  useEffect(() => {
    if (!data?.privacySettings) return;
    const ps = data.privacySettings;
    if (ps.visibilite) setVisib(p => p.map((t, i) => ({ ...t, checked: ps.visibilite?.[VISIB_KEYS[i]]  ?? t.checked })));
    if (ps.donnees)    setDatas(p => p.map((t, i) => ({ ...t, checked: ps.donnees?.[DONNEES_KEYS[i]]   ?? t.checked })));
  }, [data]);

  useEffect(() => { if (saveTrigger > 0) handleSave(); }, [saveTrigger]);

  async function handleSave() {
    const privacySettings = {
      visibilite: Object.fromEntries(VISIB_KEYS.map((k,i)    => [k, visib[i].checked])),
      donnees:    Object.fromEntries(DONNEES_KEYS.map((k,i)  => [k, datas[i].checked])),
    };
    try {
      await onSave(privacySettings);
      markClean();
      pop('✅ Confidentialité sauvegardée', 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
  }

  function upd(setter: React.Dispatch<React.SetStateAction<TRow[]>>, i: number, v: boolean) {
    setter(p => p.map((x, j) => j === i ? { ...x, checked:v } : x)); dirty();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1><i className="fas fa-shield-halved" /> Confidentialité</h1>
        <p>Contrôlez la visibilité de vos informations et l'utilisation de vos données.</p>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div className={s.fcTtl}><i className="fas fa-eye" /> Visibilité & Partage</div></div>
        <div className={s.fcBody}>{visib.map((t,i) => <ToggleRow key={t.label} label={t.label} sub={t.sub} checked={t.checked} badge={t.badge} onChange={v => upd(setVisib,i,v)} />)}</div>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div className={s.fcTtl}><i className="fas fa-chart-bar" /> Données analytiques</div></div>
        <div className={s.fcBody}>{datas.map((t,i) => <ToggleRow key={t.label} label={t.label} sub={t.sub} checked={t.checked} badge={t.badge} onChange={v => upd(setDatas,i,v)} />)}</div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder</>}
        </button>
      </div>
    </div>
  );
}