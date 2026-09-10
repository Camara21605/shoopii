// src/dashboards/livreur/pages/MissionsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MissionCard from '../components/MissionCard';
import RefuseMissionModal from '../components/RefuseMissionModal';
import { fetchMissions, accepterMission, refuserMission } from '../services/missions.api';
import type { MissionApi } from '../services/missions.api';
import { buildMapMissionState } from '../data/livreurData';
import shared from '../styles/Shared.module.css';

interface Props { onPop: (m: string, t?: string) => void; }

/* Clés internes stables (comparaisons de code) — voir RefuseMissionModal.tsx
 * pour le même raisonnement : le libellé affiché vient de t(), la clé sert
 * uniquement à la logique de filtrage. */
const FILTER_KEYS = ['tout', 'express', 'standard', 'urgentes', 'proches'] as const;

export default function MissionsPage({ onPop }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [active,   setActive]   = useState<typeof FILTER_KEYS[number]>('tout');
  const [missions, setMissions] = useState<MissionApi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [autoAcc,  setAutoAcc]  = useState(true);
  const [refusingMission, setRefusingMission] = useState<MissionApi | null>(null);
  const [refusing, setRefusing] = useState(false);

  useEffect(() => {
    fetchMissions()
      .then(setMissions)
      .catch(() => onPop(t('livreurMissions.toasts.loadError'), 'e'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = active === 'tout'       ? missions
    : active === 'express'   ? missions.filter(m => m.speed === 'exp' || m.speed === 'ult')
    : active === 'standard'  ? missions.filter(m => m.speed === 'std')
    : active === 'urgentes'  ? missions.filter(m => m.urgent)
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
      onPop(t('livreurMissions.toasts.accepted', { id: m.id }), 's');
    } catch (err: any) {
      onPop(err?.message ?? t('livreurMissions.toasts.acceptError'), 'e');
    }
  };

  /* ── Refuser (motif obligatoire via RefuseMissionModal) ── */
  const confirmRefuse = async (reason: string) => {
    if (!refusingMission) return;
    setRefusing(true);
    try {
      await refuserMission(refusingMission.uuid, reason);
      setMissions(prev => prev.filter(x => x.id !== refusingMission.id));
      onPop(t('livreurMissions.toasts.refused', { id: refusingMission.id }), 'w');
      setRefusingMission(null);
    } catch (err: any) {
      onPop(err?.message ?? t('livreurMissions.toasts.refuseError'), 'e');
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
          {FILTER_KEYS.map(key => (
            <button
              key={key}
              className={`${shared.filterBtn} ${active===key ? shared.filterBtnOn : ''}`}
              onClick={() => setActive(key)}
            >{t(`livreurMissions.filters.${key}`)}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <label className={shared.tog}>
              <input type="checkbox" checked={autoAcc} onChange={e => { setAutoAcc(e.target.checked); onPop(e.target.checked ? t('livreurMissions.toasts.autoAcceptOn') : t('livreurMissions.toasts.autoAcceptOff'), e.target.checked ? 's' : 'w'); }} />
              <span className={shared.togs} />
            </label>
            <span style={{ fontSize:12, color:'var(--t2)', fontWeight:600 }}>{t('livreurMissions.autoAccept')}</span>
          </div>
          <span style={{ fontSize:12, color:'var(--t3)' }}>· <strong style={{ color:'var(--navy)' }}>{count}</strong> {t('livreurMissions.enAttente')}</span>
        </div>
      </div>

      {loading && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
          <i className="fas fa-circle-notch fa-spin" /> {t('livreurMissions.chargement')}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ padding:'60px 0', textAlign:'center', color:'var(--t3)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>{t('livreurMissions.empty.title')}</div>
          <div style={{ fontSize:12, marginTop:4 }}>{t('livreurMissions.empty.sub')}</div>
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
