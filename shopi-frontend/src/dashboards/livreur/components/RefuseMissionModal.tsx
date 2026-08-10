// src/dashboards/livreur/components/RefuseMissionModal.tsx
// Modal de confirmation du refus d'une mission — motif obligatoire.

import { useState } from 'react';
import type { Mission } from '../data/livreurData';

interface Props {
  mission: Mission;
  saving:  boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const REASONS = ['Trop loin', 'Indisponible', 'Zone hors couverture', 'Autre'];

export default function RefuseMissionModal({ mission, saving, onClose, onConfirm }: Props) {
  const [choice, setChoice] = useState<string | null>(null);
  const [detail, setDetail] = useState('');

  const finalReason = choice === 'Autre' ? detail.trim() : (choice ?? '');
  const canConfirm  = finalReason.length > 0;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:900, padding:16,
    }} onClick={onClose}>
      <div
        style={{ background:'var(--white)', borderRadius:'var(--r-xl)', padding:28, maxWidth:440, width:'100%', boxShadow:'0 24px 60px rgba(0,0,0,.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(239,68,68,.14)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className="fas fa-xmark" style={{ color:'var(--red)', fontSize:16 }} />
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--navy)' }}>Refuser la mission {mission.id}</div>
            <div style={{ fontSize:12, color:'var(--t3)' }}>{mission.shop} · {mission.client}</div>
          </div>
        </div>

        <div style={{ padding:'12px 14px', background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'var(--r-lg)', marginBottom:18, fontSize:12, color:'var(--t2)', lineHeight:1.5 }}>
          Cette mission sera retirée de votre liste. L'entreprise (ou le client) devra choisir un autre livreur.
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--navy)', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
            Motif du refus (obligatoire)
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:choice==='Autre' ? 10 : 0 }}>
            {REASONS.map(r => (
              <button
                key={r}
                onClick={() => setChoice(r)}
                style={{
                  padding:'8px 14px', borderRadius:'var(--pill)', fontSize:12, fontWeight:600, cursor:'pointer',
                  border: choice === r ? '1.5px solid var(--red)' : '1.5px solid var(--bdr2)',
                  background: choice === r ? 'rgba(239,68,68,.14)' : 'var(--g50)',
                  color: choice === r ? 'var(--red)' : 'var(--t2)',
                }}
              >
                {r}
              </button>
            ))}
          </div>
          {choice === 'Autre' && (
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder="Précisez le motif…"
              rows={3}
              maxLength={300}
              autoFocus
              style={{
                width:'100%', boxSizing:'border-box', marginTop:4, padding:'10px 12px',
                border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)', fontSize:13,
                outline:'none', fontFamily:'var(--fb)', background:'var(--g50)', color:'var(--t1)', resize:'vertical',
              }}
            />
          )}
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} disabled={saving}
            style={{ flex:1, background:'var(--g50)', border:'1.5px solid var(--bdr2)', borderRadius:'var(--pill)', padding:'11px 0', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--t2)' }}>
            Annuler
          </button>
          <button
            onClick={() => onConfirm(finalReason)}
            disabled={saving || !canConfirm}
            style={{
              flex:1, background: canConfirm ? 'var(--red)' : 'var(--g200)',
              color: canConfirm ? '#fff' : 'var(--t3)', border:'none',
              borderRadius:'var(--pill)', padding:'11px 0', fontSize:13, fontWeight:700,
              cursor: canConfirm ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:7,
            }}
          >
            {saving ? <><i className="fas fa-spinner fa-spin" /> En cours…</> : <><i className="fas fa-xmark" /> Confirmer le refus</>}
          </button>
        </div>
      </div>
    </div>
  );
}
