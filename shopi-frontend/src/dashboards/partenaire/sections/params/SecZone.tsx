/* ================================================================
 * FICHIER : sections/params/SecZone.tsx
 * Section "Zone d'activité" — ville, commune, quartiers ciblés.
 * API : onSave(dto) → PATCH /partenaire/parametres/zone
 * ================================================================ */

import { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:        PartenaireData | null;
  saving:      boolean;
  dirty:       () => void;
  markClean:   () => void;
  saveTrigger: number;
  onSave:      (body: Partial<PartenaireData>) => Promise<void>;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
}

const VILLES = ['Conakry', 'Kindia', 'Kankan', 'Labé', 'Nzérékoré', 'Boké', 'Faranah', 'Mamou'];
const COMMUNES_CONAKRY = ['Kaloum', 'Dixinn', 'Matam', 'Ratoma', 'Matoto'];

export default function SecZone({
  data, saving, dirty, markClean, saveTrigger, onSave, onToast
}: Props) {
  const [ville,     setVille]    = useState('Conakry');
  const [commune,   setCommune]  = useState('');
  const [quartiers, setQuartiers]= useState('');

  useEffect(() => {
    if (!data) return;
    setVille(data.ville     ?? 'Conakry');
    setCommune(data.commune ?? '');
    setQuartiers(data.zone  ?? '');
  }, [data]);

  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  async function handleSave() {
    try {
      await onSave({ ville, commune, zone: quartiers });
      markClean();
      onToast("✅ Zone d'activité sauvegardée", 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'w');
    }
  }

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div>
          <div className={s.fcTtl}><i className="fas fa-location-dot" /> Zone d'activité</div>
          <div className={s.fcSub}>Les zones où vous recrutez des acteurs pour Shopi.</div>
        </div>
      </div>
      <div className={s.fcBody}>
        <div className={s.grid2}>
          <div className={s.fg}>
            <label className={s.fl}>Ville principale</label>
            <select className={s.fin} value={ville} onChange={e => { setVille(e.target.value); dirty(); }}>
              {VILLES.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className={s.fg}>
            <label className={s.fl}>Commune <span className={s.flOpt}>Conakry uniquement</span></label>
            <select className={s.fin} value={commune} onChange={e => { setCommune(e.target.value); dirty(); }}
              disabled={ville !== 'Conakry'}>
              <option value="">— Sélectionner —</option>
              {COMMUNES_CONAKRY.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className={s.fg} style={{ marginBottom: 0 }}>
          <label className={s.fl}>Quartiers / marchés ciblés</label>
          <input
            className={s.fin}
            value={quartiers}
            onChange={e => { setQuartiers(e.target.value); dirty(); }}
            placeholder="Ex: Madina, Cosa, Kaloum centre"
          />
          <span className={s.hint}>Séparez par des virgules. Aide Shopi à vous proposer des prospects proches.</span>
        </div>
      </div>
    </div>
  );
}
