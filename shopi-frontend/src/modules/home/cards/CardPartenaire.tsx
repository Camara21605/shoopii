import React, { useState } from 'react';
import type { Partenaire } from '../../data/mockData';
import styles from './Cards.module.css';

interface Props { p: Partenaire; onToast: (m: string) => void; }

export default function CardPartenaire({ p, onToast }: Props) {
  const [suivi, setSuivi] = useState(false);
  return (
    <div className={styles.ptCard}>
      <div className={styles.ptIco}>{p.emoji}</div>
      <div className={styles.ptDom}>{p.domaine}</div>
      <div className={styles.ptCert}><i className="fas fa-shield-check" /> {p.cert}</div>
      <div className={styles.ptNm}>{p.nom}</div>
      <div className={styles.ptDs}>{p.desc}</div>
      <div className={styles.ptAbonnes}><i className="fas fa-users" /> {(p.abonnes/1000).toFixed(1)}K abonnés</div>
      <div className={styles.ptBtns}>
        <button className={styles.ptAcc} onClick={() => onToast(`🤝 ${p.nom}`)}>En savoir plus</button>
        <button className={`${styles.ptFlw} ${suivi ? styles.ptFlwOn : ''}`}
          onClick={() => { setSuivi(s => !s); onToast(suivi ? '👋 Désabonné' : `✅ Abonné à ${p.nom}`); }}>
          {suivi ? <><i className="fas fa-check" /> Abonné</> : <><i className="fas fa-plus" /> Suivre</>}
        </button>
      </div>
    </div>
  );
}
