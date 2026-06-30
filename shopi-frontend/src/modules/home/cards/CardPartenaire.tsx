import { useState } from 'react';
import type { Partenaire } from '../data/mockData';
import styles from './Cards.module.css';

interface Props { p: Partenaire; onToast: (m: string) => void; }

export default function CardPartenaire({ p, onToast }: Props) {
  const [suivi, setSuivi] = useState(false);
  const abonnesK = p.abonnes >= 1000 ? `${(p.abonnes / 1000).toFixed(1)}K` : p.abonnes.toString();

  return (
    <div className={styles.ptCard}>

      {/* ── Bannière ── */}
      <div className={styles.ptBanner} />

      {/* ── Body ── */}
      <div className={styles.ptBody}>

        {/* Icône */}
        <div className={styles.ptIco}>{p.emoji}</div>

        {/* Domaine */}
        <div className={styles.ptDom}>{p.domaine}</div>

        {/* Certification */}
        <div className={styles.ptCert}>
          <i className="fas fa-shield-check" /> {p.cert}
        </div>

        {/* Nom */}
        <div className={styles.ptNm}>{p.nom}</div>

        {/* Description */}
        <div className={styles.ptDs}>{p.desc}</div>

        {/* Abonnés */}
        <div className={styles.ptAbonnes}>
          <i className="fas fa-users" />
          <span><strong>{abonnesK}</strong> abonnés</span>
        </div>

        {/* Boutons */}
        <div className={styles.ptBtns}>
          <button className={styles.ptAcc} onClick={() => onToast(`🤝 ${p.nom}`)}>
            <i className="fas fa-arrow-up-right-from-square" /> En savoir plus
          </button>
          <button
            className={`${styles.ptFlw} ${suivi ? styles.ptFlwOn : ''}`}
            onClick={() => { setSuivi(s => !s); onToast(suivi ? '👋 Désabonné' : `✅ Abonné à ${p.nom}`); }}
          >
            {suivi
              ? <><i className="fas fa-check" /> Abonné</>
              : <><i className="fas fa-plus" /> Suivre ce partenaire</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
