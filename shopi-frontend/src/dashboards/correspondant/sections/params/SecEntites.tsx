/* ================================================================
 * sections/params/SecEntites.tsx — VERSION CONNECTÉE
 * POST /entites/codes/:type → regenererCode
 * PATCH /entites            → saveEntites (colabSettings)
 * ================================================================ */
import React, { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import ToggleRow from './ToggleRow';
import { pop } from '../../components/Toast';
import { COLAB_TOGGLES, type ToggleRow as TRow } from '../../data/parametresData';
import type { CorrespondantData } from '../../hooks/useCorrespondantParametres';

interface Props {
  data:           CorrespondantData | null;
  saving:         boolean;
  dirty:          () => void;
  markClean:      () => void;
  saveTrigger:    number;
  onSave:         (body: { colabSettings?: Record<string, boolean> }) => Promise<any>;
  onRegenerCode:  (type: 'boutique' | 'livreur') => Promise<{ code: string; expiry: string; max: number }>;
}

const COLAB_KEYS = ['accepterNonVerifies', 'autoAssigner', 'notifierBoutique', 'partagerStats'];

export default function SecEntites({ data, saving, dirty, markClean, saveTrigger, onSave, onRegenerCode }: Props) {
  const [colabs,        setColabs]        = useState<TRow[]>(COLAB_TOGGLES.map(t => ({ ...t })));
  const [codeBoutique,  setCodeBoutique]  = useState('COR-AB7');
  const [codeLivreur,   setCodeLivreur]   = useState('LVR-AB3');
  const [boutiqueInfo,  setBoutiqueInfo]  = useState({ expiry: '', usages: 0, max: 5 });
  const [livreurInfo,   setLivreurInfo]   = useState({ expiry: '', usages: 0, max: 10 });
  const [regen, setRegen] = useState<null|'boutique'|'livreur'>(null);

  /* ── Init depuis API ── */
  useEffect(() => {
    if (!data) return;
    if (data.codeBoutique) setCodeBoutique(data.codeBoutique);
    if (data.codeLivreur)  setCodeLivreur(data.codeLivreur);
    setBoutiqueInfo({ expiry: data.codeBoutiqueExpiry ?? '', usages: data.codeBoutiqueUsages ?? 0, max: data.codeBoutiqueMax ?? 5 });
    setLivreurInfo ({ expiry: data.codeLivreurExpiry  ?? '', usages: data.codeLivreurUsages  ?? 0, max: data.codeLivreurMax  ?? 10 });
    if (data.colabSettings) {
      setColabs(prev => prev.map((c, i) => ({ ...c, checked: data.colabSettings?.[COLAB_KEYS[i]] ?? c.checked })));
    }
  }, [data]);

  useEffect(() => { if (saveTrigger > 0) handleSave(); }, [saveTrigger]);

  async function handleSave() {
    const colabSettings: Record<string, boolean> = {};
    colabs.forEach((c, i) => { colabSettings[COLAB_KEYS[i]] = c.checked; });
    try {
      await onSave({ colabSettings });
      markClean();
      pop('✅ Paramètres collaboration sauvegardés', 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
  }

  async function handleRegen(type: 'boutique' | 'livreur') {
    setRegen(type);
    try {
      const res = await onRegenerCode(type);
      if (type === 'boutique') { setCodeBoutique(res.code); setBoutiqueInfo(p => ({ ...p, expiry: res.expiry, usages: 0 })); }
      else                     { setCodeLivreur(res.code);  setLivreurInfo(p => ({ ...p, expiry: res.expiry, usages: 0 })); }
      pop(`🔄 Code ${type} régénéré : ${res.code}`, 's');
    } catch (e: any) { pop(`❌ ${e.message}`, 'e'); }
    finally { setRegen(null); }
  }

  function CodeBox({ code, color, label, info, type, expiry, usages, max }:
    { code:string; color:string; label:string; info:string; type:'boutique'|'livreur'; expiry:string; usages:number; max:number }) {
    return (
      <div style={{ background:color, border:`1px solid rgba(0,0,0,.1)`, borderRadius:'var(--r-lg)', padding:16, marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:9, opacity:.8 }}>{label}</div>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--white)', border:'1px solid rgba(0,0,0,.08)', borderRadius:'var(--r-md)', padding:'13px 15px', marginBottom:10 }}>
          <div style={{ fontFamily:'var(--fd)', fontSize:22, fontWeight:800, color:'var(--navy)', letterSpacing:5, flex:1 }}>{code}</div>
          <button onClick={() => { navigator.clipboard.writeText(code); pop(`📋 Code ${code} copié !`, 's'); }} style={{ background:'var(--cor,#B45309)', color:'#fff', border:'none', borderRadius:'var(--r-sm)', padding:'7px 16px', fontSize:11, fontWeight:700, cursor:'pointer' }}>Copier</button>
          <button onClick={() => handleRegen(type)} disabled={regen === type} style={{ background:'var(--g50)', color:'var(--t2)', border:'1px solid var(--bdr2)', borderRadius:'var(--r-sm)', padding:'7px 14px', fontSize:11, cursor:'pointer' }}>
            {regen === type ? <><i className="fas fa-spinner fa-spin" /> …</> : 'Renouveler'}
          </button>
        </div>
        <div style={{ fontSize:11, color:'var(--t2)', lineHeight:1.5 }}>
          <span dangerouslySetInnerHTML={{ __html: info }} />
          {expiry && <> · Expire le <strong>{new Date(expiry).toLocaleDateString('fr-FR')}</strong></>}
          <> · <strong>{usages}/{max}</strong> utilisations</>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={s.psHd}>
        <h1><i className="fas fa-handshake" /> Entités partenaires</h1>
        <p>Codes d'invitation pour boutiques et livreurs + paramètres de collaboration.</p>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-store" /> Code boutique</div></div></div>
        <div className={s.fcBody}>
          <CodeBox code={codeBoutique} color="var(--cor-bg)" label="Code actif — boutique" type="boutique"
            info="La boutique entre ce code lors de son inscription."
            expiry={boutiqueInfo.expiry} usages={boutiqueInfo.usages} max={boutiqueInfo.max} />
        </div>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-motorcycle" /> Code livreur</div></div></div>
        <div className={s.fcBody}>
          <CodeBox code={codeLivreur} color="var(--tl-bg,rgba(14,116,144,.09))" label="Code actif — livreur" type="livreur"
            info="Le livreur entre ce code lors de son inscription."
            expiry={livreurInfo.expiry} usages={livreurInfo.usages} max={livreurInfo.max} />
        </div>
      </div>
      <div className={s.fc}>
        <div className={s.fcHd}><div><div className={s.fcTtl}><i className="fas fa-sliders" /> Paramètres de collaboration</div></div></div>
        <div className={s.fcBody}>
          {colabs.map((t, i) => (
            <ToggleRow key={t.label} label={t.label} sub={t.sub} checked={t.checked} badge={t.badge}
              onChange={v => { setColabs(p => p.map((x, j) => j === i ? { ...x, checked:v } : x)); dirty(); }} />
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