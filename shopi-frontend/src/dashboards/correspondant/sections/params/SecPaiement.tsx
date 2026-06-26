/* SecPaiement.tsx — VERSION CONNECTÉE */
import React, { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import RadioOption from './RadioOption';
import { pop } from '../../components/Toast';
import { PAIEMENTS_INIT, VIR_FREQ, type Paiement, type VirFreq } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

interface Props {
  data: CorrespondantData | null; saving: boolean;
  dirty: () => void; markClean: () => void; saveTrigger: number;
  onSave: (body: Partial<CorrespondantData>) => Promise<any>;
}

const FREQ_KEYS: Record<string, number> = { quotidien:0, hebdomadaire:1, instantane:2 };
const COMMISSIONS = [['Par colis standard','5 000 GNF'],['Par colis > 50K GNF','1.2% de la valeur'],['Par retour traité','3 000 GNF']];

export default function SecPaiement({ data, saving, dirty, markClean, saveTrigger, onSave }: Props) {
  const [paiements, setPaiements] = useState<Paiement[]>(PAIEMENTS_INIT.map(p => ({ ...p })));
  const [virFreqs,  setVirFreqs]  = useState<VirFreq[]>(VIR_FREQ.map(v => ({ ...v })));
  const [seuil,     setSeuil]     = useState('100000');

  /* ── Init depuis API ── */
  useEffect(() => {
    if (!data) return;
    if (data.paiementMethodes?.length) setPaiements(data.paiementMethodes as any);
    if (data.virementFrequence) {
      const idx = FREQ_KEYS[data.virementFrequence] ?? 1;
      setVirFreqs(prev => prev.map((v, i) => ({ ...v, sel: i === idx })));
    }
    if (data.virementSeuil) setSeuil(String(data.virementSeuil));
  }, [data]);

  useEffect(() => { if (saveTrigger > 0) handleSave(); }, [saveTrigger]);

  async function handleSave() {
    const selFreq = VIR_FREQ[virFreqs.findIndex(v => v.sel)];
    const FREQ_ENUM: Record<string, string> = { 'Virement quotidien':'quotidien', 'Virement hebdomadaire':'hebdomadaire', 'Retrait instantané':'instantane' };
    try {
      await onSave({ paiementMethodes: paiements as any, virementFrequence: FREQ_ENUM[selFreq?.nm] as any, virementSeuil: Number(seuil) });
      markClean();
      pop('✅ Paiement sauvegardé', 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
  }

  function setDefault(idx: number) { setPaiements(prev => prev.map((p, i) => ({ ...p, def: i === idx }))); pop('✅ Mode par défaut modifié', 's'); dirty(); }
  function selectFreq(idx: number) { setVirFreqs(prev => prev.map((v, i) => ({ ...v, sel: i === idx }))); dirty(); }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}><h1><i className="fas fa-wallet" /> Paiement</h1><p>Méthodes de réception des commissions Shopi.</p></div>
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-money-bill-transfer" /> Méthodes de réception</div></div>
          <button className={s.fcAction} onClick={() => pop('➕ Ajouter une méthode','i')}><i className="fas fa-plus" /> Ajouter</button>
        </div>
        <div className={s.fcBody}>
          <div className={s.pmList}>
            {paiements.map((p, i) => (
              <div key={p.nm} className={`${s.pmItem} ${p.def ? s.pmDef : ''}`}>
                <div className={s.pmIc} style={{ background:p.bg }}>{p.em}</div>
                <div style={{ flex:1 }}><div className={s.pmNm}>{p.nm} {p.def && <span className={s.pmDefTag}>Par défaut</span>}</div><div className={s.pmSub}>{p.sub}</div></div>
                <div className={s.pmActs}>
                  {!p.def && <button className={s.pmBtn} onClick={() => setDefault(i)}>Défaut</button>}
                  <button className={`${s.pmBtn} ${s.pmBtnDanger}`} onClick={() => pop('🗑️ Supprimé','w')}><i className="fas fa-trash-can" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-calendar-check" /> Fréquence des virements</div></div></div>
        <div className={s.fcBody}>
          <div className={s.radioGroup}>
            {virFreqs.map((v, i) => <RadioOption key={v.nm} em={v.em} title={v.nm} sub={v.sub} badge={v.prix} color={v.color} sel={v.sel} onClick={() => selectFreq(i)} />)}
          </div>
        </div>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-receipt" /> Taux de commission</div></div></div>
        <div className={s.fcBody}>
          <div style={{ background:'var(--cor-bg)', border:'1px solid var(--bdr-cor)', borderRadius:'var(--r-lg)', padding:16, marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {COMMISSIONS.map(([l, v]) => (<div key={l} style={{ background:'var(--white)', borderRadius:'var(--r-md)', padding:11, textAlign:'center', border:'1px solid var(--bdr-cor)' }}><div style={{ fontSize:10, color:'var(--t3)', marginBottom:5 }}>{l}</div><div style={{ fontFamily:'var(--fd)', fontSize:14, fontWeight:800, color:'var(--cor,#B45309)' }}>{v}</div></div>))}
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Seuil de virement automatique</div>
            <div className={s.fw}>
              <i className="fas fa-coins" style={{ position:'absolute', left:13, color:'var(--t3)', fontSize:13, pointerEvents:'none', zIndex:1 }} />
              <input className={s.fin} type="number" value={seuil} step="10000" onChange={e => { setSeuil(e.target.value); dirty(); }} />
              <span style={{ position:'absolute', right:13, fontSize:12, fontWeight:700, color:'var(--t3)', pointerEvents:'none' }}>GNF</span>
            </div>
          </div>
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