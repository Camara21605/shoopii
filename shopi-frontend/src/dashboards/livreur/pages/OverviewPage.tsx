// src/dashboards/livreur/pages/OverviewPage.tsx
// Vue d'ensemble — entièrement branchée sur des données réelles.
//
// Sections supprimées (aucune réalité backend, ne sont remplacées par
// rien plutôt que par des données inventées) :
//   - Bannière "Suggestion intelligente Shoneya" (aucun moteur d'IA/
//     recommandation n'existe côté backend)
//   - Grille "Smart insights" (même raison)
//   - Carte "Objectifs du mois" (aucune notion d'objectif/cible
//     n'existe dans le schéma — les valeurs "target" étaient inventées)
//   - Répartition des notes par étoile + "248 avis" + "Top 5%" dans le
//     bloc évaluation (aucune table d'avis livreur n'existe ; seule la
//     note moyenne réelle est conservée)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PageId } from '../data/livreurData';
import { fmtGNF, buildMapMissionState } from '../data/livreurData';
import { fetchEnCours } from '../services/encours.api';
import type { EnCoursApi } from '../services/encours.api';
import { fetchMissions, accepterMission, refuserMission } from '../services/missions.api';
import type { MissionApi } from '../services/missions.api';
import { fetchStats, fetchRevenus, fetchRevenusChart } from '../services/overview.api';
import type { StatsApi, RevenusApi, RevenusChartPoint } from '../services/overview.api';
import { apiFetch } from '@/shared/services/apiFetch';

import MissionCard from '../components/MissionCard';
import RefuseMissionModal from '../components/RefuseMissionModal';
import shared from '../styles/Shared.module.css';
import styles from '../styles/OverviewPage.module.css';

interface Props {
  onNavigate:   (p: PageId) => void;
  onPop:        (msg: string, type?: string) => void;
  setTodayEarn: (v: number) => void;
}

// ── ACTIVITÉ — mapping type notification → icône + couleur ──
interface ActivityItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

