// src/dashboards/livreur/pages/HistoriquePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildSpeedLabel, SPEED_CLASS, fmtGNF } from '../data/livreurData';
import type { HistStatus } from '../data/livreurData';
import { fetchHistorique } from '../services/historique.api';
import type { HistApi } from '../services/historique.api';
import shared from '../styles/Shared.module.css';

interface Props { onPop: (m:string,t?:string)=>void; }
/* Clés internes stables (comparaisons de code) — le libellé affiché vient
 * de t(), même raisonnement que MissionsPage.tsx/RefuseMissionModal.tsx. */
const HIST_FILTER_KEYS = ['tout', 'livre', 'incident', 'annule'] as const;
const HIST_MAP: Record<string, HistStatus | null> = { tout: null, livre: 'done', incident: 'iss', annule: 'can' };

export default function HistoriquePage({ onPop }: Props) {
  const { t } = useTranslation();
  const SPEED_LABEL = buildSpeedLabel(t);
  const navigate = useNavigate();
  const [active, setActive] = useState<typeof HIST_FILTER_KEYS[number]>('tout');
  const [historique, setHistorique] = useState<HistApi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistorique()
      .then(setHistorique)
      .catch(() => onPop(t('livreurHistorique.loadError'), 'e'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = active === 'tout' ? historique : historique.filter(h => h.status === HIST_MAP[active]);

  return (
    <div className={shared.page}>
      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap' }}>
        <div style={{ display:'flex',gap:7 }}>
          {HIST_FILTER_KEYS.map(key => (
            <button key={key} className={`${shared.filterBtn} ${active===key?shared.filterBtnOn:''}`} onClick={() => setActive(key)}>{t(`livreurHistorique.filters.${key}`)}</button>
          ))}
        </div>
        <button onClick={() => onPop(t('livreurHistorique.exportToast'),'s')} style={{ marginLeft:'auto',background:'var(--white)',border:'1.5px solid var(--bdr2)',borderRadius:'var(--pill)',padding:'8px 16px',fontSize:12,fontWeight:600,color:'var(--t2)',cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}>
          <i className="fas fa-download" /> {t('livreurHistorique.exporter')}
        </button>
      </div>

      {loading && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
          <i className="fas fa-circle-notch fa-spin" /> {t('livreurHistorique.chargement')}
        </div>
      )}

      {!loading && data.length === 0 && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>{t('livreurHistorique.empty.title')}</div>
          <div style={{ fontSize:12, marginTop:4 }}>{t('livreurHistorique.empty.sub')}</div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className={shared.card}>
          <div className={shared.tableWrap}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>{t('livreurHistorique.table.id')}</th>
                  <th>{t('livreurHistorique.table.produit')}</th>
                  <th>{t('livreurHistorique.table.boutique')}</th>
                  <th>{t('livreurHistorique.table.distance')}</th>
                  <th>{t('livreurHistorique.table.vitesse')}</th>
                  <th>{t('livreurHistorique.table.statut')}</th>
                  <th>{t('livreurHistorique.table.date')}</th>
                  <th style={{textAlign:'right'}}>{t('livreurHistorique.table.gain')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((h,i) => (
                  <tr key={i} onClick={() => navigate(`/commande/${h.uuid}/suivi`)} style={{ cursor:'pointer' }}>
                    <td className={shared.tdId}>{h.id}</td>
                    <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:28,height:28,borderRadius:7,background:'var(--sky-2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{h.em}</div><span style={{fontSize:12,fontWeight:600,color:'var(--navy)'}}>{h.nm}</span></div></td>
                    <td style={{color:'var(--t2)'}}>{h.shop}</td>
                    <td style={{color:'var(--t3)'}}>{h.dist}</td>
                    <td><span className={`${shared.speedBadge} ${shared[SPEED_CLASS[h.speed] as keyof typeof shared]}`}>{SPEED_LABEL[h.speed]}</span></td>
                    <td><span className={`${shared.sPill} ${h.status==='done'?shared.sDone:h.status==='iss'?shared.sIss:shared.sCan}`}>{t(`livreurHistorique.status.${h.status}`)}</span></td>
                    <td style={{fontSize:11,color:'var(--t3)'}}>{h.date}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--fd)',fontSize:13,fontWeight:800,color:h.earn?'var(--emerald)':'var(--red)'}}>{h.earn?'+':'-'}{fmtGNF(h.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
