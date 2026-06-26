// src/dashboards/livreur/pages/MissionsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MissionCard from '../components/MissionCard';
import { fetchMissions } from '../services/missions.api';
import type { MissionApi } from '../services/missions.api';
import shared from '../styles/Shared.module.css';

interface Props { onPop: (m: string, t?: string) => void; }

const FILTERS = ['Tout','Express ⚡','Standard','Urgentes','Proches'];

export default function MissionsPage({ onPop }: Props) {
  const navigate = useNavigate();
  const [active,   setActive]   = useState('Tout');
  const [missions, setMissions] = useState<MissionApi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [autoAcc,  setAutoAcc]  = useState(true);

  useEffect(() => {
    fetchMissions()
      .then(setMissions)
      .catch(() => onPop('❌ Impossible de charger les missions', 'e'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = active === 'Tout'       ? missions
    : active === 'Express ⚡' ? missions.filter(m => m.speed === 'exp' || m.speed === 'ult')
    : active === 'Standard'   ? missions.filter(m => m.speed === 'std')
    : active === 'Urgentes'   ? missions.filter(m => m.urgent)
    : missions.filter(m => parseInt(m.dist) <= 5);

  /* ── Ouvrir la page de suivi de la commande ── */
  const accept = (id: string) => {
    const m = missions.find(x => x.id === id);
    if (!m) return;
    navigate(`/commande/${m.uuid}/suivi`);
  };

  const count = missions.filter(m => m.status === 'new').length;

  return (
    <div className={shared.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              className={`${shared.filterBtn} ${active===f ? shared.filterBtnOn : ''}`}
              onClick={() => setActive(f)}
            >{f}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <label className={shared.tog}>
              <input type="checkbox" checked={autoAcc} onChange={e => { setAutoAcc(e.target.checked); onPop(e.target.checked ? '🤖 Auto-acceptation activée' : '⏸️ Désactivée', e.target.checked ? 's' : 'w'); }} />
              <span className={shared.togs} />
            </label>
            <span style={{ fontSize:12, color:'var(--t2)', fontWeight:600 }}>Auto-accepter missions &lt;5km</span>
          </div>
          <span style={{ fontSize:12, color:'var(--t3)' }}>· <strong style={{ color:'var(--navy)' }}>{count}</strong> disponibles</span>
        </div>
      </div>

      {loading && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
          <i className="fas fa-circle-notch fa-spin" /> Chargement des missions…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>Aucune mission pour le moment</div>
          <div style={{ fontSize:12, marginTop:4 }}>Vous serez notifié dès qu'un client vous choisira comme livreur.</div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(m => <MissionCard key={m.id} mission={m} onAccept={accept} onPop={onPop} />)}
        </div>
      )}
    </div>
  );
}
