// pages/OverviewPage.tsx
import { useState, useEffect } from 'react';
import type { PageId } from '../data/correspondantData';
import { fmtGNF, fmtMini } from '../data/correspondantData';
import s from '../styles/OverviewPage.module.css';
import sh from '../styles/Shared.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface Props { setPage: (p: PageId) => void; }

interface ColisUrgent {
  id: string; nm: string; boutique: string; client: string; valeur: number;
}
interface OverviewData {
  zoneNom: string;
  kpis: { missionsTotales: number; revenusCeMois: number; tauxSucces: number; partenairesActifs: number };
  relayFlow: { sources: number; destinations: number };
  activite: { msg: string; highlight?: string; t: string }[];
  colisUrgent: ColisUrgent | null;
  colisCounts: { att: number; stock: number; dep: number; ret: number };
  livresCeMois: number;
  objectifs: { missionsCeMois: number; revenusCeMois: number; tauxSucces: number };
}

/* Cibles fixes — aucun système d'objectifs configurables n'existe encore côté backend */
const TARGETS = { missions: 160, revenus: 1_000_000, succes: 100 };

const EMPTY: OverviewData = {
  zoneNom: 'Zone',
  kpis: { missionsTotales: 0, revenusCeMois: 0, tauxSucces: 100, partenairesActifs: 0 },
  relayFlow: { sources: 0, destinations: 0 },
  activite: [],
  colisUrgent: null,
  colisCounts: { att: 0, stock: 0, dep: 0, ret: 0 },
  livresCeMois: 0,
  objectifs: { missionsCeMois: 0, revenusCeMois: 0, tauxSucces: 100 },
};

/* Met en gras `highlight` dans `texte` via JSX (échappé par React) — pas de
 * dangerouslySetInnerHTML : le message contient le nom d'une boutique choisi
 * librement par l'entreprise (voir overview-aggregate.service.ts). */
function ActiviteMsg({ msg, highlight }: { msg: string; highlight?: string }) {
  if (!highlight) return <>{msg}</>;
  const idx = msg.indexOf(highlight);
  if (idx === -1) return <>{msg}</>;
  return <>{msg.slice(0, idx)}<b>{highlight}</b>{msg.slice(idx + highlight.length)}</>;
}

