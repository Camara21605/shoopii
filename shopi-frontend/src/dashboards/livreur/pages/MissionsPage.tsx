// src/dashboards/livreur/pages/MissionsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MissionCard from '../components/MissionCard';
import RefuseMissionModal from '../components/RefuseMissionModal';
import { fetchMissions, accepterMission, refuserMission } from '../services/missions.api';
import type { MissionApi } from '../services/missions.api';
import { buildMapMissionState } from '../data/livreurData';
import shared from '../styles/Shared.module.css';

interface Props { onPop: (m: string, t?: string) => void; }

const FILTERS = ['Tout','Express ⚡','Standard','Urgentes','Proches'];

export default function MissionsPage({ onPop }: Props) {
  const navigate = useNavigate();
  const [active,   setActive]   = useState('Tout');
  const [missions, setMissions] = useState<MissionApi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [autoAcc,  setAutoAcc]  = useState(true);
  const [refusingMission, setRefusingMission] = useState<MissionApi | null>(null);
  const [refusing, setRefusing] = useState(false);

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

  /* ── "Accepter" (status new → accepte réellement) ou "Voir la commande" (status prep/active → navigue) ── */
  const accept = async (id: string) => {
    const m = missions.find(x => x.id === id);
    if (!m) return;

    if (m.status !== 'new') {
      navigate(`/commande/${m.uuid}/suivi`);
      return;
    }

    try {
      await accepterMission(m.uuid);
      setMissions(prev => prev.map(x => x.id === id ? { ...x, status: 'prep' } : x));
      onPop(`✅ Mission ${m.id} acceptée`, 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Impossible d\'accepter cette mission', 'e');
    }
  };

  /* ── Refuser (motif obligatoire via RefuseMissionModal) ── */
  const confirmRefuse = async (reason: string) => {
    if (!refusingMission) return;
    setRefusing(true);
    try {
      await refuserMission(refusingMission.uuid, reason);
      setMissions(prev => prev.filter(x => x.id !== refusingMission.id));
      onPop(`✕ Mission ${refusingMission.id} refusée`, 'w');
      setRefusingMission(null);
    } catch (err: any) {
      onPop(err?.message ?? '❌ Impossible de refuser cette mission', 'e');
    } finally {
      setRefusing(false);
    }
  };

  /* ── Voir la boutique + le client de cette mission sur "Ma zone de livraison" ── */
  const showOnMap = (m: MissionApi) => {
    navigate('/dashboard/livreur/zone', { state: { mapMission: buildMapMissionState(m) } });
  };

  /* ── Ouvrir le détail complet de la commande (clic sur la carte) ──
   * La commande existe déjà même si le livreur n'a pas encore répondu
   * (status 'new') — l'accès y est autorisé car il en est déjà le
   * livreur assigné côté backend (voir isInvolved dans getCommandeDetail). */
  const openDetail = (m: MissionApi) => navigate(`/commande/${m.uuid}/suivi`);

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
          <span style={{ fontSize:12, color:'var(--t3)' }}>· <strong style={{ color:'var(--navy)' }}>{count}</strong> en attente</span>
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
          {filtered.map(m => (
            <MissionCard
              key={m.id}
              mission={m}
              onAccept={accept}
              onMap={() => showOnMap(m)}
              onRefuse={() => setRefusingMission(m)}
              onOpen={() => openDetail(m)}
            />
          ))}
        </div>
      )}

      {refusingMission && (
        <RefuseMissionModal
          mission={refusingMission}
          saving={refusing}
          onClose={() => setRefusingMission(null)}
          onConfirm={confirmRefuse}
        />
      )}
    </div>
  );
}
