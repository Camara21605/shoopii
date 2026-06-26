import React, { useState, useEffect } from 'react';
import SectionHeader from '../ui/SectionHeader';
import styles from './PromotionsSection.module.css';
interface Props { onToast: (m: string) => void; }
export default function PromotionsSection({ onToast }: Props) {
  const [timer, setTimer] = useState({ h:8, m:42, s:17 });
  useEffect(() => {
    const id = setInterval(() => setTimer(p => {
      let { h, m, s } = p; s--; if(s<0){s=59;m--;} if(m<0){m=59;h--;} if(h<0) h=23; return {h,m,s};
    }), 1000);
    return () => clearInterval(id);
  }, []);
  const SMALL = [
    { ico:'👗', bg:'var(--rs-bg)', titre:'Mode & Beauté',    sub:'Nouvelles collections 2025', pct:'−25%', color:'var(--rose)'    },
    { ico:'🏆', bg:'var(--em-bg)', titre:'Meilleures Ventes', sub:'Les plus plébiscités',       pct:'Top',  color:'var(--emerald)' },
    { ico:'🏠', bg:'var(--am-bg)', titre:'Maison & Déco',    sub:'Styles contemporains',        pct:'−15%', color:'var(--amber)'   },
    { ico:'🎮', bg:'var(--vl-bg)', titre:'Gaming',           sub:'Dernières sorties',           pct:'−20%', color:'var(--violet)'  },
  ];
  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
        <SectionHeader kick="Offres limitées" title="Flash Sales &amp; <em>Promotions</em>" sub="Des prix exceptionnels, pour un temps limité" />
        <div className={styles.layout}>
          {/* Grande promo */}
          <div className={styles.big} onClick={() => onToast('🔥 Offres électronique !')}>
            <div className={styles.bigBg}/><div className={styles.bigEm}>📱</div>
            <div className={styles.tag}><i className="fas fa-bolt" /> Flash Sale — Aujourd'hui</div>
            <div className={styles.pct}>−40%</div>
            <div className={styles.bigTitle}>Électronique & High-Tech</div>
            <p className={styles.bigSub}>Smartphones, ordinateurs, accessoires à prix cassés</p>
            <div className={styles.timer}>
              {[{v:timer.h,l:'H'},{v:timer.m,l:'M'},{v:timer.s,l:'S'}].map((t,i) => (
                <React.Fragment key={i}>
                  {i>0 && <span className={styles.tsep}>:</span>}
                  <div className={styles.tblk}><div className={styles.tnum}>{String(t.v).padStart(2,'0')}</div><div className={styles.tlbl}>{t.l}</div></div>
                </React.Fragment>
              ))}
            </div>
            <button className={styles.bigBtn} onClick={e => { e.stopPropagation(); onToast('🛒 Voir les offres'); }}>
              <i className="fas fa-bolt" /> Voir les offres
            </button>
          </div>
          {/* Petites promos */}
          <div className={styles.smGrid}>
            {SMALL.map(s => (
              <div key={s.titre} className={styles.sm} onClick={() => onToast(`${s.ico} ${s.titre}`)}>
                <div className={styles.smIco} style={{ background: s.bg }}>{s.ico}</div>
                <div className={styles.smText}><div className={styles.smTitle}>{s.titre}</div><div className={styles.smSub}>{s.sub}</div></div>
                <div className={styles.smPct} style={{ color: s.color }}>{s.pct}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
