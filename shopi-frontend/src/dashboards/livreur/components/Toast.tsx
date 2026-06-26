// src/dashboards/livreur/components/Toast.tsx
import React, { useEffect, useState } from 'react';
import styles from '../styles/Toast.module.css';

const ICONS: Record<string, string> = { s:'fa-check-circle', i:'fa-circle-info', w:'fa-triangle-exclamation', e:'fa-circle-xmark' };
const COLORS: Record<string, string> = { s:'#10B981', i:'var(--blue-lt)', w:'var(--amber)', e:'var(--red)' };

interface Props { msg: string; type: string; }

export default function Toast({ msg, type }: Props) {
  const [show, setShow] = useState(false);
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setShow(true))); }, []);
  return (
    <div className={`${styles.tmsg} ${show ? styles.show : ''}`}>
      <i className={`fas ${ICONS[type] ?? 'fa-circle-info'}`} style={{ color: COLORS[type] ?? COLORS.i, fontSize: 14, flexShrink: 0 }} />
      <span dangerouslySetInnerHTML={{ __html: msg }} />
    </div>
  );
}