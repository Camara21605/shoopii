// pages/OverviewPage.tsx
import React, { useState, useEffect } from 'react';
import { pop } from '../components/Toast';
import type { PageId } from '../data/correspondantData';
import { BOUTIQUES, LIVREURS, ACTIVITE, REV_WEEK, REV_MONTH, fmtGNF, fmtMini } from '../data/correspondantData';
import s from '../styles/OverviewPage.module.css';
import sh from '../styles/Shared.module.css';

interface Props { setPage: (p: PageId) => void; }

function useTimer(initial: string) {
  const [time, setTime] = useState(initial);
  useEffect(() => {
    const [h, m] = initial.split(':').map(Number);
    let secs = h * 3600 + m * 60;
    const t = setInterval(() => {
      secs = Math.max(0, secs - 1);
      setTime(`${Math.floor(secs/3600).toString().padStart(2,'0')}:${Math.floor((secs%3600)/60).toString().padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  return (
    <div className={s.kpiSpark}>
      {data.map((v, i) => (
        <div key={i} className={s.ksBar} style={{
          height: Math.max(3, Math.round((v / max) * 26)),
          background: i === data.length - 1 ? color : 'rgba(11,31,58,.08)',
          borderRadius: '2px 2px 0 0', flex: 1,
        }} />
      ))} 
    </div>
  );
}

const KPIS = [
  { k:'k1', em:'📦', val:'142',     lbl:'Missions totales',   sub:'14 en dépôt · 3 en transit',  badge:'+22%', data:[28,45,62,88,112,130,142], color:'#B45309' },
  { k:'k2', em:'💰', val:'730 000', lbl:'Revenus ce mois',    sub:'Net GNF · +38K aujourd\'hui',  badge:'+18%', data:[180,240,165,320,730],     color:'#047857' },
  { k:'k3', em:'✅', val:'97%',     lbl:'Taux de succès',     sub:'138 sur 142 missions',         badge:'+1%',  data:[92,94,95,96,97],          color:'#0E7490' },
  { k:'k4', em:'🤝', val:'11',      lbl:'Partenaires actifs', sub:'4 boutiques · 7 livreurs',     badge:'+2',   data:[4,5,7,8,9,10,11],         color:'#5B8EF4' },
];

const OBJECTIVES = [
  { nm:'Missions mensuelles', ic:'fa-box',          c:'#B45309', cur:142,    target:160                },
  { nm:'Revenus du mois',     ic:'fa-coins',         c:'#047857', cur:730000, target:1000000, fmt:true  },
  { nm:'Taux de succès',      ic:'fa-check-circle', c:'#0E7490', cur:97,     target:100,     pct:true  },
];

export default function OverviewPage({ setPage }: Props) {
  const [showAlert, setShowAlert] = useState(true);
  const [revMode,   setRevMode]   = useState<'sem' | 'mois'>('sem');
  const timer   = useTimer('47:12');
  const revData = revMode === 'sem' ? REV_WEEK : REV_MONTH;
  const maxRev  = Math.max(...revData.map(d => d.v));

  return (
    <div className={sh.page}>

      {/* ── Colis urgent banner ── */}
      <div className={s.cuBanner}>
        <div className={s.cuBg} /><div className={s.cuGrid} />
        <div className={s.cuPulse}>📦</div>
        <div className={s.cuInfo}>
          <div className={s.cuLabel}>Colis en attente urgente · Réclamation client</div>
          <div className={s.cuTitle}>3 colis TechStore — Client non joignable depuis 48h</div>
          <div className={s.cuMeta}>
            <span><i className="fas fa-store" /> TechStore Conakry</span>
            <span><i className="fas fa-user" /> Mamadou K. · Kaloum</span>
            <span><i className="fas fa-coins" /> 37 500 000 GNF en dépôt</span>
          </div>
        </div>
        <div className={s.cuTimer}>
          <div className={s.cuTimerVal}>{timer}</div>
          <div className={s.cuTimerLbl}>Délai de retour</div>
        </div>
        <div className={s.cuActions}>
          <button className={s.cuBtnOk} onClick={() => pop('📞 Appel client en cours…', 'i')}>
            <i className="fas fa-phone" /> Contacter le client
          </button>
          <button className={s.cuBtn2} onClick={() => pop('↩️ Retour boutique initié', 'w')}>
            <i className="fas fa-rotate-left" /> Initier le retour
          </button>
        </div>
      </div>

      {/* ── Smart alert ── */}
      {showAlert && (
        <div className={s.smartAlert}>
          <div className={s.saIcon}>🧠</div>
          <div className={s.saBody}>
            <div className={s.saTag}><i className="fas fa-bolt" /> Suggestion intelligente Shopi</div>
            <div className={s.saMsg}>Affluence colis prévue ce week-end — 18 livraisons attendues</div>
            <div className={s.saSub}>TechStore et AppleZone ont 18 envois planifiés vers votre zone. Confirmez votre disponibilité.</div>
          </div>
          <button className={s.saBtn} onClick={() => { pop('✅ Disponibilité confirmée pour le week-end', 's'); setShowAlert(false); }}>
            <i className="fas fa-check" /> Confirmer
          </button>
          <button className={s.saDismiss} onClick={() => setShowAlert(false)}><i className="fas fa-xmark" /></button>
        </div>
      )}

      {/* ── KPI Grid ── */}
      <div className={s.kpiGrid}>
        {KPIS.map(k => (
          <div key={k.k} className={`${s.kpi} ${(s as any)[k.k]}`}>
            <div className={s.kpiBar} />
            <div className={s.kpiTop}>
              <div className={s.kpiIc}>{k.em}</div>
              <span className={`${s.kpiBadge} ${s.bUp}`}>
                <i className="fas fa-arrow-trend-up" /> {k.badge}
              </span>
            </div>
            <div className={s.kpiVal}>{k.val}</div>
            <div className={s.kpiLbl}>{k.lbl}</div>
            <div className={s.kpiSub}>{k.sub}</div>
            <Spark data={k.data} color={k.color} />
          </div>
        ))}
      </div>

      {/* ── Hero banner ── */}
      <div className={s.hero}>
        <div className={s.heroBg} /><div className={s.heroGrid} />
        <div className={s.heroLeft}>
          <div className={s.heroBadge}><span className={s.heroDot} /> Correspondant actif · Zone Conakry</div>
          <div className={s.heroTitle}>Bonjour, <em>Amadou</em> 👋<br />Votre relais fonctionne bien.</div>
          <div className={s.heroSub}>
            14 colis en dépôt · 3 transferts actifs · 2 retours à traiter.
            Taux de succès ce mois : <strong style={{ color: '#F59E0B' }}>97%</strong>.
          </div>
          <div className={s.heroBtns}>
            <button className={s.hb1} onClick={() => setPage('colis')}><i className="fas fa-box" /> Gérer les colis</button>
            <button className={s.hb2} onClick={() => setPage('transferts')}><i className="fas fa-arrows-rotate" /> Voir les transferts</button>
          </div>
        </div>
        <div className={s.heroRight}>
          {[{ val:'142', unit:'',   lbl:'Missions totales', trend:'+12%'  },
            { val:'97',  unit:'%',  lbl:'Taux succès',      trend:'Stable'},
            { val:'4.9', unit:'⭐', lbl:'Note moy.',        trend:'+0.1'  }].map(h => (
            <div key={h.lbl} className={s.hStat}>
              <div className={s.hsVal}>{h.val}</div>
              <div className={s.hsUnit}>{h.unit}</div>
              <div className={s.hsLbl}>{h.lbl}</div>
              <div className={s.hsTrend}><i className="fas fa-arrow-trend-up" /> {h.trend}</div>
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
              <div style={{ fontFamily:'var(--fd)', fontSize:14, fontWeight:700, color:'#fff' }}>Flux de relais actuel</div>
              <span style={{ fontSize:10, color:'rgba(245,158,11,.6)', fontWeight:700, textTransform:'uppercase' }}>En temps réel</span>
            </div>
            <div className={s.relayCount}><i className="fas fa-box" /> 14 colis en transit via votre relais</div>
            <div className={s.relayFlow}>
              <div className={s.relayNode}>
                <div className={s.rnLabel}>Sources</div>
                <div className={s.rnName}>4 Boutiques</div>
                <div className={s.rnSub}>TechStore · AppleZone · +2</div>
              </div>
              <div className={s.relayArrow}><i className="fas fa-arrow-right" /></div>
              <div className={s.relayNode} style={{ borderColor:'rgba(245,158,11,.4)', background:'rgba(245,158,11,.12)' }}>
                <div className={s.rnLabel}>Votre relais</div>
                <div className={s.rnName} style={{ color:'#F59E0B' }}>📍 Conakry</div>
                <div className={s.rnSub}>Centre de dépôt</div>
              </div>
              <div className={s.relayArrow}><i className="fas fa-arrow-right" /></div>
              <div className={s.relayNode}>
                <div className={s.rnLabel}>Destinations</div>
                <div className={s.rnName}>7 Livreurs</div>
                <div className={s.rnSub}>Kaloum · Dixinn · +5</div>
              </div>
            </div>
            <div className={s.relayStats}>
              {([['📥','En attente',14,'#F59E0B'],['🔄','En transfert',3,'#67E8F9'],['✅','Livrés ce mois',125,'#10B981']] as const).map(([em,lbl,val,c]) => (
                <div key={lbl} className={s.relayStat}>
                  <div className={s.rsEm}>{em}</div>
                  <div className={s.rsVal} style={{ color:c }}>{val}</div>
                  <div className={s.rsLbl}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={sh.card} style={{ marginBottom:0 }}>
            <div className={sh.ch}><div className={sh.chT}><i className="fas fa-timeline" /> Activité récente</div></div>
            <div className={sh.cb}>
              {ACTIVITE.map((a, i) => (
                <div key={i} className={sh.actItem}>
                  <div className={sh.actIc} style={{ background:a.bg }}>
                    <i className={`fas ${a.ic}`} style={{ color:a.c, fontSize:12 }} />
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:'var(--t2)', lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html:a.msg }} />
                    <div style={{ fontSize:10, color:'var(--t4,#C5CAD3)', marginTop:2 }}>{a.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne droite : Chart + Objectifs */}
        <div>
          <div className={sh.card}>
            <div className={sh.ch}>
              <div className={sh.chT}><i className="fas fa-chart-line" /> Revenus</div>
              <div style={{ display:'flex', gap:4, background:'var(--g100,#F1F3F5)', borderRadius:'var(--r-md,12px)', padding:3 }}>
                {(['sem','mois'] as const).map(m => (
                  <button key={m} onClick={() => setRevMode(m)} style={{
                    background: revMode===m ? '#fff' : 'transparent', border:'none',
                    borderRadius:'var(--r-sm,6px)', padding:'5px 11px',
                    fontSize:12, fontWeight:revMode===m ? 700 : 600,
                    color:revMode===m ? 'var(--navy,#0B1F3A)' : 'var(--t2,#4B5563)',
                    boxShadow:revMode===m ? '0 1px 3px rgba(11,31,58,.06)' : 'none', cursor:'pointer',
                  }}>
                    {m === 'sem' ? 'Semaine' : 'Mois'}
                  </button>
                ))}
              </div>
            </div>
            <div className={sh.cb}>
              <div className={s.revBars}>
                {revData.map((d, i) => (
                  <div key={i} className={s.rbWrap}>
                    <div className={s.rb} style={{
                      height: Math.max(4, Math.round((d.v / maxRev) * 100)),
                      background: d.today
                        ? 'linear-gradient(180deg,#B45309,rgba(180,83,9,.5))'
                        : 'linear-gradient(180deg,rgba(245,158,11,.25),rgba(180,83,9,.1))',
                    }}>
                      <div className={s.rbV}>{fmtMini(d.v)}</div>
                    </div>
                    <div className={s.rbL} style={{ color:d.today ? '#B45309':'var(--t3)', fontWeight:d.today ? 700:400 }}>{d.j}</div>
                  </div>
                ))}
              </div>
              <div className={s.revFooter}>
                <span>Total : <strong style={{ color:'var(--navy)', fontFamily:'var(--fd)' }}>{fmtGNF(revData.reduce((a,d)=>a+d.v,0))}</strong></span>
                <span style={{ color:'#B45309', fontWeight:700 }}>Moy. : {fmtGNF(Math.round(revData.reduce((a,d)=>a+d.v,0)/revData.length))}</span>
              </div>
            </div>
          </div>

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
                      <div className={sh.objNm} style={{ color:o.c }}><i className={`fas ${o.ic}`} /> {o.nm}</div>
                      <div className={sh.objPct} style={{ color:o.c }}>{pct}%</div>
                    </div>
                    <div className={sh.objBarBg}><div className={sh.objBarFill} style={{ width:`${pct}%`, background:o.c }} /></div>
                    <div className={sh.objNums}><span>{disp}</span><span>Objectif : {goal}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Boutiques + Livreurs preview ── */}
      <div className={sh.g2} style={{ marginTop:16 }}>
        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}>
            <div className={sh.chT}><i className="fas fa-store" /> Boutiques partenaires</div>
            <button className={sh.chA} onClick={() => setPage('boutiques')}>Voir tout <i className="fas fa-arrow-right" /></button>
          </div>
          <div className={sh.cb}>
            <div className={sh.entityList}>
              {BOUTIQUES.slice(0,3).map(b => (
                <div key={b.nm} className={sh.entityItem} onClick={() => pop(`🏪 ${b.nm}`, 'i')}>
                  <div className={sh.entityLogo}>{b.em}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={sh.entityNm}>{b.nm}</div>
                    <div className={sh.entityMeta}>
                      <span>{b.cat}</span>
                      <span><i className="fas fa-star" style={{ color:'#F59E0B' }} /> {b.rat}</span>
                    </div>
                  </div>
                  <div className={sh.entityRight}>
                    <div className={sh.entityStat}>{b.colis}</div>
                    <div className={sh.entityStatL}>colis actifs</div>
                    {b.pending > 0 && <span className={sh.ebPend + ' ' + sh.eb}>{b.pending} en attente</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={sh.card} style={{ marginBottom:0 }}>
          <div className={sh.ch}>
            <div className={sh.chT}><i className="fas fa-motorcycle" /> Livreurs locaux</div>
            <button className={sh.chA} onClick={() => setPage('livreurs')}>Voir tout <i className="fas fa-arrow-right" /></button>
          </div>
          <div className={sh.cb}>
            <div className={sh.entityList}>
              {LIVREURS.slice(0,4).map(l => (
                <div key={l.nm} className={sh.entityItem} onClick={() => pop(`🛵 ${l.nm}`, 'i')}>
                  <div className={sh.entityLogo}>{l.em}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className={sh.entityNm}>{l.nm}</div>
                    <div className={sh.entityMeta}>
                      <span>{l.zone}</span>
                      <span style={{ color:l.online ? '#047857':'var(--t3)' }}>
                        <i className={`fas ${l.online ? 'fa-circle':'fa-moon'}`} />
                        {l.online ? ' En ligne' : ' Hors ligne'}
                      </span>
                    </div>
                  </div>
                  <div className={sh.entityRight}>
                    <div className={sh.entityStat}>{l.rat} ⭐</div>
                    <div className={sh.entityStatL}>{l.missions} missions</div>
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