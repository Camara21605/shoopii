// src/dashboards/livreur/pages/OverviewPage.tsx
// Vue d'ensemble — ordre exact du HTML :
// 1. MissionActiveBanner  2. SmartBanner  3. KpiGrid
// 4. InsightGrid  5. Charts row (RevChart + Objectifs)
// 6. Missions preview + (Eval quick + Activity)

import React, { useState, useEffect, useCallback } from 'react';
import type { PageId } from '../data/livreurData';
import { MISSIONS, REV_WEEK, REV_MONTH, fmtGNF, fmtMini } from '../data/livreurData';

import MissionCard from '../components/MissionCard';
import shared from '../styles/Shared.module.css';
import styles from '../styles/OverviewPage.module.css';

interface Props {
  onNavigate:   (p: PageId) => void;
  onPop:        (msg: string, type?: string) => void;
  setTodayEarn: (v: number) => void;
}

// ── KPI DATA ──────────────────────────────────────────────
const KPI_DATA = [
  { k:'k1', em:'🚚', val:'42',        lbl:'Livraisons ce mois',   sub:'37 confirmées · 5 en cours', badge:'+18%', up:true,  spark:[18,24,31,38,42] },
  { k:'k2', em:'💰', val:'1 092 000', lbl:'Revenus ce mois (GNF)', sub:"Net · +44K aujourd'hui",     badge:'+21%', up:true,  spark:[320000,410000,185000,580000,1092000] },
  { k:'k3', em:'⭐', val:'4.9',       lbl:'Note moyenne',          sub:'248 avis · 97% positifs',    badge:'Stable',up:false, spark:[4.7,4.8,4.8,4.9,4.9] },
  { k:'k4', em:'🏪', val:'3',         lbl:'Boutiques abonnées',    sub:'TechStore · AppleZone · FashionHub', badge:'+1', up:true, spark:[1,1,2,2,3] },
];

const KPI_COLORS = ['var(--teal)','var(--emerald)','var(--amber)','var(--blue-lt)'];

// ── INSIGHTS ──────────────────────────────────────────────
const INSIGHTS = [
  { em:'📈', ttl:"Meilleure heure aujourd'hui", sub:'14h – 18h · +62% de missions Express dans votre zone samedi', badge:'tip', badgeTxt:'Planifier',     badgeIc:'fa-bolt'               },
  { em:'💡', ttl:'Astuce : augmentez vos gains', sub:'Les missions Ultra génèrent 2.5× plus de revenus. Activez ce mode.', badge:'tip', badgeTxt:'Optimiser', badgeIc:'fa-lightbulb'         },
  { em:'🏆', ttl:'Top 5% des livreurs Shopi',    sub:'Votre note de 4.9 vous place dans l\'élite. Continuez ainsi !',    badge:'up',  badgeTxt:'+0.1 ce mois', badgeIc:'fa-trophy'           },
  { em:'⚠️', ttl:'Assurance expire dans 12 jours',sub:"Renouvelez votre attestation pour maintenir votre statut vérifié.", badge:'warn', badgeTxt:'Action requise', badgeIc:'fa-triangle-exclamation' },
];

// ── ACTIVITÉ ──────────────────────────────────────────────
const ACT_DATA = [
  { ic:'fa-check-circle', c:'var(--emerald)', msg:'Mission <strong>MIS-0124</strong> acceptée — iPhone 15 Pro', t:'Il y a 8 min'  },
  { ic:'fa-coins',        c:'var(--teal)',    msg:'+26 000 GNF encaissés — Livraison Express confirmée',         t:'Il y a 2h'    },
  { ic:'fa-star',         c:'var(--amber)',   msg:'Mamadou K. vous a noté <strong>5⭐</strong>',                 t:'Il y a 3h'    },
  { ic:'fa-motorcycle',   c:'var(--blue)',    msg:'3 nouvelles missions depuis TechStore Conakry',               t:'Il y a 4h'    },
];