export default function OverviewPage({ setPage }: Props) {
  const [data, setData]       = useState<OverviewData>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<OverviewData>('/dashboard/correspondant/overview')
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { kpis, relayFlow, activite, colisUrgent, colisCounts, livresCeMois, objectifs } = data;

  const KPIS = [
    { k:'k1', em:'📦', val:String(kpis.missionsTotales),                 lbl:'Missions totales' },
    { k:'k2', em:'💰', val:fmtMini(kpis.revenusCeMois),                  lbl:'Revenus ce mois · GNF' },
    { k:'k3', em:'✅', val:`${kpis.tauxSucces}%`,                        lbl:'Taux de succès' },
    { k:'k4', em:'🤝', val:String(kpis.partenairesActifs),               lbl:'Partenaires actifs' },
  ];

  const OBJECTIVES = [
    { nm:'Missions mensuelles', ic:'fa-box',          cur:objectifs.missionsCeMois, target:TARGETS.missions },
    { nm:'Revenus du mois',     ic:'fa-coins',         cur:objectifs.revenusCeMois,  target:TARGETS.revenus, fmt:true },
    { nm:'Taux de succès',      ic:'fa-check-circle',  cur:objectifs.tauxSucces,     target:TARGETS.succes,  pct:true },
  ];

  return (
    <div className={sh.page}>

      {/* ── Colis urgent banner — masqué si aucun colis urgent réel ── */}
      {colisUrgent && (
        <div className={s.cuBanner}>
          <div className={s.cuBg} /><div className={s.cuGrid} />
          <div className={s.cuPulse}>📦</div>
          <div className={s.cuInfo}>
            <div className={s.cuLabel}>Colis en attente urgente</div>
            <div className={s.cuTitle}>{colisUrgent.id} — {colisUrgent.nm}</div>
            <div className={s.cuMeta}>
              <span><i className="fas fa-store" /> {colisUrgent.boutique}</span>
              <span><i className="fas fa-user" /> {colisUrgent.client}</span>
              <span><i className="fas fa-coins" /> {fmtGNF(colisUrgent.valeur)}</span>
            </div>
          </div>
          <div className={s.cuActions}>
            <button className={s.cuBtnOk} onClick={() => setPage('colis')}>
              <i className="fas fa-box" /> Voir le colis
            </button>
          </div>
        </div>
      )}

      {/* ── KPI Grid ── */}
      <div className={s.kpiGrid}>
        {KPIS.map(k => (
          <div key={k.k} className={`${s.kpi} ${(s as any)[k.k]}`}>
            <div className={s.kpiBar} />
            <div className={s.kpiTop}>
              <div className={s.kpiIc}>{k.em}</div>
            </div>
            <div className={s.kpiVal}>{k.val}</div>
            <div className={s.kpiLbl}>{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* ── Hero banner ── */}
      <div className={s.hero}>
        <div className={s.heroBg} /><div className={s.heroGrid} />
        <div className={s.heroLeft}>
          <div className={s.heroBadge}><span className={s.heroDot} /> Correspondant actif · {data.zoneNom}</div>
          <div className={s.heroTitle}>Bonjour 👋<br />Votre relais fonctionne bien.</div>
          <div className={s.heroSub}>
            {colisCounts.stock} colis en dépôt · {colisCounts.dep} transferts actifs · {colisCounts.ret} retours à traiter.
            Taux de succès ce mois : <strong style={{ color: 'var(--t1)' }}>{kpis.tauxSucces}%</strong>.
          </div>
          <div className={s.heroBtns}>
            <button className={s.hb1} onClick={() => setPage('colis')}><i className="fas fa-box" /> Gérer les colis</button>
            <button className={s.hb2} onClick={() => setPage('transferts')}><i className="fas fa-arrows-rotate" /> Voir les transferts</button>
          </div>
        </div>
        <div className={s.heroRight}>
          {[
            { val:String(kpis.missionsTotales), unit:'',  lbl:'Missions totales' },
            { val:String(kpis.tauxSucces),      unit:'%', lbl:'Taux succès'      },
            { val:String(kpis.partenairesActifs), unit:'', lbl:'Partenaires actifs' },
          ].map(h => (
            <div key={h.lbl} className={s.hStat}>
              <div className={s.hsVal}>{h.val}</div>
              <div className={s.hsUnit}>{h.unit}</div>
              <div className={s.hsLbl}>{h.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grid principal ── */}
      <div className={sh.g3} style={{ marginBottom: 0 }}>

        {/* Colonne gauche : Relay + Activité */}
        <div>
          <div className={s.relayCard}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontFamily:'var(--fd)', fontSize:14, fontWeight:700, color:'var(--t1)' }}>Flux de relais actuel</div>
              <span style={{ fontSize:10, color:'var(--t3)', fontWeight:700, textTransform:'uppercase' }}>Données réelles</span>
            </div>
            <div className={s.relayCount}><i className="fas fa-box" /> {colisCounts.stock + colisCounts.dep} colis en transit via votre relais</div>
            <div className={s.relayFlow}>
              <div className={s.relayNode}>
                <div className={s.rnLabel}>Sources</div>
                <div className={s.rnName}>{relayFlow.sources} Boutique{relayFlow.sources > 1 ? 's' : ''}</div>
              </div>
              <div className={s.relayArrow}><i className="fas fa-arrow-right" /></div>
              <div className={s.relayNode} style={{ borderColor:'var(--bdr2)', background:'var(--g100)' }}>
                <div className={s.rnLabel}>Votre relais</div>
                <div className={s.rnName} style={{ color:'var(--t1)' }}>📍 {data.zoneNom}</div>
                <div className={s.rnSub}>Centre de dépôt</div>
              </div>
              <div className={s.relayArrow}><i className="fas fa-arrow-right" /></div>
              <div className={s.relayNode}>
                <div className={s.rnLabel}>Destinations</div>
                <div className={s.rnName}>{relayFlow.destinations} Livreur{relayFlow.destinations > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className={s.relayStats}>
              {([
                ['📥', 'En attente',      colisCounts.att + colisCounts.stock],
                ['🔄', 'En transfert',    colisCounts.dep],
                ['✅', 'Livrés ce mois',  livresCeMois],
              ] as const).map(([em, lbl, val]) => (
                <div key={lbl} className={s.relayStat}>
                  <div className={s.rsEm}>{em}</div>
                  <div className={s.rsVal} style={{ color:'var(--t1)' }}>{val}</div>
                  <div className={s.rsLbl}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={sh.card} style={{ marginBottom:0 }}>
            <div className={sh.ch}><div className={sh.chT}><i className="fas fa-timeline" /> Activité récente</div></div>
            <div className={sh.cb}>
              {loading && <div style={{ padding:'12px 0', color:'var(--t3)' }}>Chargement…</div>}
              {!loading && activite.length === 0 && (
                <div style={{ padding:'12px 0', color:'var(--t3)' }}>Aucune activité récente.</div>
              )}
              {activite.map((a, i) => (
                <div key={i} className={sh.actItem}>
                  <div className={sh.actIc} style={{ background:'var(--g100)' }}>
                    <i className="fas fa-box" style={{ color:'var(--t2)', fontSize:12 }} />
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:'var(--t2)', lineHeight:1.5 }}><ActiviteMsg msg={a.msg} highlight={a.highlight} /></div>
                    <div style={{ fontSize:10, color:'var(--t4,#C5CAD3)', marginTop:2 }}>{a.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne droite : Objectifs */}
        <div>
          <div className={sh.card} style={{ marginBottom:0 }}>
            <div className={sh.ch}><div className={sh.chT}><i className="fas fa-bullseye" /> Objectifs du mois</div></div>
            <div className={sh.cb}>
              {OBJECTIVES.map(o => {
                const pct  = Math.min(100, Math.round((o.cur / o.target) * 100));
                const disp = (o as any).fmt ? fmtGNF(o.cur)    : (o as any).pct ? o.cur+'%'    : o.cur;
                const goal = (o as any).fmt ? fmtGNF(o.target) : (o as any).pct ? o.target+'%' : o.target;
                return (
                  <div key={o.nm} className={sh.objItem}>
                    <div className={sh.objTop}>
                      <div className={sh.objNm} style={{ color:'var(--t2)' }}><i className={`fas ${o.ic}`} /> {o.nm}</div>
                      <div className={sh.objPct} style={{ color:'var(--t2)' }}>{pct}%</div>
                    </div>
                    <div className={sh.objBarBg}><div className={sh.objBarFill} style={{ width:`${pct}%`, background:'var(--t2)' }} /></div>
                    <div className={sh.objNums}><span>{disp}</span><span>Objectif : {goal}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Raccourcis ── */}
      <div className={sh.g2} style={{ marginTop:16 }}>
        <div className={sh.card} style={{ marginBottom:0, cursor:'pointer' }} onClick={() => setPage('boutiques')}>
          <div className={sh.ch}>
            <div className={sh.chT}><i className="fas fa-store" /> Boutiques partenaires</div>
            <span className={sh.chA}>Voir tout <i className="fas fa-arrow-right" /></span>
          </div>
          <div className={sh.cb}>
            <div style={{ fontFamily:'var(--fd)', fontSize:28, fontWeight:800, color:'var(--navy)' }}>{relayFlow.sources}</div>
            <div style={{ fontSize:12, color:'var(--t3)' }}>boutiques traitées via ce relais</div>
          </div>
        </div>

        <div className={sh.card} style={{ marginBottom:0, cursor:'pointer' }} onClick={() => setPage('livreurs')}>
          <div className={sh.ch}>
            <div className={sh.chT}><i className="fas fa-motorcycle" /> Livreurs locaux</div>
            <span className={sh.chA}>Voir tout <i className="fas fa-arrow-right" /></span>
          </div>
          <div className={sh.cb}>
            <div style={{ fontFamily:'var(--fd)', fontSize:28, fontWeight:800, color:'var(--navy)' }}>{relayFlow.destinations}</div>
            <div style={{ fontSize:12, color:'var(--t3)' }}>livreurs approvisionnés via ce relais</div>
          </div>
        </div>
      </div>
    </div>
  );
}
