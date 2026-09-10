// src/dashboards/livreur/components/RefuseMissionModal.tsx
// Modal de confirmation du refus d'une mission — motif obligatoire.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Mission } from '../data/livreurData';

interface Props {
  mission: Mission;
  saving:  boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/* Clés internes — stables quelle que soit la langue (comparaisons de code,
 * pas d'affichage). Le texte envoyé au backend (`finalReason`) utilise le
 * libellé traduit, cf. buildReasons() ci-dessous. */
const REASON_KEYS = ['tropLoin', 'indisponible', 'horsZone', 'autre'] as const;

export default function RefuseMissionModal({ mission, saving, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<string | null>(null);
  const [detail, setDetail] = useState('');

  const reasonLabel = (key: string) => t(`livreurRefuseModal.reasons.${key}`);
  const finalReason = choice === 'autre' ? detail.trim() : (choice ? reasonLabel(choice) : '');
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
            <div style={{ fontSize:15, fontWeight:800, color:'var(--navy)' }}>{t('livreurRefuseModal.titre', { id: mission.id })}</div>
            <div style={{ fontSize:12, color:'var(--t3)' }}>{mission.shop} · {mission.client}</div>
          </div>
        </div>

        <div style={{ padding:'12px 14px', background:'rgba(239,68,68,.10)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'var(--r-lg)', marginBottom:18, fontSize:12, color:'var(--t2)', lineHeight:1.5 }}>
          {t('livreurRefuseModal.warning')}
        </div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--navy)', marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
            {t('livreurRefuseModal.motifLabel')}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:choice==='autre' ? 10 : 0 }}>
            {REASON_KEYS.map(key => (
              <button
                key={key}
                onClick={() => setChoice(key)}
                style={{
                  padding:'8px 14px', borderRadius:'var(--pill)', fontSize:12, fontWeight:600, cursor:'pointer',
                  border: choice === key ? '1.5px solid var(--red)' : '1.5px solid var(--bdr2)',
                  background: choice === key ? 'rgba(239,68,68,.14)' : 'var(--g50)',
                  color: choice === key ? 'var(--red)' : 'var(--t2)',
                }}
              >
                {reasonLabel(key)}
              </button>
            ))}
          </div>
          {choice === 'autre' && (
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder={t('livreurRefuseModal.precisezPlaceholder')}
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
            {t('livreurRefuseModal.annuler')}
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
            {saving ? <><i className="fas fa-spinner fa-spin" /> {t('livreurRefuseModal.enCours')}</> : <><i className="fas fa-xmark" /> {t('livreurRefuseModal.confirmer')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
