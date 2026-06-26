// src/dashboards/livreur/components/NotifPanel.tsx
import React from 'react';
import { NOTIFS } from '../data/livreurData';
import styles from '../styles/NotifPanel.module.css';

interface Props { isOpen: boolean; onClose: () => void; onPop: (m: string, t?: string) => void; }

export default function NotifPanel({ isOpen, onClose, onPop }: Props) {
  return (
    <div className={`${styles.panel} ${isOpen ? styles.open : ''}`}>
      <div className={styles.hd}>
        <div className={styles.hdTitle}>
          <i className="fas fa-bell" style={{ color:'var(--teal)' }} />
          Notifications
          <span className={styles.badge}>7</span>
        </div>
        <button className={styles.close} onClick={onClose}><i className="fas fa-xmark" /></button>
      </div>
      <div className={styles.list}>
        {NOTIFS.map((n, i) => (
          <div
            key={i}
            className={`${styles.item} ${n.unread ? styles.unread : ''}`}
            onClick={() => onPop('📬 Notification lue', 'i')}
          >
            <div className={styles.ic} style={{ background: n.bg }}>
              <i className={`fas ${n.ic}`} style={{ color: n.c, fontSize: 13 }} />
            </div>
            <div className={styles.body}>
              <div className={styles.msg} dangerouslySetInnerHTML={{ __html: n.msg }} />
              <div className={styles.time}>{n.t}</div>
            </div>
            {n.unread && <div className={styles.dot} />}
          </div>
        ))}
      </div>
    </div>
  );
}