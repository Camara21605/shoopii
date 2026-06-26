import React, { useEffect, useState } from 'react';
import styles from './HeroSection.module.css';

interface Props { onToast: (m: string) => void; onExplore: () => void; onRegister: () => void; }

export default function HeroSection({ onToast, onExplore, onRegister }: Props) {
  const [timer, setTimer] = useState({ h: 8, m: 42, s: 17 });
  useEffect(() => {
    const id = setInterval(() => setTimer(p => {
      let { h, m, s } = p;
      s--; if (s<0){s=59;m--;} if (m<0){m=59;h--;} if (h<0) h=23;
      return { h, m, s };
    }), 1000);
    return () => clearInterval(id);
  }, []);

  const ROLES = [
    { emoji:'🛍️', label:'Client' }, { emoji:'🏪', label:'Entreprise' },
    { emoji:'🛵', label:'Livreur' }, { emoji:'🤝', label:'Partenaire' },
    { emoji:'📍', label:'Correspondant' }, { emoji:'🔑', label:'Administrateur' },
  ];

  return (
    <section className={styles.hero}>
      <div className={styles.atm} /><div className={styles.grid} /><div className={styles.stripe} />
      <div className={styles.inner}>
        {/* Colonne texte */}
        <div className={styles.textCol}>
          <div className={styles.eyebrow}>
            <span className={styles.dot} />
            Marketplace N°1 — Afrique de l'Ouest
          </div>
          <h1 className={styles.h1}>
            La confiance.<br />
            <span className={styles.accent}>La connexion.</span><br />
            <em className={styles.italic}>L'Afrique.</em>
          </h1>
          <p className={styles.sub}>
            Shopi réunit clients, entreprises, livreurs, partenaires, correspondants et
            administrateurs dans un écosystème digital unifié — conçu pour l'Afrique, calibré pour le monde.
          </p>
          <div className={styles.cta}>
            <button className={styles.cta1} onClick={onExplore}>
              <i className="fas fa-compass" /> Explorer les produits
            </button>
            <button className={styles.cta2} onClick={onRegister}>
              <i className="fas fa-store" /> Ouvrir une boutique
            </button>
          </div>
          <div className={styles.roles}>
            {ROLES.map(r => (
              <div key={r.label} className={styles.chip} onClick={() => onToast(`${r.emoji} Espace ${r.label}`)}>
                <span>{r.emoji}</span> {r.label}
              </div>
            ))}
          </div>
        </div>

        {/* Colonne visuelle */}
        <div className={styles.visual}>
          {/* Carte produit flottante */}
          <div className={styles.card}>
            <div className={styles.cardImg}>📱</div>
            <div className={styles.cardTop}>
              <span className={styles.cardShop}>TechStore Conakry</span>
              <span className={styles.cardStars}>★★★★★</span>
            </div>
            <div className={styles.cardName}>iPhone 15 Pro 256GB</div>
            <div className={styles.cardPrice}>12 500 000 GNF</div>
            <div className={styles.cardBtns}>
              <button className={styles.cardCart} onClick={() => onToast('🛒 Ajouté !')}>
                <i className="fas fa-cart-plus" /> Ajouter
              </button>
              <button className={styles.cardFav} onClick={() => onToast('❤️ Favoris')}>
                <i className="far fa-heart" />
              </button>
            </div>
          </div>
          {/* Stats mini */}
          <div className={styles.statsGrid}>
            {[
              { ico:'📦', val:'25K+', lbl:'Produits',  col:'var(--blue)'    },
              { ico:'🛵', val:'640+', lbl:'Livreurs',  col:'var(--emerald)' },
              { ico:'🏪', val:'4K+',  lbl:'Boutiques', col:'var(--navy)'    },
              { ico:'👥', val:'120K+',lbl:'Clients',   col:'var(--violet)'  },
            ].map(s => (
              <div key={s.lbl} className={styles.stat}>
                <div className={styles.statIco}>{s.ico}</div>
                <div><div className={styles.statVal} style={{ color:s.col }}>{s.val}</div><div className={styles.statLbl}>{s.lbl}</div></div>
              </div>
            ))}
          </div>
          {/* Timer flash sale */}
          <div className={styles.flashBanner}>
            <div className={styles.flashLeft}>
              <span className={styles.flashTag}><i className="fas fa-bolt" /> FLASH SALE</span>
              <span className={styles.flashPct}>−40%</span>
              <span className={styles.flashLabel}>Électronique</span>
            </div>
            <div className={styles.flashTimer}>
              {[{v:timer.h,l:'H'},{v:timer.m,l:'M'},{v:timer.s,l:'S'}].map((t,i) => (
                <React.Fragment key={i}>
                  {i>0 && <span className={styles.tsep}>:</span>}
                  <div className={styles.tblk}>
                    <div className={styles.tnum}>{String(t.v).padStart(2,'0')}</div>
                    <div className={styles.tlbl}>{t.l}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