function activityIcon(type: string): { ic: string; c: string } {
  if (type.startsWith('delivery.'))  return { ic: 'fa-motorcycle',   c: 'var(--teal)'    };
  if (type.startsWith('payment.'))   return { ic: 'fa-coins',        c: 'var(--emerald)' };
  if (type.startsWith('review.'))    return { ic: 'fa-star',         c: 'var(--amber)'   };
  if (type.startsWith('order.'))     return { ic: 'fa-box',          c: 'var(--blue)'    };
  if (type.startsWith('message.'))   return { ic: 'fa-message',      c: 'var(--blue)'    };
  if (type.startsWith('account.'))   return { ic: 'fa-user-check',   c: 'var(--teal)'    };
  if (type.startsWith('follow.'))    return { ic: 'fa-user-plus',    c: 'var(--blue)'    };
  if (type.startsWith('colis.'))     return { ic: 'fa-box-open',     c: 'var(--amber)'   };
  if (type.startsWith('system.'))    return { ic: 'fa-bell',         c: 'var(--t3)'      };
  return { ic: 'fa-circle-info', c: 'var(--t3)' };
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'À l\'instant';
  if (mins  < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${days}j`;
}

export default function OverviewPage({ onNavigate, onPop, setTodayEarn }: Props) {
  const navigate = useNavigate();

  const [stats,      setStats]      = useState<StatsApi | null>(null);
  const [revenus,    setRevenus]    = useState<RevenusApi | null>(null);
  const [chartMode,  setChartMode]  = useState<'semaine' | 'mois'>('semaine');
  const [chartData,  setChartData]  = useState<RevenusChartPoint[]>([]);
  const [encours,    setEncours]    = useState<EnCoursApi | null>(null);
  const [missions,   setMissions]   = useState<MissionApi[]>([]);
  const [activite,   setActivite]   = useState<ActivityItem[]>([]);
  const [now,        setNow]        = useState(Date.now());
  const [refusingMission, setRefusingMission] = useState<MissionApi | null>(null);
  const [refusing,        setRefusing]        = useState(false);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
    fetchRevenus().then(d => { setRevenus(d); setTodayEarn(d.revenusThisMonth); }).catch(() => {});
    fetchEnCours().then(setEncours).catch(() => {});
    fetchMissions().then(setMissions).catch(() => {});
    apiFetch<ActivityItem[]>('/dashboard/livreur/activite')
      .then(data => { if (data) setActivite(data); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRevenusChart(chartMode).then(setChartData).catch(() => setChartData([]));
  }, [chartMode]);

  /* Horloge pour le compte à rebours de la mission active (etaAt réel) */
  useEffect(() => {
    if (!encours?.etaAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [encours?.etaAt]);

  /* "Accepter" (status new → accepte réellement) ou "Voir la commande" (navigue) */
  const goToMission = useCallback(async (id: string) => {
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
      onPop(err?.message ?? "❌ Impossible d'accepter cette mission", 'e');
    }
  }, [missions, navigate, onPop]);

  const confirmRefuseMission = useCallback(async (reason: string) => {
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
  }, [refusingMission, onPop]);

  /* Voir la boutique + le client de cette mission sur "Ma zone de livraison" */
  const showMissionOnMap = useCallback((m: MissionApi) => {
    navigate('/dashboard/livreur/zone', { state: { mapMission: buildMapMissionState(m) } });
  }, [navigate]);

  /* Ouvrir le détail complet de la commande (clic sur la carte de mission) */
  const openMissionDetail = useCallback((m: MissionApi) => {
    navigate(`/commande/${m.uuid}/suivi`);
  }, [navigate]);

  const chartMax   = Math.max(1, ...chartData.map(d => d.v));
  const chartTotal = chartData.reduce((s, d) => s + d.v, 0);

  let etaSecs = 0;
  const hasEta = !!encours?.etaAt;
  if (encours?.etaAt) {
    etaSecs = Math.max(0, Math.floor((new Date(encours.etaAt).getTime() - now) / 1000));
  }
  const mm = String(Math.floor(etaSecs / 60)).padStart(2, '0');
  const ss = String(etaSecs % 60).padStart(2, '0');
  const isUrgent = hasEta && etaSecs < 5 * 60;

  const ratingValue = stats?.averageRating != null ? Number(stats.averageRating) : 0;
  const ratingStars = Math.round(ratingValue);

  return (
    <div className={shared.page}>

      {/* ── 1. Mission active — réelle (GET /livreur/encours), masquée si aucune ── */}
      {encours && (
        <div className={styles.maBanner}>
          <div className={styles.maBg} /><div className={styles.maGrid} />
          <div className={styles.maPulse}>🛵</div>
          <div className={styles.maInfo}>
            <div className={styles.maLabel}>Mission active · {encours.id}</div>
            <div className={styles.maTitle}>{encours.nm}</div>
            <div className={styles.maMeta}>
              <span><i className="fas fa-store" /> {encours.shop}</span>
              <span><i className="fas fa-user" /> {encours.client.nom}</span>
              <span><i className="fas fa-coins" /> {fmtGNF(encours.fee)}</span>
            </div>
          </div>
          <div className={styles.maRight}>
            {hasEta && (
              <div className={`${styles.maTimer} ${isUrgent ? styles.timerUrgent : ''}`}>
                <div className={`${styles.maTimerVal} ${isUrgent ? styles.timerValUrgent : ''}`}>{mm}:{ss}</div>
                <div className={styles.maTimerLbl}>Temps restant</div>
              </div>
            )}
            <div className={styles.maActions}>
              <button className={styles.maBtnOk} onClick={() => navigate(`/commande/${encours.uuid}/suivi`)}>
                <i className="fas fa-check-circle" /> Voir la commande
              </button>
              <button className={styles.maBtnIssue} onClick={() => onNavigate('encours')}>
                <i className="fas fa-route" /> Détails de la course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. KPI grid — données réelles uniquement ── */}
      <div className={styles.kpiGrid}>
        <div className={`${shared.kpi} ${shared.k1}`}>
          <div className={shared.kpiBar} />
          <div className={shared.kpiTop}>
            <div className={shared.kpiIc}>🚚</div>
          </div>
          <div className={shared.kpiVal}>{stats?.deliveriesThisMonth ?? '—'}</div>
          <div className={shared.kpiLbl}>Livraisons ce mois</div>
        </div>

        <div className={`${shared.kpi} ${shared.k2}`}>
          <div className={shared.kpiBar} />
          <div className={shared.kpiTop}>
            <div className={shared.kpiIc}>💰</div>
          </div>
          <div className={shared.kpiVal}>{revenus ? fmtGNF(revenus.revenusThisMonth) : '—'}</div>
          <div className={shared.kpiLbl}>Revenus ce mois</div>
        </div>

        <div className={`${shared.kpi} ${shared.k3}`}>
          <div className={shared.kpiBar} />
          <div className={shared.kpiTop}>
            <div className={shared.kpiIc}>⭐</div>
          </div>
          <div className={shared.kpiVal}>{stats ? ratingValue.toFixed(1) : '—'}</div>
          <div className={shared.kpiLbl}>Note moyenne</div>
        </div>

        <div className={`${shared.kpi} ${shared.k4}`}>
          <div className={shared.kpiBar} />
          <div className={shared.kpiTop}>
            <div className={shared.kpiIc}>🏪</div>
          </div>
          <div className={shared.kpiVal}>{stats?.boutiquesAbonnees ?? '—'}</div>
          <div className={shared.kpiLbl}>Boutiques abonnées</div>
        </div>
      </div>

      {/* ── 3. Graphique des revenus — réel (GET /dashboard/livreur/revenus/chart) ── */}
      <div className={shared.card}>
        <div className={shared.ch}>
          <div className={shared.chT}><i className="fas fa-chart-line" /> Revenus</div>
          <div className={styles.chartTabs}>
            {(['semaine', 'mois'] as const).map(mode => (
              <button
                key={mode}
                className={`${styles.chartTab} ${chartMode === mode ? styles.chartTabOn : ''}`}
                onClick={() => setChartMode(mode)}
              >
                {mode === 'semaine' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
        </div>
        <div className={shared.cb}>
          {chartData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t3)', fontSize: 13 }}>
              Aucun revenu enregistré sur cette période.
            </div>
          ) : (
            <>
              <div className={styles.revBars}>
                {chartData.map((d, i) => (
                  <div key={i} className={styles.rbWrap}>
                    <div
                      className={styles.rb}
                      style={{
                        height: Math.max(4, Math.round((d.v / chartMax) * 108)),
                        background: d.today
                          ? 'linear-gradient(180deg,var(--teal),rgba(0,0,0,.5))'
                          : 'linear-gradient(180deg,var(--sky-3),var(--sky-2))',
                      }}
                    >
                      <div className={styles.rbV}>{fmtMini(d.v)}</div>
                    </div>
                    <div className={styles.rbL} style={{
                      color: d.today ? 'var(--teal)' : 'var(--t3)',
                      fontWeight: d.today ? 700 : 400,
                    }}>
                      {d.j}{d.today ? ' ●' : ''}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.revFooter}>
                <span>Total : <strong style={{ color: 'var(--navy)', fontFamily: 'var(--fd)' }}>{fmtGNF(chartTotal)}</strong></span>
                <span style={{ color: 'var(--teal)', fontWeight: 700 }}>
                  Moy./jour : {fmtGNF(Math.round(chartTotal / Math.max(1, chartData.length)))}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 4. Mes missions + Évaluation + Activité ── */}
      <div className={shared.g2}>

        {/* Mes missions — réelles (GET /livreur/missions), déjà assignées à ce livreur */}
        <div className={shared.card}>
          <div className={shared.ch}>
            <div className={shared.chT}><i className="fas fa-motorcycle" /> Mes missions</div>
            <button className={shared.chA} onClick={() => onNavigate('missions')}>
              Toutes
              <span style={{ background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 'var(--pill)', marginLeft: 3 }}>
                {missions.length}
              </span>
              <i className="fas fa-arrow-right" />
            </button>
          </div>
          <div className={shared.cb}>
            {missions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t3)', fontSize: 13 }}>
                Aucune mission en cours pour le moment.
              </div>
            ) : (
              <div className={styles.missionList}>
                {missions.slice(0, 2).map(m => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    onAccept={goToMission}
                    onMap={() => showMissionOnMap(m)}
                    onRefuse={() => setRefusingMission(m)}
                    onOpen={() => openMissionDetail(m)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : Évaluation (note réelle uniquement) + Activité */}
        <div>
          <div className={shared.card}>
            <div className={shared.ch}>
              <div className={shared.chT}><i className="fas fa-star" /> Mon évaluation</div>
            </div>
            <div className={shared.cb}>
              <div className={styles.evalBig}>
                <div className={styles.evalNum}>{stats ? ratingValue.toFixed(1) : '—'}</div>
                <div className={styles.evalStars}>
                  {'★'.repeat(ratingStars)}{'☆'.repeat(5 - ratingStars)}
                </div>
                {!stats?.averageRating && (
                  <div className={styles.evalSub}>Pas encore de note — effectuez vos premières livraisons.</div>
                )}
              </div>
            </div>
          </div>

          <div className={`${shared.card} ${shared.cardLast}`}>
            <div className={shared.ch}><div className={shared.chT}><i className="fas fa-timeline" /> Activité récente</div></div>
            <div className={shared.cb}>
              {activite.length === 0 ? (
                <div style={{ color: 'var(--t3)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
                  Aucune activité récente
                </div>
              ) : (
                activite.slice(0, 5).map(a => {
                  const { ic, c } = activityIcon(a.type);
                  return (
                    <div key={a.id} className={styles.actItem} style={{ opacity: a.isRead ? 0.7 : 1 }}>
                      <div className={styles.actIc} style={{ background: 'var(--tl-bg)' }}>
                        <i className={`fas ${ic}`} style={{ color: c, fontSize: 11 }} />
                      </div>
                      <div>
                        <div className={styles.actMsg}>{a.title}</div>
                        <div className={styles.actTime}>{relativeTime(a.createdAt)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {refusingMission && (
        <RefuseMissionModal
          mission={refusingMission}
          saving={refusing}
          onClose={() => setRefusingMission(null)}
          onConfirm={confirmRefuseMission}
        />
      )}
    </div>
  );
}

/* Formatte un montant en version compacte (ex: 1.2M, 320K) pour les
 * barres du graphique — évite que les gros chiffres débordent. */
function fmtMini(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n);
}
