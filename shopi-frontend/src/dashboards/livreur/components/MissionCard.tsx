// src/dashboards/livreur/components/MissionCard.tsx
// Carte de mission — reproduit exactement .mc du HTML.

import React from 'react';
import type { Mission } from '../data/livreurData';
import { SPEED_LABEL, fmtGNF } from '../data/livreurData';
import styles from '../styles/MissionCard.module.css';
import shared from '../styles/Shared.module.css';

interface Props {
  mission:  Mission;
  onAccept: (id: string) => void;
  onPop:    (msg: string, type?: string) => void;
}

const SPEED_CLS: Record<string, string> = {
  eco: shared.speedEco,
  std: shared.speedStd,
  exp: shared.speedExp,
  ult: shared.speedUlt,
};

export default function MissionCard({ mission: m, onAccept, onPop }: Props) {
  const badgeLabel = m.urgent ? '🔥 Urgent' : m.status === 'new' ? 'Disponible' : 'En préparation';
  const badgeCls   = m.urgent ? styles.badgeUrgent : m.status === 'new' ? styles.badgeNew : styles.badgePrep;

  return (
    <div
      className={`${styles.mc} ${m.urgent ? styles.urgent : ''}`}
      onClick={() => onPop(`📦 Détails ${m.id}`, 'i')}
    >
      {/* Badge statut */}
      <span className={`${styles.mcBadge} ${badgeCls}`}>{badgeLabel}</span>

      {/* Tête de carte : icône + infos */}
      <div className={styles.mcTop}>
        <div className={styles.mcIcon}>{m.em}</div>
        <div className={styles.mcBody}>
          <div className={styles.mcId}>{m.id} · {m.date}</div>
          <div className={styles.mcNm}>{m.nm}</div>
          <div className={styles.mcShop}>
            <i className="fas fa-store" /> {m.shop} · {m.client}
          </div>
        </div>
      </div>

      {/* Route */}
      <div className={styles.mcRoute}>
        <div className={`${styles.mcDot} ${styles.dotFr}`} />
        <div className={styles.mcPlace}>{m.from}</div>
        <div className={styles.mcLine} />
        <i className="fas fa-chevron-right" style={{ color:'var(--t4)', fontSize:9, flexShrink:0 }} />
        <div className={styles.mcPlace}>{m.to}</div>
        <div className={`${styles.mcDot} ${styles.dotTo}`} />
        <div className={styles.mcDist}>{m.dist}</div>
      </div>

      {/* Meta */}
      <div className={styles.mcMeta}>
        <div className={styles.mcMetaItem}>
          <i className="fas fa-route" style={{ color:'var(--t4)' }} /> {m.dist}
        </div>
        <div className={styles.mcMetaItem}>
          <span className={`${shared.speedBadge} ${SPEED_CLS[m.speed]}`}>
            {SPEED_LABEL[m.speed]}
          </span>
        </div>
        {m.urgent && (
          <div className={styles.mcMetaItem} style={{ color:'var(--red)' }}>
            <i className="fas fa-fire" /> Mission urgente
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.mcActions}>
        {(m.status === 'new' || m.status === 'prep') && (
          <button
            className={styles.btnAccept}
            onClick={e => { e.stopPropagation(); onAccept(m.id); }}
          >
            <i className="fas fa-check" /> {m.status === 'prep' ? 'Voir la commande' : 'Accepter'}
          </button>
        )}
        <button
          className={styles.btnMap}
          onClick={e => { e.stopPropagation(); onPop(`🗺️ Itinéraire ${m.id}`, 'i'); }}
        >
          <i className="fas fa-map-location-dot" /> Carte
        </button>
        {m.status === 'new' && (
          <button
            className={styles.btnX}
            onClick={e => { e.stopPropagation(); onPop('✕ Mission refusée', 'w'); }}
          >
            <i className="fas fa-xmark" />
          </button>
        )}
        <div className={styles.mcFee}>{fmtGNF(m.fee)}</div>
      </div>
    </div>
  );
}