// ── OBJECTIFS ─────────────────────────────────────────────
const OBJS = [
  { nm:'Livraisons mensuelles', ic:'fa-motorcycle', c:'var(--teal)',    cur:42,      target:50,      isFmt:false, isStar:false },
  { nm:'Revenus du mois',       ic:'fa-coins',      c:'var(--emerald)', cur:1092000, target:1500000, isFmt:true,  isStar:false },
  { nm:'Note moyenne',          ic:'fa-star',       c:'var(--amber)',   cur:4.9,     target:5.0,     isFmt:false, isStar:true  },
];

export default function OverviewPage({ onNavigate, onPop, setTodayEarn }: Props) {
  const [showBanner,   setShowBanner]   = useState(true);
  const [showSmart,    setShowSmart]    = useState(true);
  const [chartMode,    setChartMode]    = useState<'sem'|'mois'>('sem');
  const [missionCount, setMissionCount] = useState(MISSIONS.length);

  // Compte à rebours mission active
  const [timerSecs, setTimerSecs] = useState(18 * 60 + 42);
  useEffect(() => {
    const id = setInterval(() => setTimerSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(timerSecs / 60)).padStart(2, '0');
  const ss = String(timerSecs % 60).padStart(2, '0');
  const isUrgent = timerSecs < 5 * 60;

  // Confirmer livraison
  const confirmDelivery = useCallback(() => {
    setTodayEarn(70_000);
    setShowBanner(false);
    onPop('🎉 Livraison confirmée ! +26 000 GNF ajoutés à votre wallet', 's');
  }, [setTodayEarn, onPop]);

  // Accepter mission
  const acceptMission = useCallback((id: string) => {
    setMissionCount(c => Math.max(0, c - 1));
    const m = MISSIONS.find(x => x.id === id);
    onPop(`✅ Mission ${id} acceptée — Rendez-vous chez ${m?.shop}!`, 's');
  }, [onPop]);

  const chartData  = chartMode === 'sem' ? REV_WEEK : REV_MONTH;
  const chartMax   = Math.max(...chartData.map(d => d.v));
  const chartTotal = chartData.reduce((s, d) => s + d.v, 0);

  return (
    <div className={shared.page}>

      {/* ── 1. Mission active banner ── */}
      {showBanner && (
        <div className={styles.maBanner}>
          <div className={styles.maBg} /><div className={styles.maGrid} />
          <div className={styles.maPulse}>🛵</div>
          <div className={styles.maInfo}>
            <div className={styles.maLabel}>Mission en cours · Livraison Express</div>
            <div className={styles.maTitle}>iPhone 15 Pro 256GB — TechStore Conakry</div>
            <div className={styles.maMeta}>
              <span><i className="fas fa-user" /> Mamadou Kouyaté</span>
              <span><i className="fas fa-phone" /> +224 620 123 456</span>
              <span><i className="fas fa-coins" /> 26 000 GNF</span>
            </div>
            <div className={styles.maRoute}>
              <div className={`${styles.maDot} ${styles.dotFr}`} />
              <div className={styles.maPlace}>Kaloum — TechStore</div>
              <div className={styles.maLine} />
              <i className="fas fa-chevron-right" style={{ color:'rgba(255,255,255,.4)', fontSize:10, flexShrink:0 }} />
              <div className={styles.maPlace}>Almamya, Rue KA-012</div>
              <div className={`${styles.maDot} ${styles.dotTo}`} />
            </div>
          </div>
          <div className={styles.maRight}>
            <div className={`${styles.maTimer} ${isUrgent ? styles.timerUrgent : ''}`}>
              <div className={`${styles.maTimerVal} ${isUrgent ? styles.timerValUrgent : ''}`}>{mm}:{ss}</div>
              <div className={styles.maTimerLbl}>Temps restant</div>
            </div>
            <div className={styles.maActions}>
              <button className={styles.maBtnOk} onClick={confirmDelivery}>
                <i className="fas fa-check-circle" /> Livraison confirmée
              </button>
              <button className={styles.maBtnIssue} onClick={() => onPop('⚠️ Problème signalé au support Shopi', 'w')}>
                <i className="fas fa-triangle-exclamation" /> Problème
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Smart AI banner ── */}
      {showSmart && (
        <div className={styles.smartBanner}>
          <div className={styles.sbIcon}>🧠</div>
          <div className={styles.sbText}>
            <div className={styles.sbTag}><i className="fas fa-bolt" /> Suggestion intelligente Shopi</div>
            <div className={styles.sbMsg}>Forte demande Express dans Kaloum — samedi 14h–18h</div>
            <div className={styles.sbSub}>Les samedis après-midi, votre zone enregistre +62% de missions Express. Restez disponible pour maximiser vos gains.</div>
          </div>
          <button className={styles.sbAction} onClick={() => onPop('✅ Rappel activé pour 14h', 's')}>
            <i className="fas fa-bell" /> Me rappeler
          </button>
          <button className={styles.sbDismiss} onClick={() => setShowSmart(false)}>
            <i className="fas fa-xmark" />
          </button>
        </div>
      )}

      {/* ── 3. KPI grid ── */}
      <div className={styles.kpiGrid}>
        {KPI_DATA.map((k, i) => {
          const max = Math.max(...k.spark);
          return (
            <div key={k.k} className={`${shared.kpi} ${shared[k.k as keyof typeof shared] ?? ''} ${i===0?shared.k1:i===1?shared.k2:i===2?shared.k3:shared.k4}`}>
              <div className={shared.kpiBar} />
              <div className={shared.kpiTop}>
                <div className={shared.kpiIc}>{k.em}</div>
                <span className={`${shared.kpiBadge} ${k.up ? shared.badgeUp : shared.badgeNu}`}>
                  {k.up && <i className="fas fa-arrow-trend-up" />} {k.badge}
                </span>
              </div>
              <div className={shared.kpiVal}>{k.val}</div>
              <div className={shared.kpiLbl}>{k.lbl}</div>
              <div className={shared.kpiSub}>{k.sub}</div>
              <div className={shared.kpiSpark}>
                {k.spark.map((v, j) => (
                  <div key={j} className={shared.sparkBar} style={{
                    height: Math.max(3, Math.round((v/max)*28)),
                    background: j === k.spark.length-1 ? KPI_COLORS[i] : 'rgba(14,116,144,.2)',
                  }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 4. Smart insights ── */}
      <div className={styles.insightGrid}>
        {INSIGHTS.map((ins, i) => (
          <div key={i} className={styles.insightCard} onClick={() => onPop(`💡 ${ins.ttl}`, 'i')}>
            <span className={styles.icEm}>{ins.em}</span>
            <div className={styles.icTtl}>{ins.ttl}</div>
            <div className={styles.icSub}>{ins.sub}</div>
            <div className={`${styles.icBadge} ${styles[`badge_${ins.badge}`] ?? ''}`}>
              <i className={`fas ${ins.badgeIc}`} /> {ins.badgeTxt}
            </div>
          </div>
        ))}
      </div>

      {/* ── 5. Revenue chart + Objectifs ── */}
      <div className={shared.g3}>
        <div className={shared.card}>
          <div className={shared.ch}>
            <div className={shared.chT}><i className="fas fa-chart-line" /> Revenus</div>
            <div className={styles.chartTabs}>
              {(['sem','mois'] as const).map(mode => (
                <button
                  key={mode}
                  className={`${styles.chartTab} ${chartMode===mode ? styles.chartTabOn : ''}`}
                  onClick={() => setChartMode(mode)}
                >
                  {mode === 'sem' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
          </div>
          <div className={shared.cb}>
            <div className={styles.revBars}>
              {chartData.map((d, i) => (
                <div key={i} className={styles.rbWrap}>
                  <div
                    className={styles.rb}
                    style={{
                      height: Math.max(4, Math.round((d.v/chartMax)*108)),
                      background: (d as any).today
                        ? 'linear-gradient(180deg,var(--teal),rgba(14,116,144,.5))'
                        : 'linear-gradient(180deg,var(--sky-3),var(--sky-2))',
                    }}
                  >
                    <div className={styles.rbV}>{fmtMini(d.v)}</div>
                  </div>
                  <div className={styles.rbL} style={{
                    color: (d as any).today ? 'var(--teal)' : 'var(--t3)',
                    fontWeight: (d as any).today ? 700 : 400,
                  }}>
                    {d.j}{(d as any).today ? ' ●' : ''}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.revFooter}>
              <span>Total : <strong style={{ color:'var(--navy)', fontFamily:'var(--fd)' }}>{fmtGNF(chartTotal)}</strong></span>
              <span style={{ color:'var(--teal)', fontWeight:700 }}>
                Moy./jour : {fmtGNF(Math.round(chartTotal / chartData.length))}
              </span>
            </div>
          </div>
        </div>

        <div className={`${shared.card} ${shared.cardLast}`}>
          <div className={shared.ch}><div className={shared.chT}><i className="fas fa-bullseye" /> Objectifs du mois</div></div>
          <div className={shared.cb}>
            {OBJS.map((o, i) => {
              const pct  = Math.min(100, Math.round((o.cur / o.target) * 100));
              const disp = o.isFmt ? fmtGNF(o.cur) : o.isStar ? `${o.cur}⭐` : String(o.cur);
              const goal = o.isFmt ? fmtGNF(o.target) : o.isStar ? `${o.target}⭐` : String(o.target);
              return (
                <div key={i} className={shared.objItem}>
                  <div className={shared.objTop}>
                    <div className={shared.objNm} style={{ color: o.c }}>
                      <i className={`fas ${o.ic}`} /> {o.nm}
                    </div>
                    <div className={shared.objPct}>{pct}%</div>
                  </div>
                  <div className={shared.objBarBg}>
                    <div className={shared.objBarFill} style={{ width:`${pct}%`, background: o.c }} />
                  </div>
                  <div className={shared.objNums}>
                    <span>{disp}</span><span>Objectif : {goal}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 6. Missions preview + Eval + Activité ── */}
      <div className={shared.g2}>

        {/* Missions preview */}
        <div className={shared.card}>
          <div className={shared.ch}>
            <div className={shared.chT}><i className="fas fa-motorcycle" /> Missions disponibles</div>
            <button className={shared.chA} onClick={() => onNavigate('missions')}>
              Toutes
              <span style={{ background:'var(--red)', color:'#fff', fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:'var(--pill)', marginLeft:3 }}>
                {missionCount}
              </span>
              <i className="fas fa-arrow-right" />
            </button>
          </div>
          <div className={shared.cb}>
            <div className={styles.missionList}>
              {MISSIONS.slice(0, 2).map(m => (
                <MissionCard key={m.id} mission={m} onAccept={acceptMission} onPop={onPop} />
              ))}
            </div>
          </div>
        </div>

        {/* Colonne droite : Eval + Activité */}
        <div>
          <div className={shared.card}>
            <div className={shared.ch}>
              <div className={shared.chT}><i className="fas fa-star" /> Mon évaluation</div>
              <button className={shared.chA} onClick={() => onNavigate('evaluation')}>Détails</button>
            </div>
            <div className={shared.cb}>
              <div className={styles.evalBig}>
                <div className={styles.evalNum}>4.9</div>
                <div className={styles.evalStars}>★★★★★</div>
                <div className={styles.evalSub}>248 avis · 97% de satisfaction · 🏆 Top 5%</div>
              </div>
              {[[5,82],[4,12],[3,4],[2,1],[1,1]].map(([s, p]) => (
                <div key={s} className={styles.starRow}>
                  <span className={styles.starLbl}>{s}★</span>
                  <div className={styles.starBarBg}>
                    <div className={styles.starBarFill} style={{ width:`${p}%` }} />
                  </div>
                  <span className={styles.starPct}>{p}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${shared.card} ${shared.cardLast}`}>
            <div className={shared.ch}><div className={shared.chT}><i className="fas fa-timeline" /> Activité du jour</div></div>
            <div className={shared.cb}>
              {ACT_DATA.map((a, i) => (
                <div key={i} className={styles.actItem}>
                  <div className={styles.actIc} style={{ background:'var(--tl-bg)' }}>
                    <i className={`fas ${a.ic}`} style={{ color:a.c, fontSize:11 }} />
                  </div>
                  <div>
                    <div className={styles.actMsg} dangerouslySetInnerHTML={{ __html: a.msg }} />
                    <div className={styles.actTime}>{a.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}